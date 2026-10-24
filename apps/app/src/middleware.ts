import { defineMiddleware } from "astro:middleware"
import { resolveRouteAccess } from "./lib/access-control.js"
import { resolveSession } from "./lib/session.js"

function isBypassedPath(pathname: string): boolean {
  return pathname.startsWith("/_astro/") || pathname === "/sign-out" || pathname === "/favicon.svg"
}

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname

  if (isBypassedPath(path)) {
    return next()
  }

  const { user, session } = await resolveSession(context.request)
  context.locals.user = user
  context.locals.session = session

  const access = resolveRouteAccess({ pathname: path, user })
  if (access.kind === "redirect") {
    return context.redirect(access.location)
  }

  return next()
})
