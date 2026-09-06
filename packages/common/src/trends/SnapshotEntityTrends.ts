import type { CanonicalSnapshotInput, SnapshotIncompatibilityReason, SnapshotProvenance } from "./SnapshotTrends.js"
import { parseCanonicalSnapshotContext } from "./SnapshotTrends.js"

export type SnapshotEntityDomain = "components" | "hotspots" | "controls" | "ownership"

export type SnapshotEntityRecordProvenance = {
  readonly shards: readonly string[]
  readonly records: readonly string[]
}

export type SnapshotEntityRecord = {
  readonly id: string
  readonly values: Readonly<Record<string, unknown>>
  readonly provenance: SnapshotEntityRecordProvenance
}

export type SnapshotEntityCollection = {
  readonly present: boolean
  readonly records: readonly SnapshotEntityRecord[]
}

export type CanonicalEntitySnapshotInput = CanonicalSnapshotInput & {
  readonly entities?: Readonly<Partial<Record<SnapshotEntityDomain, SnapshotEntityCollection>>>
}

export type SnapshotEntityProvenance = {
  readonly snapshotId: string
  readonly generatedAt: string
  readonly shards: readonly string[]
  readonly records: readonly string[]
}

export type SnapshotEntityDeltaDirection = "added" | "removed" | "changed" | "unchanged"

export type SnapshotEntityDelta = {
  readonly domain: SnapshotEntityDomain
  readonly id: string
  readonly baseline: Readonly<Record<string, unknown>> | null
  readonly current: Readonly<Record<string, unknown>> | null
  readonly changedFields: readonly string[]
  readonly direction: SnapshotEntityDeltaDirection
  readonly provenance: {
    readonly baseline?: SnapshotEntityProvenance
    readonly current?: SnapshotEntityProvenance
  }
}

export type SnapshotEntityIncompatibilityReason = SnapshotIncompatibilityReason | "entities"

export type SnapshotEntityComparison =
  | {
      readonly status: "compatible"
      readonly domain: SnapshotEntityDomain
      readonly baseline: SnapshotProvenance
      readonly current: SnapshotProvenance
      readonly deltas: readonly SnapshotEntityDelta[]
    }
  | {
      readonly status: "missing"
      readonly missing: "baseline" | "current" | "entities"
      readonly message: string
    }
  | {
      readonly status: "incompatible"
      readonly reason: SnapshotEntityIncompatibilityReason
      readonly message: string
    }

type RecordValue = Record<string, unknown>

type ParsedEntities =
  | { readonly kind: "present"; readonly values: ReadonlyMap<string, SnapshotEntityRecord> }
  | { readonly kind: "missing" }
  | { readonly kind: "invalid"; readonly message: string }

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function canonicalJson(value: unknown): string | undefined {
  if (value === null) return "null"
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : undefined
  if (Array.isArray(value)) {
    const items = value.map(canonicalJson)
    return items.every((item): item is string => item !== undefined) ? `[${items.join(",")}]` : undefined
  }
  if (!isRecord(value)) return undefined

  const keys = Object.keys(value).sort(compareStrings)
  const fields: string[] = []
  for (const key of keys) {
    const item = canonicalJson(value[key])
    if (item === undefined) return undefined
    fields.push(`${JSON.stringify(key)}:${item}`)
  }
  return `{${fields.join(",")}}`
}

function validProvenance(value: unknown): value is SnapshotEntityRecordProvenance {
  if (!isRecord(value) || !Array.isArray(value.shards) || !Array.isArray(value.records)) return false
  return (
    value.shards.length > 0 &&
    value.records.length > 0 &&
    value.shards.every((item) => typeof item === "string" && item.trim().length > 0) &&
    value.records.every((item) => typeof item === "string" && item.trim().length > 0)
  )
}

function parseEntities(raw: unknown, domain: SnapshotEntityDomain, side: "current" | "baseline"): ParsedEntities {
  if (raw === undefined) return { kind: "missing" }
  if (!isRecord(raw) || typeof raw.present !== "boolean") {
    return {
      kind: "invalid",
      message: `${side[0]!.toUpperCase()}${side.slice(1)} ${domain} entity collection is malformed.`,
    }
  }
  if (!raw.present) return { kind: "missing" }
  if (!Array.isArray(raw.records)) {
    return {
      kind: "invalid",
      message: `${side[0]!.toUpperCase()}${side.slice(1)} ${domain} entity collection must contain a records array.`,
    }
  }

  const values = new Map<string, SnapshotEntityRecord>()
  for (const [index, item] of raw.records.entries()) {
    if (!isRecord(item)) {
      return { kind: "invalid", message: `${domain} entity record ${index} must be an object.` }
    }
    const id = typeof item.id === "string" ? item.id.trim() : ""
    if (!id || !isRecord(item.values) || !validProvenance(item.provenance)) {
      return {
        kind: "invalid",
        message: `${domain} entity record ${index} must contain an id, values, and provenance.`,
      }
    }
    if (canonicalJson(item.values) === undefined) {
      return { kind: "invalid", message: `${domain} entity record ${index} contains a non-JSON value.` }
    }
    if (values.has(id)) {
      return { kind: "invalid", message: `${domain} entity collection contains duplicate id '${id}'.` }
    }
    values.set(id, {
      id,
      values: item.values,
      provenance: {
        shards: item.provenance.shards.map((shard) => shard.trim()),
        records: item.provenance.records.map((record) => record.trim()),
      },
    })
  }

  return { kind: "present", values }
}

function entityProvenance(snapshot: SnapshotProvenance, record: SnapshotEntityRecord): SnapshotEntityProvenance {
  return {
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    shards: record.provenance.shards,
    records: record.provenance.records,
  }
}

function changedFields(baseline: SnapshotEntityRecord, current: SnapshotEntityRecord): readonly string[] {
  const keys = new Set([...Object.keys(baseline.values), ...Object.keys(current.values)])
  return [...keys].sort(compareStrings).filter((key) => {
    const baselineValue = canonicalJson(baseline.values[key])
    const currentValue = canonicalJson(current.values[key])
    return baselineValue !== currentValue
  })
}

function missingEntitiesMessage(side: "current" | "baseline", domain: SnapshotEntityDomain): string {
  return `${side[0]!.toUpperCase()}${side.slice(1)} snapshot is missing the ${domain} entity collection.`
}

export function compareCanonicalEntitySnapshots(
  current: CanonicalEntitySnapshotInput | null | undefined,
  baseline: CanonicalEntitySnapshotInput | null | undefined,
  domain: SnapshotEntityDomain,
): SnapshotEntityComparison {
  if (current === null || current === undefined) {
    return { status: "missing", missing: "current", message: "Current snapshot is missing." }
  }
  if (baseline === null || baseline === undefined) {
    return { status: "missing", missing: "baseline", message: "Baseline snapshot is missing." }
  }

  const currentContext = parseCanonicalSnapshotContext(current.context)
  if (currentContext.kind === "invalid") {
    return { status: "incompatible", reason: currentContext.reason, message: currentContext.message }
  }
  const baselineContext = parseCanonicalSnapshotContext(baseline.context)
  if (baselineContext.kind === "invalid") {
    return { status: "incompatible", reason: baselineContext.reason, message: baselineContext.message }
  }

  const currentProvenance = currentContext.value
  const baselineProvenance = baselineContext.value
  if (currentProvenance.mode !== baselineProvenance.mode) {
    return { status: "incompatible", reason: "report_mode", message: "Snapshots must use the same report mode." }
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

  const currentEntities = parseEntities(current.entities?.[domain], domain, "current")
  if (currentEntities.kind === "missing") {
    return { status: "missing", missing: "entities", message: missingEntitiesMessage("current", domain) }
  }
  if (currentEntities.kind === "invalid") {
    return { status: "incompatible", reason: "entities", message: currentEntities.message }
  }
  const baselineEntities = parseEntities(baseline.entities?.[domain], domain, "baseline")
  if (baselineEntities.kind === "missing") {
    return { status: "missing", missing: "entities", message: missingEntitiesMessage("baseline", domain) }
  }
  if (baselineEntities.kind === "invalid") {
    return { status: "incompatible", reason: "entities", message: baselineEntities.message }
  }

  const entityIds = new Set([...currentEntities.values.keys(), ...baselineEntities.values.keys()])
  const deltas = [...entityIds].sort(compareStrings).map((id): SnapshotEntityDelta => {
    const currentRecord = currentEntities.values.get(id)
    const baselineRecord = baselineEntities.values.get(id)

    if (!currentRecord) {
      return {
        domain,
        id,
        baseline: baselineRecord!.values,
        current: null,
        changedFields: [],
        direction: "removed",
        provenance: { baseline: entityProvenance(baselineProvenance, baselineRecord!) },
      }
    }
    if (!baselineRecord) {
      return {
        domain,
        id,
        baseline: null,
        current: currentRecord.values,
        changedFields: [],
        direction: "added",
        provenance: { current: entityProvenance(currentProvenance, currentRecord) },
      }
    }

    const fields = changedFields(baselineRecord, currentRecord)
    return {
      domain,
      id,
      baseline: baselineRecord.values,
      current: currentRecord.values,
      changedFields: fields,
      direction: fields.length === 0 ? "unchanged" : "changed",
      provenance: {
        baseline: entityProvenance(baselineProvenance, baselineRecord),
        current: entityProvenance(currentProvenance, currentRecord),
      },
    }
  })

  return {
    status: "compatible",
    domain,
    baseline: baselineProvenance,
    current: currentProvenance,
    deltas,
  }
}
