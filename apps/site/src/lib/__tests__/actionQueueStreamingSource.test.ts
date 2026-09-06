import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { DatasetCatalog, DatasetDescriptor, PortfolioActionSignal } from "@planetnik/common"
import { buildPortfolioActionQueueItem } from "@planetnik/common"
import { createDatasetActionQueueReader } from "../datasets/actionQueueSource.js"
import { createStreamingActionQueueSource } from "../datasets/actionQueueStreamingSource.js"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const currentId = "22222222-2222-4222-8222-222222222222"
const baselineId = "11111111-1111-4111-8111-111111111111"
const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value))

function root(): string {
  const result = mkdtempSync(join(tmpdir(), "planetnik-stream-actions-"))
  roots.push(result)
  return result
}

function descriptor(id: string, patch: Partial<DatasetDescriptor> = {}): DatasetDescriptor {
  return {
    id,
    slug: id,
    title: `${id} repository`,
    mode: "single_repository",
    availability: "ready",
    snapshot: { dataVersion: 2, snapshotId: currentId, generatedAt: "2026-09-06T00:00:00.000Z" },
    description: "Streaming action source fixture",
    provenance: {},
    stats: {},
    languages: [],
    tags: [],
    capabilities: ["summary", "metrics", "contributors"],
    curation: { featured: false, shelf: "fixtures", order: 0 },
    ...patch,
  }
}

function context(snapshotId: string, generatedAt: string): Record<string, unknown> {
  const canonicalShards = {
    summary: "analysisResults.json",
    metrics: "metrics.json",
    contributors: "contributors.json",
    filesMain: "files_main.json",
    units: "units.json",
    componentDependencies: "component_dependencies.json",
    hotspots: "hotspots.json",
    controls: "controls.json",
    impact: "impact.json",
    security: "security.json",
  }
  return {
    title: "Streaming fixture",
    mode: "single_repository",
    reportMode: "single_repository",
    dataVersion: 2,
    repositoryId: "repo:streaming",
    snapshotId,
    generatedAt,
    capabilities: Object.keys(canonicalShards),
    canonicalShards,
    compatibilityProjections: {},
    entityIdPolicy: {
      repository: "repo",
      file: "file",
      unit: "unit",
      component: "component",
      contributor: "contributor",
    },
  }
}

function writeSnapshot(dataDir: string, historical = false): void {
  mkdirSync(dataDir, { recursive: true })
  const snapshotId = historical ? baselineId : currentId
  const generatedAt = historical ? "2026-09-01T00:00:00.000Z" : "2026-09-06T00:00:00.000Z"
  write(join(dataDir, "report_context.json"), context(snapshotId, generatedAt))
  write(join(dataDir, "analysisResults.json"), { metadata: { name: "Streaming fixture" } })
  write(join(dataDir, "metrics.json"), { metrics: [{ id: "FILES", value: 2 }] })
  write(join(dataDir, "contributors.json"), {
    contributors: [{ id: "contributor:owner@example.test", email: "owner@example.test" }],
  })
  write(join(dataDir, "files_main.json"), {
    files: [
      { id: "file:src/a.ts", components: ["Core"], linesOfCode: historical ? 10 : 30 },
      { id: "file:src/b.ts", components: ["Core"], linesOfCode: 5 },
    ],
  })
  write(join(dataDir, "units.json"), {
    units: [{ id: "unit:src/a.ts:1", components: ["Core"], linesOfCode: 5 }],
  })
  write(join(dataDir, "component_dependencies.json"), {
    dependencies: [
      {
        id: "edge:core-api",
        fromComponentId: "component:primary:Core",
        toComponentId: "component:primary:Api",
      },
    ],
  })
  write(join(dataDir, "hotspots.json"), {
    fileHotspots: [
      {
        id: "file:src/a.ts",
        kind: "file",
        name: "a.ts",
        route: "/hotspots/files",
        severity: historical ? "Low" : "High",
        score: historical ? 10 : 80,
        reasons: ["Knowledge concentrated in one contributor"],
        team: { id: "core", label: "Core" },
      },
    ],
    unitHotspots: [],
    componentHotspots: [
      {
        id: "component:primary:Core",
        kind: "component",
        name: "Core",
        route: "/hotspots/components",
        riskTier: "High",
        dimensions: { structuralRisk: 70 },
      },
    ],
  })
  write(join(dataDir, "controls.json"), {
    goals: [{ goal: "Quality", controls: [{ metricId: "COMPLEXITY", status: historical ? "PASSED" : "FAILED" }] }],
  })
  write(join(dataDir, "impact.json"), {
    impact_opportunities: [
      { id: "file:src/a.ts", kind: "file", name: "a.ts", impact_score: 90, route: "/impact/files" },
    ],
  })
  write(join(dataDir, "security.json"), {
    alerts: [{ id: "alert:1", targetId: "file:src/a.ts", open: true, severity: "critical" }],
  })
}

function buildCatalog(): DatasetCatalog {
  return { catalogVersion: 1, datasets: [descriptor("ready")] }
}

async function collectSignals(datasetsRoot: string): Promise<{
  readonly source: Awaited<ReturnType<typeof createStreamingActionQueueSource>>
  readonly rows: readonly {
    readonly key: string
    readonly repositoryTitle: string
    readonly signal: PortfolioActionSignal
  }[]
}> {
  const source = createStreamingActionQueueSource({ catalog: buildCatalog(), datasetsRoot })
  const rows: { key: string; repositoryTitle: string; signal: PortfolioActionSignal }[] = []
  await source.streamSignals((row) => rows.push(row))
  return { source, rows }
}

describe("createStreamingActionQueueSource", () => {
  test("matches the batch source signal and item contracts, including component provenance and trends", async () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready", "data")
    writeSnapshot(dataDir)
    writeSnapshot(join(dataDir, "history", "older"), true)
    write(join(dataDir, "snapshot-history.json"), {
      historyVersion: 1,
      snapshots: [{ dataDir: "." }, { dataDir: "history/older" }],
    })

    const { source, rows } = await collectSignals(datasetsRoot)
    const batch = createDatasetActionQueueReader({ datasetsRoot, catalog: buildCatalog() }).readWindow(
      "latest-compatible",
    )
    const streamedSignals = rows.map((row) => row.signal).sort((left, right) => left.id.localeCompare(right.id))
    const batchSignals = batch.queue.items
      .flatMap((item) => item.signals)
      .sort((left, right) => left.id.localeCompare(right.id))
    expect(streamedSignals).toEqual(batchSignals)
    expect(source.metadata.asOf).toBe(batch.queue.asOf)
    expect(source.metadata.coverage.datasets).toEqual(batch.queue.coverage.datasets)
    expect(source.metadata.coverage.domains).toEqual(batch.queue.coverage.domains)
    expect(source.metadata.filterOptions.repositories).toEqual([{ id: "repo:streaming", label: "ready repository" }])
    expect(source.metadata.filterOptions.teams).toContainEqual({ id: "core", label: "Core" })
    const component = rows.find(
      (row) => row.signal.targetId === "component:primary:Core" && row.signal.domain === "coupling",
    )
    expect(component?.signal.evidence).toContainEqual(expect.objectContaining({ record: "files[index=0]" }))
    expect(component?.signal.evidence).toContainEqual(expect.objectContaining({ record: "dependencies[index=0]" }))

    const groups = new Map<string, { title: string; signals: PortfolioActionSignal[] }>()
    for (const row of rows) {
      const group = groups.get(row.key) ?? { title: row.repositoryTitle, signals: [] }
      group.signals.push(row.signal)
      groups.set(row.key, group)
    }
    const streamedItems = [...groups.values()]
      .map(({ title, signals }) => buildPortfolioActionQueueItem(title, signals, source.metadata.asOf))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => left.id.localeCompare(right.id))
    const batchItems = [...batch.queue.items].sort((left, right) => left.id.localeCompare(right.id))
    expect(streamedItems).toEqual(batchItems)
  })

  test("keeps missing and malformed capabilities explicit without emitting unsafe records", async () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready", "data")
    writeSnapshot(dataDir)
    write(join(dataDir, "impact.json"), {
      impact_opportunities: [{ id: "bad", kind: "file", route: "/../outside", impact_score: 90 }],
    })

    const { source, rows } = await collectSignals(datasetsRoot)
    expect(source.metadata.coverage.domains.impact.status).toBe("invalid")
    expect(rows.some((row) => row.signal.domain === "impact")).toBe(false)
    expect(JSON.stringify(rows)).not.toContain("outside")

    const partialRoot = root()
    const partialData = join(partialRoot, "partial", "data")
    writeSnapshot(partialData)
    const partialContext = JSON.parse(readFileSync(join(partialData, "report_context.json"), "utf8")) as Record<
      string,
      unknown
    >
    const shards = partialContext.canonicalShards as Record<string, string>
    delete shards.impact
    delete shards.security
    partialContext.capabilities = Object.keys(shards)
    write(join(partialData, "report_context.json"), partialContext)
    const partial = createStreamingActionQueueSource({
      catalog: { catalogVersion: 1, datasets: [descriptor("partial", { availability: "partial" })] },
      datasetsRoot: partialRoot,
    })
    await partial.streamSignals(() => undefined)
    expect(partial.metadata.coverage.domains.impact.status).toBe("missing")
    expect(partial.metadata.coverage.domains.security.status).toBe("missing")
  })

  test("fails the coupling domain when component provenance would duplicate a selector", async () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready", "data")
    writeSnapshot(dataDir)
    write(join(dataDir, "files_main.json"), {
      files: [{ id: "file:src/a.ts", components: ["Core", "Core"], linesOfCode: 30 }],
    })
    const { source, rows } = await collectSignals(datasetsRoot)
    expect(source.metadata.coverage.domains.coupling.status).toBe("invalid")
    expect(rows.some((row) => row.signal.domain === "coupling")).toBe(false)
  })
})
