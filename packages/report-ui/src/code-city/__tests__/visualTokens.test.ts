import { describe, expect, test } from "bun:test"
import type { CodeCityModel, CodeCitySignals } from "@planetnik/common"
import {
  buildCodeCityVisualContext,
  resolveCodeCityBuildingVisual,
  resolveCodeCityDistrictVisual,
  resolveCodeCityMaterialFamily,
} from "../visualTokens.js"

const signals = (loc: number, unitCount = 0): CodeCitySignals => ({
  footprint: { loc, buildingCount: 1 },
  complexity: { maxMcCabe: null, unitCount },
  health: { score: null, severity: null, dominantDimension: null },
  change: { commits: null, temporalLinks: null },
  ownership: { contributorIds: [], contributorCount: 0 },
  impact: { score: null, dimension: null, sourceId: null },
})

const modelFixture = (): CodeCityModel => ({
  contractVersion: 1,
  snapshot: { repositoryId: "repo:tokens", title: "Tokens" },
  districts: [
    {
      id: "district:core",
      kind: "component",
      label: "Core",
      decompositionKey: "primary",
      pathPrefix: null,
      buildingIds: ["file:brick", "file:hub"],
      metrics: signals(0),
      evidence: [],
      derived: false,
    },
    {
      id: "district:api",
      kind: "component",
      label: "API",
      decompositionKey: "primary",
      pathPrefix: null,
      buildingIds: ["file:stepped"],
      metrics: signals(0),
      evidence: [],
      derived: false,
    },
    {
      id: "district:test",
      kind: "component",
      label: "Test",
      decompositionKey: "primary",
      pathPrefix: null,
      buildingIds: ["file:test"],
      metrics: signals(0),
      evidence: [],
      derived: false,
    },
    {
      id: "district:path",
      kind: "path",
      label: "docs",
      decompositionKey: null,
      pathPrefix: "docs",
      buildingIds: ["file:empty"],
      metrics: signals(0),
      evidence: [],
      derived: true,
    },
  ],
  buildings: [
    {
      id: "file:brick",
      relativePath: "src/brick.ts",
      extension: "ts",
      sourceSets: ["main"],
      components: ["core"],
      districtIds: ["district:core"],
      primaryDistrictId: "district:core",
      metrics: signals(15, 1),
      evidence: [],
    },
    {
      id: "file:hub",
      relativePath: "src/hub.rs",
      extension: "rs",
      sourceSets: ["main"],
      components: ["core", "api"],
      districtIds: ["district:core", "district:api"],
      primaryDistrictId: "district:core",
      metrics: signals(100, 2),
      evidence: [],
    },
    {
      id: "file:stepped",
      relativePath: "src/schema.json",
      extension: "json",
      sourceSets: ["main"],
      components: ["api"],
      districtIds: ["district:api"],
      primaryDistrictId: "district:api",
      metrics: signals(10, 80),
      evidence: [],
    },
    {
      id: "file:test",
      relativePath: "src/test.css",
      extension: "css",
      sourceSets: ["test"],
      components: ["test"],
      districtIds: ["district:test"],
      primaryDistrictId: "district:test",
      metrics: signals(1, 0),
      evidence: [],
    },
    {
      id: "file:empty",
      relativePath: "docs/readme.md",
      extension: "md",
      sourceSets: [],
      components: [],
      districtIds: ["district:path"],
      primaryDistrictId: "district:path",
      metrics: signals(0, 0),
      evidence: [],
    },
  ],
  units: [],
  edges: [
    {
      id: "edge:core-api",
      kind: "component_dependency",
      decompositionKey: "primary",
      sourceDistrictId: "district:core",
      targetDistrictId: "district:api",
      count: 6,
      locFrom: null,
      evidenceCount: null,
      resolution: "both",
      evidence: [],
    },
    {
      id: "edge:api-test",
      kind: "component_dependency",
      decompositionKey: "primary",
      sourceDistrictId: "district:api",
      targetDistrictId: "district:test",
      count: 2,
      locFrom: null,
      evidenceCount: null,
      resolution: "both",
      evidence: [],
    },
    {
      id: "edge:unresolved",
      kind: "component_dependency",
      decompositionKey: "primary",
      sourceDistrictId: "district:core",
      targetDistrictId: null,
      count: 99,
      locFrom: null,
      evidenceCount: null,
      resolution: "source",
      evidence: [],
    },
  ],
  coverage: {
    presentShards: ["files_main.json"],
    missingOptionalShards: [],
    diagnostics: [],
    derivedDistrictIds: ["district:path"],
    counts: { files: 5, districts: 4, units: 0, edges: 3, diagnostics: 0 },
  },
  layout: {
    contractVersion: 1,
    seed: "code-city-v1:tokens",
    districtOrder: ["district:core", "district:api", "district:test", "district:path"],
    buildingOrder: ["file:brick", "file:hub", "file:stepped", "file:test", "file:empty"],
    unitOrder: [],
  },
  legend: { channels: [] },
})

describe("resolveCodeCityMaterialFamily", () => {
  test("maps extensions to their semantic material families", () => {
    expect([
      resolveCodeCityMaterialFamily("ts"),
      resolveCodeCityMaterialFamily("tsx"),
      resolveCodeCityMaterialFamily("js"),
      resolveCodeCityMaterialFamily("jsx"),
      resolveCodeCityMaterialFamily("rs"),
      resolveCodeCityMaterialFamily("json"),
      resolveCodeCityMaterialFamily("yaml"),
      resolveCodeCityMaterialFamily("yml"),
      resolveCodeCityMaterialFamily("toml"),
      resolveCodeCityMaterialFamily("css"),
      resolveCodeCityMaterialFamily("scss"),
      resolveCodeCityMaterialFamily("html"),
      resolveCodeCityMaterialFamily("md"),
      resolveCodeCityMaterialFamily("mdx"),
      resolveCodeCityMaterialFamily("txt"),
      resolveCodeCityMaterialFamily("unknown"),
    ]).toEqual([
      "brick",
      "brick",
      "brick",
      "brick",
      "ironstone",
      "glazed_tile",
      "glazed_tile",
      "glazed_tile",
      "glazed_tile",
      "plaster",
      "plaster",
      "plaster",
      "paperwood",
      "paperwood",
      "paperwood",
      "slate",
    ])
  })
})

describe("Code City visual tokens", () => {
  test("derives exact district and building visuals from canonical values", () => {
    const model = modelFixture()
    const context = buildCodeCityVisualContext(model)
    const district = (id: string) => model.districts.find((item) => item.id === id)!
    const building = (id: string) => model.buildings.find((item) => item.id === id)!

    expect(resolveCodeCityDistrictVisual(district("district:core"), context)).toEqual({
      kind: "district",
      parcelStyle: "civic",
      landmarkTier: "hub",
      texturePattern: "gridded",
    })
    expect(resolveCodeCityDistrictVisual(district("district:api"), context)).toEqual({
      kind: "district",
      parcelStyle: "civic",
      landmarkTier: "super_hub",
      texturePattern: "gridded",
    })
    expect(resolveCodeCityDistrictVisual(district("district:test"), context)).toEqual({
      kind: "district",
      parcelStyle: "civic",
      landmarkTier: "hub",
      texturePattern: "gridded",
    })
    expect(resolveCodeCityDistrictVisual(district("district:path"), context)).toEqual({
      kind: "district",
      parcelStyle: "derived",
      landmarkTier: "none",
      texturePattern: "solid",
    })
    expect(resolveCodeCityBuildingVisual(building("file:hub"), context)).toEqual({
      kind: "building",
      materialFamily: "ironstone",
      archetype: "tower",
      roofStyle: "capped",
      texturePattern: "banded",
      floorCount: 4,
      facadeSegments: 2,
      multiDistrict: true,
    })
    expect(resolveCodeCityBuildingVisual(building("file:stepped"), context)).toEqual({
      kind: "building",
      materialFamily: "glazed_tile",
      archetype: "stepped",
      roofStyle: "stepped",
      texturePattern: "banded",
      floorCount: 2,
      facadeSegments: 4,
      multiDistrict: false,
    })
    expect(resolveCodeCityBuildingVisual(building("file:test"), context)).toEqual({
      kind: "building",
      materialFamily: "plaster",
      archetype: "annex",
      roofStyle: "pitched",
      texturePattern: "checker",
      floorCount: 1,
      facadeSegments: 1,
      multiDistrict: false,
    })
  })

  test("ignores unresolved edges and breaks equal landmark weights by district id", () => {
    const model = modelFixture()
    const context = buildCodeCityVisualContext({
      ...model,
      edges: [
        ...model.edges.filter((edge) => edge.id !== "edge:core-api" && edge.id !== "edge:api-test"),
        {
          ...model.edges[0]!,
          id: "edge:core-test",
          targetDistrictId: "district:test",
          count: 3,
        },
        {
          ...model.edges[0]!,
          id: "edge:api-test",
          sourceDistrictId: "district:api",
          targetDistrictId: "district:test",
          count: 3,
        },
      ],
    })

    expect(context.districtIncidentWeights.get("district:core")).toBe(3)
    expect(context.districtIncidentWeights.get("district:test")).toBe(6)
    expect(context.districtRanks.get("district:test")).toBe(0)
    expect(context.districtRanks.get("district:api")).toBe(1)
    expect(context.districtRanks.get("district:core")).toBe(2)
  })

  test("uses inclusive percentile boundaries and remains stable when source arrays are permuted", () => {
    const model = modelFixture()
    const context = buildCodeCityVisualContext(model)
    const hub = model.buildings.find((building) => building.id === "file:hub")!
    const stepped = model.buildings.find((building) => building.id === "file:stepped")!
    const permuted = {
      ...model,
      districts: [...model.districts].reverse(),
      buildings: [...model.buildings].reverse(),
      edges: [...model.edges].reverse(),
    }

    expect(context.locHighCutoff).toBe(15)
    expect(context.unitHighCutoff).toBe(2)
    expect(resolveCodeCityBuildingVisual(hub, context).archetype).toBe("tower")
    expect(resolveCodeCityBuildingVisual(stepped, context).archetype).toBe("stepped")
    expect(buildCodeCityVisualContext(permuted)).toEqual(context)
  })
})
