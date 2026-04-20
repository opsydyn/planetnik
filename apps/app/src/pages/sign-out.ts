import type { APIRoute } from "astro"
import { signOutRuntimeAuthSession } from "../lib/runtime-client.js"

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

const SAME_SITE_LAX = "SameSite=Lax" as const
const SAME_SITE_NONE = "SameSite=None" as const

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

const isHostPrefixedCookie = (name: string): boolean => name.startsWith("__Host-")

const isSecurePrefixedCookie = (name: string): boolean => name.startsWith("__Secure-") || isHostPrefixedCookie(name)

function buildExpiredCookieHeader(name: string, secure: boolean, sameSite: string, domain?: string): string {
  const parts = [`${name}=`, `Expires=${EXPIRED_COOKIE_DATE}`, "Max-Age=0", "Path=/", "HttpOnly", sameSite]

  if (secure) {
    parts.push("Secure")
  }

  if (domain) {
    parts.push(`Domain=${domain}`)
  }

  return parts.join("; ")
}

function fallbackCookieHeaders(hostname: string): string[] {
  const parentDomain = deriveParentDomain(hostname)

  return CLEAR_AUTH_COOKIE_NAMES.flatMap((name) => {
    if (isHostPrefixedCookie(name)) {
      return [buildExpiredCookieHeader(name, true, SAME_SITE_NONE)]
    }

    if (isSecurePrefixedCookie(name)) {
      return [
        buildExpiredCookieHeader(name, true, SAME_SITE_NONE),
        ...(parentDomain ? [buildExpiredCookieHeader(name, true, SAME_SITE_NONE, parentDomain)] : []),
      ]
    }

    return [
      buildExpiredCookieHeader(name, false, SAME_SITE_LAX),
      buildExpiredCookieHeader(name, true, SAME_SITE_NONE),
      ...(parentDomain
        ? [
            buildExpiredCookieHeader(name, false, SAME_SITE_LAX, parentDomain),
            buildExpiredCookieHeader(name, true, SAME_SITE_NONE, parentDomain),
          ]
        : []),
    ]
  })
}

export const GET: APIRoute = async ({ request }) => {
  const cookie = request.headers.get("cookie")
  const hostname = new URL(request.url).hostname
  const forcedClearCookies = fallbackCookieHeaders(hostname)

  try {
    const forwardedCookies = await signOutRuntimeAuthSession(cookie)
    return redirectToSignIn([...forwardedCookies, ...forcedClearCookies])
  } catch {
    return redirectToSignIn(forcedClearCookies)
  }
}
