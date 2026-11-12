import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readSnapshotHistory } from "../datasets/snapshotHistory.js"

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2))
}

const snapshotContext = (snapshotId: string, generatedAt: string) => ({
  mode: "single_repository",
  reportMode: "single_repository",
  title: "Entity history fixture",
  rootRoute: "/",
  dataVersion: 2,
  repositoryId: "repo:entity-history-fixture",
  snapshotId,
  generatedAt,
  source: "test",
  hasLandscape: false,
  hasSingleRepositoryAnalysis: true,
  primaryNavigation: [],
  capabilities: [
    "summary",
    "filesMain",
    "metrics",
    "units",
    "componentDependencies",
    "hotspots",
    "controls",
    "contributors",
  ],
  canonicalShards: {
    summary: "analysisResults.json",
    filesMain: "files_main.json",
    metrics: "metrics.json",
    units: "units.json",
    componentDependencies: "component_dependencies.json",
    hotspots: "hotspots.json",
    controls: "controls.json",
    contributors: "contributors.json",
  },
  compatibilityProjections: {},
  entityIdPolicy: {
    repository: "repo:<normalised repository key>",
    file: "file:<normalised relative path>",
    unit: "unit:<normalised relative path>:<start line>",
    component: "component:<decomposition key>:<component name>",
    contributor: "contributor:<lowercase trimmed email>",
  },
})

function writeEntitySnapshot(dataDir: string, snapshotId: string, generatedAt: string, linesOfCode: number): void {
  mkdirSync(dataDir, { recursive: true })
  writeJson(join(dataDir, "report_context.json"), snapshotContext(snapshotId, generatedAt))
  writeJson(join(dataDir, "analysisResults.json"), { metadata: { name: "Entity history fixture" } })
  writeJson(join(dataDir, "metrics.json"), { metrics: [{ id: "LINES_OF_CODE_MAIN", value: linesOfCode }] })
  writeJson(join(dataDir, "files_main.json"), {
    files: [{ id: "file:src/api.ts", linesOfCode, components: ["api"] }],
  })
  writeJson(join(dataDir, "units.json"), { units: [] })
  writeJson(join(dataDir, "component_dependencies.json"), { dependencies: [] })
  writeJson(join(dataDir, "hotspots.json"), {
    componentHotspots: [{ id: "component:primary:api", kind: "component", score: linesOfCode / 10 }],
  })
  writeJson(join(dataDir, "controls.json"), {
    goals: [
      {
        goal: "Keep it simple",
        controls: [{ metricId: "LINES_OF_CODE_MAIN", metricValue: linesOfCode, status: "OK" }],
      },
    ],
  })
  writeJson(join(dataDir, "contributors.json"), {
    contributors: [{ id: "contributor:dev@example.com", email: "dev@example.com", commitsCount: linesOfCode }],
  })
}

describe("readSnapshotHistory entity comparisons", () => {
  test("attaches JSON-derived entity collections and compares every supported domain", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-history-entities-"))
    temporaryRoots.push(root)
    const dataDir = join(root, "data")
    writeEntitySnapshot(join(dataDir, "older"), "11111111-1111-4111-8111-111111111111", "2026-09-01T00:00:00.000Z", 10)
    writeEntitySnapshot(dataDir, "22222222-2222-4222-8222-222222222222", "2026-09-04T00:00:00.000Z", 12)
    writeJson(join(dataDir, "snapshot-history.json"), {
      historyVersion: 1,
      snapshots: [{ dataDir: "." }, { dataDir: "older" }],
    })

    const result = readSnapshotHistory(dataDir)

    expect(result.tag).toBe("ready")
    if (result.tag !== "ready") return
    expect(result.history.entries[0]?.snapshot.entities?.components?.records).toHaveLength(1)
    expect(result.history.entityComparisons.components).toEqual(
      expect.objectContaining({
        status: "compatible",
        domain: "components",
        deltas: [expect.objectContaining({ id: "component:primary:api", direction: "changed" })],
      }),
    )
    expect(result.history.entityComparisons.hotspots).toEqual(expect.objectContaining({ status: "compatible" }))
    expect(result.history.entityComparisons.controls).toEqual(expect.objectContaining({ status: "compatible" }))
    expect(result.history.entityComparisons.ownership).toEqual(expect.objectContaining({ status: "compatible" }))
  })
})
