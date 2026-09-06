import { createHash } from "node:crypto"
import type {
  PortfolioActionEvidence,
  PortfolioActionFactor,
  PortfolioActionFreshness,
  PortfolioActionPriorityBand,
  PortfolioActionQueue,
  PortfolioActionQueueCoverage,
  PortfolioActionQueueItem,
  PortfolioActionSignal,
  PortfolioActionSignalDomain,
  PortfolioActionTeam,
  PortfolioActionTrend,
  PortfolioActionWindow,
} from "@planetnik/common"

export const ACTION_QUEUE_ARTIFACT_VERSION = 2 as const
export const ACTION_QUEUE_ARTIFACT_PROJECTION_VERSION = 2 as const
export const ACTION_QUEUE_PAGE_SIZE = 250
export const ACTION_QUEUE_MANIFEST_FILE = "manifest.json"
export const ACTION_QUEUE_WINDOWS: readonly PortfolioActionWindow[] = [
  "current",
  "latest-compatible",
  "7d",
  "30d",
  "90d",
]

export type ActionQueueArtifactFilterOptions = {
  readonly repositories: readonly { readonly id: string; readonly label: string }[]
  readonly teams: readonly { readonly id: string; readonly label: string }[]
  readonly priorities: readonly PortfolioActionPriorityBand[]
  readonly domains: readonly PortfolioActionSignalDomain[]
}

export type ActionQueueArtifactEvidenceBase = Omit<PortfolioActionEvidence, "record">
export type ActionQueueArtifactEvidenceRef = readonly [baseId: number, record: string]
export type ActionQueueArtifactSignal = Omit<PortfolioActionSignal, "evidence"> & {
  readonly evidenceRefs: readonly ActionQueueArtifactEvidenceRef[]
}
export type ActionQueueArtifactItem = Omit<PortfolioActionQueueItem, "signals" | "evidence"> & {
  readonly signals: readonly ActionQueueArtifactSignal[]
}

export type ActionQueueArtifactChunk = {
  readonly version: typeof ACTION_QUEUE_ARTIFACT_VERSION
  readonly window: PortfolioActionWindow
  readonly page: number
  readonly pageSize: number
  readonly totalItems: number
  readonly asOf: string
  readonly coverage: PortfolioActionQueueCoverage
  readonly evidenceBases: readonly ActionQueueArtifactEvidenceBase[]
  readonly items: readonly ActionQueueArtifactItem[]
}

export type ActionQueueArtifactWindow = {
  readonly window: PortfolioActionWindow
  readonly totalItems: number
  readonly complete: boolean
  readonly pageSize: number
  readonly pageCount: number
  readonly chunks: readonly string[]
  readonly contentFingerprint: string
  readonly asOf: string
  readonly coverage: PortfolioActionQueueCoverage
}

export type ActionQueueArtifactManifest = {
  readonly version: typeof ACTION_QUEUE_ARTIFACT_VERSION
  readonly projectionVersion: number
  readonly sourceFingerprint: string
  readonly generatedAt: string
  readonly filterOptions: ActionQueueArtifactFilterOptions
  readonly windows: readonly ActionQueueArtifactWindow[]
}

const signalDomains: readonly PortfolioActionSignalDomain[] = [
  "control",
  "coupling",
  "hotspot",
  "impact",
  "ownership",
  "security",
  "trend",
]
const priorityBands: readonly PortfolioActionPriorityBand[] = ["critical", "high", "medium", "low", "unrated"]
const trends: readonly PortfolioActionTrend[] = ["worsening", "stable", "improving", "unknown"]
const freshnesses: readonly PortfolioActionFreshness[] = ["fresh", "recent", "aging", "stale", "unknown"]
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0
const isObservedValue = (value: unknown): value is string | number | boolean | null =>
  value === null ||
  typeof value === "string" ||
  typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value))
const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function isSafeDatasetHref(value: unknown, datasetId: string): value is string {
  if (
    !isNonEmptyString(value) ||
    value.includes("\\") ||
    value.includes("\0") ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return false
  let parsed: URL
  try {
    parsed = new URL(value, "https://planetnik.invalid")
  } catch {
    return false
  }
  if (parsed.origin !== "https://planetnik.invalid" || parsed.search || parsed.hash) return false
  let decodedPath: string
  try {
    decodedPath = decodeURIComponent(parsed.pathname)
  } catch {
    return false
  }
  const segments = decodedPath.split("/")
  if (
    segments[0] !== "" ||
    segments.slice(1).some((segment) => !segment || segment === "." || segment === ".." || segment.includes("\\"))
  )
    return false
  const datasetSegment = segments.indexOf("datasets", 1)
  return datasetSegment > 0 && segments[datasetSegment + 1] === datasetId && datasetSegment + 2 < segments.length
}

function isTeam(value: unknown): value is PortfolioActionTeam {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["id", "label"]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.label)
  )
}

function isAction(value: unknown): value is { readonly key: string; readonly label: string } {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["key", "label"]) &&
    isNonEmptyString(value.key) &&
    isNonEmptyString(value.label)
  )
}

function isFact(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["label", "value"]) &&
    isNonEmptyString(value.label) &&
    isObservedValue(value.value)
  )
}

function isSourcePriority(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["label", "value"]) &&
    isNonEmptyString(value.label) &&
    isObservedValue(value.value)
  )
}

function isFactor(value: unknown): value is PortfolioActionFactor {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["key", "label", "value", "explanation"]) &&
    (value.key === "priority" || value.key === "corroboration" || value.key === "trend" || value.key === "freshness") &&
    isNonEmptyString(value.label) &&
    (isNonEmptyString(value.value) || (typeof value.value === "number" && Number.isFinite(value.value))) &&
    isNonEmptyString(value.explanation)
  )
}

/** Validates compact evidence independently of the item that references it. */
export function isValidActionQueueArtifactEvidenceBase(value: unknown): value is ActionQueueArtifactEvidenceBase {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "datasetId",
      "repositoryId",
      "snapshotId",
      "generatedAt",
      "domain",
      "shard",
      "href",
      "label",
      "observed",
    ]) ||
    !isNonEmptyString(value.datasetId) ||
    !isNonEmptyString(value.repositoryId) ||
    !isNonEmptyString(value.snapshotId) ||
    !isNonEmptyString(value.generatedAt) ||
    !signalDomains.includes(value.domain as PortfolioActionSignalDomain) ||
    !isNonEmptyString(value.shard) ||
    !isNonEmptyString(value.label) ||
    !isRecord(value.observed) ||
    !Object.values(value.observed).every(isObservedValue) ||
    !isSafeDatasetHref(value.href, value.datasetId)
  )
    return false
  return true
}

function isEvidenceRef(
  value: unknown,
  evidenceBases: readonly ActionQueueArtifactEvidenceBase[],
): value is ActionQueueArtifactEvidenceRef {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    (value[0] as number) >= 0 &&
    (value[0] as number) < evidenceBases.length &&
    isNonEmptyString(value[1])
  )
}

function isArtifactSignal(
  value: unknown,
  evidenceBases: readonly ActionQueueArtifactEvidenceBase[],
): value is ActionQueueArtifactSignal {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "id",
      "repositoryId",
      "targetId",
      "targetLabel",
      "team",
      "domain",
      "priorityBand",
      "sourcePriority",
      "observedAt",
      "action",
      "explanation",
      "facts",
      "evidenceRefs",
    ]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.repositoryId) &&
    isNonEmptyString(value.targetId) &&
    isNonEmptyString(value.targetLabel) &&
    isTeam(value.team) &&
    signalDomains.includes(value.domain as PortfolioActionSignalDomain) &&
    priorityBands.includes(value.priorityBand as PortfolioActionPriorityBand) &&
    isSourcePriority(value.sourcePriority) &&
    (value.observedAt === null || isNonEmptyString(value.observedAt)) &&
    isAction(value.action) &&
    isNonEmptyString(value.explanation) &&
    Array.isArray(value.facts) &&
    value.facts.every(isFact) &&
    Array.isArray(value.evidenceRefs) &&
    value.evidenceRefs.every((reference) => isEvidenceRef(reference, evidenceBases))
  )
}

function isArtifactItem(
  value: unknown,
  evidenceBases: readonly ActionQueueArtifactEvidenceBase[],
): value is ActionQueueArtifactItem {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "id",
      "repositoryId",
      "repositoryTitle",
      "target",
      "teams",
      "primaryAction",
      "alternateActions",
      "priorityBand",
      "trend",
      "freshness",
      "corroboration",
      "factors",
      "status",
      "signals",
    ]) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.repositoryId) &&
    isNonEmptyString(value.repositoryTitle) &&
    isRecord(value.target) &&
    hasExactKeys(value.target, ["id", "label"]) &&
    isNonEmptyString(value.target.id) &&
    isNonEmptyString(value.target.label) &&
    Array.isArray(value.teams) &&
    value.teams.every(isTeam) &&
    isAction(value.primaryAction) &&
    Array.isArray(value.alternateActions) &&
    value.alternateActions.every(isAction) &&
    priorityBands.includes(value.priorityBand as PortfolioActionPriorityBand) &&
    trends.includes(value.trend as PortfolioActionTrend) &&
    freshnesses.includes(value.freshness as PortfolioActionFreshness) &&
    typeof value.corroboration === "number" &&
    Number.isInteger(value.corroboration) &&
    value.corroboration >= 0 &&
    Array.isArray(value.factors) &&
    value.factors.every(isFactor) &&
    value.status === "untracked" &&
    Array.isArray(value.signals) &&
    value.signals.every((signal) => isArtifactSignal(signal, evidenceBases))
  )
}

function assertPageSize(pageSize: number): void {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("pageSize must be a positive integer.")
}

function sameEvidence(left: PortfolioActionEvidence, right: PortfolioActionEvidence): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function compactEvidence(
  evidence: readonly PortfolioActionEvidence[],
  evidenceBases: ActionQueueArtifactEvidenceBase[],
  baseIds: Map<string, number>,
): readonly ActionQueueArtifactEvidenceRef[] {
  return evidence.map((anchor) => {
    const { record, ...base } = anchor
    if (typeof record !== "string" || record.length === 0)
      throw new Error("evidence record must be a non-empty string.")
    const key = JSON.stringify(base)
    let baseId = baseIds.get(key)
    if (baseId === undefined) {
      baseId = evidenceBases.length
      baseIds.set(key, baseId)
      evidenceBases.push(base)
    }
    return [baseId, record] as const
  })
}

export function compactActionQueueItems(items: readonly PortfolioActionQueueItem[]): {
  readonly items: readonly ActionQueueArtifactItem[]
  readonly evidenceBases: readonly ActionQueueArtifactEvidenceBase[]
} {
  const evidenceBases: ActionQueueArtifactEvidenceBase[] = []
  const baseIds = new Map<string, number>()
  const compactItems = items.map((item) => {
    const flattenedEvidence = item.signals.flatMap((signal) => signal.evidence)
    if (
      item.evidence.length !== flattenedEvidence.length ||
      item.evidence.some((anchor, index) => !sameEvidence(anchor, flattenedEvidence[index]!))
    )
      throw new Error(`action queue item '${item.id}' has evidence that does not match its signals.`)
    const { evidence: _evidence, ...itemWithoutEvidence } = item
    return {
      ...itemWithoutEvidence,
      signals: item.signals.map((signal) => {
        const { evidence: _signalEvidence, ...signalWithoutEvidence } = signal
        return {
          ...signalWithoutEvidence,
          evidenceRefs: compactEvidence(signal.evidence, evidenceBases, baseIds),
        }
      }),
    }
  })
  return { items: compactItems, evidenceBases }
}

export function expandActionQueueArtifactItems(
  items: readonly ActionQueueArtifactItem[],
  evidenceBases: readonly ActionQueueArtifactEvidenceBase[],
): readonly PortfolioActionQueueItem[] | undefined {
  if (
    !Array.isArray(items) ||
    !Array.isArray(evidenceBases) ||
    !evidenceBases.every(isValidActionQueueArtifactEvidenceBase)
  )
    return undefined
  const expanded: PortfolioActionQueueItem[] = []
  for (const item of items) {
    if (!isArtifactItem(item, evidenceBases)) return undefined
    const signals: PortfolioActionSignal[] = []
    for (const signal of item.signals) {
      if (signal.repositoryId !== item.repositoryId || !isArtifactSignal(signal, evidenceBases)) return undefined
      const evidence: PortfolioActionEvidence[] = []
      for (const reference of signal.evidenceRefs) {
        if (!isEvidenceRef(reference, evidenceBases)) return undefined
        const base = evidenceBases[reference[0] as number]
        if (!base || base.repositoryId !== signal.repositoryId || base.domain !== signal.domain) return undefined
        evidence.push({ ...base, record: reference[1] as string })
      }
      const { evidenceRefs: _evidenceRefs, ...signalWithoutRefs } = signal
      signals.push({ ...signalWithoutRefs, evidence })
    }
    expanded.push({ ...item, signals, evidence: signals.flatMap((signal) => signal.evidence) })
  }
  return expanded
}

export function chunkPortfolioActionQueue(
  queue: PortfolioActionQueue,
  pageSize: number = ACTION_QUEUE_PAGE_SIZE,
  totalItems: number = queue.items.length,
): readonly ActionQueueArtifactChunk[] {
  assertPageSize(pageSize)
  if (!Number.isInteger(totalItems) || totalItems < queue.items.length)
    throw new Error("totalItems must be an integer at least as large as the queue item count.")
  const chunks: ActionQueueArtifactChunk[] = []
  // `totalItems` may describe a larger ranked queue than the materialized
  // prefix. Page files must only represent items that actually exist in this
  // artifact; the manifest carries the full total separately.
  for (let offset = 0; offset < queue.items.length; offset += pageSize) {
    const compact = compactActionQueueItems(queue.items.slice(offset, offset + pageSize))
    chunks.push({
      version: ACTION_QUEUE_ARTIFACT_VERSION,
      window: queue.filters.window,
      page: chunks.length + 1,
      pageSize,
      totalItems,
      asOf: queue.asOf,
      coverage: queue.coverage,
      ...compact,
    })
  }
  return chunks
}

function canonicalizeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeFingerprintValue)
  if (isRecord(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalizeFingerprintValue(value[key])]),
    )
  return value
}

function fingerprintCanonicalValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeFingerprintValue(value)))
    .digest("hex")
}

export function fingerprintActionQueueArtifactFilterOptions(filterOptions: ActionQueueArtifactFilterOptions): string {
  return fingerprintCanonicalValue({ artifactVersion: ACTION_QUEUE_ARTIFACT_VERSION, filterOptions })
}

export function fingerprintActionQueueWindow(
  queue: PortfolioActionQueue,
  sourceIds: readonly string[],
  projectionVersion: number,
  pageSize: number = ACTION_QUEUE_PAGE_SIZE,
  totalItems: number = queue.items.length,
): string {
  if (!Number.isInteger(projectionVersion) || projectionVersion < 1)
    throw new Error("projectionVersion must be a positive integer.")
  assertPageSize(pageSize)
  if (!Number.isInteger(totalItems) || totalItems < queue.items.length)
    throw new Error("totalItems must be an integer at least as large as the queue item count.")
  return fingerprintCanonicalValue({
    artifactVersion: ACTION_QUEUE_ARTIFACT_VERSION,
    projectionVersion,
    sourceIds: [...sourceIds].sort(),
    window: queue.filters.window,
    pageSize,
    totalItems,
    queue,
  })
}

export function fingerprintActionQueueSource(sourceIds: readonly string[], projectionVersion: number): string {
  if (!Number.isInteger(projectionVersion) || projectionVersion < 1)
    throw new Error("projectionVersion must be a positive integer.")
  const canonical = JSON.stringify({ projectionVersion, sourceIds: [...sourceIds].sort() })
  return createHash("sha256").update(canonical).digest("hex")
}
