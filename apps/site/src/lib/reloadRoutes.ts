const reloadRoutes = new Set(["/topology", "/files/temporal"])

export function shouldBypassClientRouter(route: string): boolean {
  return reloadRoutes.has(route)
}
