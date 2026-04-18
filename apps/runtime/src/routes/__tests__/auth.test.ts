import { describe, expect, mock, test } from "bun:test"

process.env.NODE_ENV ??= "test"
process.env.PORT ??= "1337"
process.env.CORS_ORIGIN ??= "http://localhost:4321"
process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/planetnik?sslmode=disable"
process.env.BETTER_AUTH_SECRET ??= "test-secret-with-at-least-32-characters"
process.env.BETTER_AUTH_URL ??= "http://localhost:1337"
process.env.AUTH_COOKIE_SECURE ??= "false"
process.env.AUTH_COOKIE_SAME_SITE ??= "lax"

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[]
}

const readSetCookieHeaders = (headers: Headers): string[] => (headers as HeadersWithSetCookie).getSetCookie?.() ?? []

describe("runtime auth sign-out cookie cleanup", () => {
  test("expires prefixed cookies using only valid attribute combinations", async () => {
    const { appendExpiredAuthCookies } = await import("../auth/cookies.js")
    const headers = new Headers()

    appendExpiredAuthCookies(headers, {
      sameSite: "lax",
      domain: ".example.com",
    })

    const setCookies = readSetCookieHeaders(headers)

    expect(setCookies.some((value) => value.startsWith("better-auth.session_token="))).toBe(true)
    expect(setCookies.filter((value) => value.startsWith("__Secure-")).every((value) => value.includes("Secure"))).toBe(
      true,
    )
    expect(
      setCookies
        .filter((value) => value.startsWith("__Host-"))
        .every((value) => value.includes("Secure") && !value.includes("Domain=")),
    ).toBe(true)
    expect(
      setCookies.some(
        (value) => value.startsWith("__Secure-better-auth.session_token=") && value.includes("Domain=.example.com"),
      ),
    ).toBe(true)
  })
})

describe("runtime auth sign-out fallback session cleanup", () => {
  test("deletes the backing session row when the current session can be resolved", async () => {
    const { cleanupFallbackSignOutSession } = await import("../auth/fallback-sign-out.js")
    const getSession = mock(async () => ({
      session: {
        token: "session-token-123",
      },
    }))
    const deleteSessionByToken = mock(async () => undefined)

    const deleted = await cleanupFallbackSignOutSession(
      new Request("http://localhost:1337/api/auth/sign-out", {
        method: "POST",
        headers: {
          cookie: "better-auth.session_token=signed-cookie",
        },
      }),
      {
        getSession,
        deleteSessionByToken,
      },
    )

    expect(deleted).toBe(true)
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(deleteSessionByToken).toHaveBeenCalledWith("session-token-123")
  })

  test("returns false without deleting anything when the current session cannot be resolved", async () => {
    const { cleanupFallbackSignOutSession } = await import("../auth/fallback-sign-out.js")
    const getSession = mock(async () => null)
    const deleteSessionByToken = mock(async () => undefined)

    const deleted = await cleanupFallbackSignOutSession(
      new Request("http://localhost:1337/api/auth/sign-out", {
        method: "POST",
      }),
      {
        getSession,
        deleteSessionByToken,
      },
    )

    expect(deleted).toBe(false)
    expect(deleteSessionByToken).not.toHaveBeenCalled()
  })

  test("swallows session lookup failures and logs them so cookie fallback can still proceed", async () => {
    const { cleanupFallbackSignOutSession } = await import("../auth/fallback-sign-out.js")
    const lookupError = new Error("lookup failed")
    const getSession = mock(async () => {
      throw lookupError
    })
    const deleteSessionByToken = mock(async () => undefined)
    const logError = mock(() => undefined)

    const deleted = await cleanupFallbackSignOutSession(
      new Request("http://localhost:1337/api/auth/sign-out", {
        method: "POST",
      }),
      {
        getSession,
        deleteSessionByToken,
        logError,
      },
    )

    expect(deleted).toBe(false)
    expect(deleteSessionByToken).not.toHaveBeenCalled()
    expect(logError).toHaveBeenCalledWith(
      "Auth sign-out fallback could not delete session from database",
      lookupError,
    )
  })
})
