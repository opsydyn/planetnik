import type { APIRoute } from "astro"
import { SERVER_BASE_URL } from "../lib/constants.js"

const SIGN_IN_PATH = "/sign-in" as const
const REDIRECT_STATUS = 302 as const
const CLEAR_AUTH_COOKIE_NAMES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "better-auth.dont_remember",
  "better-auth.account_data",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
  "__Secure-better-auth.dont_remember",
  "__Secure-better-auth.account_data",
  "__Host-better-auth.session_token",
  "__Host-better-auth.session_data",
  "__Host-better-auth.dont_remember",
  "__Host-better-auth.account_data",
] as const

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[]
}

const isSecurePrefixedCookie = (name: string): boolean => name.startsWith("__Secure-") || name.startsWith("__Host-")

const isHostPrefixedCookie = (name: string): boolean => name.startsWith("__Host-")

function readSetCookieHeaders(headers: Headers): string[] {
  const cookies = (headers as HeadersWithSetCookie).getSetCookie?.().filter(Boolean) ?? []

  if (cookies.length > 0) {
    return cookies
  }

  const single = headers.get("set-cookie")
  return single ? [single] : []
}

function appendExpiredCookie(headers: Headers, name: string, secure: boolean): void {
  const parts = [`${name}=`, "Max-Age=0", "Path=/", "HttpOnly", "SameSite=Lax"]
  if (secure) {
    parts.push("Secure")
  }
  headers.append("set-cookie", parts.join("; "))
}

function appendExpiredCookieVariants(headers: Headers, name: string): void {
  if (isHostPrefixedCookie(name)) {
    appendExpiredCookie(headers, name, true)
    return
  }

  if (isSecurePrefixedCookie(name)) {
    appendExpiredCookie(headers, name, true)
    return
  }

  appendExpiredCookie(headers, name, false)
  appendExpiredCookie(headers, name, true)
}

export const GET: APIRoute = async ({ request }) => {
  const cookie = request.headers.get("cookie")
  const response = await fetch(`${SERVER_BASE_URL}/api/auth/sign-out`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({}),
    redirect: "manual",
  })

  const headers = new Headers({
    location: SIGN_IN_PATH,
    "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    pragma: "no-cache",
    expires: "0",
  })

  for (const value of readSetCookieHeaders(response.headers)) {
    headers.append("set-cookie", value)
  }

  for (const name of CLEAR_AUTH_COOKIE_NAMES) {
    appendExpiredCookieVariants(headers, name)
  }

  return new Response(null, {
    status: REDIRECT_STATUS,
    headers,
  })
}
