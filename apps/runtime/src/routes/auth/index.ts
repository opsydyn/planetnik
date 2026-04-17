import { Elysia } from "elysia"
import { appConfig } from "../../config.js"
import { auth } from "../../lib/auth.js"
import { appendExpiredAuthCookies } from "./cookies.js"

const HTTP_STATUS_METHOD_NOT_ALLOWED = 405 as const
const HTTP_STATUS_OK = 200 as const
const SIGN_OUT_PATH = "/api/auth/sign-out" as const

const isSignOutRequest = (request: Request): boolean => {
  try {
    return new URL(request.url).pathname === SIGN_OUT_PATH
  } catch {
    return request.url.endsWith(SIGN_OUT_PATH)
  }
}

const signOutFallbackResponse = (): Response => {
  const headers = new Headers({
    "content-type": "application/json",
  })

  appendExpiredAuthCookies(headers, {
    sameSite: appConfig.authCookies.sameSite,
    ...(appConfig.cookieDomain ? { domain: appConfig.cookieDomain } : {}),
  })

  return new Response(
    JSON.stringify({
      success: true,
      fallback: true,
    }),
    {
      status: HTTP_STATUS_OK,
      headers,
    },
  )
}

export const authRoutes = new Elysia({ name: "auth" }).all(
  "/api/auth/*",
  async ({ request }) => {
    if (["POST", "GET"].includes(request.method)) {
      try {
        return await auth.handler(request)
      } catch (error) {
        if (request.method === "POST" && isSignOutRequest(request)) {
          console.error("Auth sign-out failed, applying cookie-expire fallback", error)
          return signOutFallbackResponse()
        }
        throw error
      }
    }

    return new Response(null, { status: HTTP_STATUS_METHOD_NOT_ALLOWED })
  },
  {
    parse: "none",
  },
)
