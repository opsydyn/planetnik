import { describe, expect, test } from "bun:test"

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
