import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { DatasetCatalog, DatasetDescriptor } from "@planetnik/common"
import { createDatasetActionQueueReader, readDatasetActionQueueModel } from "../datasets/actionQueueSource.js"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
const write = (path: string, value: unknown) => writeFileSync(path, JSON.stringify(value))
const currentId = "22222222-2222-4222-8222-222222222222"
const baselineId = "11111111-1111-4111-8111-111111111111"
function root(): string {
  const result = mkdtempSync(join(tmpdir(), "planetnik-actions-"))
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
    description: "Action source fixture",
    provenance: {},
    stats: {},
    languages: [],
    tags: [],
    capabilities: ["summary", "filesMain"],
    curation: { featured: false, shelf: "fixtures", order: 0 },
    ...patch,
  }
}
function snapshot(dataDir: string, partial = false, historical = false): void {
  mkdirSync(dataDir, { recursive: true })
  const shards: Record<string, string> = {
    summary: "analysisResults.json",
    metrics: "metrics.json",
    contributors: "contributors.json",
    filesMain: "files_main.json",
    hotspots: "hotspots.json",
    controls: "controls.json",
  }
  if (!partial)
    Object.assign(shards, {
      impact: "impact.json",
      componentDependencies: "component_dependencies.json",
      security: "security.json",
    })
  write(join(dataDir, "report_context.json"), {
    title: "Canonical fixture",
    mode: "single_repository",
    reportMode: "single_repository",
    dataVersion: 2,
    repositoryId: "repo:canonical",
    snapshotId: historical ? baselineId : currentId,
    generatedAt: historical ? "2026-09-01T00:00:00.000Z" : "2026-09-06T00:00:00.000Z",
    capabilities: Object.keys(shards),
    canonicalShards: shards,
    compatibilityProjections: {},
    entityIdPolicy: {
      repository: "repo",
      file: "file",
      unit: "unit",
      component: "component",
      contributor: "contributor",
    },
  })
  write(join(dataDir, "analysisResults.json"), { metadata: { name: "Fixture" } })
  write(join(dataDir, "metrics.json"), { metrics: [{ id: "FILES", value: 1 }] })
  write(join(dataDir, "contributors.json"), {
    contributors: [{ id: "contributor:owner@example.test", email: "owner@example.test" }],
  })
  write(join(dataDir, "files_main.json"), {
    files: [{ id: "file:src/a.ts", path: "src/a.ts", components: ["Core"], linesOfCode: 30 }],
  })
  write(join(dataDir, "hotspots.json"), {
    fileHotspots: [
      {
        id: "file:src/a.ts",
        kind: "file",
        name: "a.ts",
        route: "/hotspots/files?old=1#detail",
        severity: historical ? "Low" : "High",
        score: historical ? 10 : 80,
        reasons: ["Knowledge concentrated in one contributor"],
        team: { id: "core", label: "Core" },
      },
    ],
    unitHotspots: [],
    componentHotspots: partial
      ? []
      : [
          {
            id: "component:primary:Core",
            kind: "component",
            name: "Core",
            route: "/hotspots/components",
            severity: "High",
            dimensions: { structuralRisk: 70, coordinationCost: 40 },
            riskTier: "High",
          },
        ],
  })
  write(join(dataDir, "controls.json"), {
    goals: [{ goal: "Quality", controls: [{ metricId: "COMPLEXITY", status: historical ? "PASSED" : "FAILED" }] }],
  })
  if (!partial) {
    write(join(dataDir, "impact.json"), {
      impact_opportunities: [
        { id: "file:src/a.ts", kind: "file", name: "a.ts", impact_score: 90, route: "/impact/files" },
      ],
    })
    write(join(dataDir, "component_dependencies.json"), {
      dependencies: [
        { id: "edge:core-api", fromComponentId: "component:primary:Core", toComponentId: "component:primary:Api" },
      ],
    })
    write(join(dataDir, "security.json"), {
      alerts: [
        { id: "alert:1", targetId: "file:src/a.ts", name: "Vulnerable package", open: true, severity: "critical" },
      ],
    })
  }
  // Poison projections and undeclared security must never supply queue evidence.
  writeFileSync(join(dataDir, "hotspots.txt"), "Critical TXT-only target")
  write(join(dataDir, "landscape_dependency_alerts.json"), {
    alerts: [{ id: "landscape-only", open: true, severity: "critical" }],
  })
}
function model(
  datasetsRoot: string,
  datasets: DatasetDescriptor[],
  options: { readonly maxItemsPerWindow?: number } = {},
) {
  return readDatasetActionQueueModel({
    catalog: { catalogVersion: 1, datasets } satisfies DatasetCatalog,
    datasetsRoot,
    ...options,
  })
}

describe("canonical action queue source", () => {
  test("includes ready and partial repositories and keeps planned, landscape, and malformed coverage explicit", () => {
    const datasetsRoot = root()
    for (const id of ["ready", "partial", "broken"]) snapshot(join(datasetsRoot, id, "data"), id === "partial")
    write(join(datasetsRoot, "broken/data/report_context.json"), { dataVersion: 2 })
    snapshot(join(datasetsRoot, "landscape/data"))
    const result = model(datasetsRoot, [
      descriptor("ready"),
      descriptor("partial", { availability: "partial" }),
      descriptor("broken"),
      descriptor("planned", { availability: "planned" }),
      descriptor("landscape", { mode: "landscape" }),
    ])
    expect(result.queuesByWindow.current.coverage.datasets).toMatchObject({
      included: [
        { datasetId: "partial", repositoryId: "repo:canonical" },
        { datasetId: "ready", repositoryId: "repo:canonical" },
      ],
      planned: [{ datasetId: "planned" }],
      excluded: [{ datasetId: "landscape" }],
      unavailable: [{ datasetId: "broken" }],
    })
    expect(Object.keys(result.queuesByWindow)).toEqual(["current", "latest-compatible", "7d", "30d", "90d"])
    expect(result.filterOptions.repositories).toEqual([{ id: "repo:canonical", label: "partial repository" }])
    expect(result.filterOptions.teams).toEqual([
      { id: "core", label: "Core" },
      { id: "unassigned", label: "Unassigned" },
    ])
    expect(JSON.stringify(result)).not.toContain("TXT-only")
    expect(JSON.stringify(result)).not.toContain("landscape-only")
    const partial = model(datasetsRoot, [descriptor("partial", { availability: "partial" })]).queuesByWindow.current
    expect(partial.coverage.domains.security.status).toBe("missing")
    expect(partial.coverage.domains.impact.status).toBe("missing")
    expect(partial.coverage.domains.coupling.status).toBe("missing")
  })

  test("retains exact canonical IDs, array selectors, dependency anchors and compatible historical evidence", () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready/data")
    snapshot(dataDir)
    snapshot(join(dataDir, "history/older"), false, true)
    write(join(dataDir, "snapshot-history.json"), {
      historyVersion: 1,
      snapshots: [{ dataDir: "." }, { dataDir: "history/older" }],
    })
    const result = model(datasetsRoot, [descriptor("ready")])
    const queue = result.queuesByWindow["latest-compatible"]
    expect(queue.coverage.domains.trend).toMatchObject({ status: "present" })
    const file = queue.items.find((item) => item.target.id === "file:src/a.ts")!
    expect(file.trend).toBe("worsening")
    expect(file.evidence).toContainEqual(
      expect.objectContaining({
        datasetId: "ready",
        repositoryId: "repo:canonical",
        snapshotId: currentId,
        shard: "impact.json",
        record: "impact_opportunities[index=0]",
        href: "/datasets/ready/impact/files",
      }),
    )
    expect(file.evidence).toContainEqual(
      expect.objectContaining({
        domain: "trend",
        snapshotId: baselineId,
        generatedAt: "2026-09-01T00:00:00.000Z",
        shard: "hotspots.json",
        record: "fileHotspots[index=0]",
      }),
    )
    expect(file.evidence).toContainEqual(
      expect.objectContaining({ shard: "security.json", record: "alerts[index=0]", href: "/datasets/ready/overview" }),
    )
    const core = queue.items.find((item) => item.target.id === "component:primary:Core")!
    const coupling = core.signals.find((signal) => signal.domain === "coupling")!
    expect(coupling.facts).toContainEqual({ label: "structuralRisk", value: 70 })
    expect(coupling.evidence).toContainEqual(
      expect.objectContaining({ shard: "files_main.json", record: "files[index=0]" }),
    )
    expect(coupling.evidence).toContainEqual(
      expect.objectContaining({ shard: "component_dependencies.json", record: "dependencies[index=0]" }),
    )
    expect(coupling.evidence).not.toContainEqual(
      expect.objectContaining({ shard: "files_main.json", record: "dependencies[index=0]" }),
    )
    expect(queue.items.find((item) => item.target.id === "control:Quality:COMPLEXITY")?.trend).toBe("worsening")
    expect(
      result.queuesByWindow.current.items.flatMap((item) => item.signals).some((signal) => signal.domain === "trend"),
    ).toBe(false)
  })

  test("uses catalogue id for reading and slug for queue URLs without active-dataset fallback", () => {
    const datasetsRoot = root()
    snapshot(join(datasetsRoot, "source-id/data"))
    const result = model(datasetsRoot, [descriptor("source-id", { slug: "public-slug" }), descriptor("missing")])
    expect(result.queuesByWindow.current.coverage.datasets.included).toEqual([
      { datasetId: "public-slug", repositoryId: "repo:canonical" },
    ])
    expect(result.queuesByWindow.current.items[0]?.evidence[0]?.href).toStartWith("/datasets/public-slug/")
    expect(result.queuesByWindow.current.coverage.datasets.unavailable).toHaveLength(1)
  })

  test("fingerprints both catalogue and public identities for artifact invalidation", () => {
    const datasetsRoot = root()
    snapshot(join(datasetsRoot, "source-id/data"))
    const reader = createDatasetActionQueueReader({
      datasetsRoot,
      catalog: { catalogVersion: 1, datasets: [descriptor("source-id", { slug: "public-slug" })] },
    })
    expect(reader.sourceIds).toEqual([
      ["source-id", "public-slug", currentId, "2026-09-06T00:00:00.000Z"].join("\u0000"),
    ])
  })

  test.each(["impact", "security"])("rejects malformed and duplicate %s evidence", (capability) => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready/data")
    snapshot(dataDir)
    const file = join(dataDir, `${capability}.json`)
    write(file, { wrong: [] })
    expect(
      model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current.coverage.domains[
        capability as "impact" | "security"
      ].status,
    ).toBe("invalid")
    const value =
      capability === "impact" ? { id: "same", impact_score: 80 } : { id: "same", open: true, severity: "high" }
    write(file, { [capability === "impact" ? "impact_opportunities" : "alerts"]: [value, value] })
    expect(
      model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current.coverage.domains[
        capability as "impact" | "security"
      ].status,
    ).toBe("invalid")
    writeFileSync(file, "{")
    expect(
      model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current.coverage.domains[
        capability as "impact" | "security"
      ].status,
    ).toBe("invalid")
  })

  test("rejects unsafe source paths and duplicate stable hotspot identities", () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready/data")
    snapshot(dataDir)
    const file = join(dataDir, "hotspots.json")
    const raw = JSON.parse(readFileSync(file, "utf-8"))
    raw.fileHotspots[0].route = "/../outside"
    write(file, raw)
    let queue = model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current
    expect(queue.coverage.domains.hotspot.status).toBe("invalid")
    expect(JSON.stringify(queue.items)).not.toContain("/../")
    raw.fileHotspots[0].route = "/hotspots/files"
    raw.fileHotspots.push(raw.fileHotspots[0])
    write(file, raw)
    queue = model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current
    expect(queue.coverage.domains.hotspot.status).toBe("invalid")
    expect(queue.coverage.diagnostics.some((entry) => /duplicate/.test(entry.reason))).toBe(true)
  })

  test.each([
    ["hotspots", { fileHotspots: [null] }, "hotspot"],
    ["hotspots", {}, "hotspot"],
    ["impact", { impact_opportunities: {} }, "impact"],
    ["controls", { goals: [{ goal: "Quality", controls: [{ metricId: "LOC" }, { metricId: "LOC" }] }] }, "control"],
  ] as const)("keeps malformed %s shapes explicit without throwing", (shard, value, domain) => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready/data")
    snapshot(dataDir)
    write(join(dataDir, `${shard}.json`), value)
    expect(model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current.coverage.domains[domain].status).toBe(
      "invalid",
    )
  })

  test("rejects duplicate component selectors instead of manufacturing dependency provenance", () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready/data")
    snapshot(dataDir)
    write(join(dataDir, "files_main.json"), { files: [{ id: "file:a", components: ["Core", "Core"] }] })
    const queue = model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current
    expect(queue.coverage.domains.coupling.status).toBe("invalid")
    expect(queue.coverage.diagnostics.some((entry) => /duplicate/.test(entry.reason))).toBe(true)
  })

  test("rejects duplicate dependency identities before component aggregation", () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready/data")
    snapshot(dataDir)
    const edge = { id: "same-edge", fromComponentId: "component:primary:Core", toComponentId: "component:primary:Api" }
    write(join(dataDir, "component_dependencies.json"), { dependencies: [edge, edge] })
    expect(model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current.coverage.domains.coupling.status).toBe(
      "invalid",
    )
  })

  test("rejects unsafe declared shards and records with no available dataset overview route", () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready/data")
    snapshot(dataDir)
    let queue = model(datasetsRoot, [descriptor("ready", { capabilities: [] })]).queuesByWindow.current
    expect(queue.coverage.domains.control.status).toBe("invalid")
    expect(queue.coverage.domains.security.status).toBe("invalid")
    const context = JSON.parse(readFileSync(join(dataDir, "report_context.json"), "utf-8"))
    context.canonicalShards.impact = "../impact.json"
    write(join(dataDir, "report_context.json"), context)
    queue = model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current
    expect(queue.coverage.datasets.unavailable).toHaveLength(1)
    expect(queue.items).toHaveLength(0)
  })

  test("supports only declared repository alerts and preserves their original index", () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready/data")
    snapshot(dataDir)
    const context = JSON.parse(readFileSync(join(dataDir, "report_context.json"), "utf-8"))
    delete context.canonicalShards.security
    context.canonicalShards.alerts = "security.json"
    context.capabilities = Object.keys(context.canonicalShards)
    write(join(dataDir, "report_context.json"), context)
    write(join(dataDir, "security.json"), {
      alerts: [
        { id: "closed", open: false },
        { id: "open", open: true, severity: "high" },
      ],
    })
    const queue = model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current
    expect(queue.items.flatMap((item) => item.evidence)).toContainEqual(
      expect.objectContaining({ domain: "security", shard: "security.json", record: "alerts[index=1]" }),
    )
  })

  test("retains declared control and security routes outside the hotspot route inventory", () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready/data")
    snapshot(dataDir)
    write(join(dataDir, "security.json"), {
      alerts: [{ id: "alert", open: true, severity: "high", route: "/security/packages" }],
    })
    write(join(dataDir, "controls.json"), {
      goals: [{ goal: "Quality", controls: [{ metricId: "LOC", status: "FAILED", route: "/controls/quality" }] }],
    })
    const evidence = model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current.items.flatMap(
      (item) => item.evidence,
    )
    expect(evidence).toContainEqual(
      expect.objectContaining({ domain: "security", href: "/datasets/ready/security/packages" }),
    )
    expect(evidence).toContainEqual(
      expect.objectContaining({ domain: "control", href: "/datasets/ready/controls/quality" }),
    )
  })

  test("applies deployment base paths to every returned evidence anchor after common validation", () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready/data")
    snapshot(dataDir)
    snapshot(join(dataDir, "history/older"), false, true)
    write(join(dataDir, "snapshot-history.json"), {
      historyVersion: 1,
      snapshots: [{ dataDir: "." }, { dataDir: "history/older" }],
    })
    const child = Bun.spawnSync({
      cmd: [
        process.execPath,
        "--define",
        'import.meta.env={"BASE_URL":"/planetnik"}',
        "--eval",
        `
      import { readDatasetActionQueueModel } from ${JSON.stringify(import.meta.resolve("../datasets/actionQueueSource.js"))};
      process.stdout.write(JSON.stringify(readDatasetActionQueueModel(${JSON.stringify({ datasetsRoot, catalog: { catalogVersion: 1, datasets: [descriptor("ready")] } })})));
    `,
      ],
    })
    expect(child.exitCode).toBe(0)
    const result = JSON.parse(new TextDecoder().decode(child.stdout)) as ReturnType<typeof model>
    for (const queue of Object.values(result.queuesByWindow)) {
      expect(queue.items.length).toBeGreaterThan(0)
      for (const item of queue.items)
        for (const anchor of [...item.evidence, ...item.signals.flatMap((signal) => signal.evidence)]) {
          expect(anchor.href).toStartWith("/planetnik/datasets/ready/")
        }
    }
  })

  test("caps static windows while preserving full totals and explicit truncation", () => {
    const datasetsRoot = root()
    const dataDir = join(datasetsRoot, "ready/data")
    snapshot(dataDir)
    const hotspots = JSON.parse(readFileSync(join(dataDir, "hotspots.json"), "utf-8")) as Record<string, unknown[]>
    const base = hotspots.fileHotspots![0] as Record<string, unknown>
    hotspots.fileHotspots = Array.from({ length: 6 }, (_, index) => ({
      ...base,
      id: `file:src/${index}.ts`,
      name: `${index}.ts`,
      route: "/hotspots/files",
    }))
    write(join(dataDir, "hotspots.json"), hotspots)

    const full = model(datasetsRoot, [descriptor("ready")]).queuesByWindow.current
    const boundedModel = model(datasetsRoot, [descriptor("ready")], { maxItemsPerWindow: 2 })
    const bounded = boundedModel.queuesByWindow.current

    expect(full.items.length).toBeGreaterThan(2)
    expect(bounded.items).toEqual(full.items.slice(0, 2))
    expect(boundedModel.totalItemsByWindow.current).toBe(full.items.length)
    expect(boundedModel.truncatedByWindow.current).toBe(true)
    expect(boundedModel.maxItemsPerWindow).toBe(2)
  })

  test("rejects a non-positive static window limit", () => {
    const datasetsRoot = root()
    snapshot(join(datasetsRoot, "ready/data"))
    expect(() => model(datasetsRoot, [descriptor("ready")], { maxItemsPerWindow: 0 })).toThrow(
      "maxItemsPerWindow must be a positive integer.",
    )
  })
})
