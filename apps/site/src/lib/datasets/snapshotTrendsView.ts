import type {
  CanonicalEntitySnapshotInput,
  SnapshotComparison,
  SnapshotEntityComparison,
  SnapshotEntityDelta,
  SnapshotEntityDomain,
  SnapshotMetricDelta,
} from "@planetnik/common"
import type { SnapshotHistoryReadResult } from "./snapshotHistory.js"

type RecordValue = Record<string, unknown>

export type SnapshotTrendSnapshot = {
  readonly snapshotId: string
  readonly generatedAt: string
  readonly relativeDataDir: string
}

export type SnapshotTrendRow = Pick<SnapshotMetricDelta, "id" | "baseline" | "current" | "delta" | "direction"> & {
  readonly baselineRecord?: string
  readonly currentRecord?: string
}

export type SnapshotTrendEntityRow = Pick<
  SnapshotEntityDelta,
  "id" | "baseline" | "current" | "direction" | "changedFields"
> & {
  readonly baselineShards: readonly string[]
  readonly baselineRecords: readonly string[]
  readonly currentShards: readonly string[]
  readonly currentRecords: readonly string[]
}

export type SnapshotTrendEntitySection = {
  readonly domain: SnapshotEntityDelta["domain"]
  readonly label: string
  readonly status: "compatible" | "missing" | "incompatible"
  readonly message: string
  readonly rows: readonly SnapshotTrendEntityRow[]
}

export type SnapshotTrendProjectSide = {
  readonly snapshotId: string
  readonly metricCount: number
  readonly entityCount: number
  readonly recordCounts: Readonly<Record<SnapshotEntityDomain, number>>
  readonly missingDomains: readonly SnapshotEntityDomain[]
  readonly emptyDomains: readonly SnapshotEntityDomain[]
}

export type SnapshotTrendProjectMovement = {
  readonly metricChanged: number
  readonly metricAdded: number
  readonly metricRemoved: number
  readonly entityChanged: number
  readonly entityAdded: number
  readonly entityRemoved: number
  readonly totalChanged: number
}

export type SnapshotTrendProjectCoverage = {
  readonly status: "complete" | "partial" | "unavailable"
  readonly caveat: string
}

export type SnapshotTrendProjectSummary = {
  readonly baseline: SnapshotTrendProjectSide
  readonly current: SnapshotTrendProjectSide
  readonly movement: SnapshotTrendProjectMovement
  readonly coverage: SnapshotTrendProjectCoverage
}

export type SnapshotTrendViewModel =
  | {
      readonly status: "compatible"
      readonly message: string
      readonly baseline: SnapshotTrendSnapshot
      readonly current: SnapshotTrendSnapshot
      readonly rows: readonly SnapshotTrendRow[]
      readonly project: SnapshotTrendProjectSummary
      readonly entitySections?: readonly SnapshotTrendEntitySection[]
    }
  | {
      readonly status: "missing" | "incompatible" | "invalid"
      readonly message: string
      readonly rows: readonly []
    }

function emptyState(status: "missing" | "incompatible" | "invalid", message: string): SnapshotTrendViewModel {
  return { status, message, rows: [] }
}

function snapshotSummary(
  entries: SnapshotHistoryReadResult & { readonly tag: "ready" },
  snapshotId: string,
): SnapshotTrendSnapshot | undefined {
  const entry = entries.history.entries.find((candidate) => candidate.context.snapshotId === snapshotId)
  if (!entry) return undefined
  const generatedAt = entry.context.generatedAt
  if (typeof generatedAt !== "string") return undefined
  return {
    snapshotId,
    generatedAt,
    relativeDataDir: entry.relativeDataDir,
  }
}

function trendRow(delta: SnapshotMetricDelta): SnapshotTrendRow {
  return {
    id: delta.id,
    baseline: delta.baseline,
    current: delta.current,
    delta: delta.delta,
    direction: delta.direction,
    ...(delta.provenance.baseline?.record ? { baselineRecord: delta.provenance.baseline.record } : {}),
    ...(delta.provenance.current?.record ? { currentRecord: delta.provenance.current.record } : {}),
  }
}

const ENTITY_SECTION_LABELS = {
  components: "Components",
  hotspots: "Hotspots",
  controls: "Controls",
  ownership: "Ownership",
} as const

const ENTITY_DOMAINS: readonly SnapshotEntityDomain[] = ["components", "hotspots", "controls", "ownership"]

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function entityRow(delta: SnapshotEntityDelta): SnapshotTrendEntityRow {
  return {
    id: delta.id,
    baseline: delta.baseline,
    current: delta.current,
    direction: delta.direction,
    changedFields: delta.changedFields,
    baselineShards: delta.provenance.baseline?.shards ?? [],
    baselineRecords: delta.provenance.baseline?.records ?? [],
    currentShards: delta.provenance.current?.shards ?? [],
    currentRecords: delta.provenance.current?.records ?? [],
  }
}

function entitySection(comparison: SnapshotEntityComparison): SnapshotTrendEntitySection {
  if (comparison.status === "compatible") {
    return {
      domain: comparison.domain,
      label: ENTITY_SECTION_LABELS[comparison.domain],
      status: "compatible",
      message: "",
      rows: comparison.deltas.map(entityRow),
    }
  }
  const domain = Object.keys(ENTITY_SECTION_LABELS).find((key) => {
    return comparison.message.toLowerCase().includes(key.slice(0, -1))
  }) as keyof typeof ENTITY_SECTION_LABELS | undefined
  const fallbackDomain = domain ?? "components"
  return {
    domain: fallbackDomain,
    label: ENTITY_SECTION_LABELS[fallbackDomain],
    status: comparison.status,
    message: comparison.message,
    rows: [],
  }
}

function entitySections(result: SnapshotHistoryReadResult): readonly SnapshotTrendEntitySection[] | undefined {
  if (result.tag !== "ready" || !result.history.entityComparisons) return undefined
  return (Object.keys(ENTITY_SECTION_LABELS) as Array<keyof typeof ENTITY_SECTION_LABELS>).map((domain) => {
    const comparison = result.history.entityComparisons?.[domain]
    if (comparison) {
      if (comparison.status === "compatible") return entitySection(comparison)
      return {
        domain,
        label: ENTITY_SECTION_LABELS[domain],
        status: comparison.status,
        message: comparison.message,
        rows: [],
      }
    }
    return {
      domain,
      label: ENTITY_SECTION_LABELS[domain],
      status: "missing",
      message: "Entity comparison is unavailable.",
      rows: [],
    }
  })
}

function snapshotMetricCount(snapshot: CanonicalEntitySnapshotInput, fallback: number): number {
  if (!isRecord(snapshot.metrics) || !Array.isArray(snapshot.metrics.metrics)) return fallback
  return snapshot.metrics.metrics.length
}

function projectSide(
  snapshot: CanonicalEntitySnapshotInput,
  snapshotId: string,
  metricCount: number,
): SnapshotTrendProjectSide {
  const recordCounts = Object.fromEntries(
    ENTITY_DOMAINS.map((domain) => [
      domain,
      snapshot.entities?.[domain]?.present ? snapshot.entities[domain]!.records.length : 0,
    ]),
  ) as Record<SnapshotEntityDomain, number>
  const missingDomains = ENTITY_DOMAINS.filter((domain) => !snapshot.entities?.[domain]?.present)
  const emptyDomains = ENTITY_DOMAINS.filter(
    (domain) => snapshot.entities?.[domain]?.present && recordCounts[domain] === 0,
  )
  return {
    snapshotId,
    metricCount,
    entityCount: Object.values(recordCounts).reduce((total, count) => total + count, 0),
    recordCounts,
    missingDomains,
    emptyDomains,
  }
}

function coverageStatus(
  baseline: SnapshotTrendProjectSide,
  current: SnapshotTrendProjectSide,
): SnapshotTrendProjectCoverage {
  const unavailable =
    baseline.missingDomains.length === ENTITY_DOMAINS.length && current.missingDomains.length === ENTITY_DOMAINS.length
  if (unavailable) {
    return {
      status: "unavailable",
      caveat: "No entity lenses are available in either snapshot; project movement covers metrics only.",
    }
  }

  const hasGaps =
    baseline.missingDomains.length > 0 ||
    baseline.emptyDomains.length > 0 ||
    current.missingDomains.length > 0 ||
    current.emptyDomains.length > 0
  if (!hasGaps) {
    return { status: "complete", caveat: "All four entity lenses have records in both snapshots." }
  }

  const baselineSignature = [...baseline.missingDomains, ...baseline.emptyDomains].join(",")
  const currentSignature = [...current.missingDomains, ...current.emptyDomains].join(",")
  return {
    status: "partial",
    caveat:
      baselineSignature === currentSignature
        ? "Coverage is partial; empty or unavailable lenses are shown explicitly and should not be read as zero change."
        : "Coverage differs between snapshots; added or removed entities in affected lenses may reflect collection availability rather than product change.",
  }
}

function projectSummary(
  result: SnapshotHistoryReadResult & { readonly tag: "ready" },
  comparison: Extract<SnapshotComparison, { readonly status: "compatible" }>,
): SnapshotTrendProjectSummary | undefined {
  const baselineEntry = result.history.entries.find(
    (entry) => entry.context.snapshotId === comparison.baseline.snapshotId,
  )
  const currentEntry = result.history.entries.find(
    (entry) => entry.context.snapshotId === comparison.current.snapshotId,
  )
  if (!baselineEntry || !currentEntry) return undefined

  const baseline = projectSide(
    baselineEntry.snapshot,
    comparison.baseline.snapshotId,
    snapshotMetricCount(baselineEntry.snapshot, comparison.deltas.length),
  )
  const current = projectSide(
    currentEntry.snapshot,
    comparison.current.snapshotId,
    snapshotMetricCount(currentEntry.snapshot, comparison.deltas.length),
  )
  const metricChanged = comparison.deltas.filter((delta) => delta.direction !== "unchanged").length
  const metricAdded = comparison.deltas.filter((delta) => delta.direction === "added").length
  const metricRemoved = comparison.deltas.filter((delta) => delta.direction === "removed").length
  const entityDeltas = result.history.entityComparisons
    ? Object.values(result.history.entityComparisons).flatMap((entityComparison) =>
        entityComparison.status === "compatible" ? entityComparison.deltas : [],
      )
    : []
  const entityChanged = entityDeltas.filter((delta) => delta.direction !== "unchanged").length
  const entityAdded = entityDeltas.filter((delta) => delta.direction === "added").length
  const entityRemoved = entityDeltas.filter((delta) => delta.direction === "removed").length

  return {
    baseline,
    current,
    movement: {
      metricChanged,
      metricAdded,
      metricRemoved,
      entityChanged,
      entityAdded,
      entityRemoved,
      totalChanged: metricChanged + entityChanged,
    },
    coverage: coverageStatus(baseline, current),
  }
}

export function buildSnapshotTrendViewModel(result: SnapshotHistoryReadResult): SnapshotTrendViewModel {
  if (result.tag === "missing") return emptyState("missing", result.message)
  if (result.tag === "invalid") return emptyState("invalid", result.message)

  const comparison: SnapshotComparison = result.history.comparison
  if (comparison.status === "missing") return emptyState("missing", comparison.message)
  if (comparison.status === "incompatible") return emptyState("incompatible", comparison.message)

  const baseline = snapshotSummary(result, comparison.baseline.snapshotId)
  const current = snapshotSummary(result, comparison.current.snapshotId)
  if (!baseline || !current) {
    return emptyState("invalid", "Snapshot history entries do not match the comparison provenance.")
  }

  const sections = entitySections(result)
  const project = projectSummary(result, comparison)
  if (!project) {
    return emptyState("invalid", "Snapshot history entries do not match the comparison provenance.")
  }
  return {
    status: "compatible",
    message: "Latest snapshot compared with its immediate predecessor.",
    baseline,
    current,
    rows: comparison.deltas.map(trendRow),
    project,
    ...(sections ? { entitySections: sections } : {}),
  }
}
