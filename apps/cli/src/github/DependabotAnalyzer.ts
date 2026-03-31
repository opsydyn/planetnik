import type { DependabotAlert } from "./DependabotClient.js"

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

export function buildLandscapeHealth(alertsByRepo: Map<string, DependabotAlert[]>): LandscapeDependencyHealth {
  const repoHealthList: RepositoryDependencyHealth[] = []
  const totalSeverity: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 }
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
  }
}
