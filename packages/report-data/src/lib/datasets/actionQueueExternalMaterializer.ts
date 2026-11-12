import { closeSync, createReadStream, mkdtempSync, openSync, rmSync, writeSync } from "node:fs"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { createInterface } from "node:readline"
import type {
  PortfolioActionQueueCoverage,
  PortfolioActionQueueItem,
  PortfolioActionSignal,
  PortfolioActionSignalDomain,
  PortfolioActionWindow,
} from "@planetnik/common"
import { buildPortfolioActionQueueItem, compareQueueItems, isPortfolioActionSignalInWindow } from "@planetnik/common"
import { route } from "../route.js"
import {
  ACTION_QUEUE_ARTIFACT_PROJECTION_VERSION,
  ACTION_QUEUE_ARTIFACT_VERSION,
  ACTION_QUEUE_MANIFEST_FILE,
  ACTION_QUEUE_PAGE_SIZE,
  ACTION_QUEUE_WINDOWS,
  type ActionQueueArtifactManifest,
  type ActionQueueArtifactWindow,
  compactActionQueueItems,
  createActionQueueWindowStreamFingerprint,
  fingerprintStreamingActionQueueSource,
} from "./actionQueueArtifacts.js"
import type { ActionQueueStreamingSignalRow, ActionQueueStreamingSource } from "./actionQueueStreamingSource.js"

const domains: readonly PortfolioActionSignalDomain[] = [
  "hotspot",
  "control",
  "security",
  "impact",
  "coupling",
  "ownership",
  "trend",
]

export type MaterializeStreamingActionQueueArtifactsOptions = {
  readonly source: ActionQueueStreamingSource
  readonly outputDir: string
  readonly windows?: readonly PortfolioActionWindow[]
  readonly pageSize?: number
  readonly partitionCount?: number
}

type PartitionRow = ActionQueueStreamingSignalRow
type Group = { readonly repositoryTitle: string; readonly signals: PortfolioActionSignal[] }
type DomainCounts = Record<PortfolioActionSignalDomain, number>

type WindowRuns = {
  readonly totalItems: number
  readonly coverage: PortfolioActionQueueCoverage
  readonly runPaths: readonly string[]
}

type RunCursor = {
  readonly path: string
  readonly input: ReturnType<typeof createReadStream>
  readonly lines: ReturnType<typeof createInterface>
  readonly iterator: AsyncIterator<string>
  item?: PortfolioActionQueueItem
}

function positiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`)
}

function assertWindows(windows: readonly PortfolioActionWindow[]): void {
  if (!windows.length) throw new Error("At least one action queue window is required.")
  const seen = new Set<PortfolioActionWindow>()
  for (const window of windows) {
    if (!ACTION_QUEUE_WINDOWS.includes(window)) throw new Error(`Unknown action queue window '${window}'.`)
    if (seen.has(window)) throw new Error(`Duplicate action queue window '${window}'.`)
    seen.add(window)
  }
}

/** Stable FNV-1a partitioning over UTF-8 key bytes. */
export function actionQueueStreamPartitionForKey(key: string, partitionCount: number): number {
  positiveInteger(partitionCount, "partitionCount")
  let hash = 2_166_136_261
  for (const byte of new TextEncoder().encode(key)) hash = Math.imul(hash ^ byte, 16_777_619)
  return (hash >>> 0) % partitionCount
}

function initialDomainCounts(): DomainCounts {
  return Object.fromEntries(domains.map((domain) => [domain, 0])) as DomainCounts
}

function collectBunGarbage(): void {
  const runtime = globalThis as typeof globalThis & { readonly Bun?: { readonly gc?: (force?: boolean) => void } }
  runtime.Bun?.gc?.(true)
}

function reportStreamMemory(label: string): void {
  if (process.env.PLANETNIK_DEBUG_STREAM_MEMORY === "1")
    console.error(`[action-queue-stream] ${label}: ${Math.round(process.memoryUsage().rss / 1048576)} MiB`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parsePartitionRow(value: unknown, path: string, lineNumber: number): PartitionRow {
  if (
    !isRecord(value) ||
    typeof value.key !== "string" ||
    typeof value.repositoryTitle !== "string" ||
    !isRecord(value.signal)
  )
    throw new Error(`Malformed action queue signal row at ${path}:${lineNumber}.`)
  if (!domains.includes(value.signal.domain as PortfolioActionSignalDomain))
    throw new Error(`Malformed action queue signal row at ${path}:${lineNumber}: unknown signal domain.`)
  return value as unknown as PartitionRow
}

function routeItem(item: PortfolioActionQueueItem): PortfolioActionQueueItem {
  const routeEvidence = (evidence: PortfolioActionQueueItem["evidence"]) => {
    let changed = false
    const routed = evidence.map((anchor) => {
      const href = route(anchor.href)
      if (href === anchor.href) return anchor
      changed = true
      return { ...anchor, href }
    })
    return { value: routed, changed }
  }
  let changed = false
  const signals = item.signals.map((signal) => {
    const evidence = routeEvidence(signal.evidence)
    if (!evidence.changed) return signal
    changed = true
    return { ...signal, evidence: evidence.value }
  })
  const itemEvidence = routeEvidence(item.evidence)
  changed ||= itemEvidence.changed
  return changed ? { ...item, signals, evidence: itemEvidence.value } : item
}

function windowCoverage(
  sourceCoverage: PortfolioActionQueueCoverage,
  counts: DomainCounts,
): PortfolioActionQueueCoverage {
  return {
    datasets: {
      included: [...sourceCoverage.datasets.included],
      planned: [...sourceCoverage.datasets.planned],
      excluded: [...sourceCoverage.datasets.excluded],
      unavailable: [...sourceCoverage.datasets.unavailable],
    },
    domains: Object.fromEntries(
      domains.map((domain) => {
        const base = sourceCoverage.domains[domain]
        return [
          domain,
          {
            status: base.status,
            datasetCount: base.datasetCount,
            signalCount: base.status === "invalid" ? 0 : counts[domain],
            ...(base.message ? { message: base.message } : {}),
          },
        ]
      }),
    ) as PortfolioActionQueueCoverage["domains"],
    diagnostics: [...sourceCoverage.diagnostics],
  }
}

async function writePartitionFiles(
  source: ActionQueueStreamingSource,
  stagingDir: string,
  partitionCount: number,
): Promise<readonly string[]> {
  const partitionDir = join(stagingDir, "partitions")
  await mkdir(partitionDir, { recursive: true })
  const paths = Array.from({ length: partitionCount }, (_, index) => join(partitionDir, `${index}.jsonl`))
  const descriptors = paths.map((path) => openSync(path, "w"))
  let rowCount = 0
  try {
    await source.streamSignals((row) => {
      if (!row || typeof row.key !== "string" || typeof row.repositoryTitle !== "string" || !row.signal)
        throw new Error("Streaming action queue source emitted a malformed signal row.")
      const partition = actionQueueStreamPartitionForKey(row.key, partitionCount)
      writeSync(descriptors[partition]!, `${JSON.stringify(row)}\n`)
      rowCount += 1
      if ((rowCount & 65_535) === 0) collectBunGarbage()
    })
  } finally {
    for (const descriptor of descriptors) closeSync(descriptor)
  }
  return paths
}

async function readPartition(
  path: string,
  window: PortfolioActionWindow,
  asOf: string,
  groups: Map<string, Group>,
  counts: DomainCounts,
): Promise<void> {
  const input = createReadStream(path, { encoding: "utf8" })
  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY })
  let lineNumber = 0
  try {
    for await (const line of lines) {
      lineNumber += 1
      let value: unknown
      try {
        value = JSON.parse(line)
      } catch {
        throw new Error(`Malformed action queue partition row at ${path}:${lineNumber}.`)
      }
      const row = parsePartitionRow(value, path, lineNumber)
      if (!isPortfolioActionSignalInWindow(row.signal, window, asOf)) continue
      const group = groups.get(row.key) ?? { repositoryTitle: row.repositoryTitle, signals: [] }
      group.signals.push(row.signal)
      groups.set(row.key, group)
      counts[row.signal.domain] += 1
    }
  } finally {
    lines.close()
    input.destroy()
  }
}

async function buildWindowRuns(
  partitionPaths: readonly string[],
  stagingDir: string,
  sourceCoverage: PortfolioActionQueueCoverage,
  window: PortfolioActionWindow,
  asOf: string,
): Promise<WindowRuns> {
  const counts = initialDomainCounts()
  const runDir = join(stagingDir, "runs", window)
  await mkdir(runDir, { recursive: true })
  const runPaths: string[] = []
  let totalItems = 0
  for (const [partition, path] of partitionPaths.entries()) {
    const groups = new Map<string, Group>()
    await readPartition(path, window, asOf, groups, counts)
    const items = [...groups.values()]
      .flatMap(({ repositoryTitle, signals }) => {
        const item = buildPortfolioActionQueueItem(repositoryTitle, signals, asOf)
        return item ? [routeItem(item)] : []
      })
      .sort(compareQueueItems)
    if (items.length === 0) continue
    totalItems += items.length
    const runPath = join(runDir, `${partition}.jsonl`)
    const descriptor = openSync(runPath, "w")
    try {
      for (const item of items) writeSync(descriptor, `${JSON.stringify(item)}\n`)
    } finally {
      closeSync(descriptor)
    }
    runPaths.push(runPath)
    groups.clear()
    items.length = 0
    collectBunGarbage()
    reportStreamMemory(`partition ${partition}`)
  }
  return { totalItems, coverage: windowCoverage(sourceCoverage, counts), runPaths }
}

async function nextCursor(cursor: RunCursor): Promise<PortfolioActionQueueItem | undefined> {
  const result = await cursor.iterator.next()
  if (result.done) return undefined
  let value: unknown
  try {
    value = JSON.parse(result.value)
  } catch {
    throw new Error(`Malformed action queue item run '${cursor.path}'.`)
  }
  if (!isRecord(value) || typeof value.id !== "string")
    throw new Error(`Malformed action queue item run '${cursor.path}'.`)
  return value as unknown as PortfolioActionQueueItem
}

function compareCursors(left: RunCursor, right: RunCursor): number {
  return compareQueueItems(left.item!, right.item!) || left.path.localeCompare(right.path)
}

function heapPush(heap: RunCursor[], cursor: RunCursor): void {
  heap.push(cursor)
  let index = heap.length - 1
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2)
    if (compareCursors(heap[parent]!, heap[index]!) <= 0) break
    ;[heap[parent], heap[index]] = [heap[index]!, heap[parent]!]
    index = parent
  }
}

function heapPop(heap: RunCursor[]): RunCursor | undefined {
  if (heap.length === 0) return undefined
  const result = heap[0]
  const last = heap.pop()!
  if (heap.length > 0) {
    heap[0] = last
    let index = 0
    while (true) {
      const left = index * 2 + 1
      const right = left + 1
      let smallest = index
      if (left < heap.length && compareCursors(heap[left]!, heap[smallest]!) < 0) smallest = left
      if (right < heap.length && compareCursors(heap[right]!, heap[smallest]!) < 0) smallest = right
      if (smallest === index) break
      ;[heap[index], heap[smallest]] = [heap[smallest]!, heap[index]!]
      index = smallest
    }
  }
  return result
}

async function* mergeRuns(runPaths: readonly string[]): AsyncGenerator<PortfolioActionQueueItem> {
  const cursors: RunCursor[] = []
  const heap: RunCursor[] = []
  try {
    for (const path of runPaths) {
      const input = createReadStream(path, { encoding: "utf8" })
      const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY })
      const cursor: RunCursor = { path, input, lines, iterator: lines[Symbol.asyncIterator]() }
      cursor.item = await nextCursor(cursor)
      cursors.push(cursor)
      if (cursor.item) heapPush(heap, cursor)
    }
    while (heap.length > 0) {
      const cursor = heapPop(heap)!
      const item = cursor.item!
      cursor.item = await nextCursor(cursor)
      if (cursor.item) heapPush(heap, cursor)
      yield item
    }
  } finally {
    for (const cursor of cursors) {
      cursor.lines.close()
      cursor.input.destroy()
    }
  }
}

async function writeWindowPages(
  stagingDir: string,
  source: ActionQueueStreamingSource,
  window: PortfolioActionWindow,
  pageSize: number,
  runs: WindowRuns,
): Promise<ActionQueueArtifactWindow> {
  await mkdir(join(stagingDir, window), { recursive: true })
  const fingerprint = createActionQueueWindowStreamFingerprint({
    sourceIds: source.sourceIds,
    projectionVersion: ACTION_QUEUE_ARTIFACT_PROJECTION_VERSION,
    window,
    pageSize,
    totalItems: runs.totalItems,
    asOf: source.metadata.asOf,
    coverage: runs.coverage,
  })
  const chunks: string[] = []
  const pageItems: PortfolioActionQueueItem[] = []
  let emitted = 0
  const writePage = async () => {
    if (pageItems.length === 0) return
    const page = chunks.length + 1
    const compact = compactActionQueueItems(pageItems)
    const relativePath = `${window}/${page}.json`
    await writeFile(
      join(stagingDir, relativePath),
      `${JSON.stringify({
        version: ACTION_QUEUE_ARTIFACT_VERSION,
        window,
        page,
        pageSize,
        totalItems: runs.totalItems,
        asOf: source.metadata.asOf,
        coverage: runs.coverage,
        ...compact,
      })}\n`,
      "utf8",
    )
    chunks.push(relativePath)
    pageItems.length = 0
  }
  for await (const item of mergeRuns(runs.runPaths)) {
    fingerprint.updateItem(item)
    pageItems.push(item)
    emitted += 1
    if (pageItems.length === pageSize) await writePage()
  }
  await writePage()
  if (emitted !== runs.totalItems)
    throw new Error(`Action queue merge for '${window}' emitted ${emitted} items, expected ${runs.totalItems}.`)
  return {
    window,
    totalItems: runs.totalItems,
    complete: true,
    pageSize,
    pageCount: chunks.length,
    chunks,
    contentFingerprint: fingerprint.digest(),
    asOf: source.metadata.asOf,
    coverage: runs.coverage,
  }
}

export async function materializeStreamingActionQueueArtifacts(
  options: MaterializeStreamingActionQueueArtifactsOptions,
): Promise<ActionQueueArtifactManifest> {
  const windows = options.windows ?? ACTION_QUEUE_WINDOWS
  const pageSize = options.pageSize ?? ACTION_QUEUE_PAGE_SIZE
  const partitionCount = options.partitionCount ?? 64
  positiveInteger(pageSize, "pageSize")
  positiveInteger(partitionCount, "partitionCount")
  assertWindows(windows)

  const parentDir = dirname(options.outputDir)
  await mkdir(parentDir, { recursive: true })
  const stagingDir = mkdtempSync(join(parentDir, ".action-queue-stream-"))
  let published = false
  try {
    const partitionPaths = await writePartitionFiles(options.source, stagingDir, partitionCount)
    collectBunGarbage()
    reportStreamMemory("after partitions")
    const materializedWindows: ActionQueueArtifactWindow[] = []
    for (const window of windows) {
      const runs = await buildWindowRuns(
        partitionPaths,
        stagingDir,
        options.source.metadata.coverage,
        window,
        options.source.metadata.asOf,
      )
      materializedWindows.push(await writeWindowPages(stagingDir, options.source, window, pageSize, runs))
      collectBunGarbage()
      reportStreamMemory(`after window ${window}`)
      await rm(join(stagingDir, "runs", window), { recursive: true, force: true })
    }
    // Partitions are an intermediate source spool. They are reused across
    // windows but must never become part of the published artifact payload.
    await rm(join(stagingDir, "partitions"), { recursive: true, force: true })
    await rm(join(stagingDir, "runs"), { recursive: true, force: true })
    const manifest: ActionQueueArtifactManifest = {
      version: ACTION_QUEUE_ARTIFACT_VERSION,
      projectionVersion: ACTION_QUEUE_ARTIFACT_PROJECTION_VERSION,
      sourceFingerprint: fingerprintStreamingActionQueueSource(
        options.source.sourceIds,
        ACTION_QUEUE_ARTIFACT_PROJECTION_VERSION,
      ),
      // The source as-of timestamp is a deterministic build input; unlike the
      // bounded legacy materializer this complete path does not use the host clock.
      generatedAt: options.source.metadata.asOf,
      filterOptions: options.source.metadata.filterOptions,
      windows: materializedWindows,
    }
    await writeFile(join(stagingDir, ACTION_QUEUE_MANIFEST_FILE), `${JSON.stringify(manifest)}\n`, "utf8")
    await rm(options.outputDir, { recursive: true, force: true })
    await rename(stagingDir, options.outputDir)
    published = true
    return manifest
  } finally {
    if (!published) rmSync(stagingDir, { recursive: true, force: true })
  }
}
