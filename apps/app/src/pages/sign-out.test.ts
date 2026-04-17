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

  beforeEach(() => {
    const fetchMock = mock(async () => new Response(null, { status: 200 }))
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

    const setCookies = readSetCookieHeaders(response.headers)
    expect(setCookies.some((value) => value.startsWith("better-auth.session_token="))).toBe(true)
    expect(setCookies.some((value) => value.startsWith("better-auth.session_data="))).toBe(true)
    expect(setCookies.every((value) => value.includes("Max-Age=0"))).toBe(true)
    expect(setCookies.filter((value) => value.startsWith("__Secure-")).every((value) => value.includes("Secure"))).toBe(
      true,
    )
    expect(
      setCookies
        .filter((value) => value.startsWith("__Host-"))
        .every((value) => value.includes("Secure") && !value.includes("Domain=")),
    ).toBe(true)
  })
})
