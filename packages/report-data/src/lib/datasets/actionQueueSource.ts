import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  buildPortfolioActionQueueWithStats,
  type CanonicalReportContext,
  type DatasetCatalog,
  type DatasetDescriptor,
  type PortfolioActionDatasetInput,
  type PortfolioActionDomainInput,
  type PortfolioActionEvidence,
  type PortfolioActionPriorityBand,
  type PortfolioActionQueue,
  type PortfolioActionSignalDomain,
  type PortfolioActionSourceRecord,
  type PortfolioActionTrendInput,
  type PortfolioActionWindow,
  type SnapshotEntityCollection,
  type SnapshotEntityRecord,
} from "@planetnik/common"
import { route } from "../route.js"
import { getDatasetViewPath } from "./explore.js"
import { normaliseEvidencePath, readDatasetReport } from "./reportReader.js"
import { readDatasetCurrentSnapshot, readDatasetSnapshotHistory } from "./snapshotHistory.js"

export type DatasetActionQueueModel = {
  readonly queuesByWindow: Readonly<Record<PortfolioActionWindow, PortfolioActionQueue>>
  readonly totalItemsByWindow: Readonly<Record<PortfolioActionWindow, number>>
  readonly truncatedByWindow: Readonly<Record<PortfolioActionWindow, boolean>>
  readonly maxItemsPerWindow?: number
  readonly filterOptions: {
    readonly repositories: readonly { readonly id: string; readonly label: string }[]
    readonly teams: readonly { readonly id: string; readonly label: string }[]
    readonly priorities: readonly PortfolioActionPriorityBand[]
    readonly domains: readonly PortfolioActionSignalDomain[]
  }
}

export type Values = Readonly<Record<string, unknown>>
export type DatasetActionQueueSourceContext = {
  readonly dataset: DatasetDescriptor
  readonly context: CanonicalReportContext
}
type Source = DatasetActionQueueSourceContext
const windows: readonly PortfolioActionWindow[] = ["current", "latest-compatible", "7d", "30d", "90d"]
export const STATIC_ACTION_QUEUE_ITEM_LIMIT = 250
const domains: readonly PortfolioActionSignalDomain[] = [
  "hotspot",
  "control",
  "security",
  "impact",
  "coupling",
  "ownership",
  "trend",
]
const priorities: readonly PortfolioActionPriorityBand[] = ["critical", "high", "medium", "low", "unrated"]
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
export const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined
const missing = (message: string): PortfolioActionDomainInput => ({ status: "missing", records: [], message })
const invalid = (message: string): PortfolioActionDomainInput => ({ status: "invalid", records: [], message })

export function evidencePath(source: Source, values: Values): string | null {
  const raw = values.route
  if (raw !== undefined && typeof raw !== "string") return null
  if (typeof raw === "string") {
    // Reject traversal before normalisation; never turn unsafe evidence into an overview link.
    let decoded: string
    try {
      decoded = decodeURIComponent(raw)
    } catch {
      return null
    }
    if (
      decoded.includes("\\") ||
      decoded.includes("\0") ||
      decoded.split(/[?#]/u, 1)[0]!.split("/").includes("..") ||
      /^\s*(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(decoded)
    )
      return null
    const path = normaliseEvidencePath(raw)
    if (path) return `/datasets/${source.dataset.slug}/${path}`
  }
  return getDatasetViewPath(source.dataset, "overview")
}

export function observed(values: Values): PortfolioActionEvidence["observed"] {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) =>
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)),
    ),
  ) as PortfolioActionEvidence["observed"]
}

export function expanded(values: Values): Values {
  return { ...(isRecord(values.dimensions) ? values.dimensions : {}), ...values }
}

export function label(record: SnapshotEntityRecord): string {
  return text(record.values.name) ?? text(record.values.targetLabel) ?? text(record.values.metricId) ?? record.id
}

// Entity provenance contains shard and selector lists, not a Cartesian product.
// Resolve each selector through the validated capability map to retain exact pairs.
export function anchors(
  source: Source,
  record: SnapshotEntityRecord,
  domain: PortfolioActionSignalDomain,
): readonly PortfolioActionEvidence[] | null {
  const href = evidencePath(source, record.values)
  if (!href) return null
  const selectorCapabilities: Readonly<Record<string, string>> = {
    files: "filesMain",
    units: "units",
    dependencies: "componentDependencies",
    fileHotspots: "hotspots",
    unitHotspots: "hotspots",
    componentHotspots: "hotspots",
    goals: "controls",
    contributors: "contributors",
    impact_opportunities: "impact",
    alerts: source.context.canonicalShards?.security ? "security" : "alerts",
  }
  const result: PortfolioActionEvidence[] = []
  const seen = new Set<string>()
  for (const selector of record.provenance.records) {
    const key = selector.split("[", 1)[0]!
    const capability = selectorCapabilities[key]
    const shard = capability ? source.context.canonicalShards?.[capability] : undefined
    if (!shard || !record.provenance.shards.includes(shard) || seen.has(`${shard}\0${selector}`)) return null
    seen.add(`${shard}\0${selector}`)
    result.push({
      datasetId: source.dataset.slug,
      repositoryId: source.context.repositoryId!,
      snapshotId: source.context.snapshotId!,
      generatedAt: source.context.generatedAt!,
      domain,
      shard,
      record: selector,
      href,
      label: label(record),
      observed: observed(expanded(record.values)),
    })
  }
  return result.length ? result : null
}

export function sourceRecord(
  source: Source,
  record: SnapshotEntityRecord,
  domain: PortfolioActionSignalDomain,
): PortfolioActionSourceRecord | null {
  const evidence = anchors(source, record, domain)
  if (!evidence) return null
  const team = record.values.team
  return {
    id: `${domain}:${record.id}`,
    targetId: text(record.values.targetId) ?? record.id,
    targetLabel: label(record),
    observedAt: text(record.values.observedAt) ?? source.context.generatedAt!,
    values: expanded(record.values),
    evidence,
    ...(isRecord(team) && text(team.id) && text(team.label)
      ? { team: { id: text(team.id)!, label: text(team.label)! } }
      : {}),
  }
}

function entityDomain(
  source: Source,
  collection: SnapshotEntityCollection | undefined,
  domain: PortfolioActionSignalDomain,
): PortfolioActionDomainInput {
  if (!collection?.present) return missing(`${domain} capability is not declared.`)
  const ids = new Set<string>()
  const records: PortfolioActionSourceRecord[] = []
  for (const entity of collection.records) {
    if (ids.has(entity.id)) return invalid(`${domain} contains duplicate stable identity '${entity.id}'.`)
    ids.add(entity.id)
    const record = sourceRecord(source, entity, domain)
    if (!record)
      return invalid(`${domain} record '${entity.id}' has invalid, duplicate, or unroutable evidence selectors.`)
    records.push(record)
  }
  return { status: "present", records }
}

function readArrayDomain(source: Source, dataDir: string, domain: "impact" | "security"): PortfolioActionDomainInput {
  const capability =
    domain === "security" ? (source.context.canonicalShards?.security ? "security" : "alerts") : "impact"
  const file = source.context.canonicalShards?.[capability]
  if (!file) return missing(`${domain} capability is not declared.`)
  const key = domain === "impact" ? "impact_opportunities" : "alerts"
  try {
    // Source.context came from readDatasetCurrentSnapshot's strict v2 validation.
    const raw: unknown = JSON.parse(readFileSync(join(dataDir, file), "utf-8"))
    if (!isRecord(raw) || !Array.isArray(raw[key])) return invalid(`${file} must contain a ${key} array.`)
    const records: SnapshotEntityRecord[] = []
    for (const [index, value] of raw[key].entries()) {
      if (!isRecord(value) || !text(value.id))
        return invalid(`${file} has a malformed ${key} record at index ${index}.`)
      records.push({
        id: text(value.id)!,
        values: value,
        provenance: { shards: [file], records: [`${key}[index=${index}]`] },
      })
    }
    return entityDomain(source, { present: true, records }, domain)
  } catch {
    return invalid(`${file} is unreadable or malformed JSON.`)
  }
}

function hotspotShapeProblem(source: Source, dataDir: string): PortfolioActionDomainInput | undefined {
  const file = source.context.canonicalShards?.hotspots
  if (!file) return undefined
  try {
    const raw: unknown = JSON.parse(readFileSync(join(dataDir, file), "utf-8"))
    if (!isRecord(raw) || !["fileHotspots", "unitHotspots", "componentHotspots"].some((key) => Array.isArray(raw[key])))
      return invalid(`${file} must contain a documented hotspot array.`)
  } catch {
    return invalid(`${file} is unreadable or malformed JSON.`)
  }
  return undefined
}

function componentIdentityProblem(
  report: ReturnType<typeof readDatasetReport>,
): PortfolioActionDomainInput | undefined {
  if (report.tag !== "ready") return invalid(report.message)
  for (const [name, records] of [
    ["filesMain", report.snapshot.filesMain],
    ["units", report.snapshot.units],
    ["componentDependencies", report.snapshot.dependencies],
  ] as const) {
    const ids = new Set<string>()
    for (const record of records) {
      if (!isRecord(record)) return invalid(`${name} contains a malformed record.`)
      const id = "id" in record ? text(record.id) : undefined
      if (!id) continue
      if (ids.has(id)) return invalid(`${name} contains duplicate stable identity '${id}'.`)
      ids.add(id)
    }
  }
  return undefined
}

function couplingDomain(
  source: Source,
  components: SnapshotEntityCollection | undefined,
  hotspots: SnapshotEntityCollection | undefined,
): PortfolioActionDomainInput {
  const componentHotspots = hotspots?.records.filter((record) => record.values.kind === "component") ?? []
  if (
    !source.context.canonicalShards?.componentDependencies &&
    !componentHotspots.some((record) => isRecord(record.values.dimensions))
  )
    return missing("Component coupling evidence is not declared.")
  const componentsInput = entityDomain(source, components, "coupling")
  const hotspotsInput = entityDomain(
    source,
    { present: hotspots?.present ?? false, records: componentHotspots },
    "coupling",
  )
  if (componentsInput.status === "invalid") return componentsInput
  if (hotspotsInput.status === "invalid") return hotspotsInput
  const hotspotById = new Map(hotspotsInput.records.map((record) => [record.targetId, record]))
  return {
    status: "present",
    records: componentsInput.records.map((component) => {
      const hotspot = hotspotById.get(component.targetId)
      return {
        ...component,
        values: { ...component.values, ...hotspot?.values, kind: "component" },
        evidence: [...component.evidence, ...(hotspot?.evidence ?? [])],
        ...(hotspot?.team ? { team: hotspot.team } : {}),
      }
    }),
  }
}

export function historyInputs(
  source: Source,
  options: { readonly datasetsRoot?: string },
): {
  readonly historyStatus: PortfolioActionDatasetInput["historyStatus"]
  readonly trendInputs: readonly PortfolioActionTrendInput[]
  readonly domain: PortfolioActionDomainInput
} {
  const result = readDatasetSnapshotHistory(source.dataset.id, options)
  if (result.tag !== "ready")
    return {
      historyStatus: result.tag,
      trendInputs: [],
      domain: result.tag === "invalid" ? invalid(result.message) : missing(result.message),
    }
  const comparison = result.history.comparison
  if (comparison.status !== "compatible")
    return {
      historyStatus: comparison.status,
      trendInputs: [],
      domain: comparison.status === "missing" ? missing(comparison.message) : invalid(comparison.message),
    }
  if (comparison.current.snapshotId !== source.context.snapshotId)
    return {
      historyStatus: "invalid",
      trendInputs: [],
      domain: invalid("History latest snapshot does not match the current dataset."),
    }
  const inputs: PortfolioActionTrendInput[] = []
  for (const entities of Object.values(result.history.entityComparisons ?? {})) {
    if (entities.status === "incompatible")
      return { historyStatus: "invalid", trendInputs: [], domain: invalid(entities.message) }
    if (entities.status !== "compatible") continue
    for (const delta of entities.deltas) {
      if (!delta.baseline || !delta.current || !delta.provenance.baseline || !delta.provenance.current) continue
      const baselineEntry = result.history.entries.find(
        (entry) => entry.context.snapshotId === delta.provenance.baseline!.snapshotId,
      )
      if (!baselineEntry)
        return { historyStatus: "invalid", trendInputs: [], domain: invalid("Historical evidence snapshot is absent.") }
      const baselineEvidence = anchors(
        { ...source, context: baselineEntry.context },
        { id: delta.id, values: delta.baseline, provenance: delta.provenance.baseline },
        "trend",
      )
      const currentEvidence = anchors(
        source,
        { id: delta.id, values: delta.current, provenance: delta.provenance.current },
        "trend",
      )
      if (!baselineEvidence || !currentEvidence)
        return {
          historyStatus: "invalid",
          trendInputs: [],
          domain: invalid("Historical evidence selectors or routes are invalid."),
        }
      inputs.push({
        targetId: text(delta.current.targetId) ?? delta.id,
        targetLabel: label({ id: delta.id, values: delta.current, provenance: delta.provenance.current }),
        baselineValues: expanded(delta.baseline),
        currentValues: expanded(delta.current),
        baselineEvidence,
        currentEvidence,
        observedAt: source.context.generatedAt!,
      })
    }
  }
  return { historyStatus: "compatible", trendInputs: inputs, domain: { status: "present", records: [] } }
}

function datasetInput(
  dataset: DatasetDescriptor,
  options: { readonly datasetsRoot?: string },
): PortfolioActionDatasetInput {
  const base: PortfolioActionDatasetInput = {
    datasetId: dataset.slug,
    repositoryId: "",
    repositoryTitle: dataset.title,
    mode: dataset.mode,
    availability: dataset.availability,
    trendInputs: [],
    historyStatus: "missing",
  }
  if (dataset.availability === "planned" || dataset.mode === "landscape" || dataset.availability === "invalid")
    return base
  const currentWithEntities = readDatasetCurrentSnapshot(dataset.id, { ...options, includeEntities: true })
  // Keep malformed optional entity evidence explicit without dropping valid independent domains.
  const current =
    currentWithEntities.tag === "ready" ? currentWithEntities : readDatasetCurrentSnapshot(dataset.id, options)
  if (current.tag !== "ready") return { ...base, availability: "invalid" }
  const { context, dataDir } = current.snapshot
  if (context.mode !== "single_repository") return { ...base, mode: "landscape" }
  const report = readDatasetReport(dataset.id, options)
  const source: Source = { dataset, context }
  const entities = current.snapshot.snapshot.entities
  const error = currentWithEntities.tag === "ready" ? undefined : invalid(currentWithEntities.message)
  const hotspot = error ?? hotspotShapeProblem(source, dataDir) ?? entityDomain(source, entities?.hotspots, "hotspot")
  const ownership = hotspot.status === "invalid" ? hotspot : entityDomain(source, entities?.hotspots, "ownership")
  const history = historyInputs(source, options)
  return {
    ...base,
    repositoryId: context.repositoryId!,
    historyStatus: history.historyStatus,
    trendInputs: history.trendInputs,
    current: {
      snapshotId: context.snapshotId!,
      generatedAt: context.generatedAt!,
      domains: {
        hotspot,
        control: error ?? entityDomain(source, entities?.controls, "control"),
        ownership,
        coupling:
          error ?? componentIdentityProblem(report) ?? couplingDomain(source, entities?.components, entities?.hotspots),
        impact: readArrayDomain(source, dataDir, "impact"),
        security: readArrayDomain(source, dataDir, "security"),
        trend: history.domain,
      },
    },
  }
}

export type DatasetActionQueueReader = {
  readonly datasets: readonly PortfolioActionDatasetInput[]
  readonly sourceIds: readonly string[]
  readonly readWindow: (
    window: PortfolioActionWindow,
    options?: { readonly itemLimit?: number },
  ) => { readonly queue: PortfolioActionQueue; readonly totalItems: number }
}

function routeQueue(queue: PortfolioActionQueue): PortfolioActionQueue {
  return {
    ...queue,
    items: queue.items.map((item) => ({
      ...item,
      evidence: item.evidence.map((anchor) => ({
        ...anchor,
        href: route(anchor.href),
      })),
      signals: item.signals.map((signal) => ({
        ...signal,
        evidence: signal.evidence.map((anchor) => ({
          ...anchor,
          href: route(anchor.href),
        })),
      })),
    })),
  }
}

export function sourceId(dataset: DatasetDescriptor): string {
  return [
    dataset.id,
    dataset.slug,
    dataset.snapshot?.snapshotId ?? "unknown",
    dataset.snapshot?.generatedAt ?? "unknown",
  ].join("\0")
}

export function createDatasetActionQueueReader(options: {
  readonly catalog: DatasetCatalog
  readonly datasetsRoot?: string
}): DatasetActionQueueReader {
  const datasets = [...options.catalog.datasets]
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((dataset) => datasetInput(dataset, options))
  return {
    datasets,
    sourceIds: [...options.catalog.datasets].sort((left, right) => left.slug.localeCompare(right.slug)).map(sourceId),
    readWindow: (window, windowOptions = {}) => {
      const result = buildPortfolioActionQueueWithStats(datasets, { window, ...windowOptions })
      return { ...result, queue: routeQueue(result.queue) }
    },
  }
}

export function readDatasetActionQueueWindow(options: {
  readonly catalog: DatasetCatalog
  readonly datasetsRoot?: string
  readonly window: PortfolioActionWindow
}): PortfolioActionQueue {
  return createDatasetActionQueueReader(options).readWindow(options.window).queue
}

/** Filesystem boundary only. Common validates base-free routes; deployment prefixes belong to the returned site model. */
export function readDatasetActionQueueModel(options: {
  readonly catalog: DatasetCatalog
  readonly datasetsRoot?: string
  /** Optional static presentation bound; totals remain available separately. */
  readonly maxItemsPerWindow?: number
}): DatasetActionQueueModel {
  const maxItemsPerWindow = options.maxItemsPerWindow
  if (maxItemsPerWindow !== undefined && (!Number.isInteger(maxItemsPerWindow) || maxItemsPerWindow < 1))
    throw new Error("maxItemsPerWindow must be a positive integer.")
  const reader = createDatasetActionQueueReader(options)
  const datasets = reader.datasets
  const totalItemsByWindow = {} as Record<PortfolioActionWindow, number>
  const truncatedByWindow = {} as Record<PortfolioActionWindow, boolean>
  const queuesByWindow = Object.fromEntries(
    windows.map((window): [PortfolioActionWindow, PortfolioActionQueue] => {
      const result = reader.readWindow(window, { itemLimit: maxItemsPerWindow })
      const queue = result.queue
      totalItemsByWindow[window] = result.totalItems
      truncatedByWindow[window] = maxItemsPerWindow !== undefined && result.totalItems > maxItemsPerWindow
      const items = maxItemsPerWindow === undefined ? queue.items : queue.items.slice(0, maxItemsPerWindow)
      return [
        window,
        {
          ...queue,
          items,
        },
      ]
    }),
  ) as Record<PortfolioActionWindow, PortfolioActionQueue>
  const items = windows.flatMap((window) => queuesByWindow[window].items)
  const repositoryIds = new Set(items.flatMap((item) => item.evidence.map((anchor) => anchor.repositoryId)))
  const repositories = [...repositoryIds]
    .sort()
    .map((id) => ({ id, label: datasets.find((dataset) => dataset.repositoryId === id)!.repositoryTitle }))
  const teams = new Map<string, { readonly id: string; readonly label: string }>()
  for (const item of items)
    for (const signal of item.signals) if (!teams.has(signal.team.id)) teams.set(signal.team.id, signal.team)
  return {
    queuesByWindow,
    totalItemsByWindow,
    truncatedByWindow,
    ...(maxItemsPerWindow === undefined ? {} : { maxItemsPerWindow }),
    filterOptions: {
      repositories,
      teams: [...teams.values()].sort((left, right) => left.id.localeCompare(right.id)),
      priorities,
      domains,
    },
  }
}
