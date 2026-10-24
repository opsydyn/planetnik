import { describe, expect, test } from "bun:test"
import {
  buildCodeCityModel,
  CodeCityInputError,
  type CodeCityModel,
  type CodeCitySnapshotInput,
} from "@planetnik/common"
import { type CodeCityRouteResolution, resolveCodeCityRouteState } from "../routeState.js"

const snapshotInput = (overrides: Partial<CodeCitySnapshotInput> = {}): CodeCitySnapshotInput => ({
  context: {
    dataVersion: 2,
    reportMode: "single_repository",
    title: "Fixture repository",
    repositoryId: "repo:fixture",
  },
  filesMain: {
    files: [
      {
        id: "file:src/index.ts",
        relativePath: "src/index.ts",
        linesOfCode: 20,
      },
    ],
  },
  ...overrides,
})

const resolutionFor = (model: CodeCityModel): CodeCityRouteResolution => ({
  tag: "model",
  model,
})

describe("resolveCodeCityRouteState", () => {
  test("returns ready when the complete single-repository model has buildings", () => {
    const model = buildCodeCityModel({
      ...snapshotInput(),
      filesTest: { files: [] },
      units: { units: [] },
      componentDependencies: { dependencies: [] },
      hotspots: { fileHotspots: [], unitHotspots: [], componentHotspots: [] },
      impact: { impact_opportunities: [] },
    })

    expect(
      resolveCodeCityRouteState({
        title: "Fixture repository",
        reportMode: "single_repository",
        resolution: resolutionFor(model),
      }).tag,
    ).toBe("ready")
  })

  test("returns partial when optional canonical shards are missing", () => {
    const model = buildCodeCityModel(snapshotInput())

    expect(
      resolveCodeCityRouteState({
        title: "Fixture repository",
        reportMode: "single_repository",
        resolution: resolutionFor(model),
      }).tag,
    ).toBe("partial")
  })

  test("returns unsupported-landscape before attempting a model", () => {
    expect(
      resolveCodeCityRouteState({
        title: "Landscape fixture",
        reportMode: "landscape",
        resolution: {
          tag: "invalid",
          message: "This must remain hidden for landscapes.",
        },
      }),
    ).toEqual({ tag: "unsupported-landscape", title: "Landscape fixture" })
  })

  test("returns invalid when required input is rejected", () => {
    let resolution: CodeCityRouteResolution

    try {
      buildCodeCityModel({
        ...snapshotInput(),
        context: { ...snapshotInput().context, repositoryId: "" },
      })
      throw new Error("Expected invalid required input to be rejected")
    } catch (error) {
      if (!(error instanceof CodeCityInputError)) throw error
      resolution = { tag: "invalid", message: error.message }
    }

    expect(
      resolveCodeCityRouteState({
        title: "Fixture repository",
        reportMode: "single_repository",
        resolution: resolution!,
      }),
    ).toEqual({
      tag: "invalid",
      message: "Code City requires a repository identity",
    })
  })

  test("returns empty for a valid model with no buildings", () => {
    const model = buildCodeCityModel({
      ...snapshotInput(),
      filesMain: { files: [] },
    })

    expect(
      resolveCodeCityRouteState({
        title: "Fixture repository",
        reportMode: "single_repository",
        resolution: resolutionFor(model),
      }).tag,
    ).toBe("empty")
  })
})
