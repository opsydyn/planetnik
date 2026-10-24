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

function getHostedReportRepoRouteParam(repoKey: string): string {
  return encodeRouteSegment(repoKey)
}

export function getHostedReportRepoKeyFromParam(param: string): string {
  return decodeRouteSegment(param)
}

export function getHostedReportContributorRouteParam(email: string): string {
  return encodeRouteSegment(email)
}

export function getHostedReportContributorEmailFromParam(param: string): string {
  return decodeRouteSegment(param)
}

export function getHostedReportRepositoriesHref(slug: string): string {
  return `/reports/${slug}/repositories`
}

export function getHostedReportRepositoryHref(slug: string, repoKey: string): string {
  return `${getHostedReportRepositoriesHref(slug)}/${getHostedReportRepoRouteParam(repoKey)}`
}

export function getHostedReportRepositoryPageHref(slug: string, repoKey: string, suffix = ""): string {
  const base = getHostedReportRepositoryHref(slug, repoKey)
  if (!suffix || suffix === "/") return base
  return `${base}${suffix.startsWith("/") ? suffix : `/${suffix}`}`
}

export function getHostedReportRepositoryContributorHref(slug: string, repoKey: string, email: string): string {
  return `${getHostedReportRepositoryPageHref(slug, repoKey, "/contributors")}/${getHostedReportContributorRouteParam(email)}`
}
