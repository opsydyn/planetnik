import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type {
  CanonicalReportContext,
  SnapshotEntityCollection,
  SnapshotEntityDomain,
  SnapshotEntityRecord,
} from "@planetnik/common"

type RecordValue = Record<string, unknown>

export type SnapshotEntityReadResult =
  | {
      readonly tag: "ready"
      readonly entities: Readonly<Record<SnapshotEntityDomain, SnapshotEntityCollection>>
    }
  | { readonly tag: "invalid"; readonly message: string }

type ShardResult =
  | { readonly tag: "absent" }
  | { readonly tag: "present"; readonly fileName: string; readonly value: unknown }
  | { readonly tag: "invalid"; readonly message: string }

type ArrayShardResult =
  | { readonly tag: "absent" }
  | { readonly tag: "present"; readonly fileName: string; readonly records: readonly RecordValue[] }
  | { readonly tag: "invalid"; readonly message: string }

type ComponentAccumulator = {
  readonly id: string
  readonly name: string
  readonly decompositionKey: string
  readonly fileIndices: number[]
  readonly unitIndices: number[]
  readonly dependencyIndices: number[]
  linesOfCode: number
  outboundEdges: number
  inboundEdges: number
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readShard(dataDir: string, context: CanonicalReportContext, capability: string): ShardResult {
  const fileName = context.canonicalShards?.[capability]
  if (!fileName) return { tag: "absent" }
  const path = join(dataDir, fileName)
  if (!existsSync(path)) {
    return { tag: "invalid", message: `Could not read canonical ${capability} shard '${fileName}'.` }
  }
  try {
    return { tag: "present", fileName, value: JSON.parse(readFileSync(path, "utf-8")) as unknown }
  } catch {
    return { tag: "invalid", message: `Could not read canonical ${capability} shard '${fileName}'.` }
  }
}

function readArrayShard(
  dataDir: string,
  context: CanonicalReportContext,
  capability: string,
  key: string,
): ArrayShardResult {
  const shard = readShard(dataDir, context, capability)
  if (shard.tag !== "present") return shard
  if (!isRecord(shard.value) || !Array.isArray(shard.value[key])) {
    return { tag: "invalid", message: `Canonical ${capability} shard '${shard.fileName}' must contain a ${key} array.` }
  }
  if (!shard.value[key].every(isRecord)) {
    return {
      tag: "invalid",
      message: `Canonical ${capability} shard '${shard.fileName}' contains a malformed ${key} record.`,
    }
  }
  return { tag: "present", fileName: shard.fileName, records: shard.value[key] }
}

function componentIdentity(
  value: unknown,
  decompositionKey = "primary",
): { readonly id: string; readonly name: string; readonly decompositionKey: string } | undefined {
  if (typeof value !== "string") return undefined
  const raw = value.trim()
  if (!raw) return undefined
  if (raw.startsWith("component:")) {
    const parts = raw.split(":")
    const parsedDecomposition = parts[1]?.trim()
    const name = parts.slice(2).join(":").trim()
    if (!parsedDecomposition || !name) return undefined
    return { id: `component:${parsedDecomposition}:${name}`, name, decompositionKey: parsedDecomposition }
  }
  return { id: `component:${decompositionKey}:${raw}`, name: raw, decompositionKey }
}

function componentRecord(
  accumulator: ComponentAccumulator,
  source: { readonly filesMain?: string; readonly units?: string; readonly componentDependencies?: string },
): SnapshotEntityRecord {
  const shards: string[] = []
  const records: string[] = []
  if (source.filesMain && accumulator.fileIndices.length > 0) {
    shards.push(source.filesMain)
    records.push(...accumulator.fileIndices.map((index) => `files[index=${index}]`))
  }
  if (source.units && accumulator.unitIndices.length > 0) {
    shards.push(source.units)
    records.push(...accumulator.unitIndices.map((index) => `units[index=${index}]`))
  }
  if (source.componentDependencies && accumulator.dependencyIndices.length > 0) {
    shards.push(source.componentDependencies)
    records.push(...accumulator.dependencyIndices.map((index) => `dependencies[index=${index}]`))
  }
  return {
    id: accumulator.id,
    values: {
      name: accumulator.name,
      decompositionKey: accumulator.decompositionKey,
      files: accumulator.fileIndices.length,
      units: accumulator.unitIndices.length,
      linesOfCode: accumulator.linesOfCode,
      dependencyEdges: accumulator.dependencyIndices.length,
      inboundEdges: accumulator.inboundEdges,
      outboundEdges: accumulator.outboundEdges,
    },
    provenance: { shards, records },
  }
}

function readComponents(
  files: ArrayShardResult,
  units: ArrayShardResult,
  dependencies: ArrayShardResult,
): SnapshotEntityCollection | { readonly tag: "invalid"; readonly message: string } {
  const present = files.tag === "present" || units.tag === "present" || dependencies.tag === "present"
  if (!present) return { present: false, records: [] }

  const components = new Map<string, ComponentAccumulator>()
  const ensure = (identity: { readonly id: string; readonly name: string; readonly decompositionKey: string }) => {
    const existing = components.get(identity.id)
    if (existing) return existing
    const created: ComponentAccumulator = {
      id: identity.id,
      name: identity.name,
      decompositionKey: identity.decompositionKey,
      fileIndices: [],
      unitIndices: [],
      dependencyIndices: [],
      linesOfCode: 0,
      outboundEdges: 0,
      inboundEdges: 0,
    }
    components.set(identity.id, created)
    return created
  }

  if (files.tag === "present") {
    for (const [index, file] of files.records.entries()) {
      const names = file.components
      if (names !== undefined && !Array.isArray(names)) {
        return {
          tag: "invalid",
          message: `Canonical filesMain shard '${files.fileName}' contains malformed components.`,
        }
      }
      for (const name of Array.isArray(names) ? names : []) {
        const identity = componentIdentity(name)
        if (!identity) {
          return {
            tag: "invalid",
            message: `Canonical filesMain shard '${files.fileName}' contains a malformed component name.`,
          }
        }
        const component = ensure(identity)
        component.fileIndices.push(index)
        const linesOfCode = file.linesOfCode
        if (typeof linesOfCode === "number" && Number.isFinite(linesOfCode)) component.linesOfCode += linesOfCode
      }
    }
  }

  if (units.tag === "present") {
    for (const [index, unit] of units.records.entries()) {
      const names = unit.components
      if (names !== undefined && !Array.isArray(names)) {
        return { tag: "invalid", message: `Canonical units shard '${units.fileName}' contains malformed components.` }
      }
      for (const name of Array.isArray(names) ? names : []) {
        const identity = componentIdentity(name)
        if (!identity) {
          return {
            tag: "invalid",
            message: `Canonical units shard '${units.fileName}' contains a malformed component name.`,
          }
        }
        const component = ensure(identity)
        component.unitIndices.push(index)
      }
    }
  }

  if (dependencies.tag === "present") {
    for (const [index, dependency] of dependencies.records.entries()) {
      const decompositionKey =
        typeof dependency.decompositionKey === "string" && dependency.decompositionKey.trim()
          ? dependency.decompositionKey.trim()
          : "primary"
      const from = componentIdentity(dependency.fromComponentId ?? dependency.fromComponent, decompositionKey)
      const to = componentIdentity(dependency.toComponentId ?? dependency.toComponent, decompositionKey)
      if (!from || !to) {
        return {
          tag: "invalid",
          message: `Canonical componentDependencies shard '${dependencies.fileName}' contains a malformed dependency.`,
        }
      }
      const source = ensure(from)
      const target = ensure(to)
      source.dependencyIndices.push(index)
      target.dependencyIndices.push(index)
      source.outboundEdges += 1
      target.inboundEdges += 1
    }
  }

  const source = {
    ...(files.tag === "present" ? { filesMain: files.fileName } : {}),
    ...(units.tag === "present" ? { units: units.fileName } : {}),
    ...(dependencies.tag === "present" ? { componentDependencies: dependencies.fileName } : {}),
  }
  return {
    present: true,
    records: [...components.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((component) => componentRecord(component, source)),
  }
}

function readHotspots(
  dataDir: string,
  context: CanonicalReportContext,
): SnapshotEntityCollection | { readonly tag: "invalid"; readonly message: string } {
  const shard = readShard(dataDir, context, "hotspots")
  if (shard.tag === "absent") return { present: false, records: [] }
  if (shard.tag === "invalid") return shard
  if (!isRecord(shard.value)) {
    return { tag: "invalid", message: `Canonical hotspots shard '${shard.fileName}' must be an object.` }
  }

  const records: SnapshotEntityRecord[] = []
  for (const key of ["fileHotspots", "unitHotspots", "componentHotspots"] as const) {
    const values = shard.value[key]
    if (values !== undefined && !Array.isArray(values)) {
      return {
        tag: "invalid",
        message: `Canonical hotspots shard '${shard.fileName}' contains a malformed ${key} array.`,
      }
    }
    for (const [index, value] of (Array.isArray(values) ? values : []).entries()) {
      if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) {
        return {
          tag: "invalid",
          message: `Canonical hotspots shard '${shard.fileName}' contains a malformed ${key} record.`,
        }
      }
      records.push({
        id: value.id.trim(),
        values: value,
        provenance: { shards: [shard.fileName], records: [`${key}[index=${index}]`] },
      })
    }
  }
  return { present: true, records }
}

function readControls(
  dataDir: string,
  context: CanonicalReportContext,
): SnapshotEntityCollection | { readonly tag: "invalid"; readonly message: string } {
  const shard = readShard(dataDir, context, "controls")
  if (shard.tag === "absent") return { present: false, records: [] }
  if (shard.tag === "invalid") return shard
  if (!isRecord(shard.value) || !Array.isArray(shard.value.goals)) {
    return { tag: "invalid", message: `Canonical controls shard '${shard.fileName}' must contain a goals array.` }
  }

  const records: SnapshotEntityRecord[] = []
  for (const [goalIndex, goal] of shard.value.goals.entries()) {
    if (!isRecord(goal) || typeof goal.goal !== "string" || !Array.isArray(goal.controls)) {
      return { tag: "invalid", message: `Canonical controls shard '${shard.fileName}' contains a malformed goal.` }
    }
    for (const [controlIndex, control] of goal.controls.entries()) {
      if (!isRecord(control) || typeof control.metricId !== "string" || !control.metricId.trim()) {
        return { tag: "invalid", message: `Canonical controls shard '${shard.fileName}' contains a malformed control.` }
      }
      const goalName = goal.goal.trim()
      const metricId = control.metricId.trim()
      if (!goalName)
        return { tag: "invalid", message: `Canonical controls shard '${shard.fileName}' contains a malformed goal.` }
      records.push({
        id: `control:${goalName}:${metricId}`,
        values: { goal: goalName, ...control, metricId },
        provenance: {
          shards: [shard.fileName],
          records: [`goals[index=${goalIndex}].controls[index=${controlIndex}]`],
        },
      })
    }
  }
  return { present: true, records }
}

function readOwnership(
  dataDir: string,
  context: CanonicalReportContext,
): SnapshotEntityCollection | { readonly tag: "invalid"; readonly message: string } {
  const shard = readArrayShard(dataDir, context, "contributors", "contributors")
  if (shard.tag === "absent") return { present: false, records: [] }
  if (shard.tag === "invalid") return shard

  const records: SnapshotEntityRecord[] = []
  for (const [index, contributor] of shard.records.entries()) {
    const email = typeof contributor.email === "string" ? contributor.email.trim().toLowerCase() : ""
    const rawId = typeof contributor.id === "string" ? contributor.id.trim() : ""
    const id = rawId || (email ? `contributor:${email}` : "")
    if (!id) {
      return {
        tag: "invalid",
        message: `Canonical contributors shard '${shard.fileName}' contains a malformed contributor.`,
      }
    }
    records.push({
      id,
      values: contributor,
      provenance: { shards: [shard.fileName], records: [`contributors[index=${index}]`] },
    })
  }
  return { present: true, records }
}

export function readSnapshotEntities(dataDir: string, context: CanonicalReportContext): SnapshotEntityReadResult {
  const files = readArrayShard(dataDir, context, "filesMain", "files")
  if (files.tag === "invalid") return files
  const units = readArrayShard(dataDir, context, "units", "units")
  if (units.tag === "invalid") return units
  const dependencies = readArrayShard(dataDir, context, "componentDependencies", "dependencies")
  if (dependencies.tag === "invalid") return dependencies

  const components = readComponents(files, units, dependencies)
  if ("tag" in components) return components
  const hotspots = readHotspots(dataDir, context)
  if ("tag" in hotspots) return hotspots
  const controls = readControls(dataDir, context)
  if ("tag" in controls) return controls
  const ownership = readOwnership(dataDir, context)
  if ("tag" in ownership) return ownership

  return {
    tag: "ready",
    entities: { components, hotspots, controls, ownership },
  }
}
