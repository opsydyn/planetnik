import { describe, expect, test } from "bun:test"
import { type CanonicalReportContext, CodeCityInputError } from "@planetnik/common"
import {
  type LandscapeCodeCitySnapshotRecords,
  readLandscapeRepositoryCodeCitySnapshot,
  toLandscapeCodeCitySnapshotInput,
} from "../landscapeCodeCitySnapshot.js"

const context = (canonicalShards?: Record<string, string>): CanonicalReportContext => ({
  dataVersion: 2,
  mode: "single_repository",
  reportMode: "single_repository",
  title: "Landscape repository fixture",
  repositoryId: "repo:landscape-fixture",
  snapshotId: "snapshot:fixture",
  canonicalShards,
})

const fullRecords = (): LandscapeCodeCitySnapshotRecords => ({
  context: context({
    filesMain: "files_main.json",
    filesTest: "files_test.json",
    units: "units.json",
    componentDependencies: "component_dependencies.json",
    hotspots: "hotspots.json",
    impact: "impact.json",
  }),
  filesMain: [
    {
      id: "file:main",
      relativePath: "src/main.ts",
      linesOfCode: 12,
      components: ["app"],
    },
  ],
  filesTest: [{ id: "file:test", relativePath: "test/main.ts", linesOfCode: 4 }],
  units: [{ id: "unit:main", relativeFileName: "src/main.ts", shortName: "main" }],
  dependencies: [{ decompositionKey: "package", fromComponent: "app", toComponent: "lib" }],
  hotspots: [{ id: "hotspot:file", kind: "file", name: "src/main.ts" }],
  impact: { impact_opportunities: [{ id: "impact:file", kind: "file", name: "src/main.ts" }] },
})

describe("toLandscapeCodeCitySnapshotInput", () => {
  test("converts repository-local canonical records into shared input", () => {
    const input = toLandscapeCodeCitySnapshotInput(fullRecords())

    expect(input.context.repositoryId).toBe("repo:landscape-fixture")
    expect(input.filesMain.files).toHaveLength(1)
    expect(input.filesTest?.files).toHaveLength(1)
    expect(input.units?.units).toHaveLength(1)
    expect(input.componentDependencies?.dependencies).toHaveLength(1)
    expect(input.hotspots?.fileHotspots).toHaveLength(1)
    expect(input.impact?.impact_opportunities).toHaveLength(1)
  })

  test("preserves manifest-declared empty optional shards", () => {
    const records = fullRecords()
    const input = toLandscapeCodeCitySnapshotInput({
      ...records,
      context: context({
        filesMain: "files_main.json",
        units: "units.json",
        componentDependencies: "component_dependencies.json",
        hotspots: "hotspots.json",
        impact: "impact.json",
      }),
      filesTest: [],
      units: [],
      dependencies: [],
      hotspots: [],
      impact: undefined,
    })

    expect(input.filesTest).toBeUndefined()
    expect(input.units).toEqual({ units: [] })
    expect(input.componentDependencies).toEqual({ dependencies: [] })
    expect(input.hotspots).toEqual({})
    expect(input.impact).toEqual({})
  })

  test("rejects a landscape or non-v2 repository context", () => {
    expect(() =>
      toLandscapeCodeCitySnapshotInput({
        ...fullRecords(),
        context: { ...context(), mode: "landscape", reportMode: "landscape" },
      }),
    ).toThrow(CodeCityInputError)
    expect(() =>
      toLandscapeCodeCitySnapshotInput({
        ...fullRecords(),
        context: { ...context(), dataVersion: 1 },
      }),
    ).toThrow(CodeCityInputError)
  })

  test("rejects a missing files_main collection", () => {
    expect(() => toLandscapeCodeCitySnapshotInput({ ...fullRecords(), filesMain: null })).toThrow(CodeCityInputError)
  })
})

test("reads repository-local JSON through the supplied reader", () => {
  const records = fullRecords()
  const exports = new Map<string, unknown>([
    ["report_context.json", records.context],
    ["files_main.json", { files: records.filesMain }],
    ["files_test.json", { files: records.filesTest }],
    ["units.json", { units: records.units }],
    ["component_dependencies.json", { dependencies: records.dependencies }],
    ["hotspots.json", { fileHotspots: records.hotspots }],
    ["impact.json", records.impact],
  ])
  const input = readLandscapeRepositoryCodeCitySnapshot(
    "alan/fixture",
    <_T>(_, fileName) => (exports.get(fileName) as _T | undefined) ?? null,
  )

  expect(input.filesMain.files).toHaveLength(1)
  expect(input.units?.units).toHaveLength(1)
})
