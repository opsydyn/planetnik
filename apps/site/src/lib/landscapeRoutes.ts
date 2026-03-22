import { getContributorRouteParam } from "./contributors"
import { route } from "./route"

function encodeRouteSegment(value: string): string {
  return encodeURIComponent(value).replace(/%/g, "$")
}

function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\$/g, "%"))
  } catch {
    return value
  }
}

export function getLandscapeRepoRouteParam(repoKey: string): string {
  return encodeRouteSegment(repoKey)
}

export function getLandscapeRepoKeyFromParam(param: string): string {
  return decodeRouteSegment(param)
}

export function getLandscapeRepositoryHref(repoKey: string): string {
  return route(`/landscape/repositories/${getLandscapeRepoRouteParam(repoKey)}`)
}

export function getLandscapeRepositoryPageHref(repoKey: string, suffix = ""): string {
  const base = getLandscapeRepositoryHref(repoKey)
  if (!suffix || suffix === "/") return base
  return `${base}${suffix.startsWith("/") ? suffix : `/${suffix}`}`
}

export function getLandscapeContributorHref(email: string): string {
  return route(`/landscape/contributors/${getContributorRouteParam(email)}`)
}

export function getLandscapeRepositoryContributorHref(repoKey: string, email: string): string {
  return `${getLandscapeRepositoryHref(repoKey)}/contributors/${getContributorRouteParam(email)}`
}

export function getLandscapeRepositoryContributorsHref(repoKey: string): string {
  return `${getLandscapeRepositoryHref(repoKey)}/contributors`
}

export function getLandscapeRepositoryMetricsHref(repoKey: string): string {
  return getLandscapeRepositoryPageHref(repoKey, "/metrics")
}

export function getLandscapeRepositoryCommitsHref(repoKey: string): string {
  return getLandscapeRepositoryPageHref(repoKey, "/commits")
}

export function getLandscapeRepositoryComponentsHref(repoKey: string): string {
  return getLandscapeRepositoryPageHref(repoKey, "/components")
}

export function getLandscapeRepositoryDuplicationHref(repoKey: string): string {
  return getLandscapeRepositoryPageHref(repoKey, "/duplication")
}

export function getLandscapeRepositoryCouplingHref(repoKey: string): string {
  return getLandscapeRepositoryPageHref(repoKey, "/coupling")
}

export function getLandscapeRepositoryDependenciesHref(repoKey: string): string {
  return getLandscapeRepositoryPageHref(repoKey, "/dependencies")
}

export function getLandscapeRepositoryHotspotsHref(repoKey: string): string {
  return getLandscapeRepositoryPageHref(repoKey, "/hotspots")
}

export function getLandscapeRepositoryImpactHref(repoKey: string): string {
  return getLandscapeRepositoryPageHref(repoKey, "/impact")
}

export function getLandscapeRepositoryControlsHref(repoKey: string): string {
  return getLandscapeRepositoryPageHref(repoKey, "/controls")
}

export function getLandscapeRepositoryFilePageHref(
  repoKey: string,
  page: "size" | "age" | "churn" | "temporal",
): string {
  return getLandscapeRepositoryPageHref(repoKey, `/files/${page}`)
}

export function getLandscapeRepositoryUnitPageHref(
  repoKey: string,
  page: "size" | "complexity",
): string {
  return getLandscapeRepositoryPageHref(repoKey, `/units/${page}`)
}

export function mapLandscapeRepositoryRoute(repoKey: string, href: string | null | undefined): string {
  if (!href) return getLandscapeRepositoryHref(repoKey)

  const directMappings: Record<string, string> = {
    "/": getLandscapeRepositoryHref(repoKey),
    "/metrics": getLandscapeRepositoryMetricsHref(repoKey),
    "/commits": getLandscapeRepositoryCommitsHref(repoKey),
    "/components": getLandscapeRepositoryComponentsHref(repoKey),
    "/duplication": getLandscapeRepositoryDuplicationHref(repoKey),
    "/coupling": getLandscapeRepositoryCouplingHref(repoKey),
    "/dependencies": getLandscapeRepositoryDependenciesHref(repoKey),
    "/hotspots": getLandscapeRepositoryHotspotsHref(repoKey),
    "/impact": getLandscapeRepositoryImpactHref(repoKey),
    "/controls": getLandscapeRepositoryControlsHref(repoKey),
    "/files/size": getLandscapeRepositoryFilePageHref(repoKey, "size"),
    "/files/age": getLandscapeRepositoryFilePageHref(repoKey, "age"),
    "/files/churn": getLandscapeRepositoryFilePageHref(repoKey, "churn"),
    "/files/temporal": getLandscapeRepositoryFilePageHref(repoKey, "temporal"),
    "/units/size": getLandscapeRepositoryUnitPageHref(repoKey, "size"),
    "/units/complexity": getLandscapeRepositoryUnitPageHref(repoKey, "complexity"),
    "/contributors": getLandscapeRepositoryPageHref(repoKey, "/contributors"),
    "/topology": getLandscapeRepositoryPageHref(repoKey, "/topology"),
  }

  return directMappings[href] ?? href
}
