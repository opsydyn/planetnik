import type {
  PortfolioActionDatasetInput,
  PortfolioActionDomainState,
  PortfolioActionEvidence,
  PortfolioActionPriorityBand,
  PortfolioActionQueueCoverage,
  PortfolioActionSignal,
  PortfolioActionSignalBuildResult,
  PortfolioActionSignalDomain,
  PortfolioActionSourceRecord,
  PortfolioActionTrendInput,
} from "./PortfolioActionQueue.js"

const actionByDomain = {
  security: { key: "patch-dependency", label: "Patch the vulnerable dependency" },
  control: { key: "restore-control", label: "Restore the failed quality control" },
  hotspot: { key: "stabilize-hotspot", label: "Stabilize the hotspot" },
  coupling: { key: "reduce-coupling", label: "Reduce the coupling pressure" },
  ownership: { key: "broaden-ownership", label: "Broaden ownership" },
  impact: { key: "prioritise-impact", label: "Prioritise this high-impact intervention" },
  trend: { key: "review-trend", label: "Review the recent movement" },
} as const

const domainOrder: readonly PortfolioActionSignalDomain[] = [
  "security",
  "control",
  "hotspot",
  "coupling",
  "ownership",
  "impact",
  "trend",
]

const unassignedTeam = { id: "unassigned", label: "Unassigned" } as const

type DomainCoverage = PortfolioActionQueueCoverage["domains"][PortfolioActionSignalDomain]
type Diagnostic = PortfolioActionQueueCoverage["diagnostics"][number]
export type PortfolioActionSourceRecordAdaptation =
  | { readonly tag: "signal"; readonly signal: PortfolioActionSignal }
  | { readonly tag: "skipped" }
  | { readonly tag: "invalid"; readonly diagnostic: Diagnostic }
type DomainAdapterResult = {
  readonly signals: readonly PortfolioActionSignal[]
  readonly coverage: DomainCoverage
  readonly diagnostics: readonly Diagnostic[]
}

const isNonEmpty = (value: string): boolean => value.trim().length > 0
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && isNonEmpty(value)

const isSafeDatasetHref = (href: string, datasetId: string): boolean => {
  if (!isNonEmpty(href) || !href.startsWith(`/datasets/${datasetId}/`)) return false
  if (href.startsWith("//") || href.includes("\\") || href.split(/[?#]/, 1)[0]!.split("/").includes("..")) return false
  try {
    const parsed = new URL(href, "https://planetnik.invalid")
    return parsed.origin === "https://planetnik.invalid" && parsed.pathname.startsWith(`/datasets/${datasetId}/`)
  } catch {
    return false
  }
}

const evidenceProblem = (
  evidence: PortfolioActionEvidence,
  input: PortfolioActionDatasetInput,
  domain: PortfolioActionSignalDomain,
  allowHistoricalSnapshot = false,
): string | undefined => {
  if (!isNonEmpty(evidence.datasetId) || evidence.datasetId !== input.datasetId)
    return "evidence datasetId does not match the dataset"
  if (!isNonEmpty(evidence.repositoryId) || evidence.repositoryId !== input.repositoryId)
    return "evidence repositoryId does not match the repository"
  if (!isNonEmpty(evidence.snapshotId)) return "evidence snapshotId is empty"
  if (!allowHistoricalSnapshot && evidence.snapshotId !== input.current?.snapshotId)
    return "evidence snapshotId does not match the current snapshot"
  if (evidence.domain !== domain) return "evidence domain does not match the source domain"
  if (!isNonEmpty(evidence.shard)) return "evidence shard selector is empty"
  if (!isNonEmpty(evidence.record)) return "evidence record selector is empty"
  if (!isSafeDatasetHref(evidence.href, input.datasetId))
    return "evidence href is not a safe dataset-scoped relative route"
  return undefined
}

const recordProblem = (
  record: PortfolioActionSourceRecord,
  input: PortfolioActionDatasetInput,
  domain: PortfolioActionSignalDomain,
): string | undefined => {
  if (!isNonEmpty(record.id)) return "source record id is empty"
  if (!isNonEmpty(record.targetId)) return "source record targetId is empty"
  if (!isNonEmpty(record.targetLabel)) return "source record target label is empty"
  if (record.evidence.length === 0) return "source record has no evidence"
  for (const evidence of record.evidence) {
    const problem = evidenceProblem(evidence, input, domain)
    if (problem) return problem
  }
  return undefined
}

const primitiveFacts = (values: Readonly<Record<string, unknown>>): PortfolioActionSignal["facts"] =>
  Object.entries(values).flatMap(([label, value]) => {
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      return [{ label, value: value as string | number | boolean | null }]
    }
    if (Array.isArray(value) && value.every((item): item is string => typeof item === "string")) {
      return value.map((item, index) => ({ label: `${label}[${index}]`, value: item }))
    }
    return []
  })

const severityBand = (value: unknown): PortfolioActionPriorityBand => {
  switch (value) {
    case "Critical":
      return "critical"
    case "High":
      return "high"
    case "Medium":
      return "medium"
    case "Low":
      return "low"
    default:
      return "unrated"
  }
}

const securitySeverityBand = (value: unknown): PortfolioActionPriorityBand => {
  switch (value) {
    case "critical":
      return "critical"
    case "high":
      return "high"
    case "medium":
      return "medium"
    case "low":
      return "low"
    default:
      return "unrated"
  }
}

const sourcePriority = (
  domain: Exclude<PortfolioActionSignalDomain, "trend">,
  values: Readonly<Record<string, unknown>>,
): { readonly label: string; readonly value: string | number | null; readonly band: PortfolioActionPriorityBand } => {
  if (domain === "control") {
    const value = typeof values.status === "string" ? values.status : null
    return {
      label: "status",
      value,
      band: value === "FAILED" ? "critical" : value === "TOLERATED" ? "high" : "unrated",
    }
  }
  if (domain === "impact") {
    const value =
      typeof values.impact_score === "number" && Number.isFinite(values.impact_score) ? values.impact_score : null
    const band =
      value === null ? "unrated" : value >= 75 ? "critical" : value >= 55 ? "high" : value >= 35 ? "medium" : "low"
    return { label: "impact_score", value, band }
  }
  if (domain === "coupling" && isNonEmptyString(values.riskTier)) {
    const value = values.riskTier
    return { label: "riskTier", value, band: severityBand(value) }
  }
  const value = typeof values.severity === "string" ? values.severity : null
  return {
    label: "severity",
    value,
    band: domain === "security" ? securitySeverityBand(value) : severityBand(value),
  }
}

const makeSignal = (
  input: PortfolioActionDatasetInput,
  domain: Exclude<PortfolioActionSignalDomain, "trend">,
  record: PortfolioActionSourceRecord,
  extraEvidence: readonly PortfolioActionEvidence[] = [],
): PortfolioActionSignal => {
  const priority = sourcePriority(domain, record.values)
  return {
    id: record.id,
    repositoryId: input.repositoryId,
    targetId: record.targetId,
    targetLabel: record.targetLabel,
    team: record.team ?? unassignedTeam,
    domain,
    priorityBand: priority.band,
    sourcePriority: { label: priority.label, value: priority.value },
    observedAt: record.observedAt,
    action: actionByDomain[domain],
    explanation: `${actionByDomain[domain].label} for ${record.targetLabel}; source ${priority.label} is ${String(priority.value)}.`,
    facts: primitiveFacts(record.values),
    evidence: [...record.evidence, ...extraEvidence],
  }
}

/**
 * Adapt one already-normalized source record without requiring the enclosing
 * domain array to be retained in memory. Batch adapters use this same helper
 * so streamed materialization cannot drift from the canonical rules.
 */
export function adaptPortfolioActionSourceRecord(
  input: PortfolioActionDatasetInput,
  domain: Exclude<PortfolioActionSignalDomain, "trend">,
  record: PortfolioActionSourceRecord,
  extraEvidence: readonly PortfolioActionEvidence[] = [],
): PortfolioActionSourceRecordAdaptation {
  const problem = recordProblem(record, input, domain)
  if (problem) {
    return {
      tag: "invalid",
      diagnostic: {
        datasetId: input.datasetId,
        severity: "error",
        reason: `${domain} record ${record.id || "<empty>"}: ${problem}`,
      },
    }
  }
  if (domain === "security" && input.mode !== "single_repository") return { tag: "skipped" }
  return isCandidate(domain, record)
    ? { tag: "signal", signal: makeSignal(input, domain, record, extraEvidence) }
    : { tag: "skipped" }
}

const isCandidate = (
  domain: Exclude<PortfolioActionSignalDomain, "trend">,
  record: PortfolioActionSourceRecord,
): boolean => {
  const values = record.values
  switch (domain) {
    case "hotspot":
      return values.kind === "file" || values.kind === "unit" || values.kind === "component"
    case "control":
      return values.status === "FAILED" || values.status === "TOLERATED"
    case "security":
      return values.open === true
    case "impact":
      return typeof values.impact_score === "number" && Number.isFinite(values.impact_score)
    case "coupling":
      return (
        values.kind === "component" &&
        (isNonEmptyString(values.riskTier) ||
          positiveNumber(values.dependencyEdges) ||
          positiveNumber(values.inboundEdges) ||
          positiveNumber(values.outboundEdges) ||
          positiveNumber(values.coordinationCost) ||
          positiveNumber(values.structuralRisk) ||
          positiveNumber(values.changePressure) ||
          positiveNumber(values.temporalLinks))
      )
    case "ownership":
      return ownershipReason(values.reasons)
  }
}

const positiveNumber = (value: unknown): boolean => typeof value === "number" && Number.isFinite(value) && value > 0

const ownershipReason = (value: unknown): boolean => {
  const reasons =
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value.filter((reason): reason is string => typeof reason === "string")
        : []
  return reasons.some((reason) => /knowledge|ownership|backup|contributor/i.test(reason))
}

const adaptCurrentDomain = (
  input: PortfolioActionDatasetInput,
  domain: Exclude<PortfolioActionSignalDomain, "trend">,
): DomainAdapterResult => {
  const domainInput = input.current?.domains[domain]
  if (!domainInput)
    return { signals: [], coverage: { status: "missing", datasetCount: 0, signalCount: 0 }, diagnostics: [] }
  if (domainInput.status !== "present") {
    const diagnostic =
      domainInput.status === "invalid"
        ? [
            {
              datasetId: input.datasetId,
              severity: "error" as const,
              reason: `${domain} domain is declared invalid${domainInput.message ? `: ${domainInput.message}` : ""}`,
            },
          ]
        : []
    return { signals: [], coverage: coverage(domainInput.status, 0, domainInput.message), diagnostics: diagnostic }
  }

  const diagnostics: Diagnostic[] = []
  const ids = new Set<string>()
  for (const record of domainInput.records) {
    const problem = recordProblem(record, input, domain)
    if (problem)
      diagnostics.push({
        datasetId: input.datasetId,
        severity: "error",
        reason: `${domain} record ${record.id || "<empty>"}: ${problem}`,
      })
    if (ids.has(record.id))
      diagnostics.push({
        datasetId: input.datasetId,
        severity: "error",
        reason: `${domain} domain has duplicate source record id ${record.id}`,
      })
    ids.add(record.id)
  }
  if (diagnostics.length > 0) return { signals: [], coverage: coverage("invalid", 0), diagnostics }

  if (domain === "security" && input.mode !== "single_repository") {
    return { signals: [], coverage: coverage("present", 0, domainInput.message), diagnostics: [] }
  }

  const supportingEvidence = new Map<string, PortfolioActionEvidence[]>()
  if (domain === "coupling") {
    for (const record of domainInput.records) {
      if (record.values.kind !== "dependency" && record.values.kind !== "edge") continue
      const collected = supportingEvidence.get(record.targetId) ?? []
      collected.push(...record.evidence)
      supportingEvidence.set(record.targetId, collected)
    }
  }
  const signals: PortfolioActionSignal[] = []
  for (const record of domainInput.records) {
    const adaptation = adaptPortfolioActionSourceRecord(
      input,
      domain,
      record,
      supportingEvidence.get(record.targetId) ?? [],
    )
    if (adaptation.tag === "signal") signals.push(adaptation.signal)
  }
  return { signals, coverage: coverage("present", signals.length, domainInput.message), diagnostics: [] }
}

const coverage = (status: PortfolioActionDomainState, signalCount: number, message?: string): DomainCoverage => ({
  status,
  datasetCount: status === "missing" ? 0 : 1,
  signalCount,
  ...(message ? { message } : {}),
})

export const adaptHotspotSignals = (input: PortfolioActionDatasetInput): readonly PortfolioActionSignal[] =>
  adaptCurrentDomain(input, "hotspot").signals
export const adaptControlSignals = (input: PortfolioActionDatasetInput): readonly PortfolioActionSignal[] =>
  adaptCurrentDomain(input, "control").signals
export const adaptSecuritySignals = (input: PortfolioActionDatasetInput): readonly PortfolioActionSignal[] =>
  adaptCurrentDomain(input, "security").signals
export const adaptImpactSignals = (input: PortfolioActionDatasetInput): readonly PortfolioActionSignal[] =>
  adaptCurrentDomain(input, "impact").signals
export const adaptCouplingSignals = (input: PortfolioActionDatasetInput): readonly PortfolioActionSignal[] =>
  adaptCurrentDomain(input, "coupling").signals
export const adaptOwnershipSignals = (input: PortfolioActionDatasetInput): readonly PortfolioActionSignal[] =>
  adaptCurrentDomain(input, "ownership").signals

const riskFields = [
  "severity",
  "status",
  "riskTier",
  "score",
  "impact_score",
  "structuralRisk",
  "changePressure",
  "coordinationCost",
  "knowledgeRisk",
  "temporalLinks",
  "complexity",
  "commitsCount",
] as const

const ordinalValue = (field: string, value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return undefined
  if (field === "severity" || field === "riskTier")
    return ({ Low: 1, Medium: 2, High: 3, Critical: 4 } as Record<string, number>)[value]
  if (field === "status") return ({ OK: 0, PASSED: 0, TOLERATED: 1, FAILED: 2 } as Record<string, number>)[value]
  return undefined
}

const trendDirection = (trend: PortfolioActionTrendInput): "worsening" | "stable" | "improving" | undefined => {
  const directions = riskFields.flatMap((field) => {
    const baseline = ordinalValue(field, trend.baselineValues[field])
    const current = ordinalValue(field, trend.currentValues[field])
    if (baseline === undefined || current === undefined) return []
    return [Math.sign(current - baseline)]
  })
  if (directions.length === 0) return undefined
  const hasIncrease = directions.includes(1)
  const hasDecrease = directions.includes(-1)
  if (hasIncrease && hasDecrease) return undefined
  if (hasIncrease) return "worsening"
  if (hasDecrease) return "improving"
  return "stable"
}

const trendProblem = (trend: PortfolioActionTrendInput, input: PortfolioActionDatasetInput): string | undefined => {
  if (!isNonEmpty(trend.targetId)) return "trend targetId is empty"
  if (!isNonEmpty(trend.targetLabel)) return "trend target label is empty"
  if (trend.baselineEvidence.length === 0 || trend.currentEvidence.length === 0)
    return "trend has no exact baseline/current evidence"
  for (const evidence of trend.baselineEvidence) {
    const problem = evidenceProblem(evidence, input, "trend", true)
    if (problem) return problem
  }
  for (const evidence of trend.currentEvidence) {
    const problem = evidenceProblem(evidence, input, "trend")
    if (problem) return problem
  }
  return undefined
}

const adaptTrendDomain = (input: PortfolioActionDatasetInput, targetIds: ReadonlySet<string>): DomainAdapterResult => {
  const declared = input.current?.domains.trend
  const historyStatus: PortfolioActionDomainState =
    input.historyStatus === "compatible" ? "present" : input.historyStatus === "missing" ? "missing" : "invalid"
  const status: PortfolioActionDomainState =
    historyStatus === "present" ? (declared?.status ?? "present") : historyStatus
  if (status !== "present") {
    const message =
      historyStatus !== "present"
        ? status === "invalid"
          ? `history is ${input.historyStatus}`
          : undefined
        : declared?.message
    return {
      signals: [],
      coverage: coverage(status, 0, message),
      diagnostics:
        status === "invalid"
          ? [
              {
                datasetId: input.datasetId,
                severity: "error",
                reason: `trend domain is invalid${message ? `: ${message}` : ""}`,
              },
            ]
          : [],
    }
  }
  const diagnostics: Diagnostic[] = []
  for (const trend of input.trendInputs) {
    const problem = trendProblem(trend, input)
    if (problem)
      diagnostics.push({
        datasetId: input.datasetId,
        severity: "error",
        reason: `trend record ${trend.targetId || "<empty>"}: ${problem}`,
      })
  }
  if (diagnostics.length > 0) return { signals: [], coverage: coverage("invalid", 0), diagnostics }

  const signals = input.trendInputs.flatMap((trend, index): PortfolioActionSignal[] => {
    if (!targetIds.has(trend.targetId)) return []
    const direction = trendDirection(trend)
    if (!direction) return []
    const facts = riskFields.flatMap((field): PortfolioActionSignal["facts"] => {
      const baseline = trend.baselineValues[field]
      const current = trend.currentValues[field]
      if (ordinalValue(field, baseline) === undefined || ordinalValue(field, current) === undefined) return []
      return [
        { label: `baseline.${field}`, value: baseline as string | number },
        { label: `current.${field}`, value: current as string | number },
      ]
    })
    return [
      {
        id: `trend:${input.repositoryId}:${trend.targetId}:${index}`,
        repositoryId: input.repositoryId,
        targetId: trend.targetId,
        targetLabel: trend.targetLabel,
        team: unassignedTeam,
        domain: "trend",
        priorityBand: "unrated",
        sourcePriority: { label: "direction", value: direction },
        observedAt: trend.observedAt,
        action: actionByDomain.trend,
        explanation: `${actionByDomain.trend.label} for ${trend.targetLabel}; known risk fields are ${direction}.`,
        facts,
        evidence: [...trend.baselineEvidence, ...trend.currentEvidence],
      },
    ]
  })
  return { signals, coverage: coverage("present", signals.length), diagnostics: [] }
}

export const adaptTrendSignals = (
  input: PortfolioActionDatasetInput,
  actionableSignals: readonly PortfolioActionSignal[],
): readonly PortfolioActionSignal[] =>
  adaptTrendDomain(
    input,
    new Set(actionableSignals.filter((signal) => signal.domain !== "trend").map((signal) => signal.targetId)),
  ).signals

/** Adapt compatible trend evidence using only stable actionable target IDs. */
export const adaptPortfolioActionTrendTargets = (
  input: PortfolioActionDatasetInput,
  targetIds: ReadonlySet<string>,
): readonly PortfolioActionSignal[] => adaptTrendDomain(input, targetIds).signals

export function adaptPortfolioActionSignals(input: PortfolioActionDatasetInput): PortfolioActionSignalBuildResult {
  const resultByDomain = new Map<PortfolioActionSignalDomain, DomainAdapterResult>()
  for (const domain of domainOrder.filter((candidate) => candidate !== "trend")) {
    resultByDomain.set(domain, adaptCurrentDomain(input, domain as Exclude<PortfolioActionSignalDomain, "trend">))
  }
  const actionableSignals = domainOrder.flatMap((domain) => resultByDomain.get(domain)?.signals ?? [])
  resultByDomain.set(
    "trend",
    adaptTrendDomain(
      input,
      new Set(actionableSignals.filter((signal) => signal.domain !== "trend").map((signal) => signal.targetId)),
    ),
  )

  const domainCoverage = {} as Record<PortfolioActionSignalDomain, DomainCoverage>
  for (const domain of domainOrder) domainCoverage[domain] = resultByDomain.get(domain)!.coverage
  return {
    signals: domainOrder.flatMap((domain) => resultByDomain.get(domain)!.signals),
    domainCoverage,
    diagnostics: domainOrder.flatMap((domain) => resultByDomain.get(domain)!.diagnostics),
  }
}
