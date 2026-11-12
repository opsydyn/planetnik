import { join } from "node:path"
import type {
  CanonicalReportContext,
  DatasetCatalog,
  DatasetDescriptor,
  PortfolioActionDatasetInput,
  PortfolioActionEvidence,
  PortfolioActionQueueCoverage,
  PortfolioActionSignal,
  PortfolioActionSignalDomain,
  PortfolioActionSourceRecord,
  SnapshotEntityRecord,
} from "@planetnik/common"
import {
  adaptPortfolioActionSourceRecord,
  adaptPortfolioActionTrendTargets,
  emptyPortfolioActionCoverage,
} from "@planetnik/common"
import type { ActionQueueArtifactFilterOptions } from "./actionQueueArtifacts.js"
import {
  type DatasetActionQueueSourceContext,
  historyInputs,
  isRecord,
  sourceId,
  sourceRecord,
  text,
} from "./actionQueueSource.js"
import { readDatasetCurrentSnapshot } from "./snapshotHistory.js"
import { streamJsonArrayObjects } from "./streamJsonArray.js"

type ActionQueueStreamingSourceMetadata = {
  readonly asOf: string
  readonly coverage: PortfolioActionQueueCoverage
  readonly filterOptions: ActionQueueArtifactFilterOptions
}

export type ActionQueueStreamingSignalRow = {
  readonly key: string
  readonly repositoryTitle: string
  readonly signal: PortfolioActionSignal
}

export type ActionQueueStreamingSource = {
  readonly sourceIds: readonly string[]
  readonly metadata: ActionQueueStreamingSourceMetadata
  readonly streamSignals: (emit: (row: ActionQueueStreamingSignalRow) => void) => Promise<void>
}

type StreamingDataset = {
  readonly dataset: DatasetDescriptor
  readonly dataDir: string
  readonly context: CanonicalReportContext
  readonly source: DatasetActionQueueSourceContext
  input: PortfolioActionDatasetInput
}

type DomainState = {
  status: "present" | "missing" | "invalid"
  signalCount: number
  message?: string
  diagnostics: PortfolioActionQueueCoverage["diagnostics"][number][]
}

type MutableCoverage = {
  datasets: {
    included: { datasetId: string; repositoryId: string }[]
    planned: { datasetId: string; reason: string }[]
    excluded: { datasetId: string; reason: string }[]
    unavailable: { datasetId: string; reason: string }[]
  }
  domains: Record<
    PortfolioActionSignalDomain,
    {
      status: "present" | "missing" | "invalid"
      datasetCount: number
      signalCount: number
      message?: string
    }
  >
  diagnostics: PortfolioActionQueueCoverage["diagnostics"][number][]
}

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

const domains: readonly PortfolioActionSignalDomain[] = [
  "hotspot",
  "control",
  "security",
  "impact",
  "coupling",
  "ownership",
  "trend",
]
const filterDomains: readonly PortfolioActionSignalDomain[] = [
  "control",
  "coupling",
  "hotspot",
  "impact",
  "ownership",
  "security",
  "trend",
]
const priorities = ["critical", "high", "medium", "low", "unrated"] as const

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function hasOwnershipReason(value: Record<string, unknown>): boolean {
  const reasons =
    typeof value.reasons === "string"
      ? [value.reasons]
      : Array.isArray(value.reasons)
        ? value.reasons.filter((reason): reason is string => typeof reason === "string")
        : []
  return reasons.some((reason) => /knowledge|ownership|backup|contributor/i.test(reason))
}

function sourceRecordFromRaw(
  source: DatasetActionQueueSourceContext,
  domain: Exclude<PortfolioActionSignalDomain, "trend">,
  fileName: string,
  selector: string,
  value: Record<string, unknown>,
  id: string | undefined = text(value.id),
): PortfolioActionSourceRecord | null {
  if (!id) return null
  return sourceRecord(source, { id, values: value, provenance: { shards: [fileName], records: [selector] } }, domain)
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

function makeDomainState(status: DomainState["status"] = "missing", message?: string): DomainState {
  return { status, signalCount: 0, ...(message ? { message } : {}), diagnostics: [] }
}

function invalidState(state: DomainState, datasetId: string, reason: string): void {
  state.status = "invalid"
  state.signalCount = 0
  state.message = reason
  state.diagnostics.push({ datasetId, severity: "error", reason })
}

function emitAdapted(
  input: PortfolioActionDatasetInput,
  domain: Exclude<PortfolioActionSignalDomain, "trend">,
  record: PortfolioActionSourceRecord | null,
  emit: (signal: PortfolioActionSignal) => void,
  state: DomainState,
  extraEvidence: readonly PortfolioActionEvidence[] = [],
): void {
  if (state.status === "invalid") return
  if (!record) {
    invalidState(state, input.datasetId, `${domain} contains a malformed or unroutable source record.`)
    return
  }
  const adaptation = adaptPortfolioActionSourceRecord(input, domain, record, extraEvidence)
  if (adaptation.tag === "invalid") {
    invalidState(state, input.datasetId, adaptation.diagnostic.reason)
    return
  }
  if (adaptation.tag === "skipped") return
  state.status = "present"
  state.signalCount += 1
  emit(adaptation.signal)
}

async function streamArray(
  path: string,
  key: string,
  callback: (entry: { readonly index: number; readonly value: Record<string, unknown> }) => void | Promise<void>,
): Promise<"present" | "missing"> {
  try {
    for await (const entry of streamJsonArrayObjects(path, key)) await callback(entry)
    return "present"
  } catch (error) {
    if (errorMessage(error) === `array '${key}' was not found in the JSON document`) return "missing"
    throw error
  }
}

async function streamHotspots(
  dataset: StreamingDataset,
  input: PortfolioActionDatasetInput,
  states: Map<PortfolioActionSignalDomain, DomainState>,
  emit: (signal: PortfolioActionSignal) => void,
  componentHotspots: Map<string, SnapshotEntityRecord>,
): Promise<void> {
  const fileName = dataset.context.canonicalShards?.hotspots
  const hotspotState = states.get("hotspot")!
  const ownershipState = states.get("ownership")!
  const couplingState = states.get("coupling")!
  if (!fileName) return
  const path = join(dataset.dataDir, fileName)
  const seen = new Set<string>()
  let found = false
  for (const key of ["fileHotspots", "unitHotspots", "componentHotspots"] as const) {
    try {
      const presence = await streamArray(path, key, async ({ index, value }) => {
        found = true
        const id = text(value.id)
        if (!id) {
          invalidState(
            hotspotState,
            input.datasetId,
            `${fileName} contains a malformed ${key} record at index ${index}.`,
          )
          invalidState(
            ownershipState,
            input.datasetId,
            `${fileName} contains a malformed ${key} record at index ${index}.`,
          )
          invalidState(
            couplingState,
            input.datasetId,
            `${fileName} contains a malformed ${key} record at index ${index}.`,
          )
          return
        }
        if (seen.has(id)) {
          invalidState(hotspotState, input.datasetId, `hotspot domain has duplicate source record id ${id}`)
          invalidState(ownershipState, input.datasetId, `ownership domain has duplicate source record id ${id}`)
          invalidState(couplingState, input.datasetId, `coupling domain has duplicate source record id ${id}`)
          return
        }
        seen.add(id)
        const rawRecord: SnapshotEntityRecord = {
          id,
          values: value,
          provenance: { shards: [fileName], records: [`${key}[index=${index}]`] },
        }
        const record = sourceRecord(dataset.source, rawRecord, "hotspot")
        if (record) {
          if (value.kind === "component") componentHotspots.set(record.targetId, rawRecord)
          emitAdapted(input, "hotspot", record, emit, hotspotState)
        } else {
          invalidState(hotspotState, input.datasetId, `${key} record '${id}' has invalid evidence selectors or route.`)
        }
        if (hasOwnershipReason(value)) {
          const ownershipRecord = sourceRecordFromRaw(
            dataset.source,
            "ownership",
            fileName,
            `${key}[index=${index}]`,
            value,
            id,
          )
          emitAdapted(input, "ownership", ownershipRecord, emit, ownershipState)
        }
      })
      if (presence === "present") found = true
    } catch (error) {
      invalidState(hotspotState, input.datasetId, `${fileName} is unreadable or malformed JSON: ${errorMessage(error)}`)
      invalidState(
        ownershipState,
        input.datasetId,
        `${fileName} is unreadable or malformed JSON: ${errorMessage(error)}`,
      )
      invalidState(
        couplingState,
        input.datasetId,
        `${fileName} is unreadable or malformed JSON: ${errorMessage(error)}`,
      )
      return
    }
  }
  if (!found) {
    const reason = `${fileName} must contain a documented hotspot array.`
    invalidState(hotspotState, input.datasetId, reason)
    invalidState(ownershipState, input.datasetId, reason)
    invalidState(couplingState, input.datasetId, reason)
  } else {
    if (hotspotState.status === "missing") hotspotState.status = "present"
    if (ownershipState.status === "missing") ownershipState.status = "present"
  }
}

async function streamControls(
  dataset: StreamingDataset,
  input: PortfolioActionDatasetInput,
  state: DomainState,
  emit: (signal: PortfolioActionSignal) => void,
): Promise<void> {
  const fileName = dataset.context.canonicalShards?.controls
  if (!fileName) return
  try {
    const presence = await streamArray(
      join(dataset.dataDir, fileName),
      "goals",
      async ({ index: goalIndex, value: goal }) => {
        const goalName = text(goal.goal)
        const controls = goal.controls
        if (!goalName || !Array.isArray(controls)) {
          invalidState(state, input.datasetId, `Canonical controls shard '${fileName}' contains a malformed goal.`)
          return
        }
        for (const [controlIndex, raw] of controls.entries()) {
          if (!isRecord(raw) || !text(raw.metricId)) {
            invalidState(state, input.datasetId, `Canonical controls shard '${fileName}' contains a malformed control.`)
            continue
          }
          const metricId = text(raw.metricId)!
          const values = { goal: goalName, ...raw, metricId }
          const record = sourceRecordFromRaw(
            dataset.source,
            "control",
            fileName,
            `goals[index=${goalIndex}].controls[index=${controlIndex}]`,
            values,
            `control:${goalName}:${metricId}`,
          )
          emitAdapted(input, "control", record, emit, state)
        }
      },
    )
    if (presence === "missing")
      invalidState(state, input.datasetId, `Canonical controls shard '${fileName}' must contain a goals array.`)
    else if (state.status === "missing") state.status = "present"
  } catch (error) {
    invalidState(
      state,
      input.datasetId,
      `Canonical controls shard '${fileName}' is unreadable or malformed JSON: ${errorMessage(error)}`,
    )
  }
}

async function streamArrayDomain(
  dataset: StreamingDataset,
  input: PortfolioActionDatasetInput,
  domain: "impact" | "security",
  state: DomainState,
  emit: (signal: PortfolioActionSignal) => void,
): Promise<void> {
  const capability =
    domain === "security" ? (dataset.context.canonicalShards?.security ? "security" : "alerts") : "impact"
  const fileName = dataset.context.canonicalShards?.[capability]
  if (!fileName) return
  const key = domain === "impact" ? "impact_opportunities" : "alerts"
  const seen = new Set<string>()
  try {
    const presence = await streamArray(join(dataset.dataDir, fileName), key, async ({ index, value }) => {
      const id = text(value.id)
      if (!id) {
        invalidState(state, input.datasetId, `${fileName} has a malformed ${key} record at index ${index}.`)
        return
      }
      if (seen.has(id)) {
        invalidState(state, input.datasetId, `${domain} domain has duplicate source record id ${id}`)
        return
      }
      seen.add(id)
      const record = sourceRecordFromRaw(dataset.source, domain, fileName, `${key}[index=${index}]`, value, id)
      emitAdapted(input, domain, record, emit, state)
    })
    if (presence === "missing") invalidState(state, input.datasetId, `${fileName} must contain a ${key} array.`)
    else if (state.status === "missing") state.status = "present"
  } catch (error) {
    invalidState(state, input.datasetId, `${fileName} is unreadable or malformed JSON: ${errorMessage(error)}`)
  }
}

function createComponentMap(): Map<string, ComponentAccumulator> {
  return new Map()
}

function ensureComponent(
  components: Map<string, ComponentAccumulator>,
  identity: { readonly id: string; readonly name: string; readonly decompositionKey: string },
): ComponentAccumulator {
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

async function streamComponents(
  dataset: StreamingDataset,
  input: PortfolioActionDatasetInput,
  state: DomainState,
  componentHotspots: ReadonlyMap<string, SnapshotEntityRecord>,
): Promise<readonly PortfolioActionSourceRecord[]> {
  const filesName = dataset.context.canonicalShards?.filesMain
  const unitsName = dataset.context.canonicalShards?.units
  const dependenciesName = dataset.context.canonicalShards?.componentDependencies
  if (!filesName && !unitsName && !dependenciesName) {
    if ([...componentHotspots.values()].some((record) => isRecord(record.values.dimensions))) state.status = "present"
    return []
  }

  const components = createComponentMap()
  let invalid = false
  const fileIds = new Set<string>()
  const unitIds = new Set<string>()
  const dependencyIds = new Set<string>()
  const markInvalid = (reason: string) => {
    invalid = true
    invalidState(state, input.datasetId, reason)
  }
  if (filesName) {
    try {
      const presence = await streamArray(join(dataset.dataDir, filesName), "files", async ({ index, value }) => {
        const rawId = text(value.id)
        if (rawId && fileIds.has(rawId)) markInvalid(`filesMain contains duplicate stable identity '${rawId}'.`)
        if (rawId) fileIds.add(rawId)
        const names = value.components
        if (names !== undefined && !Array.isArray(names)) {
          markInvalid(`Canonical filesMain shard '${filesName}' contains malformed components.`)
          return
        }
        for (const name of Array.isArray(names) ? names : []) {
          const identity = componentIdentity(name)
          if (!identity) {
            markInvalid(`Canonical filesMain shard '${filesName}' contains a malformed component name.`)
            continue
          }
          const component = ensureComponent(components, identity)
          component.fileIndices.push(index)
          if (typeof value.linesOfCode === "number" && Number.isFinite(value.linesOfCode))
            component.linesOfCode += value.linesOfCode
        }
      })
      if (presence === "missing") markInvalid(`Canonical filesMain shard '${filesName}' must contain a files array.`)
    } catch (error) {
      markInvalid(`Canonical filesMain shard '${filesName}' is unreadable or malformed JSON: ${errorMessage(error)}`)
    }
  }
  if (unitsName) {
    try {
      const presence = await streamArray(join(dataset.dataDir, unitsName), "units", async ({ index, value }) => {
        const rawId = text(value.id)
        if (rawId && unitIds.has(rawId)) markInvalid(`units contains duplicate stable identity '${rawId}'.`)
        if (rawId) unitIds.add(rawId)
        const names = value.components
        if (names !== undefined && !Array.isArray(names)) {
          markInvalid(`Canonical units shard '${unitsName}' contains malformed components.`)
          return
        }
        for (const name of Array.isArray(names) ? names : []) {
          const identity = componentIdentity(name)
          if (!identity) {
            markInvalid(`Canonical units shard '${unitsName}' contains a malformed component name.`)
            continue
          }
          ensureComponent(components, identity).unitIndices.push(index)
        }
      })
      if (presence === "missing") markInvalid(`Canonical units shard '${unitsName}' must contain a units array.`)
    } catch (error) {
      markInvalid(`Canonical units shard '${unitsName}' is unreadable or malformed JSON: ${errorMessage(error)}`)
    }
  }
  if (dependenciesName) {
    try {
      const presence = await streamArray(
        join(dataset.dataDir, dependenciesName),
        "dependencies",
        async ({ index, value }) => {
          const rawId = text(value.id)
          if (rawId && dependencyIds.has(rawId))
            markInvalid(`componentDependencies contains duplicate stable identity '${rawId}'.`)
          if (rawId) dependencyIds.add(rawId)
          const decompositionKey = text(value.decompositionKey) ?? "primary"
          const from = componentIdentity(value.fromComponentId ?? value.fromComponent, decompositionKey)
          const to = componentIdentity(value.toComponentId ?? value.toComponent, decompositionKey)
          if (!from || !to) {
            markInvalid(`Canonical componentDependencies shard '${dependenciesName}' contains a malformed dependency.`)
            return
          }
          const source = ensureComponent(components, from)
          const target = ensureComponent(components, to)
          source.dependencyIndices.push(index)
          target.dependencyIndices.push(index)
          source.outboundEdges += 1
          target.inboundEdges += 1
        },
      )
      if (presence === "missing")
        markInvalid(`Canonical componentDependencies shard '${dependenciesName}' must contain a dependencies array.`)
    } catch (error) {
      markInvalid(
        `Canonical componentDependencies shard '${dependenciesName}' is unreadable or malformed JSON: ${errorMessage(error)}`,
      )
    }
  }
  if (invalid) return []
  const source = {
    ...(filesName ? { filesMain: filesName } : {}),
    ...(unitsName ? { units: unitsName } : {}),
    ...(dependenciesName ? { componentDependencies: dependenciesName } : {}),
  }
  const records = [...components.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((component) => {
      const raw = componentRecord(component, source)
      const normalized = sourceRecord(dataset.source, raw, "coupling")
      if (!normalized) {
        invalidState(
          state,
          input.datasetId,
          `coupling record '${raw.id}' has invalid, duplicate, or unroutable evidence selectors.`,
        )
        return []
      }
      const hotspotRaw = componentHotspots.get(raw.id)
      if (!hotspotRaw) return [{ ...normalized, values: { ...normalized.values, kind: "component" } }]
      const hotspot = sourceRecord(dataset.source, hotspotRaw, "coupling")
      if (!hotspot) return [normalized]
      // Preserve the component and hotspot evidence snapshots separately. In
      // particular, do not re-normalize the merged values: that would make
      // every component anchor observe hotspot-only fields and drift from the
      // batch coupling adapter.
      return [
        {
          ...normalized,
          values: { ...normalized.values, ...hotspot.values, kind: "component" },
          evidence: [...normalized.evidence, ...hotspot.evidence],
          ...(hotspot.team ? { team: hotspot.team } : {}),
        },
      ]
    })
  if (state.status !== "invalid") state.status = "present"
  return records
}

function discoverDatasets(options: { readonly catalog: DatasetCatalog; readonly datasetsRoot?: string }): {
  readonly datasets: readonly StreamingDataset[]
  readonly sourceIds: readonly string[]
  readonly coverage: MutableCoverage
  readonly asOf: string
} {
  const coverage = emptyPortfolioActionCoverage() as unknown as MutableCoverage
  const sorted = [...options.catalog.datasets].sort((left, right) => left.slug.localeCompare(right.slug))
  const duplicateIds = new Set(
    sorted
      .filter((dataset, index, all) => all.findIndex((candidate) => candidate.id === dataset.id) !== index)
      .map((dataset) => dataset.id),
  )
  const datasets: StreamingDataset[] = []
  const sourceIds = sorted.map(sourceId)
  let asOf = ""
  for (const dataset of sorted) {
    if (duplicateIds.has(dataset.id)) {
      const reason = `duplicate datasetId ${dataset.id}`
      if (!coverage.datasets.unavailable.some((entry) => entry.datasetId === dataset.slug)) {
        coverage.datasets.unavailable.push({ datasetId: dataset.slug, reason })
        coverage.diagnostics.push({ datasetId: dataset.slug, severity: "error", reason })
      }
      continue
    }
    if (dataset.availability === "planned") {
      coverage.datasets.planned.push({ datasetId: dataset.slug, reason: "dataset is planned" })
      continue
    }
    if (dataset.mode !== "single_repository") {
      coverage.datasets.excluded.push({ datasetId: dataset.slug, reason: "dataset is not single_repository" })
      continue
    }
    if (dataset.availability === "invalid") {
      const reason = "dataset availability is invalid"
      coverage.datasets.unavailable.push({ datasetId: dataset.slug, reason })
      coverage.diagnostics.push({ datasetId: dataset.slug, severity: "error", reason })
      continue
    }
    const current = readDatasetCurrentSnapshot(dataset.id, {
      datasetsRoot: options.datasetsRoot,
      includeEntities: false,
    })
    if (current.tag !== "ready" || current.snapshot.context.mode !== "single_repository") {
      const reason = current.tag === "ready" ? "dataset is not single_repository" : "dataset availability is invalid"
      if (current.tag === "ready") coverage.datasets.excluded.push({ datasetId: dataset.slug, reason })
      else {
        coverage.datasets.unavailable.push({ datasetId: dataset.slug, reason })
        coverage.diagnostics.push({ datasetId: dataset.slug, severity: "error", reason })
      }
      continue
    }
    const { snapshot } = current
    const context = snapshot.context
    const repositoryId = context.repositoryId!
    const input: PortfolioActionDatasetInput = {
      datasetId: dataset.slug,
      repositoryId,
      repositoryTitle: dataset.title,
      mode: "single_repository",
      availability: dataset.availability,
      current: { snapshotId: context.snapshotId!, generatedAt: context.generatedAt!, domains: {} },
      trendInputs: [],
      historyStatus: "missing",
    }
    datasets.push({ dataset, dataDir: snapshot.dataDir, context, source: { dataset, context }, input })
    coverage.datasets.included.push({ datasetId: dataset.slug, repositoryId })
    if (!asOf || Date.parse(context.generatedAt!) > Date.parse(asOf)) asOf = context.generatedAt!
  }
  return { datasets, sourceIds, coverage, asOf }
}

function initialDomainStates(dataset: StreamingDataset): Map<PortfolioActionSignalDomain, DomainState> {
  const shards = dataset.context.canonicalShards ?? {}
  const states = new Map<PortfolioActionSignalDomain, DomainState>(domains.map((domain) => [domain, makeDomainState()]))
  if (shards.hotspots) {
    states.get("hotspot")!.status = "present"
    states.get("ownership")!.status = "present"
  }
  if (shards.controls) states.get("control")!.status = "present"
  if (shards.filesMain || shards.units || shards.componentDependencies) states.get("coupling")!.status = "present"
  if (shards.impact) states.get("impact")!.status = "present"
  if (shards.security || shards.alerts) states.get("security")!.status = "present"
  return states
}

async function streamDataset(
  dataset: StreamingDataset,
  datasetsRoot: string | undefined,
  emitRow: (row: ActionQueueStreamingSignalRow) => void,
  coverage: MutableCoverage,
  filterOptions: {
    repositories: Map<string, { id: string; label: string }>
    teams: Map<string, { id: string; label: string }>
    domains: Set<PortfolioActionSignalDomain>
  },
): Promise<void> {
  const states = initialDomainStates(dataset)
  // Keep only the stable target IDs needed to scope historical trend signals;
  // retaining every normalized signal here would defeat the bounded reader.
  const currentTargetIds = new Set<string>()
  const componentHotspots = new Map<string, SnapshotEntityRecord>()
  const emit = (signal: PortfolioActionSignal) => {
    if (signal.domain !== "trend") currentTargetIds.add(signal.targetId)
    emitRow({ key: `${signal.repositoryId}\u0000${signal.targetId}`, repositoryTitle: dataset.dataset.title, signal })
    filterOptions.repositories.set(signal.repositoryId, { id: signal.repositoryId, label: dataset.dataset.title })
    filterOptions.teams.set(signal.team.id, signal.team)
    filterOptions.domains.add(signal.domain)
  }

  await streamHotspots(dataset, dataset.input, states, emit, componentHotspots)
  await streamControls(dataset, dataset.input, states.get("control")!, emit)
  await streamArrayDomain(dataset, dataset.input, "impact", states.get("impact")!, emit)
  await streamArrayDomain(dataset, dataset.input, "security", states.get("security")!, emit)

  const couplingRecords = await streamComponents(dataset, dataset.input, states.get("coupling")!, componentHotspots)
  const supportingEvidence = new Map<string, PortfolioActionEvidence[]>()
  for (const record of couplingRecords) {
    emitAdapted(
      dataset.input,
      "coupling",
      record,
      emit,
      states.get("coupling")!,
      supportingEvidence.get(record.targetId) ?? [],
    )
  }

  const history = historyInputs(dataset.source, { datasetsRoot })
  dataset.input = {
    ...dataset.input,
    historyStatus: history.historyStatus,
    trendInputs: history.trendInputs,
    current: { ...dataset.input.current!, domains: {} },
  }
  const trendSignals = adaptPortfolioActionTrendTargets(dataset.input, currentTargetIds)
  const trendState = states.get("trend")!
  if (
    history.domain.status === "invalid" ||
    history.historyStatus === "invalid" ||
    history.historyStatus === "incompatible"
  ) {
    trendState.status = "invalid"
    trendState.message = history.domain.message
    trendState.diagnostics.push({
      datasetId: dataset.input.datasetId,
      severity: "error",
      reason: `trend domain is invalid${history.domain.message ? `: ${history.domain.message}` : ""}`,
    })
  } else if (history.historyStatus === "compatible") {
    trendState.status = "present"
    for (const signal of trendSignals) emit(signal)
    trendState.signalCount = trendSignals.length
  } else {
    trendState.status = "missing"
  }

  // Merge this dataset's states into the source-level coverage using the same
  // invalid > present > missing precedence as the batch queue builder.
  for (const domain of domains) {
    const state = states.get(domain)!
    const existing = coverage.domains[domain]
    if (state.status === "invalid" || existing.status === "invalid") existing.status = "invalid"
    else if (state.status === "present" || existing.status === "present") existing.status = "present"
    existing.datasetCount += state.status === "missing" ? 0 : 1
    existing.signalCount += state.signalCount
    if (state.message) existing.message = existing.message ? `${existing.message}; ${state.message}` : state.message
    coverage.diagnostics = [...coverage.diagnostics, ...state.diagnostics]
  }
}

export function createStreamingActionQueueSource(options: {
  readonly catalog: DatasetCatalog
  readonly datasetsRoot?: string
}): ActionQueueStreamingSource {
  const discovered = discoverDatasets(options)
  const coverage = discovered.coverage
  const filterOptions = {
    repositories: new Map<string, { id: string; label: string }>(),
    teams: new Map<string, { id: string; label: string }>(),
    domains: new Set<PortfolioActionSignalDomain>(),
  }
  let metadata: ActionQueueStreamingSourceMetadata = {
    asOf: discovered.asOf,
    coverage,
    filterOptions: { repositories: [], teams: [], priorities: [...priorities], domains: [] },
  }
  let streamed = false
  const source: ActionQueueStreamingSource = {
    sourceIds: discovered.sourceIds,
    get metadata() {
      return metadata
    },
    streamSignals: async (emit) => {
      if (streamed) throw new Error("streamSignals may only be called once per materialization.")
      streamed = true
      for (const dataset of discovered.datasets)
        await streamDataset(dataset, options.datasetsRoot, (row) => emit(row), coverage, filterOptions)
      const mergedDomains = coverage.domains as Record<
        PortfolioActionSignalDomain,
        PortfolioActionQueueCoverage["domains"][PortfolioActionSignalDomain]
      >
      // Empty sources retain the canonical missing state from empty coverage.
      for (const domain of domains)
        if (!mergedDomains[domain]) mergedDomains[domain] = { status: "missing", datasetCount: 0, signalCount: 0 }
      metadata = {
        asOf: discovered.asOf,
        coverage,
        filterOptions: {
          repositories: [...filterOptions.repositories.values()].sort((left, right) => left.id.localeCompare(right.id)),
          teams: [...filterOptions.teams.values()].sort(
            (left, right) => left.id.localeCompare(right.id) || left.label.localeCompare(right.label),
          ),
          priorities: [...priorities],
          domains: filterDomains.filter((domain) => filterOptions.domains.has(domain)),
        },
      }
    },
  }
  return source
}
