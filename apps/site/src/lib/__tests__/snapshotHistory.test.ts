import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  readDatasetCurrentSnapshot,
  readDatasetSnapshotHistory,
  readSnapshotHistory,
} from "../datasets/snapshotHistory.js"

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2))
}

function createDataRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "planetnik-snapshot-history-"))
  temporaryRoots.push(root)
  const dataDir = join(root, "data")
  mkdirSync(dataDir, { recursive: true })
  return dataDir
}

function writeSnapshot(
  dataDir: string,
  options: {
    snapshotId: string
    generatedAt: string
    metrics?: ReadonlyArray<{ id: string; value: number }>
  },
): void {
  mkdirSync(dataDir, { recursive: true })
  const canonicalShards = {
    summary: "analysisResults.json",
    metrics: "metrics.json",
    contributors: "contributors.json",
  }
  writeJson(join(dataDir, "report_context.json"), {
    mode: "single_repository",
    reportMode: "single_repository",
    title: "History fixture",
    rootRoute: "/",
    dataVersion: 2,
    repositoryId: "repo:history-fixture",
    snapshotId: options.snapshotId,
    generatedAt: options.generatedAt,
    source: "test",
    hasLandscape: false,
    hasSingleRepositoryAnalysis: true,
    primaryNavigation: [],
    capabilities: Object.keys(canonicalShards),
    canonicalShards,
    compatibilityProjections: {},
    entityIdPolicy: {
      repository: "repo:<normalised repository key>",
      file: "file:<normalised relative path>",
      unit: "unit:<normalised relative path>:<start line>",
      component: "component:<decomposition key>:<component name>",
      contributor: "contributor:<lowercase trimmed email>",
    },
  })
  writeJson(join(dataDir, "analysisResults.json"), {
    metadata: { name: "History fixture", description: "fixture" },
    filesCount: 1,
    linesOfCode: 10,
  })
  writeJson(join(dataDir, "metrics.json"), { metrics: options.metrics ?? [{ id: "FILES", value: 1 }] })
  writeJson(join(dataDir, "contributors.json"), { contributors: [] })
}

function writeManifest(dataDir: string, snapshots: ReadonlyArray<{ dataDir: string }>): void {
  writeJson(join(dataDir, "snapshot-history.json"), { historyVersion: 1, snapshots })
}

describe("readSnapshotHistory", () => {
  test("loads current entity collections only when explicitly requested", () => {
    const datasetsRoot = mkdtempSync(join(tmpdir(), "planetnik-current-entities-"))
    temporaryRoots.push(datasetsRoot)
    const dataDir = join(datasetsRoot, "entity-fixture", "data")
    writeSnapshot(dataDir, {
      snapshotId: "22222222-2222-4222-8222-222222222222",
      generatedAt: "2026-09-04T00:00:00.000Z",
    })
    const context = JSON.parse(readFileSync(join(dataDir, "report_context.json"), "utf-8"))
    Object.assign(context.canonicalShards, {
      filesMain: "files_main.json",
      hotspots: "hotspots.json",
      controls: "controls.json",
    })
    context.capabilities = Object.keys(context.canonicalShards)
    writeJson(join(dataDir, "report_context.json"), context)
    writeJson(join(dataDir, "files_main.json"), { files: [{ id: "file:a.ts", components: ["Core"] }] })
    writeJson(join(dataDir, "hotspots.json"), { fileHotspots: [{ id: "file:a.ts", kind: "file" }] })
    writeJson(join(dataDir, "controls.json"), {
      goals: [{ goal: "Quality", controls: [{ metricId: "LOC", status: "FAILED" }] }],
    })
    writeJson(join(dataDir, "contributors.json"), { contributors: [{ email: "owner@example.test" }] })

    const defaults = readDatasetCurrentSnapshot("entity-fixture", { datasetsRoot })
    const included = readDatasetCurrentSnapshot("entity-fixture", { datasetsRoot, includeEntities: true })
    expect(defaults.tag).toBe("ready")
    expect(included.tag).toBe("ready")
    if (defaults.tag !== "ready" || included.tag !== "ready") return
    expect(defaults.snapshot.snapshot.entities).toBeUndefined()
    expect(included.snapshot.snapshot.entities).toMatchObject({
      components: { present: true, records: [{ id: "component:primary:Core" }] },
      hotspots: { present: true, records: [{ id: "file:a.ts" }] },
      controls: { present: true, records: [{ id: "control:Quality:LOC" }] },
      ownership: { present: true, records: [{ id: "contributor:owner@example.test" }] },
    })
  })

  test("reads the current canonical snapshot independently of history retention", () => {
    const datasetsRoot = mkdtempSync(join(tmpdir(), "planetnik-current-snapshot-"))
    temporaryRoots.push(datasetsRoot)
    const dataDir = join(datasetsRoot, "requests-python-pilot", "data")
    writeSnapshot(dataDir, {
      snapshotId: "22222222-2222-4222-8222-222222222222",
      generatedAt: "2026-09-04T00:00:00.000Z",
      metrics: [{ id: "LINES_OF_CODE_MAIN", value: 12 }],
    })

    const result = readDatasetCurrentSnapshot("requests-python-pilot", { datasetsRoot })

    expect(result.tag).toBe("ready")
    if (result.tag !== "ready") return
    expect(result.snapshot.relativeDataDir).toBe(".")
    expect(result.snapshot.snapshot).toMatchObject({
      context: { snapshotId: "22222222-2222-4222-8222-222222222222" },
      metrics: { metrics: [{ id: "LINES_OF_CODE_MAIN", value: 12 }] },
    })
  })

  test("resolves history from the named dataset instead of the active report environment", () => {
    const datasetsRoot = mkdtempSync(join(tmpdir(), "planetnik-named-history-"))
    temporaryRoots.push(datasetsRoot)
    const dataDir = join(datasetsRoot, "requests-python-pilot", "data")
    writeSnapshot(join(dataDir, "history", "older"), {
      snapshotId: "11111111-1111-4111-8111-111111111111",
      generatedAt: "2026-09-01T00:00:00.000Z",
      metrics: [{ id: "FILES", value: 10 }],
    })
    writeSnapshot(dataDir, {
      snapshotId: "22222222-2222-4222-8222-222222222222",
      generatedAt: "2026-09-04T00:00:00.000Z",
      metrics: [{ id: "FILES", value: 12 }],
    })
    writeManifest(dataDir, [{ dataDir: "." }, { dataDir: "history/older" }])

    const result = readDatasetSnapshotHistory("requests-python-pilot", { datasetsRoot })

    expect(result.tag).toBe("ready")
    if (result.tag !== "ready") return
    expect(result.history.manifestPath).toBe(join(dataDir, "snapshot-history.json"))
    expect(result.history.comparison.status).toBe("compatible")
  })

  test("keeps unsafe or absent dataset selections explicit", () => {
    const datasetsRoot = mkdtempSync(join(tmpdir(), "planetnik-named-history-state-"))
    temporaryRoots.push(datasetsRoot)

    expect(readDatasetSnapshotHistory("../outside", { datasetsRoot })).toEqual({
      tag: "invalid",
      message: "Dataset id is not a safe catalogue identifier.",
    })
    expect(readDatasetSnapshotHistory("missing-dataset", { datasetsRoot })).toEqual({
      tag: "missing",
      message: "Dataset 'missing-dataset' has no recognised report data directory.",
    })
  })

  test("reads canonical snapshots and compares the latest pair", () => {
    const dataDir = createDataRoot()
    writeSnapshot(join(dataDir, "history", "older"), {
      snapshotId: "11111111-1111-4111-8111-111111111111",
      generatedAt: "2026-09-01T00:00:00.000Z",
      metrics: [{ id: "FILES", value: 10 }],
    })
    writeSnapshot(dataDir, {
      snapshotId: "22222222-2222-4222-8222-222222222222",
      generatedAt: "2026-09-04T00:00:00.000Z",
      metrics: [{ id: "FILES", value: 12 }],
    })
    writeManifest(dataDir, [{ dataDir: "." }, { dataDir: "history/older" }])

    const result = readSnapshotHistory(dataDir)

    expect(result.tag).toBe("ready")
    if (result.tag !== "ready") return

    expect(result.history.entries).toHaveLength(2)
    expect(result.history.manifestPath).toBe(join(dataDir, "snapshot-history.json"))
    expect(result.history.entries[0]?.relativeDataDir).toBe(".")
    expect(result.history.comparison).toEqual(
      expect.objectContaining({
        status: "compatible",
        baseline: expect.objectContaining({ snapshotId: "11111111-1111-4111-8111-111111111111" }),
        current: expect.objectContaining({ snapshotId: "22222222-2222-4222-8222-222222222222" }),
      }),
    )
  })

  test("returns a missing state when no history manifest exists", () => {
    const dataDir = createDataRoot()

    expect(readSnapshotHistory(dataDir)).toEqual({
      tag: "missing",
      message: "Snapshot history manifest is not present.",
    })
  })

  test("keeps an archive-only interim manifest explicit", () => {
    const dataDir = createDataRoot()
    writeSnapshot(join(dataDir, "history", "older"), {
      snapshotId: "11111111-1111-4111-8111-111111111111",
      generatedAt: "2026-09-01T00:00:00.000Z",
      metrics: [{ id: "FILES", value: 10 }],
    })
    writeManifest(dataDir, [{ dataDir: "history/older" }])

    expect(readSnapshotHistory(dataDir)).toEqual({
      tag: "missing",
      message: "Snapshot history manifest does not include the current snapshot.",
    })
  })

  test("rejects malformed manifests and unsafe snapshot directories", () => {
    const dataDir = createDataRoot()

    writeJson(join(dataDir, "snapshot-history.json"), { historyVersion: 2, snapshots: [] })
    expect(readSnapshotHistory(dataDir)).toEqual({
      tag: "invalid",
      message: "Snapshot history manifest must use historyVersion 1.",
    })

    writeManifest(dataDir, [{ dataDir: "../outside" }])
    expect(readSnapshotHistory(dataDir)).toEqual({
      tag: "invalid",
      message: "Snapshot history dataDir must be a safe relative path.",
    })
  })

  test("rejects history entries without a valid canonical v2 context", () => {
    const dataDir = createDataRoot()
    mkdirSync(join(dataDir, "history", "broken"), { recursive: true })
    writeManifest(dataDir, [{ dataDir: "history/broken" }])

    expect(readSnapshotHistory(dataDir)).toEqual({
      tag: "invalid",
      message: "Snapshot history entry 'history/broken' requires a valid canonical v2 report context.",
    })
  })

  test("keeps one-snapshot history explicit instead of implying a trend", () => {
    const dataDir = createDataRoot()
    writeSnapshot(dataDir, {
      snapshotId: "22222222-2222-4222-8222-222222222222",
      generatedAt: "2026-09-04T00:00:00.000Z",
    })
    writeManifest(dataDir, [{ dataDir: "." }])

    const result = readSnapshotHistory(dataDir)

    expect(result.tag).toBe("ready")
    if (result.tag !== "ready") return
    expect(result.history.comparison).toEqual({
      status: "missing",
      missing: "baseline",
      message: "Snapshot history requires at least two snapshots.",
    })
  })
})
