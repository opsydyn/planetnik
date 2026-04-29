import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { isValid } from "date-fns"
import { appConfig } from "../config.js"
import {
  getFlexibleDataDirCandidates,
  isRecognizedDataDir,
  resolveNamedDatasetDataDir,
  resolveRecognizedDataDir,
} from "./data-directories.js"

const runtimeRoot = join(dirname(fileURLToPath(import.meta.url)), "../..")
const workspaceRoot = join(runtimeRoot, "../..")
const defaultDatasetsRoot = join(workspaceRoot, "datasets")

/**
 * Normalise any date value to YYYY-MM-DD.
 * Handles:
 *   - ISO date strings: "2023-02-27"
 *   - ISO datetime strings: "2023-02-27T00:00:00.000Z"
 *   - JS Date.toString() strings: "Mon Feb 27 2023 00:00:00 GMT+0000 (Greenwich Mean Time)"
 *   - Millisecond timestamps (number): 1677456000000
 * Returns "" for empty/invalid input so callers can use `|| "—"` guards as before.
 */
export function toISODateString(value: unknown): string {
  if (value === null || value === undefined) return ""
  let parsed: Date
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return ""
    parsed = new Date(value)
  } else if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed === "") return ""
    // Already YYYY-MM-DD — fast path
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    parsed = new Date(trimmed)
  } else {
    return ""
  }
  if (!isValid(parsed)) return ""
  return parsed.toISOString().slice(0, 10)
}

/**
 * Same as toISODateString but returns null instead of "" for missing/invalid
 * values, for fields typed `string | null`.
 */
function toISODateStringOrNull(value: unknown): string | null {
  const result = toISODateString(value)
  return result === "" ? null : result
}

export type RuntimeDataset = {
  readonly name: string
  readonly dataDir: string
  readonly title: string
  readonly reportMode: string | null
}

export type ReportContextSummary = {
  readonly mode: "single_repository" | "landscape"
  readonly reportMode: "single_repository" | "landscape"
  readonly title: string
  readonly rootRoute: string
  readonly dataVersion: number
  readonly source: string
  readonly hasLandscape: boolean
  readonly hasSingleRepositoryAnalysis: boolean
  readonly primaryNavigation: ReadonlyArray<string>
}

export type SingleRepositoryArtifactSummary = {
  readonly kind: "single_repository"
  readonly projectName: string
  readonly filesCount: number
  readonly linesOfCode: number
  readonly duplicatedLines: number
  readonly duplicationPercentage: number
}

export type LandscapeArtifactSummary = {
  readonly kind: "landscape"
  readonly title: string
  readonly landscapeName: string
  readonly repositoryCount: number
  readonly contributorCount: number
  readonly totalLinesOfCode: number
  readonly commits30d: number
  readonly commits90d: number
}

export type ReportArtifactSummary = SingleRepositoryArtifactSummary | LandscapeArtifactSummary

export type ReportContributorSummary = {
  readonly email: string
  readonly userName: string
  readonly displayName: string
  readonly status: "Rookie" | "Active" | "Inactive"
  readonly commitsAllTime: number
  readonly commits30Days: number
  readonly commits90Days: number
  readonly commits180Days: number
  readonly commits365Days: number
  readonly firstCommit: string
  readonly lastCommit: string
  readonly percentage: string
  readonly filesTouched: number | null
  readonly componentsTouched: number | null
  readonly primaryComponent: string
  readonly knowledgeSignal: string
  readonly repositoryCount: number | null
  readonly latestCommitDate: string
  readonly isBot: boolean | null
  readonly repositories: ReadonlyArray<{
    readonly name: string
    readonly repoKey: string
  }>
}

type LandscapeContributorSummary = {
  readonly totalContributors: number
  readonly active30d: number
  readonly multiRepoCount: number
  readonly botCount: number
  readonly contributors: ReadonlyArray<ReportContributorSummary>
}

export type ReportContributorDetail = {
  readonly email: string
  readonly userName: string
  readonly displayName: string
  readonly status: "Rookie" | "Active" | "Inactive"
  readonly commitsCount: number
  readonly commitsCount30Days: number
  readonly commitsCount90Days: number
  readonly commitsCount180Days: number
  readonly commitsCount365Days: number
  readonly firstCommitDate: string
  readonly latestCommitDate: string
  readonly percentage: string
  readonly activeDays: number
  readonly filesCount: number
  readonly collaboratorsCount: number
  readonly topCollaboratorEmail: string | null
  readonly topCollaboratorDisplayName: string | null
  readonly extensions: ReadonlyArray<{
    readonly extension: string
    readonly commits: number
    readonly files: number
  }>
  readonly logicalComponents: ReadonlyArray<{
    readonly name: string
    readonly files: number
    readonly linesOfCode: number
  }>
  readonly collaborators: ReadonlyArray<{
    readonly email: string
    readonly displayName: string
    readonly sharedFiles: number
  }>
  readonly topFiles: ReadonlyArray<{
    readonly relativePath: string
    readonly extension: string
    readonly commits: number
    readonly logicalComponents: ReadonlyArray<string>
    readonly concerns: ReadonlyArray<string>
  }>
  readonly dailyActivity: ReadonlyArray<{
    readonly date: string
    readonly commits: number
  }>
  readonly impact: {
    readonly glueScore: number
    readonly snackingScore: number
    readonly structuralImpactScore: number
    readonly visibleActivityScore: number
    readonly dominantDimension: string
    readonly isGlue: boolean
    readonly isSnacking: boolean
    readonly reasons: ReadonlyArray<string>
  } | null
}

export type TopologyPeopleDep = {
  readonly from: string
  readonly to: string
  readonly count: number
  readonly files: ReadonlyArray<string>
}

export type TopologyContributorImpact = {
  readonly email: string
  readonly display_name: string
  readonly glue_score: number
  readonly snacking_score: number
  readonly structural_impact_score: number
  readonly visible_activity_score: number
  readonly collaborator_count: number
  readonly shared_files_count: number
  readonly commits_count: number
  readonly files_touched: number
  readonly components_touched: number
  readonly dominant_dimension: string
  readonly dimensions: Record<string, number>
  readonly top_components: ReadonlyArray<{
    readonly name: string
    readonly files: number
    readonly commits: number
  }>
  readonly top_routes: ReadonlyArray<string>
  readonly reasons: ReadonlyArray<string>
  readonly is_glue: boolean
  readonly is_snacking: boolean
}

export type ReportTopologySummary = {
  readonly availablePeriods: ReadonlyArray<string>
  readonly strongestConnections: ReadonlyArray<{
    readonly periodLabel: string
    readonly from: string
    readonly fromDisplayName: string
    readonly to: string
    readonly toDisplayName: string
    readonly sharedCommits: number
    readonly filesCount: number
  }>
  readonly topGlueContributors: ReadonlyArray<{
    readonly email: string
    readonly displayName: string
    readonly glueScore: number
    readonly dominantDimension: string
  }>
  readonly topSnackingContributors: ReadonlyArray<{
    readonly email: string
    readonly displayName: string
    readonly snackingScore: number
    readonly dominantDimension: string
  }>
  readonly periodsData: Record<string, ReadonlyArray<TopologyPeopleDep>>
  readonly impactPeriods: Record<string, ReadonlyArray<TopologyContributorImpact>>
}

type ReportTopologyConnection = ReportTopologySummary["strongestConnections"][number]

export type ReportMetricsSummary = {
  readonly totalMetrics: number
  readonly headlineMetrics: {
    readonly mainLinesOfCode: number
    readonly testLinesOfCode: number
    readonly duplicatedLines: number
    readonly testVsMainPercentage: number
    readonly totalAnalysisTimeInMillis: number
  }
  readonly locBreakdown: ReadonlyArray<{ readonly label: string; readonly value: number }>
  readonly mainLocByExtension: ReadonlyArray<{ readonly label: string; readonly value: number }>
  readonly groupSummaries: ReadonlyArray<{
    readonly groupId: string
    readonly label: string
    readonly metrics: ReadonlyArray<{
      readonly id: string
      readonly value: number
    }>
  }>
}

export type ReportDuplicationSummary = {
  readonly duplicationPercentage: number
  readonly duplicatedLines: number
  readonly duplicateBlocksCount: number
  readonly blockSizeDistribution: ReadonlyArray<{
    readonly label: string
    readonly value: number
    readonly detail: string
  }>
  readonly mostDuplicatedFiles: ReadonlyArray<{
    readonly label: string
    readonly value: number
  }>
  readonly largestDuplicateBlocks: ReadonlyArray<{
    readonly blockSize: number
    readonly files: number
    readonly locations: ReadonlyArray<string>
  }>
}

export type ReportDependenciesSummary = {
  readonly sections: ReadonlyArray<{
    readonly decompositionKey: string
    readonly linksCount: number
    readonly incoming: ReadonlyArray<{
      readonly label: string
      readonly value: number
    }>
    readonly outgoing: ReadonlyArray<{
      readonly label: string
      readonly value: number
    }>
    readonly links: ReadonlyArray<{
      readonly fromComponent: string
      readonly toComponent: string
      readonly count: number
      readonly evidenceCount: number
      readonly locFrom: number
    }>
  }>
}

export type ReportControlsSummary = {
  readonly totalControls: number
  readonly statusCounts: {
    readonly failed: number
    readonly tolerant: number
    readonly ok: number
    readonly ignored: number
  }
  readonly goals: ReadonlyArray<{
    readonly goal: string
    readonly total: number
    readonly failed: number
    readonly tolerant: number
    readonly ok: number
    readonly ignored: number
  }>
  readonly controls: ReadonlyArray<{
    readonly id: string
    readonly goal: string
    readonly metricId: string
    readonly metricValue: number | null
    readonly desiredRangeText: string
    readonly status: string
    readonly description: string
  }>
}

export type ReportImpactSummary = {
  readonly title: string
  readonly timestamp: string
  readonly visibleActivity: {
    readonly commits: number
    readonly contributors: number
    readonly changedFiles: number
    readonly changedUnits: number
  }
  readonly structuralImpact: {
    readonly overallScore: number
    readonly dominantDimension: string
  }
  readonly impactDimensions: ReadonlyArray<{
    readonly label: string
    readonly score: number
  }>
  readonly topOpportunities: ReadonlyArray<{
    readonly name: string
    readonly kind: string
    readonly parent: string
    readonly impactScore: number
    readonly dominantDimension: string
    readonly suggestedAction: string
    readonly reasons: ReadonlyArray<string>
    readonly complexityReduction: number
    readonly boundaryShaping: number
    readonly knowledgeSpread: number
    readonly coordinationRelief: number
    readonly changeEnablement: number
  }>
  readonly snackingCandidates: ReadonlyArray<{
    readonly name: string
    readonly kind: string
    readonly visibleActivityScore: number
    readonly structuralImpactScore: number
    readonly delta: number
    readonly reason: string
  }>
  readonly conceptMappings: ReadonlyArray<{
    readonly concept: string
    readonly dimension: string
    readonly evidenceCount: number
    readonly examples: ReadonlyArray<string>
  }>
}

export type ReportSecuritySummary = {
  readonly totalRepos: number
  readonly reposWithAlerts: number
  readonly totalAlerts: number
  readonly totalOpenAlerts: number
  readonly severityCounts: {
    readonly critical: number
    readonly high: number
    readonly medium: number
    readonly low: number
  }
  readonly meanTimeToResolveDays: number | null
  readonly supplyChainExposureScore: number
  readonly sharedVulnerablePackages: ReadonlyArray<{
    readonly ecosystem: string
    readonly name: string
    readonly severity: string
    readonly affectedRepos: ReadonlyArray<string>
  }>
  readonly repoHealth: ReadonlyArray<{
    readonly owner: string
    readonly repo: string
    readonly repoKey: string | null
    readonly totalAlerts: number
    readonly openAlerts: number
    readonly fixedAlerts: number
    readonly severityCounts: {
      readonly critical: number
      readonly high: number
      readonly medium: number
      readonly low: number
    }
    readonly meanTimeToResolveDays: number | null
    readonly oldestOpenAlertDays: number | null
  }>
  readonly enrichmentSummary: {
    readonly enrichedAt: string | null
    readonly latestAlertOpenedAt: string | null
    readonly latestAdvisoryPublishedAt: string | null
    readonly uniqueCveCount: number
    readonly epssCoverageCount: number
    readonly knownExploitedCount: number
    readonly epssAvailable: boolean
    readonly kevAvailable: boolean
  }
  readonly topActionableVulnerabilities: ReadonlyArray<{
    readonly repo: string
    readonly repoKey: string | null
    readonly package: string
    readonly ecosystem: string
    readonly manifestPath: string
    readonly advisoryId: string
    readonly cveId: string | null
    readonly ghsaId: string
    readonly severity: string
    readonly summary: string
    readonly state: string
    readonly openedAt: string
    readonly publishedAt: string | null
    readonly ageDays: number
    readonly sharedRepoCount: number
    readonly vulnerableVersionRange: string
    readonly firstPatchedVersion: string | null
    readonly recommendedAction: string
    readonly epssScore: number | null
    readonly epssPercentile: number | null
    readonly knownExploited: boolean
    readonly priorityScore: number
  }>
}

export type ReportLandscapeRepositorySummary = {
  readonly repoKey: string
  readonly name: string
  readonly description: string
  readonly latestCommitDate: string
  readonly commits30d: number
  readonly commits90d: number
  readonly contributorsCount: number
  readonly filesCount: number
  readonly linesOfCode: number
  readonly duplicationPercentage: number | null
  readonly links: ReadonlyArray<{
    readonly label: string
    readonly href: string
  }>
  readonly contributors: ReadonlyArray<{
    readonly email: string
    readonly displayName: string
    readonly commitsCount: number
    readonly commits30d: number
    readonly commits90d: number
    readonly firstCommitDate: string
    readonly latestCommitDate: string
    readonly type: "Human" | "Bot"
    readonly glueScore: string
    readonly structuralImpact: string
    readonly snackRisk: string
    readonly signal: string
  }>
  readonly topContributors: ReadonlyArray<{
    readonly email: string
    readonly displayName: string
    readonly commitsCount: number
    readonly commits30d: number
    readonly commits90d: number
    readonly firstCommitDate: string
    readonly latestCommitDate: string
    readonly type: "Human" | "Bot"
    readonly glueScore: string
    readonly structuralImpact: string
    readonly snackRisk: string
    readonly signal: string
  }>
}

export type ReportLandscapeRepositoriesSummary = {
  readonly totalRepositories: number
  readonly active30d: number
  readonly totalMainLoc: number
  readonly averageMainLoc: number
  readonly repositories: ReadonlyArray<{
    readonly repoKey: string
    readonly name: string
    readonly description: string
    readonly mainLinesOfCode: number
    readonly mainFilesCount: number
    readonly commits30d: number
    readonly commits90d: number
    readonly contributorsCount: number
    readonly contributors30d: number
    readonly latestCommitDate: string
    readonly tags: ReadonlyArray<string>
  }>
}

export type ReportLandscapeOverviewSummary = {
  readonly title: string
  readonly landscapeName: string
  readonly repositoryCount: number
  readonly contributorCount: number
  readonly teamCount: number
  readonly tagCount: number
  readonly totals: {
    readonly mainLinesOfCode: number
    readonly totalLinesOfCode: number
    readonly contributorCount30Days: number
    readonly commits30d: number
    readonly commits90d: number
  }
  readonly languages: ReadonlyArray<{
    readonly extension: string
    readonly linesOfCode: number
    readonly repositories: number
  }>
  readonly topRepositories: ReadonlyArray<{
    readonly name: string
    readonly repoKey: string
    readonly mainLinesOfCode: number
    readonly contributors: number
    readonly latestCommitDate: string
  }>
}

export type ReportLandscapeTagsSummary = {
  readonly groupCount: number
  readonly tagCount: number
  readonly untaggedRepositoryCount: number
  readonly tags: ReadonlyArray<{
    readonly id: string
    readonly group: string
    readonly tag: string
    readonly repositoryCount: number
    readonly totalMainLinesOfCode: number
    readonly repositories: ReadonlyArray<string>
  }>
  readonly untaggedRepositories: ReadonlyArray<string>
}

export type ReportLandscapeTeamsSummary = {
  readonly totalTeams: number
  readonly totalMembers: number
  readonly totalRepositoryTouches: number
  readonly teams: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly description: string
    readonly commitsCount: number
    readonly commits30d: number
    readonly memberCount: number
    readonly repositoryCount: number
    readonly latestCommitDate: string
    readonly members: ReadonlyArray<string>
    readonly repositories: ReadonlyArray<string>
  }>
}

export type ReportComponentsSummary = {
  readonly totalComponents: number
  readonly singleOwnerComponents: number
  readonly lowBackupComponents: number
  readonly distributedComponents: number
  readonly unassignedFiles: number
  readonly topComponents: ReadonlyArray<{
    readonly name: string
    readonly files: number
    readonly linesOfCode: number
    readonly contributors: number
    readonly risk: string
  }>
  readonly inventory: ReadonlyArray<{
    readonly name: string
    readonly files: number
    readonly linesOfCode: number
    readonly contributors: number | null
    readonly risk: string
  }>
}

export type ReportCouplingSummary = {
  readonly decompositionKey: string
  readonly temporalWindowLabel: string | null
  readonly aggregate: {
    readonly totalComponents: number
    readonly overloadedComponents: number
    readonly knowledgeExposedComponents: number
    readonly averageLoad: number
    readonly averageBalance: number
    readonly averageRisk: number
    readonly maxRisk: number
    readonly topRiskComponent: string | undefined
  }
  readonly riskTierCounts: {
    readonly critical: number
    readonly high: number
    readonly medium: number
    readonly low: number
  }
  readonly dimensionMix: ReadonlyArray<{
    readonly id: string
    readonly label: string
    readonly value: number
    readonly color: string
  }>
  readonly dominantBreakdown: ReadonlyArray<{
    readonly label: string
    readonly value: number
    readonly detail: string
    readonly color: string
  }>
  readonly topRiskComponents: ReadonlyArray<{
    readonly component: string
    readonly systemicRisk: number
    readonly riskTier: "Low" | "Medium" | "High" | "Critical"
    readonly dominantDimension: string
    readonly explainability: ReadonlyArray<string>
  }>
  readonly inventory: ReadonlyArray<{
    readonly component: string
    readonly systemicRisk: number
    readonly overallLoad: number
    readonly balanceScore: number
    readonly riskTier: "Low" | "Medium" | "High" | "Critical"
    readonly dominantDimension: string
    readonly files: number
    readonly linesOfCode: number
    readonly contributors: number
    readonly incomingDependencies: number
    readonly outgoingDependencies: number
    readonly staticPartners: number
    readonly temporalPartners: number
    readonly contributorOverlap: number
    readonly hotspotPressure: number
    readonly staticCoupling: number
    readonly temporalCoupling: number
    readonly coordinationCoupling: number
    readonly knowledgeRisk: number
    readonly dominantDimensionId: string
    readonly explainability: ReadonlyArray<string>
  }>
}

export type ReportHotspotsSummary = {
  readonly totalHotspots: number
  readonly severityCounts: {
    readonly critical: number
    readonly high: number
    readonly medium: number
    readonly low: number
  }
  readonly kindCounts: {
    readonly files: number
    readonly units: number
    readonly components: number
  }
  readonly dominantCounts: {
    readonly structuralRisk: number
    readonly changePressure: number
    readonly coordinationCost: number
    readonly knowledgeRisk: number
  }
  readonly topHotspots: ReadonlyArray<{
    readonly name: string
    readonly score: number
    readonly severity: string
    readonly kind: string
    readonly dominantDimension: string
    readonly suggestedAction: string
  }>
  readonly rows: ReadonlyArray<{
    readonly name: string
    readonly route: string
    readonly kind: string
    readonly parent: string
    readonly score: number
    readonly severity: string
    readonly dominantDimension: string
    readonly size: number
    readonly commitsCount: number
    readonly contributorsCount: number
    readonly temporalLinks: number
    readonly complexity: number
    readonly structuralRisk: number
    readonly changePressure: number
    readonly coordinationCost: number
    readonly knowledgeRisk: number
    readonly suggestedAction: string
    readonly reasons: ReadonlyArray<string>
  }>
}

export type ReportCommitsSummary = {
  readonly totalCommits: number
  readonly totalContributors: number
  readonly activeContributors: {
    readonly days30: number
    readonly days90: number
    readonly days365: number
  }
  readonly repoAgeDays: number | null
  readonly activeDays: number | null
  readonly rookieCount: number
  readonly activity: ReadonlyArray<{
    readonly label: string
    readonly value: number
    readonly detail: string
  }>
  readonly timeline: ReadonlyArray<{
    readonly timeSlot: string
    readonly commits: number
    readonly contributors: number
  }>
  readonly extensions: ReadonlyArray<{
    readonly extension: string
    readonly commitsCount: number
    readonly committersCount: number
    readonly filesCount: number
    readonly commitsCount30Days: number
    readonly commitsCount90Days: number
  }>
}

export type ReportTrendsSummary = {
  readonly available: boolean
  readonly message: string
  readonly hint: string
}

export type ReportFileViewName = "size" | "age" | "churn" | "temporal"

export type ReportFileInventoryRow = {
  readonly relativePath: string
  readonly extension: string
  readonly linesOfCode: number
  readonly commitsCount: number | null
  readonly contributorsCount: number | null
  readonly firstDate: string | null
  readonly latestDate: string | null
}

export type ReportFilesSizeView = {
  readonly view: "size"
  readonly headline: {
    readonly fileCount: number
    readonly totalLinesOfCode: number
  }
  readonly sizeDistribution: ReadonlyArray<{
    readonly label: string
    readonly value: number
    readonly detail: string
  }>
  readonly largestFiles: ReadonlyArray<{
    readonly label: string
    readonly value: number
  }>
  readonly rows: ReadonlyArray<ReportFileInventoryRow>
}

export type ReportFilesAgeView = {
  readonly view: "age"
  readonly headline: {
    readonly ageInDays: number | null
    readonly activeDays: number | null
    readonly weeks: number | null
  }
  readonly categories: ReadonlyArray<{
    readonly label: string
    readonly value: number
  }>
}

export type ReportFilesChurnView = {
  readonly view: "churn"
  readonly headline: {
    readonly activeDays: number | null
    readonly weeks: number | null
    readonly estimatedWorkingDays: number | null
    readonly filesWithHistoryCount: number
  }
  readonly mostChangedFiles: ReadonlyArray<{
    readonly label: string
    readonly value: number
  }>
  readonly rows: ReadonlyArray<ReportFileInventoryRow>
}

export type ReportFilesTemporalView = {
  readonly view: "temporal"
  readonly sections: ReadonlyArray<{
    readonly periodKey: string
    readonly periodLabel: string
    readonly periodDays: number
    readonly dependencies: ReadonlyArray<{
      readonly file1: string
      readonly file2: string
      readonly sameCommits: number
      readonly commitsFile1: number
      readonly commitsFile2: number
      readonly latestCommit: string
    }>
  }>
}

export type ReportFilesView = ReportFilesSizeView | ReportFilesAgeView | ReportFilesChurnView | ReportFilesTemporalView

export type ReportUnitViewName = "size" | "complexity"

export type ReportUnitInventoryRow = {
  readonly shortName: string
  readonly relativeFileName: string
  readonly linesOfCode: number
  readonly mcCabeIndex: number
  readonly numberOfParameters: number
  readonly startLine: number
  readonly endLine: number
}

export type ReportUnitsSizeView = {
  readonly view: "size"
  readonly headline: {
    readonly unitCount: number
    readonly totalLinesOfCode: number
  }
  readonly sizeRisk: ReadonlyArray<{
    readonly label: string
    readonly value: number
  }>
  readonly sizeDistribution: ReadonlyArray<{
    readonly label: string
    readonly value: number
    readonly detail: string
  }>
  readonly rows: ReadonlyArray<ReportUnitInventoryRow>
}

export type ReportUnitsComplexityView = {
  readonly view: "complexity"
  readonly headline: {
    readonly unitCount: number
  }
  readonly complexityRisk: ReadonlyArray<{
    readonly label: string
    readonly value: number
  }>
  readonly complexityDistribution: ReadonlyArray<{
    readonly label: string
    readonly value: number
    readonly detail: string
  }>
  readonly rows: ReadonlyArray<ReportUnitInventoryRow>
}

export type ReportUnitsView = ReportUnitsSizeView | ReportUnitsComplexityView

export type ResolvedReportDataSource = {
  readonly dataDir: string
  readonly datasetName?: string
  readonly title: string
  readonly reportMode: string | null
}

function readReportContext(dataDir: string): Record<string, unknown> | null {
  const contextPath = join(dataDir, "report_context.json")
  if (!existsSync(contextPath)) {
    return null
  }

  try {
    return JSON.parse(readFileSync(contextPath, "utf-8")) as Record<string, unknown>
  } catch {
    return null
  }
}

function readJsonRecord(dataDir: string, fileName: string): Record<string, unknown> | null {
  const filePath = join(dataDir, fileName)
  if (!existsSync(filePath)) {
    return null
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>
  } catch {
    return null
  }
}

function readTextFile(dataDir: string, fileName: string): string | null {
  const filePath = join(dataDir, fileName)
  if (!existsSync(filePath)) {
    return null
  }

  try {
    return readFileSync(filePath, "utf-8")
  } catch {
    return null
  }
}

type ReportFileRecord = {
  readonly relativePath: string
  readonly extension: string
  readonly linesOfCode: number
  readonly commitsCount: number | null
  readonly contributorsCount: number | null
  readonly firstDate: string | null
  readonly latestDate: string | null
}

type ReportComponentSourceFile = {
  readonly relativePath: string
  readonly linesOfCode: number
  readonly components: ReadonlyArray<string>
  readonly contributors: ReadonlyArray<string>
}

type ReportComponentDependencyRecord = {
  readonly decompositionKey: string
  readonly fromComponent: string
  readonly toComponent: string
  readonly count: number
}

type ReportTemporalDependencyRecord = {
  readonly periodKey: string
  readonly periodLabel: string
  readonly periodDays: number
  readonly file1: string
  readonly file2: string
  readonly sameCommits: number
}

type ReportComponentHotspotRecord = {
  readonly name: string
  readonly parent: string
  readonly score: number
  readonly dimensions: {
    readonly structuralRisk: number
    readonly changePressure: number
    readonly coordinationCost: number
    readonly knowledgeRisk: number
  }
  readonly reasons: ReadonlyArray<string>
}

type CouplingDimensionId = "staticCoupling" | "temporalCoupling" | "coordinationCoupling" | "knowledgeRisk"

type ReportUnitRecord = {
  readonly shortName: string
  readonly relativeFileName: string
  readonly linesOfCode: number
  readonly mcCabeIndex: number
  readonly numberOfParameters: number
  readonly startLine: number
  readonly endLine: number
}

function readMetricsMap(dataDir: string): Map<string, number> {
  const text = readTextFile(dataDir, "metrics.txt")
  if (!text) {
    return new Map()
  }

  const metrics = new Map<string, number>()
  for (const line of text.split("\n").map((entry) => entry.trim())) {
    if (line.length === 0) {
      continue
    }

    const colonIdx = line.indexOf(":")
    if (colonIdx < 0) {
      continue
    }

    const id = line.substring(0, colonIdx).trim()
    const value = parseFloat(line.substring(colonIdx + 1).trim())
    if (id.length === 0 || Number.isNaN(value)) {
      continue
    }

    metrics.set(id, value)
  }

  return metrics
}

function readFileInventory(dataDir: string): ReadonlyArray<ReportFileRecord> {
  const raw = readJsonRecord(dataDir, "files_main.json")
  const files = Array.isArray(raw?.files)
    ? raw.files.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []

  return files
    .map((file) => ({
      relativePath: typeof file.relativePath === "string" ? file.relativePath : "",
      extension: typeof file.extension === "string" ? file.extension : "",
      linesOfCode: typeof file.linesOfCode === "number" ? file.linesOfCode : 0,
      commitsCount: typeof file.commitsCount === "number" ? file.commitsCount : null,
      contributorsCount: typeof file.contributorsCount === "number" ? file.contributorsCount : null,
      firstDate: toISODateStringOrNull(file.firstDate),
      latestDate: toISODateStringOrNull(file.latestDate),
    }))
    .filter((file) => file.relativePath.length > 0 && file.linesOfCode >= 0)
}

function readComponentSourceFiles(dataDir: string): ReadonlyArray<ReportComponentSourceFile> {
  const raw = readJsonRecord(dataDir, "files_main.json")
  const files = Array.isArray(raw?.files)
    ? raw.files.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []

  return files
    .map((file) => ({
      relativePath: typeof file.relativePath === "string" ? file.relativePath : "",
      linesOfCode: typeof file.linesOfCode === "number" ? file.linesOfCode : 0,
      components: Array.isArray(file.components)
        ? file.components.filter((item): item is string => typeof item === "string")
        : [],
      contributors: Array.isArray(file.contributors)
        ? file.contributors.filter((item): item is string => typeof item === "string")
        : [],
    }))
    .filter((file) => file.relativePath.length > 0 && file.linesOfCode >= 0)
}

function readComponentDependencyRecords(dataDir: string): ReadonlyArray<ReportComponentDependencyRecord> {
  const raw = readJsonRecord(dataDir, "component_dependencies.json")
  const dependencies = Array.isArray(raw?.dependencies)
    ? raw.dependencies.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []

  return dependencies
    .map((dependency) => ({
      decompositionKey: typeof dependency.decompositionKey === "string" ? dependency.decompositionKey : "",
      fromComponent: typeof dependency.fromComponent === "string" ? dependency.fromComponent : "",
      toComponent: typeof dependency.toComponent === "string" ? dependency.toComponent : "",
      count: typeof dependency.count === "number" ? dependency.count : 0,
    }))
    .filter(
      (dependency) =>
        dependency.decompositionKey.length > 0 &&
        dependency.fromComponent.length > 0 &&
        dependency.toComponent.length > 0,
    )
}

function readTemporalDependencyRecords(dataDir: string): ReadonlyArray<ReportTemporalDependencyRecord> {
  const raw = readJsonRecord(dataDir, "temporal_dependencies.json")
  const dependencies = Array.isArray(raw?.dependencies)
    ? raw.dependencies.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []

  return dependencies
    .map((dependency) => ({
      periodKey: typeof dependency.periodKey === "string" ? dependency.periodKey : "",
      periodLabel: typeof dependency.periodLabel === "string" ? dependency.periodLabel : "",
      periodDays: typeof dependency.periodDays === "number" ? dependency.periodDays : 0,
      file1: typeof dependency.file1 === "string" ? dependency.file1 : "",
      file2: typeof dependency.file2 === "string" ? dependency.file2 : "",
      sameCommits: typeof dependency.sameCommits === "number" ? dependency.sameCommits : 0,
    }))
    .filter(
      (dependency) => dependency.periodKey.length > 0 && dependency.file1.length > 0 && dependency.file2.length > 0,
    )
}

function readComponentHotspotRecords(dataDir: string): ReadonlyArray<ReportComponentHotspotRecord> {
  const raw = readJsonRecord(dataDir, "hotspots.json")
  const hotspots = Array.isArray(raw?.componentHotspots)
    ? raw.componentHotspots.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []

  return hotspots
    .map((hotspot) => {
      const dimensions =
        hotspot.dimensions && typeof hotspot.dimensions === "object"
          ? (hotspot.dimensions as Record<string, unknown>)
          : null

      return {
        name: typeof hotspot.name === "string" ? hotspot.name : "",
        parent: typeof hotspot.parent === "string" ? hotspot.parent : "",
        score: typeof hotspot.score === "number" ? hotspot.score : 0,
        dimensions: {
          structuralRisk: typeof dimensions?.structuralRisk === "number" ? dimensions.structuralRisk : 0,
          changePressure: typeof dimensions?.changePressure === "number" ? dimensions.changePressure : 0,
          coordinationCost: typeof dimensions?.coordinationCost === "number" ? dimensions.coordinationCost : 0,
          knowledgeRisk: typeof dimensions?.knowledgeRisk === "number" ? dimensions.knowledgeRisk : 0,
        },
        reasons: Array.isArray(hotspot.reasons)
          ? hotspot.reasons.filter((item): item is string => typeof item === "string")
          : [],
      }
    })
    .filter((hotspot) => hotspot.name.length > 0)
}

const COUPLING_DIMENSION_LABELS: Record<CouplingDimensionId, string> = {
  staticCoupling: "Static",
  temporalCoupling: "Temporal",
  coordinationCoupling: "Coordination",
  knowledgeRisk: "Knowledge",
}

const COUPLING_DIMENSION_COLORS: Record<string, string> = {
  Static: "#6366f1",
  Temporal: "#8b5cf6",
  Coordination: "#06b6d4",
  Knowledge: "#ef4444",
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function clamp(value: number, min = 0, max = 10): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeToTen(value: number, max: number): number {
  if (max <= 0) {
    return 0
  }

  return round1((value / max) * 10)
}

function average(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0
  }

  const mean = average(values)
  const variance = average(values.map((value) => (value - mean) ** 2))
  return Math.sqrt(variance)
}

function getCouplingRiskTier(score: number): "Low" | "Medium" | "High" | "Critical" {
  if (score >= 7.5) {
    return "Critical"
  }
  if (score >= 5.5) {
    return "High"
  }
  if (score >= 3.5) {
    return "Medium"
  }
  return "Low"
}

function getDominantCouplingDimension(scores: Record<CouplingDimensionId, number>): CouplingDimensionId {
  return (
    (Object.entries(scores) as Array<[CouplingDimensionId, number]>).sort(
      (left, right) => right[1] - left[1],
    )[0]?.[0] ?? "staticCoupling"
  )
}

function getHeuristicKnowledgeRisk(contributors: number): number {
  if (contributors <= 1) {
    return 10
  }
  if (contributors === 2) {
    return 7.5
  }
  if (contributors === 3) {
    return 5
  }
  if (contributors === 4) {
    return 3.5
  }
  return 2
}

function buildCouplingExplainability(input: {
  readonly incomingDependencies: number
  readonly outgoingDependencies: number
  readonly temporalPartners: number
  readonly contributorOverlap: number
  readonly contributors: number
  readonly hotspot: ReportComponentHotspotRecord | undefined
  readonly dominantDimension: CouplingDimensionId
}): ReadonlyArray<string> {
  const reasons = new Set<string>()

  for (const reason of input.hotspot?.reasons ?? []) {
    reasons.add(reason)
  }

  const dependencyCentrality = input.incomingDependencies + input.outgoingDependencies
  if (dependencyCentrality >= 4) {
    reasons.add(`dependency centrality across ${dependencyCentrality} component edges`)
  }

  if (input.temporalPartners >= 3) {
    reasons.add(`co-change pressure with ${input.temporalPartners} partner components`)
  }

  if (input.contributorOverlap >= 3) {
    reasons.add(`shared contributor traffic across ${input.contributorOverlap} cross-component overlaps`)
  }

  if (input.contributors <= 1) {
    reasons.add("single-owner knowledge exposure")
  } else if (input.contributors === 2) {
    reasons.add("thin backup coverage")
  }

  if (reasons.size === 0) {
    reasons.add(`dominant ${COUPLING_DIMENSION_LABELS[input.dominantDimension].toLowerCase()} pressure`)
  }

  return [...reasons].slice(0, 4)
}

function summarizeComponents(files: ReadonlyArray<ReportComponentSourceFile>): ReportComponentsSummary {
  const componentMap = new Map<string, { files: number; linesOfCode: number; contributors: Set<string> }>()

  for (const file of files) {
    for (const component of file.components) {
      const entry = componentMap.get(component) ?? {
        files: 0,
        linesOfCode: 0,
        contributors: new Set<string>(),
      }
      entry.files += 1
      entry.linesOfCode += file.linesOfCode
      for (const contributor of file.contributors) {
        entry.contributors.add(contributor)
      }
      componentMap.set(component, entry)
    }
  }

  const components = [...componentMap.entries()].sort((left, right) => right[1].linesOfCode - left[1].linesOfCode)
  const unassignedFiles = files.filter((file) => file.components.length === 0)
  const singleOwnerComponents = components.filter(([, summary]) => summary.contributors.size === 1).length
  const lowBackupComponents = components.filter(
    ([, summary]) => summary.contributors.size > 0 && summary.contributors.size <= 2,
  ).length
  const distributedComponents = components.filter(([, summary]) => summary.contributors.size >= 3).length

  const inventory = components.map(([name, summary]) => ({
    name,
    files: summary.files,
    linesOfCode: summary.linesOfCode,
    contributors: summary.contributors.size > 0 ? summary.contributors.size : null,
    risk: summary.contributors.size > 0 && summary.contributors.size <= 2 ? "Bus factor risk" : "",
  }))

  if (unassignedFiles.length > 0) {
    inventory.push({
      name: "(unassigned)",
      files: unassignedFiles.length,
      linesOfCode: unassignedFiles.reduce((sum, file) => sum + file.linesOfCode, 0),
      contributors: null,
      risk: "",
    })
  }

  return {
    totalComponents: components.length,
    singleOwnerComponents,
    lowBackupComponents,
    distributedComponents,
    unassignedFiles: unassignedFiles.length,
    topComponents: inventory
      .filter((entry) => entry.name !== "(unassigned)")
      .slice(0, 15)
      .map((entry) => ({
        name: entry.name,
        files: entry.files,
        linesOfCode: entry.linesOfCode,
        contributors: entry.contributors ?? 0,
        risk: entry.risk,
      })),
    inventory,
  }
}

function readUnitInventory(dataDir: string): ReadonlyArray<ReportUnitRecord> {
  const raw = readJsonRecord(dataDir, "units.json")
  const units = Array.isArray(raw?.units)
    ? raw.units.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []

  return units
    .map((unit) => ({
      shortName: typeof unit.shortName === "string" ? unit.shortName : "",
      relativeFileName: typeof unit.relativeFileName === "string" ? unit.relativeFileName : "",
      linesOfCode: typeof unit.linesOfCode === "number" ? unit.linesOfCode : 0,
      mcCabeIndex: typeof unit.mcCabeIndex === "number" ? unit.mcCabeIndex : 0,
      numberOfParameters: typeof unit.numberOfParameters === "number" ? unit.numberOfParameters : 0,
      startLine: typeof unit.startLine === "number" ? unit.startLine : 0,
      endLine: typeof unit.endLine === "number" ? unit.endLine : 0,
    }))
    .filter((unit) => unit.shortName.length > 0 && unit.relativeFileName.length > 0)
}

function readContributorDetailsByEmail(dataDir: string): Map<string, Record<string, unknown>> {
  const detailsDir = join(dataDir, "contributor_details")
  if (!existsSync(detailsDir)) {
    return new Map()
  }

  try {
    const detailsByEmail = new Map<string, Record<string, unknown>>()
    for (const fileName of readdirSync(detailsDir)) {
      if (!fileName.endsWith(".json")) {
        continue
      }

      const record = readJsonRecord(detailsDir, fileName)
      const email = record?.email
      if (!record || typeof email !== "string") {
        continue
      }

      detailsByEmail.set(email, record)
    }

    return detailsByEmail
  } catch {
    return new Map()
  }
}

function getContributorStatus(input: {
  readonly isRookie: boolean
  readonly isActive: boolean
}): "Rookie" | "Active" | "Inactive" {
  if (input.isRookie) {
    return "Rookie"
  }

  return input.isActive ? "Active" : "Inactive"
}

function getContributorDisplayName(input: { readonly email: string; readonly userName: string }): string {
  return input.userName.trim().length > 0 ? input.userName : input.email
}

function getPrimaryComponent(detail: Record<string, unknown> | undefined): string {
  const logicalComponents = detail?.logicalComponents
  if (!Array.isArray(logicalComponents)) {
    return ""
  }

  const best = logicalComponents
    .filter((component): component is Record<string, unknown> => typeof component === "object" && component !== null)
    .sort((left, right) => {
      const leftLoc = typeof left.linesOfCode === "number" ? left.linesOfCode : -1
      const rightLoc = typeof right.linesOfCode === "number" ? right.linesOfCode : -1
      return rightLoc - leftLoc
    })[0]

  return typeof best?.name === "string" ? best.name : ""
}

function getKnowledgeSignal(componentsTouched: number | null): string {
  if (componentsTouched === 1) {
    return "Single-component specialist"
  }

  if (componentsTouched !== null && componentsTouched >= 5) {
    return "Cross-context knowledge"
  }

  return ""
}

function groupMetricId(id: string): string {
  if (id === "TOTAL_NUMBER_OF_FILES" || id.startsWith("NUMBER_OF_FILES_")) {
    return "NUMBER_OF_FILES"
  }
  if (id.startsWith("LINES_OF_CODE_") || id.startsWith("TEST_VS_MAIN_LINES_OF_CODE")) {
    return "LINES_OF_CODE"
  }
  if (
    id.startsWith("NUMBER_OF_UNITS") ||
    id.startsWith("LINES_OF_CODE_IN_UNITS") ||
    id.startsWith("LINES_OF_CODE_OUTSIDE_UNITS")
  ) {
    return "UNITS"
  }
  if (id.includes("_RISK_FILE_SIZE_")) return "FILE_SIZE_RISK"
  if (id.startsWith("CONDITIONAL_COMPLEXITY_")) return "CONDITIONAL_COMPLEXITY"
  if (id.startsWith("FILE_CHANGE_HISTORY_")) return "FILE_CHANGE_HISTORY"
  if (id.startsWith("FILE_AGE_")) return "FILE_AGE"
  if (id.startsWith("NUMBER_OF_DEPENDENCIES_") || id.startsWith("NUMBER_OF_PLACES_WITH_CYCLIC_DEPENDENCIES_")) {
    return "DEPENDENCIES"
  }
  if (id.startsWith("DUPLICATION_") || id.startsWith("UNIT_DUPLICATES_")) {
    return "DUPLICATION"
  }
  if (id.startsWith("NUMBER_OF_CONTRIBUTORS")) return "TEAM"
  if (id.startsWith("TOTAL_ANALYSIS_TIME_")) return "ANALYSIS"

  const parts = id.split("_")
  return parts.slice(0, Math.min(3, parts.length)).join("_")
}

function formatMetricGroupLabel(group: string): string {
  const labels: Record<string, string> = {
    NUMBER_OF_FILES: "Files",
    LINES_OF_CODE: "Lines of Code",
    UNITS: "Units",
    FILE_SIZE_RISK: "File Size Risk",
    CONDITIONAL_COMPLEXITY: "Conditional Complexity",
    FILE_CHANGE_HISTORY: "File Change History",
    FILE_AGE: "File Age",
    DEPENDENCIES: "Dependencies",
    DUPLICATION: "Duplication",
    TEAM: "Team",
    ANALYSIS: "Analysis",
  }

  return labels[group] ?? group.replaceAll("_", " ").toLowerCase()
}

function sortMetricGroups(left: string, right: string): number {
  const groupOrder = [
    "LINES_OF_CODE",
    "NUMBER_OF_FILES",
    "UNITS",
    "CONDITIONAL_COMPLEXITY",
    "FILE_SIZE_RISK",
    "FILE_AGE",
    "DEPENDENCIES",
    "FILE_CHANGE_HISTORY",
    "TEAM",
    "DUPLICATION",
    "ANALYSIS",
  ]
  const leftIndex = groupOrder.indexOf(left)
  const rightIndex = groupOrder.indexOf(right)
  const resolvedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex
  const resolvedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex

  if (resolvedLeft !== resolvedRight) {
    return resolvedLeft - resolvedRight
  }

  return left.localeCompare(right)
}

function isReportMode(value: unknown): value is "single_repository" | "landscape" {
  return value === "single_repository" || value === "landscape"
}

export function readReportContextSummary(dataDir: string): ReportContextSummary | null {
  const context = readReportContext(dataDir)
  if (!context) {
    return null
  }

  const mode = context.mode
  const reportMode = context.reportMode
  const title = context.title
  const rootRoute = context.rootRoute
  const dataVersion = context.dataVersion
  const source = context.source
  const hasLandscape = context.hasLandscape
  const hasSingleRepositoryAnalysis = context.hasSingleRepositoryAnalysis
  const primaryNavigation = context.primaryNavigation

  if (
    !isReportMode(mode) ||
    !isReportMode(reportMode) ||
    typeof title !== "string" ||
    typeof rootRoute !== "string" ||
    typeof dataVersion !== "number" ||
    typeof source !== "string" ||
    typeof hasLandscape !== "boolean" ||
    typeof hasSingleRepositoryAnalysis !== "boolean" ||
    !Array.isArray(primaryNavigation) ||
    !primaryNavigation.every((item) => typeof item === "string")
  ) {
    return null
  }

  return {
    mode,
    reportMode,
    title,
    rootRoute,
    dataVersion,
    source,
    hasLandscape,
    hasSingleRepositoryAnalysis,
    primaryNavigation,
  }
}

export function readReportArtifactSummary(
  dataDir: string,
  context: ReportContextSummary | null,
): ReportArtifactSummary | null {
  if (context?.reportMode === "landscape") {
    const overview = readJsonRecord(dataDir, "landscape_overview.json")
    const title = overview?.title
    const landscapeName = overview?.landscapeName
    const repositoryCount = overview?.repositoryCount
    const contributorCount = overview?.contributorCount
    const totals =
      overview?.totals && typeof overview.totals === "object" ? (overview.totals as Record<string, unknown>) : null
    const totalLinesOfCode = totals?.totalLinesOfCode
    const commits30d = totals?.commits30d
    const commits90d = totals?.commits90d

    if (
      typeof title !== "string" ||
      typeof landscapeName !== "string" ||
      typeof repositoryCount !== "number" ||
      typeof contributorCount !== "number" ||
      typeof totalLinesOfCode !== "number" ||
      typeof commits30d !== "number" ||
      typeof commits90d !== "number"
    ) {
      return null
    }

    return {
      kind: "landscape",
      title,
      landscapeName,
      repositoryCount,
      contributorCount,
      totalLinesOfCode,
      commits30d,
      commits90d,
    }
  }

  const analysis = readJsonRecord(dataDir, "analysisResults.json")
  const metadata =
    analysis?.metadata && typeof analysis.metadata === "object" ? (analysis.metadata as Record<string, unknown>) : null
  const duplication =
    analysis?.duplication && typeof analysis.duplication === "object"
      ? (analysis.duplication as Record<string, unknown>)
      : null
  const projectName = metadata?.name
  const filesCount = analysis?.filesCount
  const linesOfCode = analysis?.linesOfCode
  const duplicatedLines = duplication?.duplicatedLines
  const duplicationPercentage = duplication?.percentage

  if (
    typeof projectName !== "string" ||
    typeof filesCount !== "number" ||
    typeof linesOfCode !== "number" ||
    typeof duplicatedLines !== "number" ||
    typeof duplicationPercentage !== "number"
  ) {
    return null
  }

  return {
    kind: "single_repository",
    projectName,
    filesCount,
    linesOfCode,
    duplicatedLines,
    duplicationPercentage,
  }
}

export function readReportLandscapeOverviewSummary(dataDir: string): ReportLandscapeOverviewSummary | null {
  const overview = readJsonRecord(dataDir, "landscape_overview.json")
  if (!overview) {
    return null
  }

  const title = typeof overview.title === "string" ? overview.title : null
  const landscapeName = typeof overview.landscapeName === "string" ? overview.landscapeName : null
  const repositoryCount = typeof overview.repositoryCount === "number" ? overview.repositoryCount : null
  const contributorCount = typeof overview.contributorCount === "number" ? overview.contributorCount : null
  const totals =
    overview.totals && typeof overview.totals === "object" ? (overview.totals as Record<string, unknown>) : null

  if (!title || !landscapeName || repositoryCount === null || contributorCount === null || !totals) {
    return null
  }

  const mainLinesOfCode = typeof totals.mainLinesOfCode === "number" ? totals.mainLinesOfCode : null
  const totalLinesOfCode = typeof totals.totalLinesOfCode === "number" ? totals.totalLinesOfCode : null
  const contributorCount30Days =
    typeof totals.contributorCount30Days === "number" ? totals.contributorCount30Days : null
  const commits30d = typeof totals.commits30d === "number" ? totals.commits30d : null
  const commits90d = typeof totals.commits90d === "number" ? totals.commits90d : null

  if (
    mainLinesOfCode === null ||
    totalLinesOfCode === null ||
    contributorCount30Days === null ||
    commits30d === null ||
    commits90d === null
  ) {
    return null
  }

  const languages = Array.isArray(overview.languages)
    ? overview.languages
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => {
          const extension = typeof item.extension === "string" ? item.extension : null
          const linesOfCode = typeof item.linesOfCode === "number" ? item.linesOfCode : null
          const repositories = typeof item.repositories === "number" ? item.repositories : null

          if (!extension || linesOfCode === null || repositories === null) {
            return null
          }

          return {
            extension,
            linesOfCode,
            repositories,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : []

  const topRepositories = Array.isArray(overview.topRepositories)
    ? overview.topRepositories
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => {
          const name = typeof item.name === "string" ? item.name : null
          const repoKey = typeof item.repoKey === "string" ? item.repoKey : null
          const mainLinesOfCode = typeof item.mainLinesOfCode === "number" ? item.mainLinesOfCode : null
          const contributors = typeof item.contributors === "number" ? item.contributors : null
          const latestCommitDate = toISODateStringOrNull(item.latestCommitDate)

          if (!name || !repoKey || mainLinesOfCode === null || contributors === null || latestCommitDate === null) {
            return null
          }

          return {
            name,
            repoKey,
            mainLinesOfCode,
            contributors,
            latestCommitDate,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : []

  const tags = readJsonRecord(dataDir, "landscape_tags.json")
  const tagCount = typeof tags?.tagCount === "number" ? tags.tagCount : 0

  const teams = readJsonRecord(dataDir, "landscape_teams.json")
  const teamCount =
    typeof teams?.teamCount === "number" ? teams.teamCount : Array.isArray(teams?.teams) ? teams.teams.length : 0

  return {
    title,
    landscapeName,
    repositoryCount,
    contributorCount,
    teamCount,
    tagCount,
    totals: {
      mainLinesOfCode,
      totalLinesOfCode,
      contributorCount30Days,
      commits30d,
      commits90d,
    },
    languages,
    topRepositories,
  }
}

export function readReportLandscapeTagsSummary(dataDir: string): ReportLandscapeTagsSummary {
  const tags = readJsonRecord(dataDir, "landscape_tags.json")
  const tagMatrix = readJsonRecord(dataDir, "landscape_tag_matrix.json")

  const groups = Array.isArray(tags?.groups)
    ? tags.groups.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []

  const rows = groups.flatMap((group) => {
    const groupName = typeof group.name === "string" ? group.name : "Unknown"
    const groupTags = Array.isArray(group.tags)
      ? group.tags.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : []

    return groupTags.map((tag) => {
      const tagKey = typeof tag.key === "string" ? tag.key : ""
      const repositories = Array.isArray(tag.repositories)
        ? tag.repositories
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .map((repository) => (typeof repository.name === "string" ? repository.name : null))
            .filter((name): name is string => name !== null)
        : []

      return {
        id: `${groupName}:${tagKey}`,
        group: groupName,
        tag: typeof tag.name === "string" ? tag.name : "Unknown",
        repositoryCount: typeof tag.repositoryCount === "number" ? tag.repositoryCount : 0,
        totalMainLinesOfCode: typeof tag.totalMainLinesOfCode === "number" ? tag.totalMainLinesOfCode : 0,
        repositories,
      }
    })
  })

  const untaggedRepositories = Array.isArray(tagMatrix?.repositories)
    ? tagMatrix.repositories
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .filter((repository) => repository.isUntagged === true)
        .map((repository) => (typeof repository.name === "string" ? repository.name : null))
        .filter((name): name is string => name !== null)
    : []

  return {
    groupCount: typeof tags?.groupCount === "number" ? tags.groupCount : groups.length,
    tagCount: typeof tags?.tagCount === "number" ? tags.tagCount : rows.length,
    untaggedRepositoryCount:
      typeof tags?.untaggedRepositoryCount === "number" ? tags.untaggedRepositoryCount : untaggedRepositories.length,
    tags: rows,
    untaggedRepositories,
  }
}

export function readReportLandscapeTeamsSummary(dataDir: string): ReportLandscapeTeamsSummary {
  const teams = readJsonRecord(dataDir, "landscape_teams.json")
  const items = Array.isArray(teams?.teams) ? teams.teams : []

  const rows = items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item, index) => {
      const id =
        (typeof item.id === "string" && item.id) ||
        (typeof item.name === "string" && item.name) ||
        (typeof item.key === "string" && item.key) ||
        `teams-${index + 1}`
      const members = Array.isArray(item.members)
        ? item.members.filter((member): member is string => typeof member === "string")
        : []
      const repositories = Array.isArray(item.repositories)
        ? item.repositories
            .filter(
              (repository): repository is Record<string, unknown> =>
                typeof repository === "object" && repository !== null,
            )
            .map((repository) => (typeof repository.name === "string" ? repository.name : null))
            .filter((repository): repository is string => repository !== null)
        : []

      return {
        id,
        name: typeof item.name === "string" ? item.name : "Unknown Team",
        description: typeof item.description === "string" && item.description.length > 0 ? item.description : "—",
        commitsCount: typeof item.commitsCount === "number" ? item.commitsCount : 0,
        commits30d:
          typeof item.commitsCount30Days === "number"
            ? item.commitsCount30Days
            : typeof item.commits30d === "number"
              ? item.commits30d
              : 0,
        memberCount: typeof item.memberCount === "number" ? item.memberCount : members.length,
        repositoryCount: typeof item.repositoryCount === "number" ? item.repositoryCount : repositories.length,
        latestCommitDate: toISODateString(item.latestCommitDate),
        members,
        repositories,
      }
    })

  return {
    totalTeams: typeof teams?.teamCount === "number" ? teams.teamCount : rows.length,
    totalMembers: rows.reduce((sum, team) => sum + team.memberCount, 0),
    totalRepositoryTouches: rows.reduce((sum, team) => sum + team.repositoryCount, 0),
    teams: rows,
  }
}

export function readReportContributorsSummary(dataDir: string): ReadonlyArray<ReportContributorSummary> {
  const text = readTextFile(dataDir, "contributors.txt")
  if (!text) {
    return []
  }

  const contributorDetailsByEmail = readContributorDetailsByEmail(dataDir)
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) {
    return []
  }

  return lines
    .slice(1)
    .map((line): ReportContributorSummary | null => {
      const cols = line.split("\t")
      if (cols.length < 8) {
        return null
      }

      const email = cols[0]?.trim() ?? ""
      if (email.length === 0) {
        return null
      }

      const userName = cols[9]?.trim() ?? ""
      const isRookie = cols[10]?.trim() === "true"
      const isActive = cols[11]?.trim() === "true"
      const detail = contributorDetailsByEmail.get(email)
      const files = detail?.files
      const logicalComponents = detail?.logicalComponents
      const filesTouched = Array.isArray(files) ? files.length : null
      const componentsTouched = Array.isArray(logicalComponents) ? logicalComponents.length : null

      return {
        email,
        userName,
        displayName: getContributorDisplayName({ email, userName }),
        status: getContributorStatus({ isRookie, isActive }),
        commitsAllTime: parseInt(cols[1] ?? "", 10) || 0,
        commits30Days: parseInt(cols[2] ?? "", 10) || 0,
        commits90Days: parseInt(cols[3] ?? "", 10) || 0,
        commits180Days: parseInt(cols[4] ?? "", 10) || 0,
        commits365Days: parseInt(cols[5] ?? "", 10) || 0,
        firstCommit: cols[6]?.trim() ?? "",
        lastCommit: cols[7]?.trim() ?? "",
        percentage: cols[8]?.trim() ?? "",
        filesTouched,
        componentsTouched,
        primaryComponent: getPrimaryComponent(detail),
        knowledgeSignal: getKnowledgeSignal(componentsTouched),
        repositoryCount: null,
        latestCommitDate: cols[7]?.trim() ?? "",
        isBot: null,
        repositories: [],
      }
    })
    .filter((contributor): contributor is ReportContributorSummary => contributor !== null)
    .sort((left, right) => right.commitsAllTime - left.commitsAllTime)
}

export function readReportLandscapeContributorsSummary(dataDir: string): LandscapeContributorSummary | null {
  const raw = readJsonRecord(dataDir, "landscape_contributors.json")
  if (!raw || typeof raw !== "object") {
    return null
  }

  const rawRecord = raw as Record<string, unknown>
  const contributors: ReadonlyArray<unknown> = Array.isArray(rawRecord.contributors) ? rawRecord.contributors : []

  const items = contributors
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item): ReportContributorSummary => {
      const email = typeof item.email === "string" ? item.email : ""
      const displayName =
        typeof item.displayName === "string" && item.displayName.length > 0
          ? item.displayName
          : typeof item.name === "string" && item.name.length > 0
            ? item.name
            : email
      const repositories: ReadonlyArray<ReportContributorSummary["repositories"][number]> = Array.isArray(
        item.repositories,
      )
        ? item.repositories
            .filter(
              (repository): repository is Record<string, unknown> =>
                typeof repository === "object" && repository !== null,
            )
            .map((repository) => ({
              name: typeof repository.name === "string" ? repository.name : "",
              repoKey: typeof repository.repoKey === "string" ? repository.repoKey : "",
            }))
            .filter((repository) => repository.name.length > 0)
        : []

      const commitsAllTime = typeof item.commitsCount === "number" ? item.commitsCount : 0
      const commits30Days =
        typeof item.commitsCount30Days === "number"
          ? item.commitsCount30Days
          : typeof item.commits30d === "number"
            ? item.commits30d
            : 0
      const commits90Days =
        typeof item.commitsCount90Days === "number"
          ? item.commitsCount90Days
          : typeof item.commits90d === "number"
            ? item.commits90d
            : 0
      const commits180Days =
        typeof item.commitsCount180Days === "number"
          ? item.commitsCount180Days
          : typeof item.commits180d === "number"
            ? item.commits180d
            : 0
      const commits365Days =
        typeof item.commitsCount365Days === "number"
          ? item.commitsCount365Days
          : typeof item.commits365d === "number"
            ? item.commits365d
            : 0
      const repositoryCount = typeof item.repositoryCount === "number" ? item.repositoryCount : repositories.length

      return {
        email,
        userName: typeof item.name === "string" ? item.name : "",
        displayName,
        status:
          commits30Days > 0 ? ("Active" as const) : commitsAllTime > 0 ? ("Inactive" as const) : ("Rookie" as const),
        commitsAllTime,
        commits30Days,
        commits90Days,
        commits180Days,
        commits365Days,
        firstCommit: toISODateString(item.firstCommitDate),
        lastCommit: toISODateString(item.latestCommitDate),
        percentage: "",
        filesTouched: null,
        componentsTouched: null,
        primaryComponent: "",
        knowledgeSignal: repositoryCount >= 3 ? "Cross-context knowledge" : "",
        repositoryCount,
        latestCommitDate: toISODateString(item.latestCommitDate),
        isBot: item.isBot === true,
        repositories,
      }
    })
    .filter((contributor) => contributor.email.length > 0)
    .sort((left, right) => right.commitsAllTime - left.commitsAllTime)

  if (items.length === 0) {
    return null
  }

  return {
    totalContributors: items.length,
    active30d: items.filter((contributor) => contributor.commits30Days > 0).length,
    multiRepoCount: items.filter((contributor) => (contributor.repositoryCount ?? 0) > 1).length,
    botCount: items.filter((contributor) => contributor.isBot === true).length,
    contributors: items,
  }
}

function readContributorImpactEntry(dataDir: string, email: string): ReportContributorDetail["impact"] {
  const impact = readJsonRecord(dataDir, "contributor_impact.json")
  const periods = Array.isArray(impact?.periods) ? impact.periods : []
  const allTimePeriod = periods.find(
    (period): period is Record<string, unknown> =>
      typeof period === "object" && period !== null && (period as Record<string, unknown>).period_key === "all_time",
  )
  const contributors = Array.isArray(allTimePeriod?.contributors)
    ? allTimePeriod.contributors.filter(
        (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
      )
    : []
  const entry = contributors.find((c) => c.email === email) as Record<string, unknown> | undefined
  if (!entry) {
    return null
  }
  return {
    glueScore: typeof entry.glue_score === "number" ? entry.glue_score : 0,
    snackingScore: typeof entry.snacking_score === "number" ? entry.snacking_score : 0,
    structuralImpactScore: typeof entry.structural_impact_score === "number" ? entry.structural_impact_score : 0,
    visibleActivityScore: typeof entry.visible_activity_score === "number" ? entry.visible_activity_score : 0,
    dominantDimension: typeof entry.dominant_dimension === "string" ? entry.dominant_dimension : "",
    isGlue: entry.is_glue === true,
    isSnacking: entry.is_snacking === true,
    reasons: Array.isArray(entry.reasons) ? entry.reasons.filter((r): r is string => typeof r === "string") : [],
  }
}

export function readReportContributorDetail(dataDir: string, email: string): ReportContributorDetail | null {
  const contributorDetailsByEmail = readContributorDetailsByEmail(dataDir)
  const detail = contributorDetailsByEmail.get(email)
  if (!detail) {
    return null
  }

  const summaries = readReportContributorsSummary(dataDir)
  const summaryByEmail = new Map(summaries.map((summary) => [summary.email, summary] as const))
  const summary = summaryByEmail.get(email)
  const collaborators = Array.isArray(detail.collaborators)
    ? detail.collaborators
        .filter(
          (collaborator): collaborator is Record<string, unknown> =>
            typeof collaborator === "object" && collaborator !== null,
        )
        .map((collaborator) => {
          const collaboratorEmail = typeof collaborator.email === "string" ? collaborator.email : ""
          const summaryMatch = summaryByEmail.get(collaboratorEmail)

          return {
            email: collaboratorEmail,
            displayName:
              summaryMatch?.displayName ??
              getContributorDisplayName({
                email: collaboratorEmail,
                userName: "",
              }),
            sharedFiles: typeof collaborator.sharedFiles === "number" ? collaborator.sharedFiles : 0,
          }
        })
    : []
  const topCollaborator = collaborators[0] ?? null

  return {
    email,
    userName: typeof detail.userName === "string" ? detail.userName : "",
    displayName:
      summary?.displayName ??
      getContributorDisplayName({
        email,
        userName: typeof detail.userName === "string" ? detail.userName : "",
      }),
    status:
      summary?.status ??
      getContributorStatus({
        isRookie: detail.isRookie === true,
        isActive: detail.isActive === true,
      }),
    commitsCount: typeof detail.commitsCount === "number" ? detail.commitsCount : 0,
    commitsCount30Days: typeof detail.commitsCount30Days === "number" ? detail.commitsCount30Days : 0,
    commitsCount90Days: typeof detail.commitsCount90Days === "number" ? detail.commitsCount90Days : 0,
    commitsCount180Days: typeof detail.commitsCount180Days === "number" ? detail.commitsCount180Days : 0,
    commitsCount365Days: typeof detail.commitsCount365Days === "number" ? detail.commitsCount365Days : 0,
    firstCommitDate: toISODateString(detail.firstCommitDate),
    latestCommitDate: toISODateString(detail.latestCommitDate),
    percentage: summary?.percentage ?? "",
    activeDays: Array.isArray(detail.dailyActivity) ? detail.dailyActivity.length : 0,
    filesCount: Array.isArray(detail.files) ? detail.files.length : 0,
    collaboratorsCount: collaborators.length,
    topCollaboratorEmail: topCollaborator?.email ?? null,
    topCollaboratorDisplayName: topCollaborator?.displayName ?? null,
    extensions: Array.isArray(detail.extensions)
      ? detail.extensions
          .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
          .map((entry) => ({
            extension: typeof entry.extension === "string" ? entry.extension : "",
            commits: typeof entry.commits === "number" ? entry.commits : 0,
            files: typeof entry.files === "number" ? entry.files : 0,
          }))
      : [],
    logicalComponents: Array.isArray(detail.logicalComponents)
      ? detail.logicalComponents
          .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
          .map((entry) => ({
            name: typeof entry.name === "string" ? entry.name : "",
            files: typeof entry.files === "number" ? entry.files : 0,
            linesOfCode: typeof entry.linesOfCode === "number" ? entry.linesOfCode : 0,
          }))
          .sort((left, right) => right.linesOfCode - left.linesOfCode)
      : [],
    collaborators: collaborators.sort((left, right) => right.sharedFiles - left.sharedFiles),
    topFiles: Array.isArray(detail.files)
      ? detail.files
          .filter((file): file is Record<string, unknown> => typeof file === "object" && file !== null)
          .map((file) => ({
            relativePath: typeof file.relativePath === "string" ? file.relativePath : "",
            extension: typeof file.extension === "string" ? file.extension : "",
            commits: typeof file.commits === "number" ? file.commits : 0,
            logicalComponents: Array.isArray(file.logicalComponents)
              ? file.logicalComponents.filter((item): item is string => typeof item === "string")
              : [],
            concerns: Array.isArray(file.concerns)
              ? file.concerns.filter((item): item is string => typeof item === "string")
              : [],
          }))
          .sort((left, right) => right.commits - left.commits)
          .slice(0, 10)
      : [],
    dailyActivity: Array.isArray(detail.dailyActivity)
      ? detail.dailyActivity
          .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
          .map((entry) => ({
            date: toISODateString(entry.date),
            commits: typeof entry.commits === "number" ? entry.commits : 0,
          }))
          .filter((entry) => entry.date.length > 0)
      : [],
    impact: readContributorImpactEntry(dataDir, email),
  }
}

export function readReportTopologySummary(dataDir: string): ReportTopologySummary | null {
  const periodFiles = [
    ["All Time", "people_dependencies.json"],
    ["1 Year", "people_dependencies_365d.json"],
    ["6 Months", "people_dependencies_180d.json"],
    ["Quarter", "people_dependencies_90d.json"],
    ["Month", "people_dependencies_30d.json"],
  ] as const

  const contributorNames = new Map<string, string>()
  const impact = readJsonRecord(dataDir, "contributor_impact.json")
  const periods = Array.isArray(impact?.periods) ? impact.periods : []
  const allTimePeriod = periods.find(
    (period) =>
      typeof period === "object" && period !== null && (period as Record<string, unknown>).period_key === "all_time",
  ) as Record<string, unknown> | undefined
  const contributors = Array.isArray(allTimePeriod?.contributors)
    ? allTimePeriod.contributors.filter(
        (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
      )
    : []
  for (const contributor of contributors) {
    if (typeof contributor.email === "string" && typeof contributor.display_name === "string") {
      contributorNames.set(contributor.email, contributor.display_name)
    }
  }

  const strongestConnections: ReportTopologyConnection[] = []
  const periodsData: Record<string, ReadonlyArray<TopologyPeopleDep>> = {}
  for (const [periodLabel, fileName] of periodFiles) {
    const filePath = join(dataDir, fileName)
    if (!existsSync(filePath)) {
      continue
    }

    let best: ReportTopologyConnection | undefined
    try {
      const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown
      if (!Array.isArray(raw) || raw.length === 0) {
        continue
      }

      const edges = raw
        .filter((edge): edge is Record<string, unknown> => typeof edge === "object" && edge !== null)
        .map((edge) => ({
          from: typeof edge.from === "string" ? edge.from : "",
          to: typeof edge.to === "string" ? edge.to : "",
          count: typeof edge.count === "number" ? edge.count : 0,
          files: Array.isArray(edge.files) ? edge.files.filter((f): f is string => typeof f === "string") : [],
        }))
        .filter((edge) => edge.from.length > 0 && edge.to.length > 0)

      if (edges.length === 0) continue

      periodsData[periodLabel] = edges

      best = edges
        .map((edge) => ({
          periodLabel,
          from: edge.from,
          fromDisplayName: contributorNames.get(edge.from) ?? edge.from,
          to: edge.to,
          toDisplayName: contributorNames.get(edge.to) ?? edge.to,
          sharedCommits: edge.count,
          filesCount: edge.files.length,
        }))
        .sort((left, right) => right.sharedCommits - left.sharedCommits)[0]
    } catch {
      continue
    }

    if (best) {
      strongestConnections.push(best)
    }
  }

  const topGlueContributors = contributors
    .filter((entry) => typeof entry.glue_score === "number")
    .map((entry) => ({
      email: typeof entry.email === "string" ? entry.email : "",
      displayName: typeof entry.display_name === "string" ? entry.display_name : "",
      glueScore: entry.glue_score as number,
      dominantDimension: typeof entry.dominant_dimension === "string" ? entry.dominant_dimension : "",
    }))
    .filter((entry) => entry.email.length > 0)
    .sort((left, right) => right.glueScore - left.glueScore)
    .slice(0, 5)

  const topSnackingContributors = contributors
    .filter((entry) => typeof entry.snacking_score === "number")
    .map((entry) => ({
      email: typeof entry.email === "string" ? entry.email : "",
      displayName: typeof entry.display_name === "string" ? entry.display_name : "",
      snackingScore: entry.snacking_score as number,
      dominantDimension: typeof entry.dominant_dimension === "string" ? entry.dominant_dimension : "",
    }))
    .filter((entry) => entry.email.length > 0)
    .sort((left, right) => right.snackingScore - left.snackingScore)
    .slice(0, 5)

  if (strongestConnections.length === 0 && topGlueContributors.length === 0 && topSnackingContributors.length === 0) {
    return null
  }

  const periodKeyToLabel: Record<string, string> = {
    all_time: "All Time",
    "365d": "1 Year",
    "180d": "6 Months",
    "90d": "Quarter",
    "30d": "Month",
  }

  const impactPeriods: Record<string, ReadonlyArray<TopologyContributorImpact>> = {}
  for (const period of periods) {
    if (typeof period !== "object" || period === null) continue
    const p = period as Record<string, unknown>
    const key = typeof p.period_key === "string" ? p.period_key : null
    if (!key) continue
    const label = periodKeyToLabel[key]
    if (!label) continue
    const rawContributors = Array.isArray(p.contributors) ? p.contributors : []
    impactPeriods[label] = rawContributors
      .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
      .map(
        (entry): TopologyContributorImpact => ({
          email: typeof entry.email === "string" ? entry.email : "",
          display_name: typeof entry.display_name === "string" ? entry.display_name : "",
          glue_score: typeof entry.glue_score === "number" ? entry.glue_score : 0,
          snacking_score: typeof entry.snacking_score === "number" ? entry.snacking_score : 0,
          structural_impact_score:
            typeof entry.structural_impact_score === "number" ? entry.structural_impact_score : 0,
          visible_activity_score: typeof entry.visible_activity_score === "number" ? entry.visible_activity_score : 0,
          collaborator_count: typeof entry.collaborator_count === "number" ? entry.collaborator_count : 0,
          shared_files_count: typeof entry.shared_files_count === "number" ? entry.shared_files_count : 0,
          commits_count: typeof entry.commits_count === "number" ? entry.commits_count : 0,
          files_touched: typeof entry.files_touched === "number" ? entry.files_touched : 0,
          components_touched: typeof entry.components_touched === "number" ? entry.components_touched : 0,
          dominant_dimension: typeof entry.dominant_dimension === "string" ? entry.dominant_dimension : "",
          dimensions:
            typeof entry.dimensions === "object" && entry.dimensions !== null
              ? Object.fromEntries(
                  Object.entries(entry.dimensions as Record<string, unknown>).map(([k, v]) => [
                    k,
                    typeof v === "number" ? v : 0,
                  ]),
                )
              : {},
          top_components: Array.isArray(entry.top_components)
            ? entry.top_components
                .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
                .map((c) => ({
                  name: typeof c.name === "string" ? c.name : "",
                  files: typeof c.files === "number" ? c.files : 0,
                  commits: typeof c.commits === "number" ? c.commits : 0,
                }))
            : [],
          top_routes: Array.isArray(entry.top_routes)
            ? entry.top_routes.filter((r): r is string => typeof r === "string")
            : [],
          reasons: Array.isArray(entry.reasons) ? entry.reasons.filter((r): r is string => typeof r === "string") : [],
          is_glue: typeof entry.is_glue === "boolean" ? entry.is_glue : false,
          is_snacking: typeof entry.is_snacking === "boolean" ? entry.is_snacking : false,
        }),
      )
      .filter((entry) => entry.email.length > 0)
  }

  return {
    availablePeriods: strongestConnections.map((edge) => edge.periodLabel),
    strongestConnections,
    topGlueContributors,
    topSnackingContributors,
    periodsData,
    impactPeriods,
  }
}

export function readReportLandscapeTopologySummary(dataDir: string): ReportTopologySummary | null {
  const raw = readJsonRecord(dataDir, "landscape_topology.json")
  const periods = Array.isArray(raw?.periods)
    ? raw.periods.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []

  if (periods.length === 0) {
    return null
  }

  const availablePeriods = periods
    .map((period) => (typeof period.periodLabel === "string" ? period.periodLabel : ""))
    .filter((label) => label.length > 0)

  const strongestConnections = periods
    .flatMap((period) => {
      const periodLabel = typeof period.periodLabel === "string" ? period.periodLabel : ""
      const strongest = Array.isArray(period.strongestConnections)
        ? period.strongestConnections.filter(
            (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
          )
        : []

      return strongest.map((connection) => ({
        periodLabel,
        from: typeof connection.from === "string" ? connection.from : "",
        fromDisplayName: typeof connection.from === "string" ? connection.from : "",
        to: typeof connection.to === "string" ? connection.to : "",
        toDisplayName: typeof connection.to === "string" ? connection.to : "",
        sharedCommits: typeof connection.sharedFilesCount === "number" ? connection.sharedFilesCount : 0,
        filesCount: Array.isArray(connection.sharedFiles)
          ? connection.sharedFiles.length
          : typeof connection.sharedFilesCount === "number"
            ? connection.sharedFilesCount
            : 0,
      }))
    })
    .filter((connection) => connection.from.length > 0 && connection.to.length > 0)
    .sort((left, right) => right.sharedCommits - left.sharedCommits)
    .slice(0, 8)

  const contributorMaxima = new Map<
    string,
    {
      displayName: string
      connectionCount: number
      sharedFilesCount: number
    }
  >()

  for (const period of periods) {
    const contributors = Array.isArray(period.contributors)
      ? period.contributors.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : []

    for (const contributor of contributors) {
      const email = typeof contributor.email === "string" ? contributor.email : ""
      if (email.length === 0) {
        continue
      }

      const current = contributorMaxima.get(email) ?? {
        displayName: typeof contributor.displayName === "string" ? contributor.displayName : email,
        connectionCount: 0,
        sharedFilesCount: 0,
      }

      contributorMaxima.set(email, {
        displayName: typeof contributor.displayName === "string" ? contributor.displayName : current.displayName,
        connectionCount: Math.max(
          current.connectionCount,
          typeof contributor.connectionCount === "number" ? contributor.connectionCount : 0,
        ),
        sharedFilesCount: Math.max(
          current.sharedFilesCount,
          typeof contributor.sharedFilesCount === "number" ? contributor.sharedFilesCount : 0,
        ),
      })
    }
  }

  const contributorEntries = [...contributorMaxima.entries()]

  const topGlueContributors = contributorEntries
    .map(([email, contributor]) => ({
      email,
      displayName: contributor.displayName,
      glueScore: contributor.connectionCount,
      dominantDimension: "shared_connections",
    }))
    .sort((left, right) => right.glueScore - left.glueScore)
    .slice(0, 5)

  const topSnackingContributors = contributorEntries
    .map(([email, contributor]) => ({
      email,
      displayName: contributor.displayName,
      snackingScore: contributor.sharedFilesCount,
      dominantDimension: "shared_files",
    }))
    .sort((left, right) => right.snackingScore - left.snackingScore)
    .slice(0, 5)

  if (
    availablePeriods.length === 0 &&
    strongestConnections.length === 0 &&
    topGlueContributors.length === 0 &&
    topSnackingContributors.length === 0
  ) {
    return null
  }

  return {
    availablePeriods,
    strongestConnections,
    topGlueContributors,
    topSnackingContributors,
    periodsData: {},
    impactPeriods: {},
  }
}

export function readReportFilesView(dataDir: string, view: ReportFileViewName): ReportFilesView | null {
  const fileInventory = readFileInventory(dataDir)

  if (view === "size") {
    if (fileInventory.length === 0) {
      return null
    }

    const sorted = [...fileInventory].sort((left, right) => right.linesOfCode - left.linesOfCode)
    const buckets = [
      { label: "1-50 LOC", min: 1, max: 50, loc: 0, count: 0 },
      { label: "51-100 LOC", min: 51, max: 100, loc: 0, count: 0 },
      { label: "101-200 LOC", min: 101, max: 200, loc: 0, count: 0 },
      { label: "201-500 LOC", min: 201, max: 500, loc: 0, count: 0 },
      { label: "501-1000 LOC", min: 501, max: 1000, loc: 0, count: 0 },
      {
        label: "1001+ LOC",
        min: 1001,
        max: Number.POSITIVE_INFINITY,
        loc: 0,
        count: 0,
      },
    ]

    for (const file of sorted) {
      for (const bucket of buckets) {
        if (file.linesOfCode >= bucket.min && file.linesOfCode <= bucket.max) {
          bucket.count += 1
          bucket.loc += file.linesOfCode
          break
        }
      }
    }

    return {
      view: "size",
      headline: {
        fileCount: sorted.length,
        totalLinesOfCode: sorted.reduce((sum, file) => sum + file.linesOfCode, 0),
      },
      sizeDistribution: buckets
        .filter((bucket) => bucket.count > 0)
        .map((bucket) => ({
          label: bucket.label,
          value: bucket.loc,
          detail: `${bucket.count} files`,
        })),
      largestFiles: sorted.slice(0, 15).map((file) => ({
        label: file.relativePath.split("/").pop() ?? file.relativePath,
        value: file.linesOfCode,
      })),
      rows: sorted,
    }
  }

  const metrics = readMetricsMap(dataDir)

  if (view === "age") {
    const categories = [
      { label: "Negligible Risk", metricId: "FILE_AGE_NEGLIGIBLE_RISK_COUNT" },
      { label: "Low Risk", metricId: "FILE_AGE_LOW_RISK_COUNT" },
      { label: "Medium Risk", metricId: "FILE_AGE_MEDIUM_RISK_COUNT" },
      { label: "High Risk", metricId: "FILE_AGE_HIGH_RISK_COUNT" },
      { label: "Very High Risk", metricId: "FILE_AGE_VERY_HIGH_RISK_COUNT" },
    ]
      .map((category) => ({
        label: category.label,
        value: metrics.get(category.metricId) ?? 0,
      }))
      .filter((category) => category.value > 0)

    const ageInDays = metrics.get("FILE_CHANGE_HISTORY_TOTAL_AGE_DAYS") ?? null
    const activeDays = metrics.get("FILE_CHANGE_HISTORY_ACTIVE_DAYS") ?? null
    const weeks = metrics.get("FILE_CHANGE_HISTORY_WEEKS") ?? null
    if (categories.length === 0 && ageInDays === null && activeDays === null && weeks === null) {
      return null
    }

    return {
      view: "age",
      headline: {
        ageInDays,
        activeDays,
        weeks,
      },
      categories,
    }
  }

  if (view === "churn") {
    const filesWithHistory = fileInventory
      .filter(
        (file): file is ReportFileInventoryRow & { readonly commitsCount: number } =>
          typeof file.commitsCount === "number" && file.commitsCount > 0,
      )
      .sort((left, right) => right.commitsCount - left.commitsCount)

    const activeDays = metrics.get("FILE_CHANGE_HISTORY_ACTIVE_DAYS") ?? null
    const weeks = metrics.get("FILE_CHANGE_HISTORY_WEEKS") ?? null
    const estimatedWorkingDays = metrics.get("FILE_CHANGE_HISTORY_ESTIMATED_WORKING_DAYS") ?? null
    if (filesWithHistory.length === 0 && activeDays === null && weeks === null && estimatedWorkingDays === null) {
      return null
    }

    return {
      view: "churn",
      headline: {
        activeDays,
        weeks,
        estimatedWorkingDays,
        filesWithHistoryCount: filesWithHistory.length,
      },
      mostChangedFiles: filesWithHistory.slice(0, 15).map((file) => ({
        label: file.relativePath.split("/").pop() ?? file.relativePath,
        value: file.commitsCount,
      })),
      rows: filesWithHistory,
    }
  }

  const raw = readJsonRecord(dataDir, "temporal_dependencies.json")
  const dependencies = Array.isArray(raw?.dependencies)
    ? raw.dependencies.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []
  if (view === "temporal") {
    const grouped = new Map<string, Array<Record<string, unknown>>>()
    for (const dependency of dependencies) {
      const key = typeof dependency.periodKey === "string" ? dependency.periodKey : ""
      if (key.length === 0) {
        continue
      }

      const group = grouped.get(key) ?? []
      group.push(dependency)
      grouped.set(key, group)
    }

    const sections = [...grouped.entries()]
      .map(([periodKey, group]) => {
        const first = group[0]
        if (!first) {
          return null
        }

        return {
          periodKey,
          periodLabel: typeof first.periodLabel === "string" ? first.periodLabel : periodKey,
          periodDays: typeof first.periodDays === "number" ? first.periodDays : 0,
          dependencies: group
            .map((dependency) => ({
              file1: typeof dependency.file1 === "string" ? dependency.file1 : "",
              file2: typeof dependency.file2 === "string" ? dependency.file2 : "",
              sameCommits: typeof dependency.sameCommits === "number" ? dependency.sameCommits : 0,
              commitsFile1: typeof dependency.commitsFile1 === "number" ? dependency.commitsFile1 : 0,
              commitsFile2: typeof dependency.commitsFile2 === "number" ? dependency.commitsFile2 : 0,
              latestCommit: typeof dependency.latestCommit === "string" ? dependency.latestCommit : "",
            }))
            .filter((dependency) => dependency.file1.length > 0 && dependency.file2.length > 0)
            .sort((left, right) => right.sameCommits - left.sameCommits),
        }
      })
      .filter((section): section is NonNullable<typeof section> => section !== null)
      .sort((left, right) => left.periodDays - right.periodDays)

    return {
      view: "temporal",
      sections,
    }
  }

  return null
}

export function readReportUnitsView(dataDir: string, view: ReportUnitViewName): ReportUnitsView | null {
  const unitInventory = readUnitInventory(dataDir)
  if (unitInventory.length === 0) {
    return null
  }

  if (view === "size") {
    const sorted = [...unitInventory].sort((left, right) => right.linesOfCode - left.linesOfCode)
    const buckets = [
      { label: "1-10 LOC", min: 1, max: 10, loc: 0, count: 0 },
      { label: "11-20 LOC", min: 11, max: 20, loc: 0, count: 0 },
      { label: "21-50 LOC", min: 21, max: 50, loc: 0, count: 0 },
      { label: "51-100 LOC", min: 51, max: 100, loc: 0, count: 0 },
      {
        label: "101+ LOC",
        min: 101,
        max: Number.POSITIVE_INFINITY,
        loc: 0,
        count: 0,
      },
    ]

    for (const unit of sorted) {
      for (const bucket of buckets) {
        if (unit.linesOfCode >= bucket.min && unit.linesOfCode <= bucket.max) {
          bucket.count += 1
          bucket.loc += unit.linesOfCode
          break
        }
      }
    }

    return {
      view: "size",
      headline: {
        unitCount: sorted.length,
        totalLinesOfCode: sorted.reduce((sum, unit) => sum + unit.linesOfCode, 0),
      },
      sizeRisk: [
        {
          label: "Low (1-20 LOC)",
          value: (buckets[0]?.count ?? 0) + (buckets[1]?.count ?? 0),
        },
        {
          label: "Medium (21-50 LOC)",
          value: buckets[2]?.count ?? 0,
        },
        {
          label: "High (51-100 LOC)",
          value: buckets[3]?.count ?? 0,
        },
        {
          label: "Very High (101+ LOC)",
          value: buckets[4]?.count ?? 0,
        },
      ].filter((bucket) => bucket.value > 0),
      sizeDistribution: buckets
        .filter((bucket) => bucket.count > 0)
        .map((bucket) => ({
          label: bucket.label,
          value: bucket.loc,
          detail: `${bucket.count} units`,
        })),
      rows: sorted,
    }
  }

  const sorted = [...unitInventory].sort((left, right) => right.mcCabeIndex - left.mcCabeIndex)
  const buckets = [
    { label: "1-5 (simple)", min: 1, max: 5, count: 0 },
    { label: "6-10 (moderate)", min: 6, max: 10, count: 0 },
    { label: "11-25 (complex)", min: 11, max: 25, count: 0 },
    {
      label: "26+ (very complex)",
      min: 26,
      max: Number.POSITIVE_INFINITY,
      count: 0,
    },
  ]

  for (const unit of sorted) {
    for (const bucket of buckets) {
      if (unit.mcCabeIndex >= bucket.min && unit.mcCabeIndex <= bucket.max) {
        bucket.count += 1
        break
      }
    }
  }

  return {
    view: "complexity",
    headline: {
      unitCount: sorted.length,
    },
    complexityRisk: buckets
      .filter((bucket) => bucket.count > 0)
      .map((bucket) => ({
        label: bucket.label,
        value: bucket.count,
      })),
    complexityDistribution: buckets
      .filter((bucket) => bucket.count > 0)
      .map((bucket) => ({
        label: bucket.label,
        value: bucket.count,
        detail: `${bucket.count} units`,
      })),
    rows: sorted,
  }
}

export function readReportHotspotsSummary(dataDir: string): ReportHotspotsSummary | null {
  const raw = readJsonRecord(dataDir, "hotspots.json")
  if (!raw) {
    return null
  }

  const groups = [
    ...(Array.isArray(raw.fileHotspots) ? raw.fileHotspots : []),
    ...(Array.isArray(raw.unitHotspots) ? raw.unitHotspots : []),
    ...(Array.isArray(raw.componentHotspots) ? raw.componentHotspots : []),
  ]
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const dimensions =
        item.dimensions && typeof item.dimensions === "object" ? (item.dimensions as Record<string, unknown>) : null

      return {
        name: typeof item.name === "string" ? item.name : "",
        route: typeof item.route === "string" ? item.route : "",
        kind: typeof item.kind === "string" ? item.kind : "",
        parent: typeof item.parent === "string" ? item.parent : "",
        score: typeof item.score === "number" ? item.score : 0,
        severity: typeof item.severity === "string" ? item.severity : "",
        dominantDimension: typeof item.dominantDimension === "string" ? item.dominantDimension : "",
        size: typeof item.size === "number" ? item.size : 0,
        commitsCount: typeof item.commitsCount === "number" ? item.commitsCount : 0,
        contributorsCount: typeof item.contributorsCount === "number" ? item.contributorsCount : 0,
        temporalLinks: typeof item.temporalLinks === "number" ? item.temporalLinks : 0,
        complexity: typeof item.complexity === "number" ? item.complexity : 0,
        structuralRisk: typeof dimensions?.structuralRisk === "number" ? dimensions.structuralRisk : 0,
        changePressure: typeof dimensions?.changePressure === "number" ? dimensions.changePressure : 0,
        coordinationCost: typeof dimensions?.coordinationCost === "number" ? dimensions.coordinationCost : 0,
        knowledgeRisk: typeof dimensions?.knowledgeRisk === "number" ? dimensions.knowledgeRisk : 0,
        suggestedAction: typeof item.suggestedAction === "string" ? item.suggestedAction : "",
        reasons: Array.isArray(item.reasons)
          ? item.reasons.filter((reason): reason is string => typeof reason === "string")
          : [],
      }
    })
    .filter((item) => item.name.length > 0 && item.kind.length > 0)
    .sort((left, right) => right.score - left.score)

  if (groups.length === 0) {
    return null
  }

  return {
    totalHotspots: groups.length,
    severityCounts: {
      critical: groups.filter((item) => item.severity === "Critical").length,
      high: groups.filter((item) => item.severity === "High").length,
      medium: groups.filter((item) => item.severity === "Medium").length,
      low: groups.filter((item) => item.severity === "Low").length,
    },
    kindCounts: {
      files: groups.filter((item) => item.kind === "file").length,
      units: groups.filter((item) => item.kind === "unit").length,
      components: groups.filter((item) => item.kind === "component").length,
    },
    dominantCounts: {
      structuralRisk: groups.filter((item) => item.dominantDimension === "structuralRisk").length,
      changePressure: groups.filter((item) => item.dominantDimension === "changePressure").length,
      coordinationCost: groups.filter((item) => item.dominantDimension === "coordinationCost").length,
      knowledgeRisk: groups.filter((item) => item.dominantDimension === "knowledgeRisk").length,
    },
    topHotspots: groups.slice(0, 15).map((item) => ({
      name: item.name,
      score: item.score,
      severity: item.severity,
      kind: item.kind,
      dominantDimension: item.dominantDimension,
      suggestedAction: item.suggestedAction,
    })),
    rows: groups,
  }
}

export function readReportCommitsSummary(dataDir: string): ReportCommitsSummary | null {
  const contributors = readReportContributorsSummary(dataDir)
  const metrics = readMetricsMap(dataDir)
  const timelineRaw = readJsonRecord(dataDir, "contributor_timeline.json")
  const perYear = Array.isArray(timelineRaw?.perYear)
    ? timelineRaw.perYear.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []
  const extensionsRaw = readJsonFileArray(dataDir, "commits_per_extension.json")

  const totalContributors = contributors.length
  const totalCommits = contributors.reduce((sum, contributor) => sum + contributor.commitsAllTime, 0)
  const activeContributors = {
    days30: contributors.filter((contributor) => contributor.commits30Days > 0).length,
    days90: contributors.filter((contributor) => contributor.commits90Days > 0).length,
    days365: contributors.filter((contributor) => contributor.commits365Days > 0).length,
  }

  const timeline = perYear
    .map((entry) => ({
      timeSlot: typeof entry.timeSlot === "string" ? entry.timeSlot : "",
      commits: typeof entry.commits === "number" ? entry.commits : 0,
      contributors: typeof entry.contributors === "number" ? entry.contributors : 0,
    }))
    .filter((entry) => entry.timeSlot.length > 0)
    .sort((left, right) => left.timeSlot.localeCompare(right.timeSlot))

  const extensions = extensionsRaw
    .map((entry) => ({
      extension: typeof entry.extension === "string" ? entry.extension : "",
      commitsCount: typeof entry.commitsCount === "number" ? entry.commitsCount : 0,
      committersCount: typeof entry.committersCount === "number" ? entry.committersCount : 0,
      filesCount: typeof entry.filesCount === "number" ? entry.filesCount : 0,
      commitsCount30Days: typeof entry.commitsCount30Days === "number" ? entry.commitsCount30Days : 0,
      commitsCount90Days: typeof entry.commitsCount90Days === "number" ? entry.commitsCount90Days : 0,
    }))
    .filter((entry) => entry.extension.length > 0)
    .sort((left, right) => right.commitsCount - left.commitsCount)

  if (totalContributors === 0 && totalCommits === 0 && timeline.length === 0 && extensions.length === 0) {
    return null
  }

  return {
    totalCommits,
    totalContributors,
    activeContributors,
    repoAgeDays: metrics.get("FILE_CHANGE_HISTORY_TOTAL_AGE_DAYS") ?? null,
    activeDays: metrics.get("FILE_CHANGE_HISTORY_ACTIVE_DAYS") ?? null,
    rookieCount: contributors.filter((contributor) => contributor.status === "Rookie").length,
    activity: [
      {
        label: "Past 30 days",
        value: activeContributors.days30,
        detail: `${activeContributors.days30} contributors`,
      },
      {
        label: "Past 90 days",
        value: activeContributors.days90,
        detail: `${activeContributors.days90} contributors`,
      },
      {
        label: "Past year",
        value: activeContributors.days365,
        detail: `${activeContributors.days365} contributors`,
      },
      {
        label: "All time",
        value: totalContributors,
        detail: `${totalContributors} contributors`,
      },
    ],
    timeline,
    extensions,
  }
}

export function readReportSecuritySummary(dataDir: string): ReportSecuritySummary | null {
  const health = readJsonRecord(dataDir, "landscape_dependency_health.json")
  if (!health) {
    return null
  }

  const landscapeRepositories = readJsonRecord(dataDir, "landscape_repositories.json")
  const repositoryEntries = Array.isArray(landscapeRepositories?.repositories)
    ? landscapeRepositories.repositories.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []
  const repoKeyByName = new Map<string, string>(
    repositoryEntries.flatMap((item) => {
      const name = typeof item.name === "string" ? item.name : null
      const repoKey = typeof item.repoKey === "string" ? item.repoKey : null
      return name && repoKey ? [[name, repoKey] as const] : []
    }),
  )

  const severityCounts =
    health.severityCounts && typeof health.severityCounts === "object"
      ? (health.severityCounts as Record<string, unknown>)
      : null
  const repoHealthEntries = Array.isArray(health.repoHealth)
    ? health.repoHealth.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []
  const sharedPackages = Array.isArray(health.sharedVulnerablePackages)
    ? health.sharedVulnerablePackages.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []
  const enrichmentSummary =
    health.enrichmentSummary && typeof health.enrichmentSummary === "object"
      ? (health.enrichmentSummary as Record<string, unknown>)
      : null
  const topActionableVulnerabilities = Array.isArray(health.topActionableVulnerabilities)
    ? health.topActionableVulnerabilities.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []

  if (
    typeof health.totalRepos !== "number" ||
    typeof health.reposWithAlerts !== "number" ||
    typeof health.totalAlerts !== "number" ||
    typeof health.totalOpenAlerts !== "number" ||
    (typeof health.meanTimeToResolveDays !== "number" &&
      health.meanTimeToResolveDays !== null &&
      typeof health.meanTimeToResolveDays !== "undefined") ||
    typeof health.supplyChainExposureScore !== "number" ||
    !severityCounts
  ) {
    return null
  }

  return {
    totalRepos: health.totalRepos,
    reposWithAlerts: health.reposWithAlerts,
    totalAlerts: health.totalAlerts,
    totalOpenAlerts: health.totalOpenAlerts,
    severityCounts: {
      critical: typeof severityCounts.critical === "number" ? severityCounts.critical : 0,
      high: typeof severityCounts.high === "number" ? severityCounts.high : 0,
      medium: typeof severityCounts.medium === "number" ? severityCounts.medium : 0,
      low: typeof severityCounts.low === "number" ? severityCounts.low : 0,
    },
    meanTimeToResolveDays: typeof health.meanTimeToResolveDays === "number" ? health.meanTimeToResolveDays : null,
    supplyChainExposureScore: health.supplyChainExposureScore,
    sharedVulnerablePackages: sharedPackages
      .map((item) => ({
        ecosystem: typeof item.ecosystem === "string" ? item.ecosystem : "",
        name: typeof item.name === "string" ? item.name : "",
        severity: typeof item.severity === "string" ? item.severity : "",
        affectedRepos: Array.isArray(item.affectedRepos)
          ? item.affectedRepos.filter((repo): repo is string => typeof repo === "string")
          : [],
      }))
      .filter((item) => item.ecosystem.length > 0 && item.name.length > 0 && item.severity.length > 0),
    repoHealth: repoHealthEntries
      .map((item) => {
        const rowSeverityCounts =
          item.severityCounts && typeof item.severityCounts === "object"
            ? (item.severityCounts as Record<string, unknown>)
            : {}
        const repo = typeof item.repo === "string" ? item.repo : ""

        return {
          owner: typeof item.owner === "string" ? item.owner : "",
          repo,
          repoKey: repoKeyByName.get(repo) ?? null,
          totalAlerts: typeof item.totalAlerts === "number" ? item.totalAlerts : 0,
          openAlerts: typeof item.openAlerts === "number" ? item.openAlerts : 0,
          fixedAlerts: typeof item.fixedAlerts === "number" ? item.fixedAlerts : 0,
          severityCounts: {
            critical: typeof rowSeverityCounts.critical === "number" ? rowSeverityCounts.critical : 0,
            high: typeof rowSeverityCounts.high === "number" ? rowSeverityCounts.high : 0,
            medium: typeof rowSeverityCounts.medium === "number" ? rowSeverityCounts.medium : 0,
            low: typeof rowSeverityCounts.low === "number" ? rowSeverityCounts.low : 0,
          },
          meanTimeToResolveDays: typeof item.meanTimeToResolveDays === "number" ? item.meanTimeToResolveDays : null,
          oldestOpenAlertDays: typeof item.oldestOpenAlertDays === "number" ? item.oldestOpenAlertDays : null,
        }
      })
      .filter((item) => item.owner.length > 0 && item.repo.length > 0),
    enrichmentSummary: {
      enrichedAt: typeof enrichmentSummary?.enrichedAt === "string" ? enrichmentSummary.enrichedAt : null,
      latestAlertOpenedAt:
        typeof enrichmentSummary?.latestAlertOpenedAt === "string" ? enrichmentSummary.latestAlertOpenedAt : null,
      latestAdvisoryPublishedAt:
        typeof enrichmentSummary?.latestAdvisoryPublishedAt === "string"
          ? enrichmentSummary.latestAdvisoryPublishedAt
          : null,
      uniqueCveCount: typeof enrichmentSummary?.uniqueCveCount === "number" ? enrichmentSummary.uniqueCveCount : 0,
      epssCoverageCount:
        typeof enrichmentSummary?.epssCoverageCount === "number" ? enrichmentSummary.epssCoverageCount : 0,
      knownExploitedCount:
        typeof enrichmentSummary?.knownExploitedCount === "number" ? enrichmentSummary.knownExploitedCount : 0,
      epssAvailable: enrichmentSummary?.epssAvailable === true,
      kevAvailable: enrichmentSummary?.kevAvailable === true,
    },
    topActionableVulnerabilities: topActionableVulnerabilities
      .map((item) => {
        const repo = typeof item.repo === "string" ? item.repo : ""
        const advisoryId = typeof item.advisoryId === "string" ? item.advisoryId : ""
        const ghsaId = typeof item.ghsaId === "string" ? item.ghsaId : ""
        return {
          repo,
          repoKey: repoKeyByName.get(repo) ?? null,
          package: typeof item.package === "string" ? item.package : "",
          ecosystem: typeof item.ecosystem === "string" ? item.ecosystem : "",
          manifestPath: typeof item.manifestPath === "string" ? item.manifestPath : "",
          advisoryId,
          cveId: typeof item.cveId === "string" ? item.cveId : null,
          ghsaId,
          severity: typeof item.severity === "string" ? item.severity : "low",
          summary: typeof item.summary === "string" ? item.summary : "",
          state: typeof item.state === "string" ? item.state : "open",
          openedAt: typeof item.openedAt === "string" ? item.openedAt : "",
          publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : null,
          ageDays: typeof item.ageDays === "number" ? item.ageDays : 0,
          sharedRepoCount: typeof item.sharedRepoCount === "number" ? item.sharedRepoCount : 0,
          vulnerableVersionRange: typeof item.vulnerableVersionRange === "string" ? item.vulnerableVersionRange : "",
          firstPatchedVersion: typeof item.firstPatchedVersion === "string" ? item.firstPatchedVersion : null,
          recommendedAction: typeof item.recommendedAction === "string" ? item.recommendedAction : "Review advisory",
          epssScore: typeof item.epssScore === "number" ? item.epssScore : null,
          epssPercentile: typeof item.epssPercentile === "number" ? item.epssPercentile : null,
          knownExploited: item.knownExploited === true,
          priorityScore: typeof item.priorityScore === "number" ? item.priorityScore : 0,
        }
      })
      .filter((item) => item.repo.length > 0 && item.advisoryId.length > 0 && item.ghsaId.length > 0),
  }
}

function resolveLandscapeRepoDataDir(dataDir: string, repoKey: string): string {
  const candidates = [
    join(resolve(dataDir, "../../.."), repoKey, "data"),
    join(resolve(dataDir, ".."), repoKey, "data"),
    join(resolve(dataDir), repoKey, "data"),
  ]

  return (
    candidates.find((candidate) => existsSync(candidate)) ??
    candidates[0] ??
    join(resolve(dataDir, "../../.."), repoKey, "data")
  )
}

function readLandscapeRepoJsonRecord(
  dataDir: string,
  repoKey: string,
  fileName: string,
): Record<string, unknown> | null {
  const path = join(resolveLandscapeRepoDataDir(dataDir, repoKey), fileName)
  if (!existsSync(path)) {
    return null
  }

  const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown
  return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null
}

function formatContributorDisplayName(input: { readonly email: string; readonly userName?: string | null }): string {
  const userName = input.userName?.trim() ?? ""
  return userName.length > 0 ? userName : input.email
}

type LandscapeRepoContributorCommits = {
  readonly commitsCount: number
  readonly commitsCount30Days: number
  readonly commitsCount90Days: number
  readonly commitsCount365Days: number
  readonly isRookie: boolean
}

function readLandscapeRepoContributorCommits(
  dataDir: string,
  repoKey: string,
): ReadonlyArray<LandscapeRepoContributorCommits> {
  const contributors = readLandscapeRepoJsonRecord(dataDir, repoKey, "contributors.json")
  const rows = Array.isArray(contributors?.contributors)
    ? contributors.contributors.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []

  return rows.map((item) => ({
    commitsCount: typeof item.commitsCount === "number" ? item.commitsCount : 0,
    commitsCount30Days: typeof item.commitsCount30Days === "number" ? item.commitsCount30Days : 0,
    commitsCount90Days: typeof item.commitsCount90Days === "number" ? item.commitsCount90Days : 0,
    commitsCount365Days:
      typeof item.commitsCount365Days === "number"
        ? item.commitsCount365Days
        : typeof item.commitsCount === "number"
          ? item.commitsCount
          : 0,
    isRookie: item.isRookie === true,
  }))
}

export function readReportLandscapeRepositorySummary(
  dataDir: string,
  repoKey: string,
): ReportLandscapeRepositorySummary | null {
  const repositories = readJsonRecord(dataDir, "landscape_repositories.json")
  const repositoryEntries = Array.isArray(repositories?.repositories)
    ? repositories.repositories.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []
  const repositoryEntry = repositoryEntries.find((item) => item.repoKey === repoKey) ?? null

  if (!repositoryEntry) {
    return null
  }

  const analysis = readLandscapeRepoJsonRecord(dataDir, repoKey, "analysisResults.json")
  const contributors = readLandscapeRepoJsonRecord(dataDir, repoKey, "contributors.json")
  const contributorImpact = readLandscapeRepoJsonRecord(dataDir, repoKey, "contributor_impact.json")
  const metadata =
    analysis?.metadata && typeof analysis.metadata === "object" ? (analysis.metadata as Record<string, unknown>) : null
  const duplication =
    analysis?.duplication && typeof analysis.duplication === "object"
      ? (analysis.duplication as Record<string, unknown>)
      : null
  const periods = Array.isArray(contributorImpact?.periods)
    ? contributorImpact.periods.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []
  const allTimeImpact = periods.find((item) => item.period_key === "all_time")
  const impactContributors = Array.isArray(allTimeImpact?.contributors)
    ? allTimeImpact.contributors.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []
  const impactByEmail = new Map<string, Record<string, unknown>>(
    impactContributors.flatMap((item) => {
      const email = typeof item.email === "string" ? item.email : null
      return email ? [[email, item] as const] : []
    }),
  )
  const contributorRows = Array.isArray(contributors?.contributors)
    ? contributors.contributors.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []

  const links = Array.isArray(metadata?.links)
    ? metadata.links
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          label: typeof item.label === "string" && item.label.length > 0 ? item.label : "Open repository",
          href: typeof item.href === "string" ? item.href : "",
        }))
        .filter((item) => item.href.length > 0)
    : []

  const contributorsSummary = contributorRows
    .map((item) => {
      const email = typeof item.email === "string" ? item.email : ""
      const impact = impactByEmail.get(email)
      const isGlue = impact?.is_glue === true
      const isSnacking = impact?.is_snacking === true
      const dominantDimension =
        typeof impact?.dominant_dimension === "string" ? impact.dominant_dimension.replaceAll("_", " ") : "—"

      return {
        email,
        displayName: formatContributorDisplayName({
          email,
          userName: typeof item.userName === "string" ? item.userName : null,
        }),
        commitsCount: typeof item.commitsCount === "number" ? item.commitsCount : 0,
        commits30d: typeof item.commitsCount30Days === "number" ? item.commitsCount30Days : 0,
        commits90d: typeof item.commitsCount90Days === "number" ? item.commitsCount90Days : 0,
        firstCommitDate: toISODateString(item.firstCommitDate),
        latestCommitDate: toISODateString(item.latestCommitDate),
        type: item.isBot === true ? ("Bot" as const) : ("Human" as const),
        glueScore: typeof impact?.glue_score === "number" ? impact.glue_score.toFixed(1) : "—",
        structuralImpact:
          typeof impact?.structural_impact_score === "number" ? impact.structural_impact_score.toFixed(1) : "—",
        snackRisk: typeof impact?.snacking_score === "number" ? impact.snacking_score.toFixed(1) : "—",
        signal: isGlue ? "Glue" : isSnacking ? "Snacking" : dominantDimension,
      }
    })
    .filter((item) => item.email.length > 0)
    .sort((left, right) => right.commitsCount - left.commitsCount || left.email.localeCompare(right.email))
  const topContributors = contributorsSummary.slice(0, 8)

  const name =
    typeof repositoryEntry.name === "string"
      ? repositoryEntry.name
      : typeof metadata?.name === "string"
        ? metadata.name
        : ""
  if (name.length === 0) {
    return null
  }

  return {
    repoKey,
    name,
    description:
      typeof repositoryEntry.description === "string"
        ? repositoryEntry.description
        : typeof metadata?.description === "string"
          ? metadata.description
          : "Repository drilldown within the current landscape analysis.",
    latestCommitDate: toISODateString(repositoryEntry.latestCommitDate),
    commits30d: typeof repositoryEntry.commits30d === "number" ? repositoryEntry.commits30d : 0,
    commits90d: typeof repositoryEntry.commits90d === "number" ? repositoryEntry.commits90d : 0,
    contributorsCount:
      typeof repositoryEntry.contributorsCount === "number"
        ? repositoryEntry.contributorsCount
        : contributorsSummary.length,
    filesCount:
      typeof analysis?.filesCount === "number"
        ? analysis.filesCount
        : typeof repositoryEntry.mainFilesCount === "number"
          ? repositoryEntry.mainFilesCount
          : 0,
    linesOfCode:
      typeof analysis?.linesOfCode === "number"
        ? analysis.linesOfCode
        : typeof repositoryEntry.mainLinesOfCode === "number"
          ? repositoryEntry.mainLinesOfCode
          : 0,
    duplicationPercentage: typeof duplication?.percentage === "number" ? duplication.percentage : null,
    links,
    contributors: contributorsSummary,
    topContributors,
  }
}

export function readReportLandscapeRepositoriesSummary(dataDir: string): ReportLandscapeRepositoriesSummary | null {
  const repositories = readJsonRecord(dataDir, "landscape_repositories.json")
  const repositoryEntries = Array.isArray(repositories?.repositories)
    ? repositories.repositories.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []

  if (repositoryEntries.length === 0) {
    return null
  }

  const rows = repositoryEntries
    .map((item) => {
      const repoKey = typeof item.repoKey === "string" ? item.repoKey : null
      const name = typeof item.name === "string" ? item.name : null
      const latestCommitDate = toISODateStringOrNull(item.latestCommitDate)

      if (!repoKey || !name || !latestCommitDate) {
        return null
      }

      const tags = Array.isArray(item.tags)
        ? item.tags
            .filter((tag): tag is Record<string, unknown> => typeof tag === "object" && tag !== null)
            .map((tag) => (typeof tag.name === "string" ? tag.name : null))
            .filter((tag): tag is string => tag !== null)
        : []

      return {
        repoKey,
        name,
        description:
          typeof item.description === "string" && item.description.trim().length > 0 ? item.description : "—",
        mainLinesOfCode: typeof item.mainLinesOfCode === "number" ? item.mainLinesOfCode : 0,
        mainFilesCount: typeof item.mainFilesCount === "number" ? item.mainFilesCount : 0,
        commits30d: typeof item.commits30d === "number" ? item.commits30d : 0,
        commits90d: typeof item.commits90d === "number" ? item.commits90d : 0,
        contributorsCount: typeof item.contributorsCount === "number" ? item.contributorsCount : 0,
        contributors30d: typeof item.contributors30d === "number" ? item.contributors30d : 0,
        latestCommitDate,
        tags,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => right.mainLinesOfCode - left.mainLinesOfCode)

  if (rows.length === 0) {
    return null
  }

  const totalRepositories = rows.length
  const active30d = rows.filter((repository) => repository.commits30d > 0).length
  const totalMainLoc = rows.reduce((sum, repository) => sum + repository.mainLinesOfCode, 0)

  return {
    totalRepositories,
    active30d,
    totalMainLoc,
    averageMainLoc: Math.round(totalMainLoc / Math.max(totalRepositories, 1)),
    repositories: rows,
  }
}

export function readReportLandscapeRepositoryMetricsSummary(
  dataDir: string,
  repoKey: string,
): ReportMetricsSummary | null {
  return readReportMetricsSummary(resolveLandscapeRepoDataDir(dataDir, repoKey))
}

export function readReportLandscapeRepositoryCommitsSummary(
  dataDir: string,
  repoKey: string,
): ReportCommitsSummary | null {
  const repoDataDir = resolveLandscapeRepoDataDir(dataDir, repoKey)
  const contributors = readLandscapeRepoContributorCommits(dataDir, repoKey)
  const metrics = readMetricsMap(repoDataDir)
  const timelineRaw = readLandscapeRepoJsonRecord(dataDir, repoKey, "contributor_timeline.json")
  const perYear = Array.isArray(timelineRaw?.perYear)
    ? timelineRaw.perYear.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []
  const extensionsRaw = readJsonFileArray(repoDataDir, "commits_per_extension.json")

  const totalContributors = contributors.length
  const totalCommits = contributors.reduce((sum, contributor) => sum + contributor.commitsCount, 0)
  const activeContributors = {
    days30: contributors.filter((contributor) => contributor.commitsCount30Days > 0).length,
    days90: contributors.filter((contributor) => contributor.commitsCount90Days > 0).length,
    days365: contributors.filter((contributor) => contributor.commitsCount365Days > 0).length,
  }

  const timeline = perYear
    .map((entry) => ({
      timeSlot: typeof entry.timeSlot === "string" ? entry.timeSlot : "",
      commits: typeof entry.commits === "number" ? entry.commits : 0,
      contributors: typeof entry.contributors === "number" ? entry.contributors : 0,
    }))
    .filter((entry) => entry.timeSlot.length > 0)
    .sort((left, right) => left.timeSlot.localeCompare(right.timeSlot))

  const extensions = extensionsRaw
    .map((entry) => ({
      extension: typeof entry.extension === "string" ? entry.extension : "",
      commitsCount: typeof entry.commitsCount === "number" ? entry.commitsCount : 0,
      committersCount: typeof entry.committersCount === "number" ? entry.committersCount : 0,
      filesCount: typeof entry.filesCount === "number" ? entry.filesCount : 0,
      commitsCount30Days: typeof entry.commitsCount30Days === "number" ? entry.commitsCount30Days : 0,
      commitsCount90Days: typeof entry.commitsCount90Days === "number" ? entry.commitsCount90Days : 0,
    }))
    .filter((entry) => entry.extension.length > 0)
    .sort((left, right) => right.commitsCount - left.commitsCount)

  if (totalContributors === 0 && totalCommits === 0 && timeline.length === 0 && extensions.length === 0) {
    return null
  }

  return {
    totalCommits,
    totalContributors,
    activeContributors,
    repoAgeDays: metrics.get("FILE_CHANGE_HISTORY_TOTAL_AGE_DAYS") ?? null,
    activeDays: metrics.get("FILE_CHANGE_HISTORY_ACTIVE_DAYS") ?? null,
    rookieCount: contributors.filter((contributor) => contributor.isRookie).length,
    activity: [
      {
        label: "Past 30 days",
        value: activeContributors.days30,
        detail: `${activeContributors.days30} contributors`,
      },
      {
        label: "Past 90 days",
        value: activeContributors.days90,
        detail: `${activeContributors.days90} contributors`,
      },
      {
        label: "Past year",
        value: activeContributors.days365,
        detail: `${activeContributors.days365} contributors`,
      },
      {
        label: "All time",
        value: totalContributors,
        detail: `${totalContributors} contributors`,
      },
    ],
    timeline,
    extensions,
  }
}

export function readReportLandscapeRepositoryDependenciesSummary(
  dataDir: string,
  repoKey: string,
): ReportDependenciesSummary | null {
  return readReportDependenciesSummary(resolveLandscapeRepoDataDir(dataDir, repoKey))
}

export function readReportLandscapeRepositoryDuplicationSummary(
  dataDir: string,
  repoKey: string,
): ReportDuplicationSummary | null {
  return readReportDuplicationSummary(resolveLandscapeRepoDataDir(dataDir, repoKey))
}

export function readReportLandscapeRepositoryHotspotsSummary(
  dataDir: string,
  repoKey: string,
): ReportHotspotsSummary | null {
  return readReportHotspotsSummary(resolveLandscapeRepoDataDir(dataDir, repoKey))
}

export function readReportLandscapeRepositoryFilesView(
  dataDir: string,
  repoKey: string,
  view: ReportFileViewName,
): ReportFilesView | null {
  return readReportFilesView(resolveLandscapeRepoDataDir(dataDir, repoKey), view)
}

export function readReportLandscapeRepositoryUnitsView(
  dataDir: string,
  repoKey: string,
  view: ReportUnitViewName,
): ReportUnitsView | null {
  return readReportUnitsView(resolveLandscapeRepoDataDir(dataDir, repoKey), view)
}

export function readReportLandscapeRepositoryContributorsSummary(
  dataDir: string,
  repoKey: string,
): ReadonlyArray<ReportContributorSummary> {
  const contributors = readLandscapeRepoJsonRecord(dataDir, repoKey, "contributors.json")
  const impact = readLandscapeRepoJsonRecord(dataDir, repoKey, "contributor_impact.json")
  const impactContributors = Array.isArray(impact?.periods)
    ? impact.periods
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .find((item) => item.period_key === "all_time")
    : null
  const impactEntries = Array.isArray(impactContributors?.contributors)
    ? impactContributors.contributors.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []
  const impactByEmail = new Map<string, Record<string, unknown>>(
    impactEntries.flatMap((item) => {
      const email = typeof item.email === "string" ? item.email : null
      return email ? [[email, item] as const] : []
    }),
  )

  const rows = Array.isArray(contributors?.contributors)
    ? contributors.contributors.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []

  return rows
    .flatMap((item): ReadonlyArray<ReportContributorSummary> => {
      const email = typeof item.email === "string" ? item.email : ""
      if (email.length === 0) {
        return []
      }

      const userName = typeof item.userName === "string" ? item.userName : ""
      const impactEntry = impactByEmail.get(email)
      const knowledgeSignal =
        impactEntry?.is_glue === true ? "Glue" : impactEntry?.is_snacking === true ? "Snacking" : ""

      return [
        {
          email,
          userName,
          displayName: formatContributorDisplayName({ email, userName }),
          status: getContributorStatus({
            isRookie: item.isRookie === true,
            isActive: typeof item.commitsCount30Days === "number" && item.commitsCount30Days > 0,
          }),
          commitsAllTime: typeof item.commitsCount === "number" ? item.commitsCount : 0,
          commits30Days: typeof item.commitsCount30Days === "number" ? item.commitsCount30Days : 0,
          commits90Days: typeof item.commitsCount90Days === "number" ? item.commitsCount90Days : 0,
          commits180Days: typeof item.commitsCount180Days === "number" ? item.commitsCount180Days : 0,
          commits365Days: typeof item.commitsCount365Days === "number" ? item.commitsCount365Days : 0,
          firstCommit: toISODateString(item.firstCommitDate),
          lastCommit: toISODateString(item.latestCommitDate),
          percentage: typeof item.percentage === "string" ? item.percentage : "",
          filesTouched: null,
          componentsTouched: null,
          primaryComponent: "",
          knowledgeSignal,
          repositoryCount: null,
          latestCommitDate: toISODateString(item.latestCommitDate),
          isBot: null,
          repositories: [],
        },
      ]
    })
    .sort((left, right) => right.commitsAllTime - left.commitsAllTime)
}

export function readReportLandscapeRepositoryContributorDetail(
  dataDir: string,
  repoKey: string,
  email: string,
): ReportContributorDetail | null {
  const fileName = `${encodeURIComponent(email)}.json`
  const repoDataDir = resolveLandscapeRepoDataDir(dataDir, repoKey)
  const detail = readJsonRecord(join(repoDataDir, "contributor_details"), fileName)
  if (!detail) {
    return null
  }

  const summaries = readReportLandscapeRepositoryContributorsSummary(dataDir, repoKey)
  const summaryByEmail = new Map(summaries.map((summary) => [summary.email, summary] as const))
  const summary = summaryByEmail.get(email)
  const collaborators = Array.isArray(detail.collaborators)
    ? detail.collaborators
        .filter(
          (collaborator): collaborator is Record<string, unknown> =>
            typeof collaborator === "object" && collaborator !== null,
        )
        .map((collaborator) => {
          const collaboratorEmail = typeof collaborator.email === "string" ? collaborator.email : ""
          const summaryMatch = summaryByEmail.get(collaboratorEmail)

          return {
            email: collaboratorEmail,
            displayName:
              summaryMatch?.displayName ??
              getContributorDisplayName({
                email: collaboratorEmail,
                userName: "",
              }),
            sharedFiles: typeof collaborator.sharedFiles === "number" ? collaborator.sharedFiles : 0,
          }
        })
    : []
  const topCollaborator = collaborators[0] ?? null

  return {
    email,
    userName: typeof detail.userName === "string" ? detail.userName : "",
    displayName:
      summary?.displayName ??
      getContributorDisplayName({
        email,
        userName: typeof detail.userName === "string" ? detail.userName : "",
      }),
    status:
      summary?.status ??
      getContributorStatus({
        isRookie: detail.isRookie === true,
        isActive: detail.isActive === true,
      }),
    commitsCount: typeof detail.commitsCount === "number" ? detail.commitsCount : 0,
    commitsCount30Days: typeof detail.commitsCount30Days === "number" ? detail.commitsCount30Days : 0,
    commitsCount90Days: typeof detail.commitsCount90Days === "number" ? detail.commitsCount90Days : 0,
    commitsCount180Days: typeof detail.commitsCount180Days === "number" ? detail.commitsCount180Days : 0,
    commitsCount365Days: typeof detail.commitsCount365Days === "number" ? detail.commitsCount365Days : 0,
    firstCommitDate: toISODateString(detail.firstCommitDate),
    latestCommitDate: toISODateString(detail.latestCommitDate),
    percentage: summary?.percentage ?? "",
    activeDays: Array.isArray(detail.dailyActivity) ? detail.dailyActivity.length : 0,
    filesCount: Array.isArray(detail.files) ? detail.files.length : 0,
    collaboratorsCount: collaborators.length,
    topCollaboratorEmail: topCollaborator?.email ?? null,
    topCollaboratorDisplayName: topCollaborator?.displayName ?? null,
    extensions: Array.isArray(detail.extensions)
      ? detail.extensions
          .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
          .map((entry) => ({
            extension: typeof entry.extension === "string" ? entry.extension : "",
            commits: typeof entry.commits === "number" ? entry.commits : 0,
            files: typeof entry.files === "number" ? entry.files : 0,
          }))
      : [],
    logicalComponents: Array.isArray(detail.logicalComponents)
      ? detail.logicalComponents
          .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
          .map((entry) => ({
            name: typeof entry.name === "string" ? entry.name : "",
            files: typeof entry.files === "number" ? entry.files : 0,
            linesOfCode: typeof entry.linesOfCode === "number" ? entry.linesOfCode : 0,
          }))
      : [],
    collaborators: collaborators.sort((left, right) => right.sharedFiles - left.sharedFiles),
    topFiles: Array.isArray(detail.files)
      ? detail.files
          .filter((file): file is Record<string, unknown> => typeof file === "object" && file !== null)
          .map((file) => ({
            relativePath: typeof file.relativePath === "string" ? file.relativePath : "",
            extension: typeof file.extension === "string" ? file.extension : "",
            commits: typeof file.commits === "number" ? file.commits : 0,
            logicalComponents: Array.isArray(file.logicalComponents)
              ? file.logicalComponents.filter((item): item is string => typeof item === "string")
              : [],
            concerns: Array.isArray(file.concerns)
              ? file.concerns.filter((item): item is string => typeof item === "string")
              : [],
          }))
      : [],
    dailyActivity: Array.isArray(detail.dailyActivity)
      ? detail.dailyActivity
          .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
          .map((entry) => ({
            date: toISODateString(entry.date),
            commits: typeof entry.commits === "number" ? entry.commits : 0,
          }))
          .filter((entry) => entry.date.length > 0)
      : [],
    impact: readContributorImpactEntry(repoDataDir, email),
  }
}

export function readReportLandscapeRepositoryTopologySummary(
  dataDir: string,
  repoKey: string,
): ReportTopologySummary | null {
  return readReportTopologySummary(resolveLandscapeRepoDataDir(dataDir, repoKey))
}

export function readReportLandscapeRepositoryImpactSummary(
  dataDir: string,
  repoKey: string,
): ReportImpactSummary | null {
  return readReportImpactSummary(resolveLandscapeRepoDataDir(dataDir, repoKey))
}

export function readReportLandscapeRepositoryControlsSummary(
  dataDir: string,
  repoKey: string,
): ReportControlsSummary | null {
  return readReportControlsSummary(resolveLandscapeRepoDataDir(dataDir, repoKey))
}

export function readReportComponentsSummary(dataDir: string): ReportComponentsSummary | null {
  const files = readComponentSourceFiles(dataDir)
  if (files.length === 0) {
    return null
  }

  return summarizeComponents(files)
}

export function readReportLandscapeRepositoryComponentsSummary(
  dataDir: string,
  repoKey: string,
): ReportComponentsSummary | null {
  return readReportComponentsSummary(resolveLandscapeRepoDataDir(dataDir, repoKey))
}

export function readReportCouplingSummary(dataDir: string): ReportCouplingSummary | null {
  const files = readComponentSourceFiles(dataDir)
  const dependencies = readComponentDependencyRecords(dataDir)
  const temporalDependencies = readTemporalDependencyRecords(dataDir)
  const hotspots = readComponentHotspotRecords(dataDir)

  const dependencyKeys = [...new Set(dependencies.map((dependency) => dependency.decompositionKey).filter(Boolean))]
  const hotspotKeys = [...new Set(hotspots.map((hotspot) => hotspot.parent).filter(Boolean))]
  const decompositionKey = dependencyKeys.includes("primary")
    ? "primary"
    : hotspotKeys.includes("primary")
      ? "primary"
      : (dependencyKeys[0] ?? hotspotKeys[0] ?? "primary")

  const temporalSections = [...new Set(temporalDependencies.map((item) => item.periodKey))]
    .map((periodKey) => {
      const items = temporalDependencies.filter((item) => item.periodKey === periodKey)
      const first = items[0]
      if (!first) {
        return null
      }

      return {
        periodLabel: first.periodLabel,
        periodDays: first.periodDays,
        items,
      }
    })
    .filter((section): section is NonNullable<typeof section> => section !== null)
    .sort((left, right) => right.periodDays - left.periodDays)

  const selectedTemporal = temporalSections[0]

  const componentStats = new Map<
    string,
    {
      files: number
      linesOfCode: number
      contributors: Set<string>
    }
  >()

  for (const file of files) {
    for (const component of file.components) {
      const entry = componentStats.get(component) ?? {
        files: 0,
        linesOfCode: 0,
        contributors: new Set<string>(),
      }
      entry.files += 1
      entry.linesOfCode += file.linesOfCode
      for (const contributor of file.contributors) {
        entry.contributors.add(contributor)
      }
      componentStats.set(component, entry)
    }
  }

  const hotspotMap = new Map(
    hotspots
      .filter((hotspot) => hotspot.parent === decompositionKey)
      .map((hotspot) => [hotspot.name, hotspot] as const),
  )

  for (const hotspot of hotspotMap.values()) {
    if (!componentStats.has(hotspot.name)) {
      componentStats.set(hotspot.name, {
        files: 0,
        linesOfCode: 0,
        contributors: new Set<string>(),
      })
    }
  }

  const filteredDependencies = dependencies.filter((dependency) => dependency.decompositionKey === decompositionKey)
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  const staticPartnersMap = new Map<string, Set<string>>()

  for (const dependency of filteredDependencies) {
    outgoing.set(dependency.fromComponent, (outgoing.get(dependency.fromComponent) ?? 0) + dependency.count)
    incoming.set(dependency.toComponent, (incoming.get(dependency.toComponent) ?? 0) + dependency.count)

    const fromPartners = staticPartnersMap.get(dependency.fromComponent) ?? new Set<string>()
    fromPartners.add(dependency.toComponent)
    staticPartnersMap.set(dependency.fromComponent, fromPartners)

    const toPartners = staticPartnersMap.get(dependency.toComponent) ?? new Set<string>()
    toPartners.add(dependency.fromComponent)
    staticPartnersMap.set(dependency.toComponent, toPartners)

    if (!componentStats.has(dependency.fromComponent)) {
      componentStats.set(dependency.fromComponent, {
        files: 0,
        linesOfCode: 0,
        contributors: new Set<string>(),
      })
    }
    if (!componentStats.has(dependency.toComponent)) {
      componentStats.set(dependency.toComponent, {
        files: 0,
        linesOfCode: 0,
        contributors: new Set<string>(),
      })
    }
  }

  const fileToComponents = new Map<string, ReadonlyArray<string>>()
  for (const file of files) {
    fileToComponents.set(file.relativePath, file.components)
  }

  const temporalWeights = new Map<string, number>()
  const temporalPartners = new Map<string, Set<string>>()

  for (const dependency of selectedTemporal?.items ?? []) {
    const leftComponents = new Set(fileToComponents.get(dependency.file1) ?? [])
    const rightComponents = new Set(fileToComponents.get(dependency.file2) ?? [])

    for (const left of leftComponents) {
      for (const right of rightComponents) {
        if (left === right) {
          continue
        }

        temporalWeights.set(left, (temporalWeights.get(left) ?? 0) + dependency.sameCommits)
        temporalWeights.set(right, (temporalWeights.get(right) ?? 0) + dependency.sameCommits)

        const leftPartners = temporalPartners.get(left) ?? new Set<string>()
        leftPartners.add(right)
        temporalPartners.set(left, leftPartners)

        const rightPartners = temporalPartners.get(right) ?? new Set<string>()
        rightPartners.add(left)
        temporalPartners.set(right, rightPartners)
      }
    }
  }

  const contributorOverlap = new Map<string, number>()
  const componentEntries = [...componentStats.entries()]
  for (let index = 0; index < componentEntries.length; index += 1) {
    const [leftComponent, leftStats] = componentEntries[index]!
    for (let inner = index + 1; inner < componentEntries.length; inner += 1) {
      const [rightComponent, rightStats] = componentEntries[inner]!
      let overlap = 0

      for (const contributor of leftStats.contributors) {
        if (rightStats.contributors.has(contributor)) {
          overlap += 1
        }
      }

      if (overlap === 0) {
        continue
      }

      contributorOverlap.set(leftComponent, (contributorOverlap.get(leftComponent) ?? 0) + overlap)
      contributorOverlap.set(rightComponent, (contributorOverlap.get(rightComponent) ?? 0) + overlap)
    }
  }

  const staticWeights = componentEntries.map(
    ([component]) => (incoming.get(component) ?? 0) + (outgoing.get(component) ?? 0),
  )
  const temporalValues = componentEntries.map(([component]) => temporalWeights.get(component) ?? 0)
  const overlapValues = componentEntries.map(([component]) => contributorOverlap.get(component) ?? 0)

  const maxStatic = Math.max(...staticWeights, 0)
  const maxTemporal = Math.max(...temporalValues, 0)
  const maxOverlap = Math.max(...overlapValues, 0)

  const snapshots = componentEntries
    .map(([component, stats]) => {
      const hotspot = hotspotMap.get(component)
      const incomingDependencies = incoming.get(component) ?? 0
      const outgoingDependencies = outgoing.get(component) ?? 0
      const dependencyPressure = normalizeToTen(incomingDependencies + outgoingDependencies, maxStatic)
      const temporalPressure = normalizeToTen(temporalWeights.get(component) ?? 0, maxTemporal)
      const overlapPressure = normalizeToTen(contributorOverlap.get(component) ?? 0, maxOverlap)

      const staticCoupling = round1(dependencyPressure * 0.7 + ((hotspot?.dimensions.structuralRisk ?? 0) / 10) * 0.3)
      const temporalCoupling = round1(temporalPressure)
      const coordinationCoupling = round1(
        overlapPressure * 0.6 + ((hotspot?.dimensions.coordinationCost ?? 0) / 10) * 0.4,
      )
      const knowledgeRisk = round1(
        getHeuristicKnowledgeRisk(stats.contributors.size) * 0.4 +
          ((hotspot?.dimensions.knowledgeRisk ?? 0) / 10) * 0.6,
      )

      const scores = {
        staticCoupling,
        temporalCoupling,
        coordinationCoupling,
        knowledgeRisk,
      }
      const overallLoad = round1(
        staticCoupling * 0.3 + temporalCoupling * 0.25 + coordinationCoupling * 0.25 + knowledgeRisk * 0.2,
      )
      const balanceScore = round1(clamp(10 - standardDeviation(Object.values(scores)) * 1.5))
      const systemicRisk = round1(clamp(overallLoad * 0.72 + (10 - balanceScore) * 0.28))
      const dominantDimension = getDominantCouplingDimension(scores)

      return {
        component,
        systemicRisk,
        overallLoad,
        balanceScore,
        riskTier: getCouplingRiskTier(systemicRisk),
        dominantDimension: COUPLING_DIMENSION_LABELS[dominantDimension],
        dominantDimensionId: dominantDimension,
        files: stats.files,
        linesOfCode: stats.linesOfCode,
        contributors: stats.contributors.size,
        incomingDependencies,
        outgoingDependencies,
        staticPartners: staticPartnersMap.get(component)?.size ?? 0,
        temporalPartners: temporalPartners.get(component)?.size ?? 0,
        contributorOverlap: contributorOverlap.get(component) ?? 0,
        hotspotPressure: round1((hotspot?.score ?? 0) / 10),
        staticCoupling,
        temporalCoupling,
        coordinationCoupling,
        knowledgeRisk,
        explainability: buildCouplingExplainability({
          incomingDependencies,
          outgoingDependencies,
          temporalPartners: temporalPartners.get(component)?.size ?? 0,
          contributorOverlap: contributorOverlap.get(component) ?? 0,
          contributors: stats.contributors.size,
          hotspot,
          dominantDimension,
        }),
      }
    })
    .sort((left, right) => {
      if (left.systemicRisk !== right.systemicRisk) {
        return right.systemicRisk - left.systemicRisk
      }
      return right.overallLoad - left.overallLoad
    })

  if (snapshots.length === 0) {
    return null
  }

  const riskTierCounts = {
    critical: snapshots.filter((snapshot) => snapshot.riskTier === "Critical").length,
    high: snapshots.filter((snapshot) => snapshot.riskTier === "High").length,
    medium: snapshots.filter((snapshot) => snapshot.riskTier === "Medium").length,
    low: snapshots.filter((snapshot) => snapshot.riskTier === "Low").length,
  }

  const dominantBreakdownMap = new Map<string, number>()
  for (const snapshot of snapshots) {
    dominantBreakdownMap.set(
      snapshot.dominantDimension,
      (dominantBreakdownMap.get(snapshot.dominantDimension) ?? 0) + 1,
    )
  }

  return {
    decompositionKey,
    temporalWindowLabel: selectedTemporal?.periodLabel ?? null,
    aggregate: {
      totalComponents: snapshots.length,
      overloadedComponents: snapshots.filter((snapshot) => snapshot.systemicRisk >= 7.5).length,
      knowledgeExposedComponents: snapshots.filter((snapshot) => snapshot.contributors <= 2).length,
      averageLoad: round1(average(snapshots.map((snapshot) => snapshot.overallLoad))),
      averageBalance: round1(average(snapshots.map((snapshot) => snapshot.balanceScore))),
      averageRisk: round1(average(snapshots.map((snapshot) => snapshot.systemicRisk))),
      maxRisk: round1(Math.max(...snapshots.map((snapshot) => snapshot.systemicRisk), 0)),
      topRiskComponent: snapshots[0]?.component,
    },
    riskTierCounts,
    dimensionMix: [
      {
        id: "staticCoupling",
        label: COUPLING_DIMENSION_LABELS.staticCoupling,
        value: round1(average(snapshots.map((snapshot) => snapshot.staticCoupling))),
        color: "#6366f1",
      },
      {
        id: "temporalCoupling",
        label: COUPLING_DIMENSION_LABELS.temporalCoupling,
        value: round1(average(snapshots.map((snapshot) => snapshot.temporalCoupling))),
        color: "#8b5cf6",
      },
      {
        id: "coordinationCoupling",
        label: COUPLING_DIMENSION_LABELS.coordinationCoupling,
        value: round1(average(snapshots.map((snapshot) => snapshot.coordinationCoupling))),
        color: "#06b6d4",
      },
      {
        id: "knowledgeRisk",
        label: COUPLING_DIMENSION_LABELS.knowledgeRisk,
        value: round1(average(snapshots.map((snapshot) => snapshot.knowledgeRisk))),
        color: "#ef4444",
      },
    ],
    dominantBreakdown: [...dominantBreakdownMap.entries()].map(([label, value]) => ({
      label,
      value,
      detail: `${value} components`,
      color: COUPLING_DIMENSION_COLORS[label] ?? "#6366f1",
    })),
    topRiskComponents: snapshots.slice(0, 12).map((snapshot) => ({
      component: snapshot.component,
      systemicRisk: snapshot.systemicRisk,
      riskTier: snapshot.riskTier,
      dominantDimension: snapshot.dominantDimension,
      explainability: snapshot.explainability,
    })),
    inventory: snapshots,
  }
}

export function readReportLandscapeRepositoryCouplingSummary(
  dataDir: string,
  repoKey: string,
): ReportCouplingSummary | null {
  return readReportCouplingSummary(resolveLandscapeRepoDataDir(dataDir, repoKey))
}

export function readReportTrendsSummary(_dataDir: string): ReportTrendsSummary {
  return {
    available: false,
    message: "Trend data requires multiple analysis snapshots over time.",
    hint: "Run planetnik generateReports periodically. Each run adds a snapshot to the trend baseline.",
  }
}

function readJsonFileArray(dataDir: string, fileName: string): ReadonlyArray<Record<string, unknown>> {
  const filePath = join(dataDir, fileName)
  if (!existsSync(filePath)) {
    return []
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown
    return Array.isArray(raw)
      ? raw.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : []
  } catch {
    return []
  }
}

export function readReportMetricsSummary(dataDir: string): ReportMetricsSummary | null {
  const metrics = [...readMetricsMap(dataDir).entries()].map(([id, value]) => ({
    id,
    value,
  }))

  if (metrics.length === 0) {
    return null
  }

  const metricById = new Map(metrics.map((metric) => [metric.id, metric.value] as const))
  const groups = new Map<string, Array<{ id: string; value: number }>>()
  for (const metric of metrics) {
    const groupId = groupMetricId(metric.id)
    const list = groups.get(groupId) ?? []
    list.push(metric)
    groups.set(groupId, list)
  }

  const locBreakdown = [
    { label: "Main", value: metricById.get("LINES_OF_CODE_MAIN") ?? 0 },
    { label: "Test", value: metricById.get("LINES_OF_CODE_TEST") ?? 0 },
    { label: "Generated", value: metricById.get("LINES_OF_CODE_GENERATED") ?? 0 },
    { label: "Build & Deploy", value: metricById.get("LINES_OF_CODE_BUILDANDDEPLOYMENT") ?? 0 },
    { label: "Other", value: metricById.get("LINES_OF_CODE_OTHER") ?? 0 },
  ].filter((item) => item.value > 0)

  const mainLocByExtension = metrics
    .filter((m) => m.id.startsWith("LINES_OF_CODE_MAIN_EXT_") && m.value > 0)
    .map((m) => ({
      label: `.${m.id.slice("LINES_OF_CODE_MAIN_EXT_".length).toLowerCase()}`,
      value: m.value,
    }))
    .sort((a, b) => b.value - a.value)

  return {
    totalMetrics: metrics.length,
    headlineMetrics: {
      mainLinesOfCode: metricById.get("LINES_OF_CODE_MAIN") ?? 0,
      testLinesOfCode: metricById.get("LINES_OF_CODE_TEST") ?? 0,
      duplicatedLines: metricById.get("DUPLICATION_NUMBER_OF_DUPLICATED_LINES") ?? 0,
      testVsMainPercentage: metricById.get("TEST_VS_MAIN_LINES_OF_CODE_PERCENTAGE") ?? 0,
      totalAnalysisTimeInMillis: metricById.get("TOTAL_ANALYSIS_TIME_IN_MILLIS") ?? 0,
    },
    locBreakdown,
    mainLocByExtension,
    groupSummaries: [...groups.entries()]
      .map(([groupId, groupMetrics]) => ({
        groupId,
        label: formatMetricGroupLabel(groupId),
        metrics: [...groupMetrics].sort((left, right) => left.id.localeCompare(right.id)),
      }))
      .sort((left, right) => sortMetricGroups(left.groupId, right.groupId)),
  }
}

export function readReportDuplicationSummary(dataDir: string): ReportDuplicationSummary | null {
  const analysis = readJsonRecord(dataDir, "analysisResults.json")
  const duplication =
    analysis?.duplication && typeof analysis.duplication === "object"
      ? (analysis.duplication as Record<string, unknown>)
      : null
  const duplicationPercentage = duplication?.percentage
  const duplicatedLines = duplication?.duplicatedLines

  const duplicatesRaw = readJsonRecord(dataDir, "duplicates.json")
  const duplicates = Array.isArray(duplicatesRaw?.duplicates)
    ? duplicatesRaw.duplicates.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
      )
    : []

  if (typeof duplicationPercentage !== "number" || typeof duplicatedLines !== "number") {
    return null
  }

  const sorted = duplicates
    .map((duplicate) => {
      const blockSize = typeof duplicate.blockSize === "number" ? duplicate.blockSize : 0
      const duplicatedFileBlocks = Array.isArray(duplicate.duplicatedFileBlocks)
        ? duplicate.duplicatedFileBlocks.filter(
            (block): block is Record<string, unknown> => typeof block === "object" && block !== null,
          )
        : []

      return {
        blockSize,
        duplicatedFileBlocks,
      }
    })
    .filter((duplicate) => duplicate.blockSize > 0)
    .sort((left, right) => right.blockSize - left.blockSize)

  const buckets = [
    { label: "6-10 lines", min: 6, max: 10, count: 0 },
    { label: "11-20 lines", min: 11, max: 20, count: 0 },
    { label: "21-50 lines", min: 21, max: 50, count: 0 },
    { label: "51-100 lines", min: 51, max: 100, count: 0 },
    { label: "100+ lines", min: 101, max: Number.POSITIVE_INFINITY, count: 0 },
  ]
  for (const duplicate of sorted) {
    for (const bucket of buckets) {
      if (duplicate.blockSize >= bucket.min && duplicate.blockSize <= bucket.max) {
        bucket.count += 1
        break
      }
    }
  }

  const fileDupCount = new Map<string, number>()
  for (const duplicate of sorted) {
    for (const block of duplicate.duplicatedFileBlocks) {
      const file = block.file && typeof block.file === "object" ? (block.file as Record<string, unknown>) : null
      const relativePath = typeof file?.relativePath === "string" ? file.relativePath : ""
      if (relativePath.length === 0) {
        continue
      }

      fileDupCount.set(relativePath, (fileDupCount.get(relativePath) ?? 0) + 1)
    }
  }

  return {
    duplicationPercentage,
    duplicatedLines,
    duplicateBlocksCount: sorted.length,
    blockSizeDistribution: buckets.map((bucket) => ({
      label: bucket.label,
      value: bucket.count,
      detail: `${bucket.count} blocks`,
    })),
    mostDuplicatedFiles: [...fileDupCount.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 15)
      .map(([path, count]) => ({
        label: path.split("/").at(-1) ?? path,
        value: count,
      })),
    largestDuplicateBlocks: sorted.slice(0, 15).map((duplicate) => ({
      blockSize: duplicate.blockSize,
      files: duplicate.duplicatedFileBlocks.length,
      locations: duplicate.duplicatedFileBlocks.map((block) => {
        const file = block.file && typeof block.file === "object" ? (block.file as Record<string, unknown>) : null
        const relativePath = typeof file?.relativePath === "string" ? file.relativePath : ""
        const startLine = typeof block.startLine === "number" ? block.startLine : 0
        const endLine = typeof block.endLine === "number" ? block.endLine : 0
        return `${relativePath}:${startLine}-${endLine}`
      }),
    })),
  }
}

export function readReportDependenciesSummary(dataDir: string): ReportDependenciesSummary | null {
  const raw = readJsonRecord(dataDir, "component_dependencies.json")
  const dependencies = Array.isArray(raw?.dependencies)
    ? raw.dependencies.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []

  if (dependencies.length === 0) {
    return null
  }

  const grouped = new Map<string, Array<Record<string, unknown>>>()
  for (const dependency of dependencies) {
    const decompositionKey = typeof dependency.decompositionKey === "string" ? dependency.decompositionKey : ""
    if (decompositionKey.length === 0) {
      continue
    }

    const group = grouped.get(decompositionKey) ?? []
    group.push(dependency)
    grouped.set(decompositionKey, group)
  }

  return {
    sections: [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([decompositionKey, group]) => {
        const incoming = new Map<string, number>()
        const outgoing = new Map<string, number>()
        const links = group.map((dependency) => {
          const fromComponent = typeof dependency.fromComponent === "string" ? dependency.fromComponent : ""
          const toComponent = typeof dependency.toComponent === "string" ? dependency.toComponent : ""
          const count = typeof dependency.count === "number" ? dependency.count : 0

          incoming.set(toComponent, (incoming.get(toComponent) ?? 0) + count)
          outgoing.set(fromComponent, (outgoing.get(fromComponent) ?? 0) + count)

          return {
            fromComponent,
            toComponent,
            count,
            evidenceCount: typeof dependency.evidenceCount === "number" ? dependency.evidenceCount : 0,
            locFrom: typeof dependency.locFrom === "number" ? dependency.locFrom : 0,
          }
        })

        return {
          decompositionKey,
          linksCount: links.length,
          incoming: [...incoming.entries()]
            .sort((left, right) => right[1] - left[1])
            .map(([label, value]) => ({ label, value })),
          outgoing: [...outgoing.entries()]
            .sort((left, right) => right[1] - left[1])
            .map(([label, value]) => ({ label, value })),
          links,
        }
      }),
  }
}

export function readReportControlsSummary(dataDir: string): ReportControlsSummary | null {
  const raw = readJsonRecord(dataDir, "controls.json")
  const goals = Array.isArray(raw?.goals)
    ? raw.goals.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : []

  if (goals.length === 0) {
    return null
  }

  const controls: Array<{
    id: string
    goal: string
    metricId: string
    metricValue: number | null
    desiredRangeText: string
    status: string
    description: string
  }> = []

  for (const goal of goals) {
    const goalName = typeof goal.goal === "string" && goal.goal.length > 0 ? goal.goal : "Controls"
    const goalControls = Array.isArray(goal.controls)
      ? goal.controls.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      : []

    for (let i = 0; i < goalControls.length; i += 1) {
      const control = goalControls[i]!
      const metricId = typeof control.metricId === "string" ? control.metricId : ""
      controls.push({
        id: `${goalName}::${metricId || `control-${i}`}`,
        goal: goalName,
        metricId,
        metricValue: typeof control.metricValue === "number" ? control.metricValue : null,
        desiredRangeText: typeof control.desiredRangeText === "string" ? control.desiredRangeText : "",
        status: typeof control.status === "string" ? control.status : "",
        description:
          typeof control.controlDescription === "string" && control.controlDescription.length > 0
            ? control.controlDescription
            : typeof control.metricDescription === "string"
              ? control.metricDescription
              : "",
      })
    }
  }

  const statusCounts = {
    failed: controls.filter((control) => control.status === "FAILED").length,
    tolerant: controls.filter((control) => control.status === "TOLERANT").length,
    ok: controls.filter((control) => control.status === "OK").length,
    ignored: controls.filter((control) => control.status.startsWith("IGNORED")).length,
  }

  const goalMap = new Map<
    string,
    {
      total: number
      failed: number
      tolerant: number
      ok: number
      ignored: number
    }
  >()
  for (const control of controls) {
    const entry = goalMap.get(control.goal) ?? {
      total: 0,
      failed: 0,
      tolerant: 0,
      ok: 0,
      ignored: 0,
    }
    entry.total += 1
    if (control.status === "FAILED") entry.failed += 1
    else if (control.status === "TOLERANT") entry.tolerant += 1
    else if (control.status === "OK") entry.ok += 1
    else if (control.status.startsWith("IGNORED")) entry.ignored += 1
    goalMap.set(control.goal, entry)
  }

  return {
    totalControls: controls.length,
    statusCounts,
    goals: [...goalMap.entries()]
      .sort((left, right) => {
        if (right[1].failed !== left[1].failed) {
          return right[1].failed - left[1].failed
        }
        if (right[1].tolerant !== left[1].tolerant) {
          return right[1].tolerant - left[1].tolerant
        }
        return right[1].total - left[1].total
      })
      .map(([goal, stats]) => ({
        goal,
        total: stats.total,
        failed: stats.failed,
        tolerant: stats.tolerant,
        ok: stats.ok,
        ignored: stats.ignored,
      })),
    controls,
  }
}

export function readReportImpactSummary(dataDir: string): ReportImpactSummary | null {
  const raw = readJsonRecord(dataDir, "impact.json")
  if (!raw) {
    return null
  }

  const visibleActivity =
    raw.visible_activity && typeof raw.visible_activity === "object"
      ? (raw.visible_activity as Record<string, unknown>)
      : null
  const structuralImpact =
    raw.structural_impact && typeof raw.structural_impact === "object"
      ? (raw.structural_impact as Record<string, unknown>)
      : null
  const structuralSummary =
    structuralImpact?.summary && typeof structuralImpact.summary === "object"
      ? (structuralImpact.summary as Record<string, unknown>)
      : null

  if (
    typeof raw.title !== "string" ||
    typeof raw.timestamp !== "string" ||
    typeof visibleActivity?.commits !== "number" ||
    typeof visibleActivity?.contributors !== "number" ||
    typeof visibleActivity?.changed_files !== "number" ||
    typeof visibleActivity?.changed_units !== "number" ||
    typeof structuralSummary?.overall_score !== "number" ||
    typeof structuralSummary?.dominant_dimension !== "string"
  ) {
    return null
  }

  const impactDimensions = Array.isArray(raw.impact_dimensions)
    ? raw.impact_dimensions
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => ({
          label: typeof item.label === "string" ? item.label : "",
          score: typeof item.score === "number" ? item.score : 0,
        }))
    : []

  const topOpportunities = Array.isArray(raw.impact_opportunities)
    ? raw.impact_opportunities
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => {
          const dims =
            item.dimensions && typeof item.dimensions === "object" ? (item.dimensions as Record<string, unknown>) : {}
          const reasons = Array.isArray(item.reasons)
            ? item.reasons.filter((r): r is string => typeof r === "string")
            : []
          return {
            name: typeof item.name === "string" ? item.name : "",
            kind: typeof item.kind === "string" ? item.kind : "",
            parent: typeof item.parent === "string" ? item.parent : "",
            impactScore: typeof item.impact_score === "number" ? item.impact_score : 0,
            dominantDimension: typeof item.dominant_dimension === "string" ? item.dominant_dimension : "",
            suggestedAction: typeof item.suggested_action === "string" ? item.suggested_action : "",
            reasons,
            complexityReduction: typeof dims.complexity_reduction === "number" ? dims.complexity_reduction : 0,
            boundaryShaping: typeof dims.boundary_shaping === "number" ? dims.boundary_shaping : 0,
            knowledgeSpread: typeof dims.knowledge_spread === "number" ? dims.knowledge_spread : 0,
            coordinationRelief: typeof dims.coordination_relief === "number" ? dims.coordination_relief : 0,
            changeEnablement: typeof dims.change_enablement === "number" ? dims.change_enablement : 0,
          }
        })
        .sort((left, right) => right.impactScore - left.impactScore)
        .slice(0, 12)
    : []

  const snackingCandidates = Array.isArray(raw.snacking_candidates)
    ? raw.snacking_candidates
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => {
          const visibleActivityScore = typeof item.visible_activity_score === "number" ? item.visible_activity_score : 0
          const structuralImpactScore =
            typeof item.structural_impact_score === "number" ? item.structural_impact_score : 0
          return {
            name: typeof item.name === "string" ? item.name : "",
            kind: typeof item.kind === "string" ? item.kind : "",
            visibleActivityScore,
            structuralImpactScore,
            delta: Math.max(visibleActivityScore - structuralImpactScore, 0),
            reason: typeof item.reason === "string" ? item.reason : "",
          }
        })
        .slice(0, 8)
    : []

  const conceptMappings = Array.isArray(raw.concept_mappings)
    ? raw.concept_mappings
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
        .map((item) => {
          const exampleIds = Array.isArray(item.example_ids)
            ? item.example_ids
                .slice(0, 3)
                .filter((id): id is string => typeof id === "string")
                .map((id: string) => {
                  if (id.startsWith("component:")) {
                    const parts = id.split(":")
                    const componentName = parts[2] ?? parts[1] ?? ""
                    return `component · ${componentName}`
                  }
                  if (id.startsWith("file:")) {
                    const filePath = id.slice("file:".length)
                    return `file · ${filePath.split("/").pop() ?? filePath}`
                  }
                  if (id.startsWith("unit:")) {
                    const unitPath = id.slice("unit:".length)
                    const sep = unitPath.lastIndexOf(":")
                    const rel = sep >= 0 ? unitPath.slice(0, sep) : unitPath
                    const line = sep >= 0 ? unitPath.slice(sep + 1) : ""
                    const fileName = rel.split("/").pop() ?? rel
                    return line ? `unit · ${fileName}:${line}` : `unit · ${fileName}`
                  }
                  return id.length > 40 ? `${id.slice(0, 39)}…` : id
                })
            : []
          return {
            concept: typeof item.concept === "string" ? item.concept : "",
            dimension: typeof item.dimension === "string" ? item.dimension : "",
            evidenceCount: typeof item.evidence_count === "number" ? item.evidence_count : 0,
            examples: exampleIds,
          }
        })
    : []

  return {
    title: raw.title,
    timestamp: raw.timestamp,
    visibleActivity: {
      commits: visibleActivity.commits,
      contributors: visibleActivity.contributors,
      changedFiles: visibleActivity.changed_files,
      changedUnits: visibleActivity.changed_units,
    },
    structuralImpact: {
      overallScore: structuralSummary.overall_score,
      dominantDimension: structuralSummary.dominant_dimension,
    },
    impactDimensions,
    topOpportunities,
    snackingCandidates,
    conceptMappings,
  }
}

function getDatasetTitle(context: Record<string, unknown> | null, fallback: string): string {
  const title = context?.title
  return typeof title === "string" && title.trim().length > 0 ? title : fallback
}

function getReportMode(context: Record<string, unknown> | null): string | null {
  const reportMode = context?.reportMode
  return typeof reportMode === "string" && reportMode.trim().length > 0 ? reportMode : null
}

export function inferDatasetNameFromAnalysisRoot(analysisRoot: string): string | undefined {
  const segments = resolve(analysisRoot)
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0)
  const datasetsIndex = segments.lastIndexOf("datasets")

  if (datasetsIndex < 0) {
    return undefined
  }

  const datasetName = segments[datasetsIndex + 1]
  return typeof datasetName === "string" && datasetName.length > 0 ? datasetName : undefined
}

export function resolvePersistedReportDataSource(input: {
  readonly analysisRoot?: string | null
  readonly datasetsRoot?: string
  readonly fileExists?: (path: string) => boolean
}): ResolvedReportDataSource | null {
  const analysisRoot = input.analysisRoot?.trim()
  if (!analysisRoot) {
    return null
  }

  const fileExists = input.fileExists
  const resolvedPath = resolve(analysisRoot)
  const directDataDir = resolveRecognizedDataDir(getFlexibleDataDirCandidates(resolvedPath), fileExists)

  if (directDataDir && isRecognizedDataDir(directDataDir, fileExists)) {
    const context = readReportContext(directDataDir)
    return {
      dataDir: directDataDir,
      title: getDatasetTitle(context, resolvedPath),
      reportMode: getReportMode(context),
    }
  }

  const datasetName = inferDatasetNameFromAnalysisRoot(resolvedPath)
  if (!datasetName) {
    return null
  }

  const fallbackDatasetsRoot = input.datasetsRoot ?? getConfiguredDatasetsRoot()
  const fallbackDataDir = resolveNamedDatasetDataDir(datasetName, fallbackDatasetsRoot, fileExists)
  if (!fallbackDataDir) {
    return null
  }

  const context = readReportContext(fallbackDataDir)
  return {
    dataDir: fallbackDataDir,
    datasetName,
    title: getDatasetTitle(context, datasetName),
    reportMode: getReportMode(context),
  }
}

export function getConfiguredDatasetsRoot(): string {
  return appConfig.datasetsRoot ?? defaultDatasetsRoot
}

export function listAvailableDatasets(): RuntimeDataset[] {
  const datasetsRoot = getConfiguredDatasetsRoot()
  if (!existsSync(datasetsRoot)) {
    return []
  }

  return readdirSync(datasetsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dataDir = resolveNamedDatasetDataDir(entry.name, datasetsRoot)
      if (!dataDir) {
        return null
      }

      const context = readReportContext(dataDir)
      return {
        name: entry.name,
        dataDir,
        title: getDatasetTitle(context, entry.name),
        reportMode: getReportMode(context),
      } satisfies RuntimeDataset
    })
    .filter((dataset): dataset is RuntimeDataset => dataset !== null)
    .sort((left, right) => left.title.localeCompare(right.title))
}

export function resolveReportDataSource(input: {
  readonly datasetName?: string | null
  readonly analysisRoot?: string | null
}): ResolvedReportDataSource | null {
  const datasetName = input.datasetName?.trim()
  if (datasetName) {
    const dataDir = resolveNamedDatasetDataDir(datasetName, getConfiguredDatasetsRoot())
    if (!dataDir) {
      return null
    }

    const context = readReportContext(dataDir)
    return {
      dataDir,
      datasetName,
      title: getDatasetTitle(context, datasetName),
      reportMode: getReportMode(context),
    }
  }

  const analysisRoot = input.analysisRoot?.trim()
  if (!analysisRoot) {
    return null
  }

  return resolvePersistedReportDataSource({
    analysisRoot,
  })
}
