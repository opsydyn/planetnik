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

const isSecurePrefixedCookie = (name: string): boolean => name.startsWith("__Secure-") || name.startsWith("__Host-")

const isHostPrefixedCookie = (name: string): boolean => name.startsWith("__Host-")

const appendExpiredCookie = (
  headers: Headers,
  name: string,
  secure: boolean,
  sameSite: string,
  domain?: string,
): void => {
  const parts = [`${name}=`, "Max-Age=0", "Path=/", "HttpOnly", `SameSite=${sameSite}`]
  if (secure) {
    parts.push("Secure")
  }
  if (domain) {
    parts.push(`Domain=${domain}`)
  }
  headers.append("set-cookie", parts.join("; "))
}

export const appendExpiredAuthCookies = (
  headers: Headers,
  {
    sameSite,
    domain,
  }: {
    readonly sameSite: string
    readonly domain?: string
  },
): void => {
  for (const name of CLEAR_AUTH_COOKIE_NAMES) {
    if (isHostPrefixedCookie(name)) {
      appendExpiredCookie(headers, name, true, sameSite)
      continue
    }

    if (isSecurePrefixedCookie(name)) {
      appendExpiredCookie(headers, name, true, sameSite)
      if (domain) {
        appendExpiredCookie(headers, name, true, sameSite, domain)
      }
      continue
    }

    appendExpiredCookie(headers, name, false, sameSite)
    appendExpiredCookie(headers, name, true, sameSite)
    if (!domain) {
      continue
    }

    appendExpiredCookie(headers, name, false, sameSite, domain)
    appendExpiredCookie(headers, name, true, sameSite, domain)
  }
}
