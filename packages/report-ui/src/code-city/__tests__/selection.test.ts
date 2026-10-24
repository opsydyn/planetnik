import { describe, expect, test } from "bun:test"
import type { CodeCityModel, CodeCitySignals } from "@planetnik/common"
import { resolveCodeCitySelection } from "../selection.js"

const signals: CodeCitySignals = {
  footprint: { loc: 1, buildingCount: 1 },
  complexity: { maxMcCabe: null, unitCount: 0 },
  health: { score: null, severity: null, dominantDimension: null },
  change: { commits: null, temporalLinks: null },
  ownership: { contributorIds: [], contributorCount: 0 },
  impact: { score: null, dimension: null, sourceId: null },
}

const model = (): CodeCityModel => ({
  contractVersion: 1,
  snapshot: { repositoryId: "repo:fixture", title: "Fixture" },
  districts: [
    {
      id: "district:core",
      kind: "component",
      label: "Core",
      decompositionKey: "primary",
      pathPrefix: null,
      buildingIds: ["file:shared"],
      metrics: signals,
      evidence: [{ kind: "component", id: "core-hotspot", route: "/hotspots#core" }],
      derived: false,
    },
    {
      id: "district:web",
      kind: "component",
      label: "Web",
      decompositionKey: "primary",
      pathPrefix: null,
      buildingIds: ["file:shared"],
      metrics: signals,
      evidence: [],
      derived: false,
    },
    {
      id: "district:other",
      kind: "component",
      label: "Other",
      decompositionKey: "primary",
      pathPrefix: null,
      buildingIds: [],
      metrics: signals,
      evidence: [],
      derived: false,
    },
  ],
  buildings: [
    {
      id: "file:shared",
      relativePath: "src/shared.ts",
      extension: "ts",
      sourceSets: ["main"],
      components: ["core", "web"],
      districtIds: ["district:core", "district:web"],
      primaryDistrictId: "district:core",
      metrics: signals,
      evidence: [
        { kind: "impact", id: "impact:shared", route: "/impact#shared" },
        { kind: "file", id: "file:shared", route: "/files#shared" },
      ],
    },
  ],
  units: [],
  edges: [
    {
      id: "edge:core-web",
      kind: "component_dependency",
      decompositionKey: "primary",
      sourceDistrictId: "district:core",
      targetDistrictId: "district:web",
      count: 1,
      locFrom: 1,
      evidenceCount: 1,
      resolution: "both",
      evidence: [{ kind: "component", id: "edge:core-web", route: "/topology#core-web" }],
    },
    {
      id: "edge:web-other",
      kind: "component_dependency",
      decompositionKey: "primary",
      sourceDistrictId: "district:web",
      targetDistrictId: "district:other",
      count: 1,
      locFrom: 1,
      evidenceCount: 1,
      resolution: "both",
      evidence: [],
    },
  ],
  coverage: {
    presentShards: ["files_main.json"],
    missingOptionalShards: [],
    diagnostics: [],
    derivedDistrictIds: [],
    counts: { files: 1, districts: 3, units: 0, edges: 2, diagnostics: 0 },
  },
  layout: {
    contractVersion: 1,
    seed: "code-city-v1:fixture",
    districtOrder: ["district:core", "district:web", "district:other"],
    buildingOrder: ["file:shared"],
    unitOrder: [],
  },
  legend: { channels: [] },
})

describe("resolveCodeCitySelection", () => {
  test("returns an empty selection state for null", () => {
    expect(resolveCodeCitySelection(model(), null)).toEqual({
      selection: null,
      districtIds: [],
      incidentEdgeIds: [],
      evidence: [],
    })
  })

  test("selects only a district and its incident edge evidence", () => {
    const result = resolveCodeCitySelection(model(), { kind: "district", id: "district:core" })

    expect(result.districtIds).toEqual(["district:core"])
    expect(result.incidentEdgeIds).toEqual(["edge:core-web"])
    expect(result.evidence).toEqual([
      { kind: "component", id: "core-hotspot", route: "/hotspots#core" },
      { kind: "component", id: "edge:core-web", route: "/topology#core-web" },
    ])
  })

  test("selects every represented district for a building without unrelated edges", () => {
    const result = resolveCodeCitySelection(model(), { kind: "building", id: "file:shared" })

    expect(result.districtIds).toEqual(["district:core", "district:web"])
    expect(result.incidentEdgeIds).toEqual(["edge:core-web", "edge:web-other"])
    expect(result.evidence).toEqual([
      { kind: "component", id: "edge:core-web", route: "/topology#core-web" },
      { kind: "file", id: "file:shared", route: "/files#shared" },
      { kind: "impact", id: "impact:shared", route: "/impact#shared" },
    ])
  })
})
