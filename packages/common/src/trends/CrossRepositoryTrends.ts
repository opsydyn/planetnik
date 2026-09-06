import type { SnapshotEntityComparison, SnapshotEntityDomain } from "./SnapshotEntityTrends.js"
import type { SnapshotComparison, SnapshotMetricProvenance, SnapshotProvenance } from "./SnapshotTrends.js"
import { parseCanonicalSnapshotContext } from "./SnapshotTrends.js"

export type CrossRepositoryMetricUnit = "lines" | "files" | "units" | "people" | "links"

export type CrossRepositoryMetricDefinition = {
  readonly id: string
  readonly label: string
  readonly unit: CrossRepositoryMetricUnit
}

/**
 * Only metrics with the same meaning in every single-repository report are
 * eligible for a portfolio sum. Extension and decomposition-specific metrics
 * stay repository-scoped because their presence is not a stable cross-repo
 * contract.
 */
export const CROSS_REPOSITORY_METRIC_DEFINITIONS: readonly CrossRepositoryMetricDefinition[] = [
  { id: "LINES_OF_CODE_MAIN", label: "Main LOC", unit: "lines" },
  { id: "TOTAL_NUMBER_OF_FILES", label: "Total files", unit: "files" },
  { id: "NUMBER_OF_UNITS", label: "Units", unit: "units" },
  { id: "NUMBER_OF_CONTRIBUTORS", label: "Contributors", unit: "people" },
  {
    id: "NUMBER_OF_DEPENDENCIES_DECOMPOSITION_PRIMARY",
    label: "Dependency links",
    unit: "links",
  },
] as const

export type CrossRepositoryHistoryStatus = "compatible" | "missing" | "incompatible" | "invalid"

export type CrossRepositoryHistoryInput = {
  readonly status: CrossRepositoryHistoryStatus
  readonly message?: string
  readonly comparison?: SnapshotComparison
  readonly entityComparisons?: Readonly<Record<SnapshotEntityDomain, SnapshotEntityComparison>>
}

export type CrossRepositoryTrendDataset = {
  readonly id: string
  readonly title: string
  readonly mode: "single_repository" | "landscape"
  readonly availability: "ready" | "partial" | "planned" | "invalid"
  readonly current?: { readonly context: unknown; readonly metrics?: unknown } | null
  readonly history?: CrossRepositoryHistoryInput
}

export type CrossRepositoryMetricRollup = {
  readonly id: string
  readonly label: string
  readonly unit: CrossRepositoryMetricUnit
  readonly current: number | null
  readonly baseline: number | null
  readonly delta: number | null
  readonly currentCoverage: number
  readonly baselineCoverage: number
  readonly deltaCoverage: number
  readonly currentRepositories: readonly string[]
  readonly baselineRepositories: readonly string[]
  readonly deltaRepositories: readonly string[]
  readonly provenance: {
    readonly current: readonly SnapshotMetricProvenance[]
    readonly baseline: readonly SnapshotMetricProvenance[]
  }
}

export type CrossRepositoryMovement = {
  readonly repositoriesWithCompatibleHistory: number
  readonly metricChanged: number
  readonly metricAdded: number
  readonly metricRemoved: number
  readonly entityChanged: number
  readonly entityAdded: number
  readonly entityRemoved: number
  readonly totalChanged: number
}

export type CrossRepositoryDatasetSummary = {
  readonly id: string
  readonly title: string
  readonly availability: CrossRepositoryTrendDataset["availability"]
  readonly status: "included" | "planned" | "unavailable" | "excluded"
  readonly reason?: string
  readonly snapshot?: SnapshotProvenance
  readonly currentMetricIds: readonly string[]
  readonly history: {
    readonly status: CrossRepositoryHistoryStatus
    readonly message: string
    readonly baselineSnapshotId?: string
    readonly currentSnapshotId?: string
  }
  readonly movement?: CrossRepositoryMovement
}

export type CrossRepositoryCoverage = {
  readonly catalogueEntries: number
  readonly repositoryEntries: number
  readonly includedRepositories: number
  readonly plannedEntries: number
  readonly unavailableEntries: number
  readonly excludedEntries: number
  readonly compatibleHistories: number
  readonly missingHistories: number
  readonly incompatibleHistories: number
  readonly invalidHistories: number
}

export type CrossRepositoryTrends = {
  readonly status: "ready" | "empty"
  readonly message: string
  readonly coverage: CrossRepositoryCoverage
  readonly metrics: readonly CrossRepositoryMetricRollup[]
  readonly movement: CrossRepositoryMovement
  readonly datasets: readonly CrossRepositoryDatasetSummary[]
}

type RecordValue = Record<string, unknown>

type ParsedMetrics =
  | { readonly kind: "present"; readonly values: ReadonlyMap<string, number> }
  | { readonly kind: "missing"; readonly message: string }
  | { readonly kind: "invalid"; readonly message: string }

type ParsedCurrent =
  | { readonly kind: "present"; readonly context: SnapshotProvenance; readonly metrics: ReadonlyMap<string, number> }
  | { readonly kind: "missing"; readonly message: string }
  | { readonly kind: "invalid"; readonly message: string }

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function parseMetrics(raw: unknown): ParsedMetrics {
  if (raw === undefined) return { kind: "missing", message: "Current snapshot is missing the metrics.json shard." }
  if (!isRecord(raw) || !Array.isArray(raw.metrics)) {
    return { kind: "invalid", message: "metrics.json must contain a metrics array." }
  }

  const values = new Map<string, number>()
  for (const [index, item] of raw.metrics.entries()) {
    if (!isRecord(item)) {
      return { kind: "invalid", message: `metrics.json record ${index} must be an object.` }
    }
    const id = typeof item.id === "string" ? item.id.trim() : ""
    const value = item.value
    if (!id || typeof value !== "number" || !Number.isFinite(value)) {
      return { kind: "invalid", message: `metrics.json record ${index} must contain a finite numeric id and value.` }
    }
    if (values.has(id)) {
      return { kind: "invalid", message: `metrics.json contains duplicate metric id '${id}'.` }
    }
    values.set(id, value)
  }
  return { kind: "present", values }
}

function parseCurrent(dataset: CrossRepositoryTrendDataset): ParsedCurrent {
  if (dataset.current === undefined || dataset.current === null) {
    return { kind: "missing", message: "Current canonical snapshot is unavailable." }
  }

  const context = parseCanonicalSnapshotContext(dataset.current.context)
  if (context.kind === "invalid") return { kind: "invalid", message: context.message }
  if (context.value.mode !== "single_repository") {
    return { kind: "invalid", message: "Cross-repository repository trends require single-repository snapshots." }
  }

  const metrics = parseMetrics(dataset.current.metrics)
  if (metrics.kind !== "present") return metrics
  return { kind: "present", context: context.value, metrics: metrics.values }
}

function metricProvenance(snapshot: SnapshotProvenance, id: string): SnapshotMetricProvenance {
  return {
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    shard: "metrics.json",
    record: `metrics[id=${id}]`,
  }
}

type NormalizedHistory = {
  readonly status: CrossRepositoryHistoryStatus
  readonly message: string
  readonly comparison?: Extract<SnapshotComparison, { readonly status: "compatible" }>
}

function historyStatus(input: CrossRepositoryHistoryInput | undefined): NormalizedHistory {
  if (!input) {
    return { status: "missing", message: "Snapshot history is not present for this repository." }
  }
  if (input.status === "invalid") {
    return { status: "invalid", message: input.message ?? "Snapshot history is invalid." }
  }
  if (input.status === "incompatible") {
    return { status: "incompatible", message: input.message ?? "Snapshot history is incompatible." }
  }
  if (input.status === "missing") {
    return { status: "missing", message: input.message ?? "Snapshot history does not contain a comparable pair." }
  }
  if (input.comparison?.status === "compatible") {
    return {
      status: "compatible",
      message: "Latest compatible snapshot pair is available.",
      comparison: input.comparison,
    }
  }
  if (input.comparison?.status === "incompatible") {
    return { status: "incompatible", message: input.comparison.message }
  }
  return {
    status: "missing",
    message: input.comparison?.message ?? "Snapshot history does not contain a comparable pair.",
  }
}

function historySummary(history: NormalizedHistory): CrossRepositoryDatasetSummary["history"] {
  return { status: history.status, message: history.message }
}

function movementFor(
  history: CrossRepositoryHistoryInput | undefined,
  compatibleComparison: Extract<SnapshotComparison, { readonly status: "compatible" }> | undefined,
): CrossRepositoryMovement | undefined {
  if (!compatibleComparison) return undefined
  const metricChanged = compatibleComparison.deltas.filter((delta) => delta.direction !== "unchanged").length
  const metricAdded = compatibleComparison.deltas.filter((delta) => delta.direction === "added").length
  const metricRemoved = compatibleComparison.deltas.filter((delta) => delta.direction === "removed").length
  const entityDeltas = history?.entityComparisons
    ? Object.values(history.entityComparisons).flatMap((comparison) =>
        comparison.status === "compatible" ? comparison.deltas : [],
      )
    : []
  const entityChanged = entityDeltas.filter((delta) => delta.direction !== "unchanged").length
  const entityAdded = entityDeltas.filter((delta) => delta.direction === "added").length
  const entityRemoved = entityDeltas.filter((delta) => delta.direction === "removed").length
  return {
    repositoriesWithCompatibleHistory: 1,
    metricChanged,
    metricAdded,
    metricRemoved,
    entityChanged,
    entityAdded,
    entityRemoved,
    totalChanged: metricChanged + entityChanged,
  }
}

function sumOrNull(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((total, value) => total + value, 0) : null
}

function addMovement(
  total: CrossRepositoryMovement,
  movement: CrossRepositoryMovement | undefined,
): CrossRepositoryMovement {
  if (!movement) return total
  return {
    repositoriesWithCompatibleHistory:
      total.repositoriesWithCompatibleHistory + movement.repositoriesWithCompatibleHistory,
    metricChanged: total.metricChanged + movement.metricChanged,
    metricAdded: total.metricAdded + movement.metricAdded,
    metricRemoved: total.metricRemoved + movement.metricRemoved,
    entityChanged: total.entityChanged + movement.entityChanged,
    entityAdded: total.entityAdded + movement.entityAdded,
    entityRemoved: total.entityRemoved + movement.entityRemoved,
    totalChanged: total.totalChanged + movement.totalChanged,
  }
}

function emptyMovement(): CrossRepositoryMovement {
  return {
    repositoriesWithCompatibleHistory: 0,
    metricChanged: 0,
    metricAdded: 0,
    metricRemoved: 0,
    entityChanged: 0,
    entityAdded: 0,
    entityRemoved: 0,
    totalChanged: 0,
  }
}

export function buildCrossRepositoryTrends(
  datasets: readonly CrossRepositoryTrendDataset[],
  definitions: readonly CrossRepositoryMetricDefinition[] = CROSS_REPOSITORY_METRIC_DEFINITIONS,
): CrossRepositoryTrends {
  const ordered = [...datasets].sort((left, right) => compareStrings(left.id, right.id))
  const summaries: CrossRepositoryDatasetSummary[] = []
  const currentByMetric = new Map<
    string,
    { values: number[]; repositories: string[]; provenance: SnapshotMetricProvenance[] }
  >()
  const baselineByMetric = new Map<
    string,
    { values: number[]; repositories: string[]; provenance: SnapshotMetricProvenance[] }
  >()
  const deltaByMetric = new Map<string, { values: number[]; repositories: string[] }>()
  let repositoryEntries = 0
  let includedRepositories = 0
  let plannedEntries = 0
  let unavailableEntries = 0
  let excludedEntries = 0
  let compatibleHistories = 0
  let missingHistories = 0
  let incompatibleHistories = 0
  let invalidHistories = 0
  let movement = emptyMovement()
  const seenDatasetIds = new Set<string>()

  for (const dataset of ordered) {
    if (seenDatasetIds.has(dataset.id)) {
      unavailableEntries += 1
      summaries.push({
        id: dataset.id,
        title: dataset.title,
        availability: dataset.availability,
        status: "unavailable",
        reason: "Duplicate dataset ids cannot be included in a portfolio roll-up.",
        currentMetricIds: [],
        history: historySummary(historyStatus(dataset.history)),
      })
      continue
    }
    seenDatasetIds.add(dataset.id)
    const history = historyStatus(dataset.history)
    if (dataset.mode !== "single_repository") {
      excludedEntries += 1
      summaries.push({
        id: dataset.id,
        title: dataset.title,
        availability: dataset.availability,
        status: "excluded",
        reason: "Landscape entries are kept in the catalogue but excluded from the repository roll-up.",
        currentMetricIds: [],
        history: historySummary(history),
      })
      continue
    }

    repositoryEntries += 1
    if (dataset.availability === "planned") {
      plannedEntries += 1
      summaries.push({
        id: dataset.id,
        title: dataset.title,
        availability: dataset.availability,
        status: "planned",
        reason: "This catalogue entry has no local canonical snapshot yet.",
        currentMetricIds: [],
        history: historySummary(history),
      })
      continue
    }

    const current = parseCurrent(dataset)
    if (current.kind !== "present") {
      unavailableEntries += 1
      summaries.push({
        id: dataset.id,
        title: dataset.title,
        availability: dataset.availability,
        status: "unavailable",
        reason: current.message,
        currentMetricIds: [],
        history: historySummary(history),
      })
      continue
    }

    includedRepositories += 1
    const currentMetricIds = [...current.metrics.keys()].sort(compareStrings)
    const compatibleComparison = history.comparison
    const datasetMovement = movementFor(dataset.history, compatibleComparison)
    movement = addMovement(movement, datasetMovement)
    if (history.status === "compatible") compatibleHistories += 1
    else if (history.status === "missing") missingHistories += 1
    else if (history.status === "incompatible") incompatibleHistories += 1
    else invalidHistories += 1

    for (const definition of definitions) {
      const value = current.metrics.get(definition.id)
      if (value !== undefined) {
        const entry = currentByMetric.get(definition.id) ?? { values: [], repositories: [], provenance: [] }
        entry.values.push(value)
        entry.repositories.push(dataset.id)
        entry.provenance.push(metricProvenance(current.context, definition.id))
        currentByMetric.set(definition.id, entry)
      }

      const delta = compatibleComparison?.deltas.find((candidate) => candidate.id === definition.id)
      if (!delta) continue
      if (delta.baseline !== null && delta.provenance.baseline) {
        const entry = baselineByMetric.get(definition.id) ?? { values: [], repositories: [], provenance: [] }
        entry.values.push(delta.baseline)
        entry.repositories.push(dataset.id)
        entry.provenance.push(delta.provenance.baseline)
        baselineByMetric.set(definition.id, entry)
      }
      if (delta.delta !== null) {
        const entry = deltaByMetric.get(definition.id) ?? { values: [], repositories: [] }
        entry.values.push(delta.delta)
        entry.repositories.push(dataset.id)
        deltaByMetric.set(definition.id, entry)
      }
    }

    summaries.push({
      id: dataset.id,
      title: dataset.title,
      availability: dataset.availability,
      status: "included",
      snapshot: current.context,
      currentMetricIds,
      history: {
        ...historySummary(history),
        ...(compatibleComparison
          ? {
              baselineSnapshotId: compatibleComparison.baseline.snapshotId,
              currentSnapshotId: compatibleComparison.current.snapshotId,
            }
          : {}),
      },
      ...(datasetMovement ? { movement: datasetMovement } : {}),
    })
  }

  const metrics = definitions.map((definition): CrossRepositoryMetricRollup => {
    const current = currentByMetric.get(definition.id)
    const baseline = baselineByMetric.get(definition.id)
    const delta = deltaByMetric.get(definition.id)
    return {
      id: definition.id,
      label: definition.label,
      unit: definition.unit,
      current: sumOrNull(current?.values ?? []),
      baseline: sumOrNull(baseline?.values ?? []),
      delta: sumOrNull(delta?.values ?? []),
      currentCoverage: current?.values.length ?? 0,
      baselineCoverage: baseline?.values.length ?? 0,
      deltaCoverage: delta?.values.length ?? 0,
      currentRepositories: current?.repositories ?? [],
      baselineRepositories: baseline?.repositories ?? [],
      deltaRepositories: delta?.repositories ?? [],
      provenance: {
        current: current?.provenance ?? [],
        baseline: baseline?.provenance ?? [],
      },
    }
  })

  const coverage: CrossRepositoryCoverage = {
    catalogueEntries: datasets.length,
    repositoryEntries,
    includedRepositories,
    plannedEntries,
    unavailableEntries,
    excludedEntries,
    compatibleHistories,
    missingHistories,
    incompatibleHistories,
    invalidHistories,
  }

  return {
    status: includedRepositories === 0 ? "empty" : "ready",
    message:
      includedRepositories === 0
        ? "No single-repository canonical snapshots are available for a portfolio roll-up."
        : `Latest canonical values are summed across ${includedRepositories} repositories; trend deltas use each repository's latest compatible history pair.`,
    coverage,
    metrics,
    movement,
    datasets: summaries,
  }
}
