import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const DATA_DIR = process.env.PLANETNIK_DATA_DIR ?? ""

function readJson(filename: string): unknown | null {
  if (!DATA_DIR) return null
  const path = join(DATA_DIR, filename)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf-8"))
}

function readTsv(filename: string): string[][] {
  if (!DATA_DIR) return []
  const path = join(DATA_DIR, filename)
  if (!existsSync(path)) return []
  const lines = readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
  return lines.map((line) => line.split("\t"))
}

// ── Analysis summary ──

export interface AnalysisSummary {
  name: string
  description: string
  filesCount: number
  linesOfCode: number
  duplication: { percentage: number; duplicatedLines: number; cleanedLines: number } | null
}

export function getSummary(): AnalysisSummary | null {
  const raw = readJson("analysisResults.json") as Record<string, unknown> | null
  if (!raw) return null
  const meta = (raw.metadata ?? {}) as Record<string, unknown>
  const dup = raw.duplication as Record<string, unknown> | undefined
  return {
    name: String(meta.name ?? "Unknown"),
    description: String(meta.description ?? ""),
    filesCount: Number(raw.filesCount ?? 0),
    linesOfCode: Number(raw.linesOfCode ?? 0),
    duplication: dup
      ? {
          percentage: Number(dup.percentage ?? 0),
          duplicatedLines: Number(dup.duplicatedLines ?? 0),
          cleanedLines: Number(dup.cleanedLines ?? 0),
        }
      : null,
  }
}

// ── Hotspots ──

export interface Hotspot {
  id: string
  kind: string
  name: string
  parent: string
  score: number
  severity: string
  size: number
  commitsCount: number
  contributorsCount: number
  complexity: number
  temporalLinks: number
  dominantDimension: string
  suggestedAction: string
  reasons: string[]
  dimensions: Record<string, number>
}

export function getHotspots(): Hotspot[] {
  const raw = readJson("hotspots.json") as Record<string, unknown> | null
  if (!raw) return []

  const groups = [
    ...((raw.fileHotspots as unknown[]) ?? []),
    ...((raw.unitHotspots as unknown[]) ?? []),
    ...((raw.componentHotspots as unknown[]) ?? []),
  ]

  return groups.map((entry) => {
    const e = entry as Record<string, unknown>
    return {
      id: String(e.id ?? ""),
      kind: String(e.kind ?? ""),
      name: String(e.name ?? ""),
      parent: String(e.parent ?? ""),
      score: Number(e.score ?? 0),
      severity: String(e.severity ?? ""),
      size: Number(e.size ?? 0),
      commitsCount: Number(e.commitsCount ?? 0),
      contributorsCount: Number(e.contributorsCount ?? 0),
      complexity: Number(e.complexity ?? 0),
      temporalLinks: Number(e.temporalLinks ?? 0),
      dominantDimension: String(e.dominantDimension ?? ""),
      suggestedAction: String(e.suggestedAction ?? ""),
      reasons: Array.isArray(e.reasons) ? e.reasons.map(String) : [],
      dimensions: (e.dimensions ?? {}) as Record<string, number>,
    }
  })
}

// ── Files ──

export interface FileEntry {
  relativePath: string
  extension: string
  linesOfCode: number
  commitsCount: number
  contributorsCount: number
  daysSinceFirstUpdate: number
  daysSinceLatestUpdate: number
  firstDate: string
  latestDate: string
  contributors: string[]
}

export function getFiles(): FileEntry[] {
  const raw = readJson("files_main.json") as Record<string, unknown> | null
  if (!raw) return []
  const files = (raw.files ?? []) as unknown[]
  return files.map((f) => {
    const e = f as Record<string, unknown>
    return {
      relativePath: String(e.relativePath ?? ""),
      extension: String(e.extension ?? ""),
      linesOfCode: Number(e.linesOfCode ?? 0),
      commitsCount: Number(e.commitsCount ?? 0),
      contributorsCount: Number(e.contributorsCount ?? 0),
      daysSinceFirstUpdate: Number(e.daysSinceFirstUpdate ?? 0),
      daysSinceLatestUpdate: Number(e.daysSinceLatestUpdate ?? 0),
      firstDate: String(e.firstDate ?? ""),
      latestDate: String(e.latestDate ?? ""),
      contributors: Array.isArray(e.contributors) ? e.contributors.map(String) : [],
    }
  })
}

// ── Contributors ──

export interface Contributor {
  email: string
  userName: string
  commitsAllTime: number
  commits30Days: number
  commits90Days: number
  commits180Days: number
  commits365Days: number
  firstCommit: string
  lastCommit: string
  isRookie: boolean
  isActive: boolean
}

export function getContributors(): Contributor[] {
  const raw = readJson("contributors.json") as Record<string, unknown> | null
  if (Array.isArray(raw?.contributors)) {
    return raw.contributors
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map((entry) => ({
        email: String(entry.email ?? ""),
        commitsAllTime: Number(entry.commitsCount ?? 0),
        commits30Days: Number(entry.commitsCount30Days ?? 0),
        commits90Days: Number(entry.commitsCount90Days ?? 0),
        commits180Days: Number(entry.commitsCount180Days ?? 0),
        commits365Days: Number(entry.commitsCount365Days ?? 0),
        firstCommit: String(entry.firstCommitDate ?? ""),
        lastCommit: String(entry.latestCommitDate ?? ""),
        userName: String(entry.userName ?? ""),
        isRookie: entry.isRookie === true,
        isActive: entry.isActive === true,
      }))
  }

  const rows = readTsv("contributors.txt")
  if (rows.length < 2) return []
  return rows.slice(1).map((cols) => ({
    email: cols[0]?.trim() ?? "",
    commitsAllTime: parseInt(cols[1] ?? "0", 10) || 0,
    commits30Days: parseInt(cols[2] ?? "0", 10) || 0,
    commits90Days: parseInt(cols[3] ?? "0", 10) || 0,
    commits180Days: parseInt(cols[4] ?? "0", 10) || 0,
    commits365Days: parseInt(cols[5] ?? "0", 10) || 0,
    firstCommit: cols[6]?.trim() ?? "",
    lastCommit: cols[7]?.trim() ?? "",
    userName: cols[9]?.trim() ?? "",
    isRookie: cols[10]?.trim() === "true",
    isActive: cols[11]?.trim() === "true",
  }))
}

// ── Impact ──

export interface ImpactData {
  overallScore: number
  dominantDimension: string
  dimensions: Record<string, number>
  opportunities: Array<{
    id: string
    kind: string
    name: string
    parent: string
    impactScore: number
    dominantDimension: string
  }>
}

export function getImpact(): ImpactData | null {
  const raw = readJson("impact.json") as Record<string, unknown> | null
  if (!raw) return null

  const structural = (raw.structural_impact ?? {}) as Record<string, unknown>
  const summary = (structural.summary ?? {}) as Record<string, unknown>
  const dims = (structural.dimensions ?? {}) as Record<string, number>
  const opps = ((raw.impact_opportunities ?? []) as unknown[]).map((o) => {
    const e = o as Record<string, unknown>
    return {
      id: String(e.id ?? ""),
      kind: String(e.kind ?? ""),
      name: String(e.name ?? ""),
      parent: String(e.parent ?? ""),
      impactScore: Number(e.impact_score ?? 0),
      dominantDimension: String(e.dominant_dimension ?? ""),
    }
  })

  return {
    overallScore: Number(summary.overall_score ?? 0),
    dominantDimension: String(summary.dominant_dimension ?? ""),
    dimensions: dims,
    opportunities: opps,
  }
}

// ── Security ──

export interface SecurityData {
  totalRepos: number
  reposWithAlerts: number
  totalAlerts: number
  totalOpenAlerts: number
  severityCounts: { critical: number; high: number; medium: number; low: number }
  meanTimeToResolveDays: number | null
  supplyChainExposureScore: number
  sharedVulnerablePackages: Array<{
    name: string
    ecosystem: string
    severity: string
    affectedRepos: string[]
  }>
  repoHealth: Array<{
    repo: string
    totalAlerts: number
    openAlerts: number
    fixedAlerts: number
    severityCounts: { critical: number; high: number; medium: number; low: number }
    meanTimeToResolveDays: number | null
    oldestOpenAlertDays: number | null
  }>
}

export function getSecurityData(): SecurityData | null {
  const raw = readJson("landscape_dependency_health.json") as Record<string, unknown> | null
  if (!raw) return null
  const sev = (raw.severityCounts ?? {}) as Record<string, number>
  const repos = ((raw.repoHealth ?? []) as unknown[]).map((r) => {
    const e = r as Record<string, unknown>
    const rs = (e.severityCounts ?? {}) as Record<string, number>
    return {
      repo: String(e.repo ?? ""),
      totalAlerts: Number(e.totalAlerts ?? 0),
      openAlerts: Number(e.openAlerts ?? 0),
      fixedAlerts: Number(e.fixedAlerts ?? 0),
      severityCounts: {
        critical: Number(rs.critical ?? 0),
        high: Number(rs.high ?? 0),
        medium: Number(rs.medium ?? 0),
        low: Number(rs.low ?? 0),
      },
      meanTimeToResolveDays: e.meanTimeToResolveDays != null ? Number(e.meanTimeToResolveDays) : null,
      oldestOpenAlertDays: e.oldestOpenAlertDays != null ? Number(e.oldestOpenAlertDays) : null,
    }
  })
  const shared = ((raw.sharedVulnerablePackages ?? []) as unknown[]).map((p) => {
    const e = p as Record<string, unknown>
    return {
      name: String(e.name ?? ""),
      ecosystem: String(e.ecosystem ?? ""),
      severity: String(e.severity ?? ""),
      affectedRepos: Array.isArray(e.affectedRepos) ? e.affectedRepos.map(String) : [],
    }
  })
  return {
    totalRepos: Number(raw.totalRepos ?? 0),
    reposWithAlerts: Number(raw.reposWithAlerts ?? 0),
    totalAlerts: Number(raw.totalAlerts ?? 0),
    totalOpenAlerts: Number(raw.totalOpenAlerts ?? 0),
    severityCounts: {
      critical: Number(sev.critical ?? 0),
      high: Number(sev.high ?? 0),
      medium: Number(sev.medium ?? 0),
      low: Number(sev.low ?? 0),
    },
    meanTimeToResolveDays: raw.meanTimeToResolveDays != null ? Number(raw.meanTimeToResolveDays) : null,
    supplyChainExposureScore: Number(raw.supplyChainExposureScore ?? 0),
    sharedVulnerablePackages: shared,
    repoHealth: repos,
  }
}

// ── Controls ──

export interface Control {
  goal: string
  metricId: string
  metricValue: number | null
  desiredRangeText: string
  status: string
  description: string
}

export function getControls(): Control[] {
  const raw = readJson("controls.json") as Record<string, unknown> | null
  if (!raw) return []
  const goals = (raw.goals ?? []) as Array<Record<string, unknown>>
  const results: Control[] = []
  for (const goal of goals) {
    const goalName = String(goal.goal ?? "Controls")
    const controls = (goal.controls ?? []) as Array<Record<string, unknown>>
    for (const c of controls) {
      results.push({
        goal: goalName,
        metricId: String(c.metricId ?? ""),
        metricValue: typeof c.metricValue === "number" ? c.metricValue : null,
        desiredRangeText: String(c.desiredRangeText ?? ""),
        status: String(c.status ?? ""),
        description: String(c.controlDescription ?? ""),
      })
    }
  }
  return results
}
