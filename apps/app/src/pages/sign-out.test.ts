import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GET } from "./sign-out"

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[]
}

function readSetCookieHeaders(headers: Headers): string[] {
  return (headers as HeadersWithSetCookie).getSetCookie?.() ?? []
}

describe("GET /sign-out", () => {
  const originalFetch = globalThis.fetch
  let fetchMock = mock(async () => new Response(null, { status: 200 }))

  beforeEach(() => {
    fetchMock = mock(async () => new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("redirects to sign-in and expires auth cookies even when upstream sends no cookie headers", async () => {
    const response = await GET({
      request: new Request("http://localhost:4321/sign-out", {
        headers: {
          cookie: "better-auth.session_token=abc",
        },
      }),
    } as never)

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/sign-in")
    expect(response.headers.get("clear-site-data")).toBe('"cookies"')

    const setCookies = readSetCookieHeaders(response.headers)
    expect(setCookies.some((value) => value.startsWith("better-auth.session_token="))).toBe(true)
    expect(setCookies.some((value) => value.startsWith("better-auth.session_data="))).toBe(true)
    expect(setCookies.every((value) => value.includes("Max-Age=0"))).toBe(true)
    expect(setCookies.every((value) => value.includes("Expires=Thu, 01 Jan 1970 00:00:00 GMT"))).toBe(true)
    expect(setCookies.every((value) => value.includes("SameSite=None"))).toBe(true)
  })

  test("adds parent-domain cookie clearing variants for hosted subdomains", async () => {
    const response = await GET({
      request: new Request("https://planetnik-app.orangeisland-647673db.uksouth.azurecontainerapps.io/sign-out", {
        headers: {
          cookie: "better-auth.session_token=abc",
        },
      }),
    } as never)

    const setCookies = readSetCookieHeaders(response.headers)
    expect(
      setCookies.some(
        (value) =>
          value.includes("better-auth.session_token=") &&
          value.includes("Domain=.orangeisland-647673db.uksouth.azurecontainerapps.io"),
      ),
    ).toBe(true)
    expect(setCookies.some((value) => value.includes("Secure"))).toBe(true)
  })

  test("still redirects to sign-in and clears cookies when upstream sign-out fails", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new Error("network broke")
    })

    const response = await GET({
      request: new Request("https://planetnik-app.orangeisland-647673db.uksouth.azurecontainerapps.io/sign-out", {
        headers: {
          cookie: "better-auth.session_token=abc",
        },
      }),
    } as never)

    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toBe("/sign-in")

    const setCookies = readSetCookieHeaders(response.headers)
    expect(setCookies.length).toBeGreaterThan(0)
    expect(
      setCookies.some(
        (value) =>
          value.includes("better-auth.session_token=") &&
          value.includes("Domain=.orangeisland-647673db.uksouth.azurecontainerapps.io"),
      ),
    ).toBe(true)
  })
})
