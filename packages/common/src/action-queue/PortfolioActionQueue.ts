export type PortfolioActionSignalDomain =
  | "hotspot"
  | "control"
  | "security"
  | "impact"
  | "coupling"
  | "ownership"
  | "trend"

export type PortfolioActionTeam = { readonly id: string; readonly label: string }
export type PortfolioActionPriorityBand = "critical" | "high" | "medium" | "low" | "unrated"
export type PortfolioActionTrend = "worsening" | "stable" | "improving" | "unknown"
export type PortfolioActionFreshness = "fresh" | "recent" | "aging" | "stale" | "unknown"
export type PortfolioActionWindow = "current" | "latest-compatible" | "7d" | "30d" | "90d"
export type PortfolioActionDomainState = "present" | "missing" | "invalid"

export type PortfolioActionEvidence = {
  readonly datasetId: string
  readonly repositoryId: string
  readonly snapshotId: string
  readonly generatedAt: string
  readonly domain: PortfolioActionSignalDomain
  readonly shard: string
  readonly record: string
  readonly href: string
  readonly label: string
  readonly observed: Readonly<Record<string, string | number | boolean | null>>
}

export type PortfolioActionSignal = {
  readonly id: string
  readonly repositoryId: string
  readonly targetId: string
  readonly targetLabel: string
  readonly team: PortfolioActionTeam
  readonly domain: PortfolioActionSignalDomain
  readonly priorityBand: PortfolioActionPriorityBand
  readonly sourcePriority: { readonly label: string; readonly value: string | number | null }
  readonly observedAt: string | null
  readonly action: { readonly key: string; readonly label: string }
  readonly explanation: string
  readonly facts: readonly { readonly label: string; readonly value: string | number | boolean | null }[]
  readonly evidence: readonly PortfolioActionEvidence[]
}

export type PortfolioActionFactor = {
  readonly key: "priority" | "corroboration" | "trend" | "freshness"
  readonly label: string
  readonly value: string | number
  readonly explanation: string
}

export type PortfolioActionQueueItem = {
  readonly id: string
  readonly repositoryId: string
  readonly repositoryTitle: string
  readonly target: { readonly id: string; readonly label: string }
  readonly teams: readonly PortfolioActionTeam[]
  readonly primaryAction: { readonly key: string; readonly label: string }
  readonly alternateActions: readonly { readonly key: string; readonly label: string }[]
  readonly priorityBand: PortfolioActionPriorityBand
  readonly trend: PortfolioActionTrend
  readonly freshness: PortfolioActionFreshness
  readonly corroboration: number
  readonly factors: readonly PortfolioActionFactor[]
  readonly signals: readonly PortfolioActionSignal[]
  readonly evidence: readonly PortfolioActionEvidence[]
  readonly status: "untracked"
}

export type PortfolioActionQueueCoverage = {
  readonly datasets: {
    readonly included: readonly { readonly datasetId: string; readonly repositoryId: string }[]
    readonly planned: readonly { readonly datasetId: string; readonly reason: string }[]
    readonly excluded: readonly { readonly datasetId: string; readonly reason: string }[]
    readonly unavailable: readonly { readonly datasetId: string; readonly reason: string }[]
  }
  readonly domains: Readonly<
    Record<
      PortfolioActionSignalDomain,
      {
        readonly status: PortfolioActionDomainState
        readonly datasetCount: number
        readonly signalCount: number
        readonly message?: string
      }
    >
  >
  readonly diagnostics: readonly {
    readonly datasetId: string
    readonly severity: "warning" | "error"
    readonly reason: string
  }[]
}

export type PortfolioActionQueueFilters = {
  readonly repositoryIds: readonly string[]
  readonly teamIds: readonly string[]
  readonly priorityBands: readonly PortfolioActionPriorityBand[]
  readonly domains: readonly PortfolioActionSignalDomain[]
  readonly window: PortfolioActionWindow
}

export type PortfolioActionQueue = {
  readonly contractVersion: 1
  readonly rankingPolicyVersion: 1
  readonly asOf: string
  readonly filters: PortfolioActionQueueFilters
  readonly items: readonly PortfolioActionQueueItem[]
  readonly coverage: PortfolioActionQueueCoverage
}

export type PortfolioActionSourceRecord = {
  readonly id: string
  readonly targetId: string
  readonly targetLabel: string
  readonly team?: PortfolioActionTeam
  readonly observedAt: string | null
  readonly values: Readonly<Record<string, unknown>>
  readonly evidence: readonly PortfolioActionEvidence[]
}
export type PortfolioActionDomainInput = {
  readonly status: PortfolioActionDomainState
  readonly message?: string
  readonly records: readonly PortfolioActionSourceRecord[]
}
export type PortfolioActionTrendInput = {
  readonly targetId: string
  readonly targetLabel: string
  readonly baselineValues: Readonly<Record<string, unknown>>
  readonly currentValues: Readonly<Record<string, unknown>>
  readonly baselineEvidence: readonly PortfolioActionEvidence[]
  readonly currentEvidence: readonly PortfolioActionEvidence[]
  readonly observedAt: string | null
}
export type PortfolioActionDatasetInput = {
  readonly datasetId: string
  readonly repositoryId: string
  readonly repositoryTitle: string
  readonly mode: "single_repository" | "landscape"
  readonly availability: "ready" | "partial" | "planned" | "invalid"
  readonly current?: {
    readonly snapshotId: string
    readonly generatedAt: string
    readonly domains: Readonly<Partial<Record<PortfolioActionSignalDomain, PortfolioActionDomainInput>>>
  }
  readonly trendInputs: readonly PortfolioActionTrendInput[]
  readonly historyStatus: "compatible" | "missing" | "incompatible" | "invalid"
}
export type HostedActionStatus = {
  readonly itemId: string
  readonly snapshotId: string
  readonly state: "acknowledged" | "snoozed" | "resolved"
  readonly changedAt: string
  readonly changedBy: string
  readonly note?: string
}

export type PortfolioActionSignalBuildResult = {
  readonly signals: readonly PortfolioActionSignal[]
  readonly domainCoverage: PortfolioActionQueueCoverage["domains"]
  readonly diagnostics: PortfolioActionQueueCoverage["diagnostics"]
}

const domains: readonly PortfolioActionSignalDomain[] = [
  "hotspot",
  "control",
  "security",
  "impact",
  "coupling",
  "ownership",
  "trend",
]
export function emptyPortfolioActionCoverage(): PortfolioActionQueueCoverage {
  const domainCoverage = {} as Record<
    PortfolioActionSignalDomain,
    PortfolioActionQueueCoverage["domains"][PortfolioActionSignalDomain]
  >
  for (const domain of domains) domainCoverage[domain] = { status: "missing", datasetCount: 0, signalCount: 0 }
  return {
    datasets: { included: [], planned: [], excluded: [], unavailable: [] },
    domains: domainCoverage,
    diagnostics: [],
  }
}
export function defaultPortfolioActionQueueFilters(): PortfolioActionQueueFilters {
  return { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: "current" }
}
