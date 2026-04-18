import type { APIRoute } from "astro"
import { SERVER_BASE_URL } from "../lib/constants.js"

const AUTH_SIGN_OUT_PATH = "/api/auth/sign-out" as const
const SIGN_IN_PATH = "/sign-in" as const
const REDIRECT_STATUS = 302 as const
const EXPIRED_COOKIE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT" as const
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

function readSetCookieHeaders(headers: Headers): string[] {
  const cookies = (headers as HeadersWithSetCookie).getSetCookie?.().filter(Boolean) ?? []

  if (cookies.length > 0) {
    return cookies
  }

  const single = headers.get("set-cookie")
  return single ? [single] : []
}

const redirectToSignIn = (setCookies: string[] = []): Response => {
  const headers = new Headers({
    location: SIGN_IN_PATH,
    "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    pragma: "no-cache",
    expires: "0",
    "clear-site-data": '"cookies"',
  })

  for (const value of setCookies) {
    headers.append("set-cookie", value)
  }

  return new Response(null, {
    status: REDIRECT_STATUS,
    headers,
  })
}

function deriveParentDomain(hostname: string): string | undefined {
  if (hostname === "localhost" || hostname.includes(":")) {
    return undefined
  }

  const labels = hostname.split(".").filter((label) => label.length > 0)
  if (labels.length < 3) {
    return undefined
  }

  return `.${labels.slice(1).join(".")}`
}

function fallbackCookieHeaders(hostname: string): string[] {
  const parentDomain = deriveParentDomain(hostname)
  const sameSiteNone = "SameSite=None"
  const baseFlags = `Expires=${EXPIRED_COOKIE_DATE}; Max-Age=0; Path=/; HttpOnly`

  return CLEAR_AUTH_COOKIE_NAMES.flatMap((name) => {
    const hostOnly = `${name}=; ${baseFlags}; ${sameSiteNone}`
    const hostOnlySecure = `${name}=; ${baseFlags}; Secure; ${sameSiteNone}`
    const domainVariants = parentDomain
      ? [
          `${name}=; ${baseFlags}; Domain=${parentDomain}; ${sameSiteNone}`,
          `${name}=; ${baseFlags}; Domain=${parentDomain}; Secure; ${sameSiteNone}`,
        ]
      : []

    return [hostOnly, hostOnlySecure, ...domainVariants]
  })
}

export const GET: APIRoute = async ({ request }) => {
  const cookie = request.headers.get("cookie")
  const hostname = new URL(request.url).hostname
  const forcedClearCookies = fallbackCookieHeaders(hostname)

  try {
    const response = await fetch(`${SERVER_BASE_URL}${AUTH_SIGN_OUT_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({}),
    })

    const forwardedCookies = readSetCookieHeaders(response.headers)
    return redirectToSignIn([...forwardedCookies, ...forcedClearCookies])
  } catch {
    return redirectToSignIn(forcedClearCookies)
  }
}
