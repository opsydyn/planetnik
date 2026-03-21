type ReloadRouteMatcher = string | RegExp

const reloadRouteMatchers: ReloadRouteMatcher[] = [
  "/topology",
  "/files/temporal",
  "/landscape/topology",
  /^\/landscape\/repositories\/[^/]+\/topology$/,
  /^\/landscape\/repositories\/[^/]+\/files\/temporal$/,
]

function normalizeRoute(route: string): string {
  const [path] = route.split(/[?#]/, 1)
  if (!path || path === "") return "/"
  return path !== "/" ? path.replace(/\/+$/, "") : path
}

export function shouldBypassClientRouter(route: string): boolean {
  const normalizedRoute = normalizeRoute(route)

  return reloadRouteMatchers.some((matcher) =>
    typeof matcher === "string" ? matcher === normalizedRoute : matcher.test(normalizedRoute),
  )
}
