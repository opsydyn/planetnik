export type CanonicalSnapshotMode = "single_repository" | "landscape"

export type CanonicalSnapshotInput = {
  readonly context: unknown
  readonly metrics?: unknown
}

export type SnapshotProvenance = {
  readonly dataVersion: 2
  readonly mode: CanonicalSnapshotMode
  readonly title: string
  readonly repositoryId?: string
  readonly snapshotId: string
  readonly generatedAt: string
}

export type SnapshotMetricProvenance = {
  readonly snapshotId: string
  readonly generatedAt: string
  readonly shard: "metrics.json"
  readonly record: string
}

export type MetricDeltaDirection = "increase" | "decrease" | "unchanged" | "added" | "removed"

export type SnapshotMetricDelta = {
  readonly id: string
  readonly baseline: number | null
  readonly current: number | null
  readonly delta: number | null
  readonly direction: MetricDeltaDirection
  readonly provenance: {
    readonly baseline?: SnapshotMetricProvenance
    readonly current?: SnapshotMetricProvenance
  }
}

export type SnapshotIncompatibilityReason =
  | "context"
  | "data_version"
  | "report_mode"
  | "repository_id"
  | "snapshot_id"
  | "generated_at"
  | "metrics"

export type SnapshotComparison =
  | {
      readonly status: "compatible"
      readonly baseline: SnapshotProvenance
      readonly current: SnapshotProvenance
      readonly deltas: ReadonlyArray<SnapshotMetricDelta>
    }
  | {
      readonly status: "missing"
      readonly missing: "baseline" | "current" | "metrics"
      readonly message: string
    }
  | {
      readonly status: "incompatible"
      readonly reason: SnapshotIncompatibilityReason
      readonly message: string
    }

type RecordValue = Record<string, unknown>

type ParsedMetrics =
  | { readonly kind: "present"; readonly values: ReadonlyMap<string, number> }
  | { readonly kind: "missing" }
  | { readonly kind: "invalid"; readonly message: string }

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSnapshotMode(value: unknown): value is CanonicalSnapshotMode {
  return value === "single_repository" || value === "landscape"
}

function isExactIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false
  const date = new Date(value)
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value
}

export function parseCanonicalSnapshotContext(
  raw: unknown,
):
  | { readonly kind: "valid"; readonly value: SnapshotProvenance }
  | { readonly kind: "invalid"; readonly reason: SnapshotIncompatibilityReason; readonly message: string } {
  if (!isRecord(raw)) {
    return { kind: "invalid", reason: "context", message: "Snapshot context is missing or not an object." }
  }

  if (raw.dataVersion !== 2) {
    return {
      kind: "invalid",
      reason: "data_version",
      message: "Snapshots must use canonical dataVersion 2.",
    }
  }

  const mode = raw.mode
  const reportMode = raw.reportMode
  if (!isSnapshotMode(mode) || !isSnapshotMode(reportMode) || mode !== reportMode) {
    return {
      kind: "invalid",
      reason: "report_mode",
      message: "Snapshot mode and reportMode must be the same supported value.",
    }
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : ""
  if (!title) {
    return { kind: "invalid", reason: "context", message: "Snapshot title is required." }
  }

  const snapshotId = typeof raw.snapshotId === "string" ? raw.snapshotId.trim() : ""
  if (!UUID_V4_PATTERN.test(snapshotId)) {
    return { kind: "invalid", reason: "context", message: "Snapshot snapshotId must be a UUID v4." }
  }

  if (!isExactIsoTimestamp(raw.generatedAt)) {
    return { kind: "invalid", reason: "generated_at", message: "Snapshot generatedAt must be an exact ISO timestamp." }
  }

  const repositoryId = typeof raw.repositoryId === "string" ? raw.repositoryId.trim() : ""
  if (mode === "single_repository" && repositoryId.length === 0) {
    return { kind: "invalid", reason: "repository_id", message: "Single-repository snapshots require repositoryId." }
  }

  return {
    kind: "valid",
    value: {
      dataVersion: 2,
      mode,
      title,
      ...(repositoryId.length > 0 ? { repositoryId } : {}),
      snapshotId,
      generatedAt: raw.generatedAt,
    },
  }
}

function parseMetrics(raw: unknown): ParsedMetrics {
  if (raw === undefined) return { kind: "missing" }
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

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function metricProvenance(snapshot: SnapshotProvenance, id: string): SnapshotMetricProvenance {
  return {
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    shard: "metrics.json",
    record: `metrics[id=${id}]`,
  }
}

function missingMetricsMessage(side: "current" | "baseline"): string {
  return `${side[0]!.toUpperCase()}${side.slice(1)} snapshot is missing the metrics.json shard.`
}

export function compareCanonicalSnapshots(
  current: CanonicalSnapshotInput | null | undefined,
  baseline: CanonicalSnapshotInput | null | undefined,
): SnapshotComparison {
  if (current === null || current === undefined) {
    return { status: "missing", missing: "current", message: "Current snapshot is missing." }
  }
  if (baseline === null || baseline === undefined) {
    return { status: "missing", missing: "baseline", message: "Baseline snapshot is missing." }
  }

  const currentContext = parseCanonicalSnapshotContext(current.context)
  if (currentContext.kind === "invalid") {
    return {
      status: "incompatible",
      reason: currentContext.reason,
      message: currentContext.message,
    }
  }

  const baselineContext = parseCanonicalSnapshotContext(baseline.context)
  if (baselineContext.kind === "invalid") {
    return {
      status: "incompatible",
      reason: baselineContext.reason,
      message: baselineContext.message,
    }
  }

  const currentProvenance = currentContext.value
  const baselineProvenance = baselineContext.value

  if (currentProvenance.mode !== baselineProvenance.mode) {
    return {
      status: "incompatible",
      reason: "report_mode",
      message: "Snapshots must use the same report mode.",
    }
  }

  const currentIdentity = currentProvenance.repositoryId ?? currentProvenance.title
  const baselineIdentity = baselineProvenance.repositoryId ?? baselineProvenance.title
  if (currentIdentity !== baselineIdentity) {
    return {
      status: "incompatible",
      reason: "repository_id",
      message: "Snapshots must describe the same repository identity.",
    }
  }

  if (currentProvenance.snapshotId === baselineProvenance.snapshotId) {
    return {
      status: "incompatible",
      reason: "snapshot_id",
      message: "Current and baseline snapshots must have different snapshotId values.",
    }
  }

  const currentMetrics = parseMetrics(current.metrics)
  if (currentMetrics.kind === "missing") {
    return { status: "missing", missing: "metrics", message: missingMetricsMessage("current") }
  }
  if (currentMetrics.kind === "invalid") {
    return { status: "incompatible", reason: "metrics", message: currentMetrics.message }
  }

  const baselineMetrics = parseMetrics(baseline.metrics)
  if (baselineMetrics.kind === "missing") {
    return { status: "missing", missing: "metrics", message: missingMetricsMessage("baseline") }
  }
  if (baselineMetrics.kind === "invalid") {
    return { status: "incompatible", reason: "metrics", message: baselineMetrics.message }
  }

  const metricIds = new Set<string>([...currentMetrics.values.keys(), ...baselineMetrics.values.keys()])
  const deltas = [...metricIds].sort(compareStrings).map((id): SnapshotMetricDelta => {
    const currentValue = currentMetrics.values.get(id)
    const baselineValue = baselineMetrics.values.get(id)

    if (currentValue === undefined) {
      return {
        id,
        baseline: baselineValue!,
        current: null,
        delta: null,
        direction: "removed",
        provenance: { baseline: metricProvenance(baselineProvenance, id) },
      }
    }
    if (baselineValue === undefined) {
      return {
        id,
        baseline: null,
        current: currentValue,
        delta: null,
        direction: "added",
        provenance: { current: metricProvenance(currentProvenance, id) },
      }
    }

    const delta = currentValue - baselineValue
    return {
      id,
      baseline: baselineValue,
      current: currentValue,
      delta,
      direction: delta === 0 ? "unchanged" : delta > 0 ? "increase" : "decrease",
      provenance: {
        baseline: metricProvenance(baselineProvenance, id),
        current: metricProvenance(currentProvenance, id),
      },
    }
  })

  return {
    status: "compatible",
    baseline: baselineProvenance,
    current: currentProvenance,
    deltas,
  }
}

export function compareLatestCanonicalSnapshots(snapshots: readonly CanonicalSnapshotInput[]): SnapshotComparison {
  if (snapshots.length < 2) {
    return {
      status: "missing",
      missing: "baseline",
      message: "Snapshot history requires at least two snapshots.",
    }
  }

  const parsed = snapshots.map((snapshot) => ({
    snapshot,
    context: parseCanonicalSnapshotContext(snapshot.context),
  }))

  for (const entry of parsed) {
    if (entry.context.kind === "invalid") {
      return {
        status: "incompatible",
        reason: entry.context.reason,
        message: entry.context.message,
      }
    }
  }

  const snapshotIds = new Set<string>()
  for (const entry of parsed) {
    if (entry.context.kind !== "valid") continue
    if (snapshotIds.has(entry.context.value.snapshotId)) {
      return {
        status: "incompatible",
        reason: "snapshot_id",
        message: "Snapshot history contains duplicate snapshotId values.",
      }
    }
    snapshotIds.add(entry.context.value.snapshotId)
  }

  const referenceContext = parsed[0]!.context
  if (referenceContext.kind !== "valid") {
    return {
      status: "incompatible",
      reason: "context",
      message: "Snapshot history contains an invalid context.",
    }
  }
  const referenceIdentity = referenceContext.value.repositoryId ?? referenceContext.value.title
  for (const entry of parsed.slice(1)) {
    if (entry.context.kind !== "valid") continue
    if (entry.context.value.mode !== referenceContext.value.mode) {
      return {
        status: "incompatible",
        reason: "report_mode",
        message: "Snapshot history must use one report mode.",
      }
    }
    const identity = entry.context.value.repositoryId ?? entry.context.value.title
    if (identity !== referenceIdentity) {
      return {
        status: "incompatible",
        reason: "repository_id",
        message: "Snapshot history must describe one repository identity.",
      }
    }
  }

  const ordered = [...parsed].sort((left, right) => {
    if (left.context.kind !== "valid" || right.context.kind !== "valid") return 0
    return (
      compareStrings(left.context.value.generatedAt, right.context.value.generatedAt) ||
      compareStrings(left.context.value.snapshotId, right.context.value.snapshotId)
    )
  })
  const baseline = ordered[ordered.length - 2]!
  const current = ordered[ordered.length - 1]!

  return compareCanonicalSnapshots(current.snapshot, baseline.snapshot)
}
