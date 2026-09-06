import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { DatasetDescriptor } from "@planetnik/common"
import { getDatasetViewPath } from "../datasets/explore.js"
import { readDatasetReport, toDatasetCodeCitySnapshotInput } from "../datasets/reportReader.js"

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2))
}

function createDatasetRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "planetnik-report-reader-"))
  temporaryRoots.push(root)
  return root
}

function writeReaderFixture(root: string): void {
  const dataDir = join(root, "python-fixture", "data")
  mkdirSync(dataDir, { recursive: true })
  const canonicalShards = {
    summary: "analysisResults.json",
    filesMain: "files_main.json",
    metrics: "metrics.json",
    contributors: "contributors.json",
  }
  writeJson(join(dataDir, "report_context.json"), {
    mode: "single_repository",
    reportMode: "single_repository",
    title: "Python fixture",
    rootRoute: "/",
    dataVersion: 2,
    repositoryId: "repo:python-fixture",
    snapshotId: "3d611736-9df1-4d22-a93e-00d06b13e767",
    generatedAt: "2026-09-03T21:08:09.001Z",
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
    metadata: { name: "Python fixture", description: "fixture" },
    filesCount: 1,
    linesOfCode: 12,
  })
  writeJson(join(dataDir, "files_main.json"), {
    files: [{ id: "file:src/main.py", relativePath: "src/main.py", extension: "py", linesOfCode: 12 }],
  })
  writeJson(join(dataDir, "metrics.json"), { metrics: [{ id: "LINES_OF_CODE_TEST", value: 0 }] })
  writeJson(join(dataDir, "contributors.json"), { contributors: [] })
}

const readyDescriptor = (overrides: Partial<DatasetDescriptor> = {}): DatasetDescriptor => ({
  id: "python-fixture",
  slug: "python-fixture",
  title: "Python fixture",
  mode: "single_repository",
  snapshot: {
    snapshotId: "3d611736-9df1-4d22-a93e-00d06b13e767",
    dataVersion: 2,
    generatedAt: "2026-09-03T21:08:09.001Z",
  },
  provenance: {},
  description: "fixture",
  stats: {},
  languages: [],
  capabilities: ["summary", "filesMain"],
  tags: [],
  curation: { featured: false, shelf: "Fixtures", order: 1 },
  availability: "ready",
  ...overrides,
})

describe("dataset report reader", () => {
  test("reads a named canonical snapshot and adapts it for Code City", () => {
    const datasetsRoot = createDatasetRoot()
    writeReaderFixture(datasetsRoot)

    const result = readDatasetReport("python-fixture", { datasetsRoot })

    expect(result.tag).toBe("ready")
    if (result.tag !== "ready") return

    expect(result.snapshot.context.repositoryId).toBe("repo:python-fixture")
    expect(result.snapshot.summary?.linesOfCode).toBe(12)
    expect(result.snapshot.filesMain).toEqual([
      { id: "file:src/main.py", relativePath: "src/main.py", extension: "py", linesOfCode: 12 },
    ])

    const input = toDatasetCodeCitySnapshotInput(result.snapshot)
    expect(input.filesMain.files).toHaveLength(1)
    expect(input.filesMain.files[0]?.relativePath).toBe("src/main.py")
    expect(input.filesTest).toBeUndefined()
  })

  test("only exposes real report view paths for generated snapshots", () => {
    const ready = readyDescriptor()
    expect(getDatasetViewPath(ready, "overview")).toBe("/datasets/python-fixture/overview")
    expect(getDatasetViewPath(ready, "code-city")).toBe("/datasets/python-fixture/code-city")
    expect(getDatasetViewPath({ ...ready, capabilities: [] }, "trends")).toBe("/datasets/python-fixture/trends")
    expect(getDatasetViewPath({ ...ready, availability: "partial" }, "overview")).toBe(
      "/datasets/python-fixture/overview",
    )
    expect(getDatasetViewPath({ ...ready, availability: "partial" }, "code-city")).toBe(
      "/datasets/python-fixture/code-city",
    )
    expect(getDatasetViewPath({ ...ready, capabilities: ["summary"] }, "code-city")).toBeNull()
    expect(getDatasetViewPath({ ...ready, mode: "landscape" }, "trends")).toBeNull()
    expect(getDatasetViewPath({ ...ready, availability: "planned", snapshot: undefined }, "overview")).toBeNull()
  })
})
