import { eq } from "drizzle-orm"
import { Elysia } from "elysia"
import { appConfig } from "../../config.js"
import { db } from "../../db/index.js"
import { session } from "../../db/schema/auth.js"
import { auth } from "../../lib/auth.js"
import { appendExpiredAuthCookies } from "./cookies.js"
import { cleanupFallbackSignOutSession } from "./fallback-sign-out.js"

const HTTP_STATUS_METHOD_NOT_ALLOWED = 405 as const
const HTTP_STATUS_OK = 200 as const
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500 as const
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

const getResponseLogPayload = async (response: Response) => {
  const headers = Object.fromEntries(response.headers.entries())

  try {
    const body = (await response.clone().text()).trim()

    return body.length > 0 ? { headers, body } : { headers }
  } catch (error) {
    return {
      headers,
      bodyReadError: error instanceof Error ? error.message : String(error),
    }
  }
}

const logServerErrorResponse = async (request: Request, response: Response) => {
  if (response.status < HTTP_STATUS_INTERNAL_SERVER_ERROR) {
    return
  }

  console.error(
    `[auth] handler returned ${response.status}: ${request.method} ${request.url}`,
    await getResponseLogPayload(response),
  )
}

const logAuthRequest = (request: Request) => {
  console.info(`[auth] request ${request.method} ${request.url}`)
}

const logAuthResponse = (request: Request, response: Response) => {
  console.info(`[auth] response ${response.status} ${request.method} ${request.url}`)
}

export const authRoutes = new Elysia({ name: "auth" }).all(
  "/api/auth/*",
  async ({ request }) => {
    if (["POST", "GET"].includes(request.method)) {
      logAuthRequest(request)

      try {
        const response = await auth.handler(request)

        logAuthResponse(request, response)
        await logServerErrorResponse(request, response)

        return response
      } catch (error) {
        if (request.method === "POST" && isSignOutRequest(request)) {
          console.error("Auth sign-out failed, applying cookie-expire fallback", error)

          await cleanupFallbackSignOutSession(request, {
            getSession: ({ headers }) => auth.api.getSession({ headers }),
            deleteSessionByToken: async (token) => {
              await db.delete(session).where(eq(session.token, token))
            },
            logError: (message, cause) => {
              console.error(message, cause)
            },
          })

          return signOutFallbackResponse()
        }
        console.error(`[auth] handler failed: ${request.method} ${request.url}`, error)
        throw error
      }
    }

    return new Response(null, { status: HTTP_STATUS_METHOD_NOT_ALLOWED })
  },
  {
    parse: "none",
  },
)
