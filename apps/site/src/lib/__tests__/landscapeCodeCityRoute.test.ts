import { describe, expect, test } from "bun:test"
import type { CodeCitySnapshotInput } from "@planetnik/common"
import { resolveLandscapeCodeCityRouteState } from "../landscapeCodeCityRoute.js"

const input = (reportMode: "single_repository" | "landscape"): CodeCitySnapshotInput => ({
  context: {
    dataVersion: 2,
    mode: reportMode,
    reportMode,
    title: "Route fixture",
    repositoryId: "repo:route-fixture",
  },
  filesMain: {
    files: [{ id: "file:route", relativePath: "src/route.ts", linesOfCode: 3 }],
  },
  filesTest: { files: [] },
  units: { units: [] },
  componentDependencies: { dependencies: [] },
  hotspots: {},
  impact: {},
})

describe("resolveLandscapeCodeCityRouteState", () => {
  test("builds a ready state from a single-repository snapshot", () => {
    const state = resolveLandscapeCodeCityRouteState("Route fixture", input("single_repository"))

    expect(state.tag).toBe("ready")
    if (state.tag === "ready") expect(state.model.buildings).toHaveLength(1)
  })

  test("keeps landscape snapshots explicitly unsupported", () => {
    const state = resolveLandscapeCodeCityRouteState("Route fixture", input("landscape"))

    expect(state).toEqual({ tag: "unsupported-landscape", title: "Route fixture" })
  })

  test("returns a bounded invalid state when the snapshot cannot be read", () => {
    const state = resolveLandscapeCodeCityRouteState("Route fixture", null)

    expect(state).toEqual({
      tag: "invalid",
      message: "Landscape repository Code City could not read a canonical v2 snapshot.",
    })
  })
})
