import type { DependabotAlert } from "./DependabotClient.js"
import type { VulnerabilityEnrichment } from "./VulnerabilityEnrichmentClient.js"

export interface SeverityCounts {
  critical: number
  high: number
  medium: number
  low: number
}

export interface RepositoryDependencyHealth {
  owner: string
  repo: string
  totalAlerts: number
  openAlerts: number
  fixedAlerts: number
  severityCounts: SeverityCounts
  meanTimeToResolveDays: number | null
  oldestOpenAlertDays: number | null
}

export interface SharedVulnerablePackage {
  ecosystem: string
  name: string
  severity: string
  affectedRepos: string[]
}

export interface LandscapeDependencyHealth {
  totalRepos: number
  reposWithAlerts: number
  totalAlerts: number
  totalOpenAlerts: number
  severityCounts: SeverityCounts
  meanTimeToResolveDays: number | null
  supplyChainExposureScore: number
  sharedVulnerablePackages: SharedVulnerablePackage[]
  repoHealth: RepositoryDependencyHealth[]
  enrichmentSummary: VulnerabilityEnrichmentSummary
  topActionableVulnerabilities: TopActionableVulnerability[]
}

export interface VulnerabilityEnrichmentSummary {
  enrichedAt: string | null
  latestAlertOpenedAt: string | null
  latestAdvisoryPublishedAt: string | null
  uniqueCveCount: number
  epssCoverageCount: number
  knownExploitedCount: number
  epssAvailable: boolean
  kevAvailable: boolean
}

export interface TopActionableVulnerability {
  repo: string
  package: string
  ecosystem: string
  manifestPath: string
  advisoryId: string
  cveId: string | null
  ghsaId: string
  severity: string
  summary: string
  state: string
  openedAt: string
  publishedAt: string | null
  ageDays: number
  sharedRepoCount: number
  vulnerableVersionRange: string
  firstPatchedVersion: string | null
  recommendedAction: string
  epssScore: number | null
  epssPercentile: number | null
  knownExploited: boolean
  priorityScore: number
}

const severityWeights = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const

function normalizeSeverity(value: string | null | undefined) {
  const normalized = String(value ?? "").toLowerCase()
  return normalized in severityWeights ? (normalized as keyof typeof severityWeights) : "low"
}

function daysSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)))
}

function maxIsoDate(values: Array<string | null | undefined>) {
  let latest: number | null = null
  for (const value of values) {
    if (!value) continue
    const time = new Date(value).getTime()
    if (Number.isNaN(time)) continue
    latest = latest === null ? time : Math.max(latest, time)
  }
  return latest === null ? null : new Date(latest).toISOString()
}

function getPackageRepoCounts(alertsByRepo: Map<string, DependabotAlert[]>) {
  const packageRepos = new Map<string, Set<string>>()
  for (const [repo, alerts] of alertsByRepo) {
    for (const alert of alerts) {
      const key = `${alert.dependency.package.ecosystem}:${alert.dependency.package.name}`.toLowerCase()
      const repos = packageRepos.get(key) ?? new Set<string>()
      repos.add(repo)
      packageRepos.set(key, repos)
    }
  }
  return packageRepos
}

function getRecommendedAction({
  state,
  patchedVersion,
  vulnerableRange,
  knownExploited,
  epssPercentile,
}: {
  state: string
  patchedVersion: string | null
  vulnerableRange: string
  knownExploited: boolean
  epssPercentile: number | null
}) {
  if (state !== "open") {
    return state === "fixed" ? (patchedVersion ? `Patched in ${patchedVersion}` : "Fixed") : "Review dismissal"
  }

  if (knownExploited && patchedVersion) return `Patch immediately to ${patchedVersion}`
  if (knownExploited) return "Investigate urgently — known exploited"
  if (epssPercentile !== null && epssPercentile >= 0.95 && patchedVersion) {
    return `Prioritize upgrade to ${patchedVersion}`
  }
  if (patchedVersion) return `Upgrade to ${patchedVersion}`
  if (vulnerableRange) return `Review range ${vulnerableRange}`
  return "Review advisory"
}

function getPriorityScore({
  severity,
  ageDays,
  sharedRepoCount,
  hasPatch,
  knownExploited,
  epssPercentile,
}: {
  severity: keyof typeof severityWeights
  ageDays: number
  sharedRepoCount: number
  hasPatch: boolean
  knownExploited: boolean
  epssPercentile: number | null
}) {
  const severityScore = severityWeights[severity] * 100
  const patchScore = hasPatch ? 40 : 10
  const spreadScore = Math.min(sharedRepoCount, 10) * 10
  const ageScore = Math.min(ageDays, 365)
  const kevScore = knownExploited ? 300 : 0
  const epssScore = epssPercentile === null ? 0 : Math.round(Math.min(epssPercentile, 1) * 100)
  return severityScore + patchScore + spreadScore + ageScore + kevScore + epssScore
}

function buildTopActionableVulnerabilities(
  alertsByRepo: Map<string, DependabotAlert[]>,
  enrichment?: VulnerabilityEnrichment,
) {
  const packageRepoCounts = getPackageRepoCounts(alertsByRepo)

  return Array.from(alertsByRepo.entries())
    .flatMap(([repo, alerts]) =>
      alerts
        .filter((alert) => alert.state === "open")
        .map((alert) => {
          const severity = normalizeSeverity(alert.security_advisory.severity ?? alert.security_vulnerability.severity)
          const cveId = alert.security_advisory.cve_id
          const epss = cveId ? enrichment?.epssByCve.get(cveId) : undefined
          const knownExploited = cveId ? (enrichment?.knownExploitedCves.has(cveId) ?? false) : false
          const firstPatchedVersion = alert.security_vulnerability.first_patched_version?.identifier ?? null
          const vulnerableVersionRange = alert.security_vulnerability.vulnerable_version_range
          const sharedRepoCount =
            packageRepoCounts.get(
              `${alert.dependency.package.ecosystem}:${alert.dependency.package.name}`.toLowerCase(),
            )?.size ?? 1
          const ageDays = daysSince(alert.created_at)
          return {
            repo,
            package: alert.dependency.package.name,
            ecosystem: alert.dependency.package.ecosystem,
            manifestPath: alert.dependency.manifest_path,
            advisoryId: cveId ?? alert.security_advisory.ghsa_id,
            cveId,
            ghsaId: alert.security_advisory.ghsa_id,
            severity,
            summary: alert.security_advisory.summary,
            state: alert.state,
            openedAt: alert.created_at,
            publishedAt: alert.security_advisory.published_at,
            ageDays,
            sharedRepoCount,
            vulnerableVersionRange,
            firstPatchedVersion,
            recommendedAction: getRecommendedAction({
              state: alert.state,
              patchedVersion: firstPatchedVersion,
              vulnerableRange: vulnerableVersionRange,
              knownExploited,
              epssPercentile: epss?.percentile ?? null,
            }),
            epssScore: epss?.score ?? null,
            epssPercentile: epss?.percentile ?? null,
            knownExploited,
            priorityScore: getPriorityScore({
              severity,
              ageDays,
              sharedRepoCount,
              hasPatch: firstPatchedVersion !== null,
              knownExploited,
              epssPercentile: epss?.percentile ?? null,
            }),
          }
        }),
    )
    .sort(
      (a, b) =>
        b.priorityScore - a.priorityScore ||
        severityWeights[normalizeSeverity(b.severity)] - severityWeights[normalizeSeverity(a.severity)] ||
        b.sharedRepoCount - a.sharedRepoCount ||
        b.ageDays - a.ageDays,
    )
    .slice(0, 25)
}

function buildEnrichmentSummary(
  alerts: DependabotAlert[],
  enrichment?: VulnerabilityEnrichment,
): VulnerabilityEnrichmentSummary {
  const cveIds = [
    ...new Set(
      alerts.map((alert) => alert.security_advisory.cve_id).filter((value): value is string => value !== null),
    ),
  ]
  const epssCoverageCount = cveIds.filter((cveId) => enrichment?.epssByCve.has(cveId)).length
  const knownExploitedCount = cveIds.filter((cveId) => enrichment?.knownExploitedCves.has(cveId)).length

  return {
    enrichedAt: enrichment?.enrichedAt ?? null,
    latestAlertOpenedAt: maxIsoDate(alerts.map((alert) => alert.created_at)),
    latestAdvisoryPublishedAt: maxIsoDate(alerts.map((alert) => alert.security_advisory.published_at)),
    uniqueCveCount: cveIds.length,
    epssCoverageCount,
    knownExploitedCount,
    epssAvailable: enrichment?.epssAvailable ?? false,
    kevAvailable: enrichment?.kevAvailable ?? false,
  }
}

function countSeverities(alerts: DependabotAlert[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const alert of alerts) {
    const sev = alert.security_advisory.severity
    if (sev in counts) {
      counts[sev as keyof SeverityCounts]++
    }
  }
  return counts
}

function computeMTTR(alerts: DependabotAlert[]): number | null {
  const fixedAlerts = alerts.filter((a) => a.state === "fixed" && a.fixed_at)
  if (fixedAlerts.length === 0) return null

  let totalDays = 0
  for (const alert of fixedAlerts) {
    const created = new Date(alert.created_at).getTime()
    const fixed = new Date(alert.fixed_at!).getTime()
    totalDays += (fixed - created) / (1000 * 60 * 60 * 24)
  }

  return Math.round(totalDays / fixedAlerts.length)
}

export function buildRepositoryHealth(
  owner: string,
  repo: string,
  alerts: DependabotAlert[],
): RepositoryDependencyHealth {
  const openAlerts = alerts.filter((a) => a.state === "open").length
  const fixedAlerts = alerts.filter((a) => a.state === "fixed").length

  let oldestOpenAlertDays: number | null = null
  const now = Date.now()
  for (const alert of alerts) {
    if (alert.state === "open") {
      const days = Math.floor((now - new Date(alert.created_at).getTime()) / (1000 * 60 * 60 * 24))
      if (oldestOpenAlertDays === null || days > oldestOpenAlertDays) {
        oldestOpenAlertDays = days
      }
    }
  }

  return {
    owner,
    repo,
    totalAlerts: alerts.length,
    openAlerts,
    fixedAlerts,
    severityCounts: countSeverities(alerts),
    meanTimeToResolveDays: computeMTTR(alerts),
    oldestOpenAlertDays,
  }
}

export function findSharedVulnerablePackages(alertsByRepo: Map<string, DependabotAlert[]>): SharedVulnerablePackage[] {
  const packageRepos = new Map<string, { ecosystem: string; name: string; severity: string; repos: Set<string> }>()

  for (const [repo, alerts] of alertsByRepo) {
    for (const alert of alerts) {
      const key = `${alert.dependency.package.ecosystem}:${alert.dependency.package.name}`
      if (!packageRepos.has(key)) {
        packageRepos.set(key, {
          ecosystem: alert.dependency.package.ecosystem,
          name: alert.dependency.package.name,
          severity: alert.security_advisory.severity,
          repos: new Set(),
        })
      }
      packageRepos.get(key)!.repos.add(repo)
    }
  }

  return Array.from(packageRepos.values())
    .filter((p) => p.repos.size > 1)
    .map((p) => ({
      ecosystem: p.ecosystem,
      name: p.name,
      severity: p.severity,
      affectedRepos: Array.from(p.repos),
    }))
}

/**
 * Compute a 0–1 supply chain exposure score.
 *
 * Blends two signals:
 * - breadth: fraction of repos that have alerts
 * - depth: number of shared vulnerable packages relative to repo count
 */
export function computeSupplyChainExposure(
  reposWithAlerts: number,
  totalRepos: number,
  sharedVulnerablePackageCount: number,
): number {
  if (totalRepos === 0) return 0

  const breadth = reposWithAlerts / totalRepos
  const depth = Math.min(sharedVulnerablePackageCount / totalRepos, 1)

  return Math.min(breadth * 0.6 + depth * 0.4, 1)
}

export function buildLandscapeHealth(
  alertsByRepo: Map<string, DependabotAlert[]>,
  enrichment?: VulnerabilityEnrichment,
): LandscapeDependencyHealth {
  const repoHealthList: RepositoryDependencyHealth[] = []
  const totalSeverity: SeverityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }
  let totalAlerts = 0
  let totalOpenAlerts = 0
  let reposWithAlerts = 0

  for (const [repo, alerts] of alertsByRepo) {
    const owner = alerts[0]?.dependency.package.ecosystem ? (repo.split("/")[0] ?? repo) : repo
    const health = buildRepositoryHealth(owner, repo, alerts)
    repoHealthList.push(health)

    totalAlerts += health.totalAlerts
    totalOpenAlerts += health.openAlerts
    if (health.totalAlerts > 0) reposWithAlerts++

    totalSeverity.critical += health.severityCounts.critical
    totalSeverity.high += health.severityCounts.high
    totalSeverity.medium += health.severityCounts.medium
    totalSeverity.low += health.severityCounts.low
  }

  const sharedVulnerablePackages = findSharedVulnerablePackages(alertsByRepo)
  const allAlerts = Array.from(alertsByRepo.values()).flat()
  const mttr = computeMTTR(allAlerts)
  const topActionableVulnerabilities = buildTopActionableVulnerabilities(alertsByRepo, enrichment)

  return {
    totalRepos: alertsByRepo.size,
    reposWithAlerts,
    totalAlerts,
    totalOpenAlerts,
    severityCounts: totalSeverity,
    meanTimeToResolveDays: mttr,
    supplyChainExposureScore: computeSupplyChainExposure(
      reposWithAlerts,
      alertsByRepo.size,
      sharedVulnerablePackages.length,
    ),
    sharedVulnerablePackages,
    repoHealth: repoHealthList,
    enrichmentSummary: buildEnrichmentSummary(allAlerts, enrichment),
    topActionableVulnerabilities,
  }
}
