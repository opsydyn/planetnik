import { compareQueueItems } from "./Ranking.js"
import { adaptPortfolioActionSignals } from "./SignalAdapters.js"

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

export type PortfolioActionQueueBuildResult = {
  readonly queue: PortfolioActionQueue
  readonly totalItems: number
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

const actionDomainOrder: readonly PortfolioActionSignalDomain[] = [
  "security",
  "control",
  "hotspot",
  "coupling",
  "ownership",
  "impact",
  "trend",
]

const priorityOrder: readonly PortfolioActionPriorityBand[] = ["critical", "high", "medium", "low", "unrated"]
const trendOrder: readonly PortfolioActionTrend[] = ["worsening", "stable", "improving", "unknown"]

type DatasetSelection = {
  readonly input: PortfolioActionDatasetInput
  readonly signalResult: PortfolioActionSignalBuildResult
  readonly signals: readonly PortfolioActionSignal[]
}

type Diagnostic = PortfolioActionQueueCoverage["diagnostics"][number]

const nonEmpty = (value: string): boolean => value.trim().length > 0
const validTimestamp = (value: string): boolean => nonEmpty(value) && Number.isFinite(Date.parse(value))

const datasetProblem = (input: PortfolioActionDatasetInput): string | undefined => {
  if (!nonEmpty(input.datasetId)) return "datasetId is empty"
  if (!nonEmpty(input.repositoryId)) return "repositoryId is empty"
  if (!nonEmpty(input.repositoryTitle)) return "repository title is empty"
  if (input.availability === "invalid") return "dataset availability is invalid"
  if (!input.current) return "current snapshot is missing"
  if (!nonEmpty(input.current.snapshotId)) return "current snapshotId is empty"
  if (!validTimestamp(input.current.generatedAt)) return "current generatedAt is invalid"
  return undefined
}

export const isPortfolioActionSignalInWindow = (
  signal: PortfolioActionSignal,
  window: PortfolioActionWindow,
  asOf: string,
): boolean => {
  if (window === "current") return signal.domain !== "trend"
  if (window === "latest-compatible") return true
  if (signal.observedAt === null) return true
  const observedAt = Date.parse(signal.observedAt)
  const reference = Date.parse(asOf)
  if (!Number.isFinite(observedAt) || !Number.isFinite(reference)) return false
  const ageDays = (reference - observedAt) / 86_400_000
  const limit = window === "7d" ? 7 : window === "30d" ? 30 : 90
  return ageDays >= 0 && ageDays <= limit
}

const freshnessOf = (signals: readonly PortfolioActionSignal[], asOf: string): PortfolioActionFreshness => {
  const reference = Date.parse(asOf)
  const observations = signals
    .flatMap((signal) => (signal.observedAt === null ? [] : [Date.parse(signal.observedAt)]))
    .filter((observedAt) => Number.isFinite(observedAt) && observedAt <= reference)
  if (observations.length === 0 || !Number.isFinite(reference)) return "unknown"
  const ageDays = (reference - Math.max(...observations)) / 86_400_000
  if (ageDays <= 7) return "fresh"
  if (ageDays <= 30) return "recent"
  if (ageDays <= 90) return "aging"
  return "stale"
}

const priorityOf = (signals: readonly PortfolioActionSignal[]): PortfolioActionPriorityBand => {
  const bands = signals.filter((signal) => signal.domain !== "trend").map((signal) => signal.priorityBand)
  return priorityOrder.find((band) => bands.includes(band)) ?? "unrated"
}

const trendOf = (signals: readonly PortfolioActionSignal[]): PortfolioActionTrend => {
  const trends = signals
    .filter((signal) => signal.domain === "trend")
    .map((signal) => signal.sourcePriority.value)
    .filter(
      (value): value is PortfolioActionTrend =>
        typeof value === "string" && trendOrder.includes(value as PortfolioActionTrend),
    )
  if (trends.includes("worsening") && trends.includes("improving")) return "unknown"
  return trendOrder.find((trend) => trends.includes(trend)) ?? "unknown"
}

const signalOrder = (left: PortfolioActionSignal, right: PortfolioActionSignal): number =>
  actionDomainOrder.indexOf(left.domain) - actionDomainOrder.indexOf(right.domain) || left.id.localeCompare(right.id)

const factorsOf = (
  priorityBand: PortfolioActionPriorityBand,
  corroboration: number,
  trend: PortfolioActionTrend,
  freshness: PortfolioActionFreshness,
): readonly PortfolioActionFactor[] => [
  {
    key: "priority",
    label: "Priority band",
    value: priorityBand,
    explanation: `The strongest current non-trend signal is ${priorityBand}.`,
  },
  {
    key: "corroboration",
    label: "Corroboration",
    value: corroboration,
    explanation: `${corroboration} distinct signal domain${corroboration === 1 ? "" : "s"} support this target.`,
  },
  {
    key: "trend",
    label: "Trend",
    value: trend,
    explanation: `Compatible allowlisted risk evidence indicates a ${trend} trend.`,
  },
  {
    key: "freshness",
    label: "Freshness",
    value: freshness,
    explanation: `The newest known observation is ${freshness} relative to the queue as-of time.`,
  },
]

const validSignalAnchor = (signal: PortfolioActionSignal, input: PortfolioActionDatasetInput): boolean =>
  nonEmpty(signal.repositoryId) &&
  signal.repositoryId === input.repositoryId &&
  nonEmpty(signal.targetId) &&
  signal.evidence.some(
    (anchor) =>
      anchor.datasetId === input.datasetId &&
      anchor.repositoryId === signal.repositoryId &&
      nonEmpty(anchor.snapshotId) &&
      validTimestamp(anchor.generatedAt) &&
      anchor.domain === signal.domain &&
      nonEmpty(anchor.shard) &&
      nonEmpty(anchor.record) &&
      anchor.href.startsWith(`/datasets/${input.datasetId}/`),
  )

export const buildPortfolioActionQueueItem = (
  repositoryTitle: string,
  unsortedSignals: readonly PortfolioActionSignal[],
  asOf: string,
): PortfolioActionQueueItem | undefined => {
  const signals = [...unsortedSignals].sort(signalOrder)
  const actionable = signals.filter((signal) => signal.domain !== "trend")
  if (actionable.length === 0) return undefined
  const priorityBand = priorityOf(signals)
  const primary = actionable.find((signal) => signal.priorityBand === priorityBand)!
  const actions = signals.flatMap((signal) => (signal.action.key === primary.action.key ? [] : [signal.action]))
  const alternateActions = actions.filter(
    (action, index) => actions.findIndex((candidate) => candidate.key === action.key) === index,
  )
  const teams = signals
    .map((signal) => signal.team)
    .filter((team, index, all) => all.findIndex((candidate) => candidate.id === team.id) === index)
    .sort((left, right) => left.id.localeCompare(right.id) || left.label.localeCompare(right.label))
  const trend = trendOf(signals)
  const freshness = freshnessOf(signals, asOf)
  const corroboration = new Set(signals.map((signal) => signal.domain)).size
  return {
    id: `action:${primary.repositoryId}:${primary.targetId}`,
    repositoryId: primary.repositoryId,
    repositoryTitle,
    target: { id: primary.targetId, label: primary.targetLabel },
    teams,
    primaryAction: primary.action,
    alternateActions,
    priorityBand,
    trend,
    freshness,
    corroboration,
    factors: factorsOf(priorityBand, corroboration, trend, freshness),
    signals,
    evidence: signals.flatMap((signal) => signal.evidence),
    status: "untracked",
  }
}

class WorstFirstQueue {
  private readonly values: PortfolioActionQueueItem[] = []

  constructor(private readonly limit: number) {}

  add(value: PortfolioActionQueueItem): void {
    if (this.values.length < this.limit) {
      this.values.push(value)
      this.siftUp(this.values.length - 1)
      return
    }
    if (compareQueueItems(value, this.values[0]!) >= 0) return
    this.values[0] = value
    this.siftDown(0)
  }

  sorted(): readonly PortfolioActionQueueItem[] {
    return [...this.values].sort(compareQueueItems)
  }

  private siftUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2)
      if (compareQueueItems(this.values[parent]!, this.values[index]!) >= 0) break
      ;[this.values[parent], this.values[index]] = [this.values[index]!, this.values[parent]!]
      index = parent
    }
  }

  private siftDown(index: number): void {
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      let worst = index
      if (left < this.values.length && compareQueueItems(this.values[left]!, this.values[worst]!) > 0) worst = left
      if (right < this.values.length && compareQueueItems(this.values[right]!, this.values[worst]!) > 0) worst = right
      if (worst === index) return
      ;[this.values[index], this.values[worst]] = [this.values[worst]!, this.values[index]!]
      index = worst
    }
  }
}

const buildItems = (
  selections: readonly DatasetSelection[],
  asOf: string,
  diagnostics: Diagnostic[],
  itemLimit?: number,
): { readonly items: readonly PortfolioActionQueueItem[]; readonly totalItems: number } => {
  const groups = new Map<string, { repositoryTitle: string; signals: PortfolioActionSignal[] }>()
  for (const selection of selections) {
    for (const signal of selection.signals) {
      if (!validSignalAnchor(signal, selection.input)) {
        diagnostics.push({
          datasetId: selection.input.datasetId,
          severity: "warning",
          reason: `signal ${signal.id || "<empty>"} has no valid provenance anchor`,
        })
        continue
      }
      const key = `${signal.repositoryId}\u0000${signal.targetId}`
      const group = groups.get(key) ?? { repositoryTitle: selection.input.repositoryTitle, signals: [] }
      group.signals.push(signal)
      groups.set(key, group)
    }
  }

  if (itemLimit === undefined) {
    const items = [...groups.values()]
      .flatMap(({ repositoryTitle, signals }) => {
        const item = buildPortfolioActionQueueItem(repositoryTitle, signals, asOf)
        return item ? [item] : []
      })
      .sort(compareQueueItems)
    return { items, totalItems: items.length }
  }
  const top = new WorstFirstQueue(itemLimit)
  let totalItems = 0
  for (const { repositoryTitle, signals } of groups.values()) {
    const item = buildPortfolioActionQueueItem(repositoryTitle, signals, asOf)
    if (item) {
      totalItems += 1
      top.add(item)
    }
  }
  return { items: top.sorted(), totalItems }
}

const mergeDomainCoverage = (selections: readonly DatasetSelection[]): PortfolioActionQueueCoverage["domains"] => {
  const merged = emptyPortfolioActionCoverage().domains as Record<
    PortfolioActionSignalDomain,
    PortfolioActionQueueCoverage["domains"][PortfolioActionSignalDomain]
  >
  for (const domain of domains) {
    const entries = selections.map((selection) => selection.signalResult.domainCoverage[domain])
    const status: PortfolioActionDomainState = entries.some((entry) => entry.status === "invalid")
      ? "invalid"
      : entries.some((entry) => entry.status === "present")
        ? "present"
        : "missing"
    const messages = [...new Set(entries.flatMap((entry) => (entry.message ? [entry.message] : [])))]
    merged[domain] = {
      status,
      datasetCount: entries.reduce((total, entry) => total + entry.datasetCount, 0),
      signalCount: selections.reduce(
        (total, selection) => total + selection.signals.filter((signal) => signal.domain === domain).length,
        0,
      ),
      ...(messages.length > 0 ? { message: messages.join("; ") } : {}),
    }
  }
  return merged
}

export function buildPortfolioActionQueueWithStats(
  datasets: readonly PortfolioActionDatasetInput[],
  options: { readonly window: PortfolioActionWindow; readonly itemLimit?: number },
): PortfolioActionQueueBuildResult {
  if (options.itemLimit !== undefined && (!Number.isInteger(options.itemLimit) || options.itemLimit < 1))
    throw new Error("itemLimit must be a positive integer.")
  const included: { datasetId: string; repositoryId: string }[] = []
  const planned: { datasetId: string; reason: string }[] = []
  const excluded: { datasetId: string; reason: string }[] = []
  const unavailable: { datasetId: string; reason: string }[] = []
  const diagnostics: Diagnostic[] = []
  const sorted = [...datasets].sort(
    (left, right) =>
      left.datasetId.localeCompare(right.datasetId) || left.repositoryId.localeCompare(right.repositoryId),
  )
  const duplicateIds = new Set(
    sorted
      .filter((input, index, all) => all.findIndex((candidate) => candidate.datasetId === input.datasetId) !== index)
      .map((input) => input.datasetId),
  )
  const eligible: PortfolioActionDatasetInput[] = []
  for (const input of sorted) {
    if (duplicateIds.has(input.datasetId)) {
      if (!unavailable.some((entry) => entry.datasetId === input.datasetId)) {
        const reason = `duplicate datasetId ${input.datasetId}`
        unavailable.push({ datasetId: input.datasetId, reason })
        diagnostics.push({ datasetId: input.datasetId, severity: "error", reason })
      }
      continue
    }
    if (input.availability === "planned") {
      planned.push({ datasetId: input.datasetId, reason: "dataset is planned" })
      continue
    }
    if (input.mode !== "single_repository") {
      excluded.push({ datasetId: input.datasetId, reason: "dataset is not single_repository" })
      continue
    }
    const problem = datasetProblem(input)
    if (problem) {
      unavailable.push({ datasetId: input.datasetId, reason: problem })
      diagnostics.push({ datasetId: input.datasetId, severity: "error", reason: problem })
      continue
    }
    eligible.push(input)
    included.push({ datasetId: input.datasetId, repositoryId: input.repositoryId })
  }

  const asOf = eligible.reduce((greatest, input) => {
    if (!greatest) return input.current!.generatedAt
    return Date.parse(input.current!.generatedAt) > Date.parse(greatest) ? input.current!.generatedAt : greatest
  }, "")
  const selections = eligible.map((input): DatasetSelection => {
    const signalResult = adaptPortfolioActionSignals(input)
    diagnostics.push(...signalResult.diagnostics)
    return {
      input,
      signalResult,
      signals: signalResult.signals.filter((signal) => isPortfolioActionSignalInWindow(signal, options.window, asOf)),
    }
  })

  const items = buildItems(selections, asOf, diagnostics, options.itemLimit)
  return {
    queue: {
      contractVersion: 1,
      rankingPolicyVersion: 1,
      asOf,
      filters: { ...defaultPortfolioActionQueueFilters(), window: options.window },
      items: items.items,
      coverage: {
        datasets: { included, planned, excluded, unavailable },
        domains: mergeDomainCoverage(selections),
        diagnostics,
      },
    },
    totalItems: items.totalItems,
  }
}

export function buildPortfolioActionQueue(
  datasets: readonly PortfolioActionDatasetInput[],
  options: { readonly window: PortfolioActionWindow; readonly itemLimit?: number },
): PortfolioActionQueue {
  return buildPortfolioActionQueueWithStats(datasets, options).queue
}

const uniqueSorted = (values: readonly string[]): readonly string[] => [...new Set(values)].sort()

export function filterPortfolioActionQueue(
  queue: PortfolioActionQueue,
  filters: PortfolioActionQueueFilters,
): PortfolioActionQueue {
  if (filters.window !== queue.filters.window) {
    throw new Error(`Cannot filter a ${queue.filters.window} queue with a ${filters.window} window`)
  }
  const normalized: PortfolioActionQueueFilters = {
    repositoryIds: uniqueSorted(filters.repositoryIds),
    teamIds: uniqueSorted(filters.teamIds),
    priorityBands: priorityOrder.filter((band) => filters.priorityBands.includes(band)),
    domains: actionDomainOrder.filter((domain) => filters.domains.includes(domain)),
    window: filters.window,
  }
  const items = queue.items.filter(
    (item) =>
      (normalized.repositoryIds.length === 0 || normalized.repositoryIds.includes(item.repositoryId)) &&
      (normalized.teamIds.length === 0 || item.teams.some((team) => normalized.teamIds.includes(team.id))) &&
      (normalized.priorityBands.length === 0 || normalized.priorityBands.includes(item.priorityBand)) &&
      (normalized.domains.length === 0 || item.signals.some((signal) => normalized.domains.includes(signal.domain))),
  )
  return { ...queue, filters: normalized, items }
}
