import { describe, expect, test } from "bun:test"
import type { CodeCityModel, CodeCitySignals } from "@planetnik/common"
import { buildCodeCityFallbackRows, buildCodeCityInspectorModel } from "../viewModel.js"

const signals = (overrides: Partial<CodeCitySignals> = {}): CodeCitySignals => ({
  footprint: { loc: 240, buildingCount: 1 },
  complexity: { maxMcCabe: 24, unitCount: 3 },
  health: { score: 87, severity: "critical", dominantDimension: "change" },
  change: { commits: 18, temporalLinks: 6 },
  ownership: { contributorIds: ["ada", "lin"], contributorCount: 2 },
  impact: { score: 73, dimension: "coupling", sourceId: "impact:runtime" },
  ...overrides,
})

const modelFixture = (): CodeCityModel => ({
  contractVersion: 1,
  snapshot: { repositoryId: "repo:fixture", title: "Fixture" },
  districts: [
    {
      id: "district:runtime",
      kind: "component",
      label: "Runtime",
      decompositionKey: "primary",
      pathPrefix: null,
      buildingIds: ["file:runtime", "file:missing"],
      metrics: signals(),
      evidence: [],
      derived: false,
    },
    {
      id: "district:web",
      kind: "component",
      label: "Web",
      decompositionKey: "primary",
      pathPrefix: null,
      buildingIds: ["file:web"],
      metrics: signals(),
      evidence: [],
      derived: false,
    },
  ],
  buildings: [
    {
      id: "file:web",
      relativePath: "src/web.ts",
      extension: "ts",
      sourceSets: ["main"],
      components: ["web"],
      districtIds: ["district:web"],
      primaryDistrictId: "district:web",
      metrics: signals({ footprint: { loc: 80, buildingCount: 1 } }),
      evidence: [{ kind: "file", id: "file:web", route: "/files/size#web" }],
    },
    {
      id: "file:missing",
      relativePath: "src/missing.ts",
      extension: "ts",
      sourceSets: ["main"],
      components: ["runtime"],
      districtIds: ["district:runtime"],
      primaryDistrictId: "district:runtime",
      metrics: signals({
        footprint: { loc: 12, buildingCount: 1 },
        complexity: { maxMcCabe: null, unitCount: 0 },
        health: { score: null, severity: null, dominantDimension: null },
        change: { commits: null, temporalLinks: null },
        ownership: { contributorIds: [], contributorCount: 0 },
        impact: { score: null, dimension: null, sourceId: null },
      }),
      evidence: [{ kind: "file", id: "file:missing", route: null }],
    },
    {
      id: "file:runtime",
      relativePath: "src/runtime.ts",
      extension: "ts",
      sourceSets: ["main", "test"],
      components: ["runtime"],
      districtIds: ["district:runtime"],
      primaryDistrictId: "district:runtime",
      metrics: signals(),
      evidence: [
        { kind: "file", id: "file:runtime", route: "/files/size#runtime" },
        { kind: "impact", id: "impact:runtime", route: "/impact#runtime" },
        { kind: "hotspot", id: "hotspot:missing-route", route: null },
      ],
    },
  ],
  units: [],
  edges: [
    {
      id: "edge:runtime-web",
      kind: "component_dependency",
      decompositionKey: "primary",
      sourceDistrictId: "district:runtime",
      targetDistrictId: "district:web",
      count: 2,
      locFrom: 240,
      evidenceCount: 1,
      resolution: "both",
      evidence: [{ kind: "component", id: "edge:runtime-web", route: "/topology#runtime-web" }],
    },
  ],
  coverage: {
    presentShards: ["files_main.json", "hotspots.json", "impact.json"],
    missingOptionalShards: [],
    diagnostics: [],
    derivedDistrictIds: [],
    counts: { files: 3, districts: 2, units: 0, edges: 1, diagnostics: 0 },
  },
  layout: {
    contractVersion: 1,
    seed: "code-city-v1:fixture",
    districtOrder: ["district:runtime", "district:web"],
    buildingOrder: ["file:runtime", "file:web", "file:missing"],
    unitOrder: [],
  },
  legend: { channels: [] },
})

const metricsObject = (metrics: ReadonlyArray<{ readonly label: string; readonly value: string }>) =>
  Object.fromEntries(metrics.map(({ label, value }) => [label, value]))

describe("buildCodeCityInspectorModel", () => {
  test("presents a selected building's signals, identity, and resolvable evidence", () => {
    const inspector = buildCodeCityInspectorModel(
      modelFixture(),
      { kind: "building", id: "file:runtime" },
      "/planetnik/",
    )

    expect(inspector).not.toBeNull()
    expect(inspector).toMatchObject({
      title: "src/runtime.ts",
      path: "src/runtime.ts",
      districtLabel: "Runtime",
      sourceSets: ["main", "test"],
    })
    expect(metricsObject(inspector?.metrics ?? [])).toEqual({
      LOC: "240",
      Health: "87 (critical; change)",
      Ownership: "2 contributors",
      Impact: "73 (coupling)",
      Change: "18 commits, 6 temporal links",
      Complexity: "McCabe 24",
      Coverage: "Complete",
    })
    expect(inspector?.evidence).toEqual([
      { label: "Component: edge:runtime-web", href: "/planetnik/topology#runtime-web" },
      { label: "File: file:runtime", href: "/planetnik/files/size#runtime" },
      { label: "Impact: impact:runtime", href: "/planetnik/impact#runtime" },
    ])
  })

  test("returns null when nothing is selected", () => {
    expect(buildCodeCityInspectorModel(modelFixture(), null, "/planetnik/")).toBeNull()
  })

  test("renders absent optional signals as neutral Unavailable values", () => {
    const inspector = buildCodeCityInspectorModel(
      modelFixture(),
      { kind: "building", id: "file:missing" },
      "/planetnik/",
    )

    expect(metricsObject(inspector?.metrics ?? [])).toMatchObject({
      Health: "Unavailable",
      Ownership: "Unavailable",
      Impact: "Unavailable",
      Change: "Unavailable",
      Complexity: "Unavailable",
    })
    expect(inspector?.evidence).toEqual([
      { label: "Component: edge:runtime-web", href: "/planetnik/topology#runtime-web" },
    ])
  })

  test("keeps a selected building inspectable when its primary district is unresolved", () => {
    const model = modelFixture()
    const runtime = model.buildings.find(({ id }) => id === "file:runtime")!
    const malformedModel: CodeCityModel = {
      ...model,
      buildings: [
        ...model.buildings.filter(({ id }) => id !== runtime.id),
        { ...runtime, primaryDistrictId: "district:unresolved" },
      ],
    }

    expect(
      buildCodeCityInspectorModel(malformedModel, { kind: "building", id: runtime.id }, "/planetnik/"),
    ).toMatchObject({
      title: "src/runtime.ts",
      districtLabel: null,
    })
  })
})

describe("buildCodeCityFallbackRows", () => {
  test("preserves model building order and leaves missing evidence and signals unavailable", () => {
    const rows = buildCodeCityFallbackRows(modelFixture(), "/planetnik/")

    expect(rows.map(({ id }) => id)).toEqual(["file:runtime", "file:web", "file:missing"])
    expect(rows[0]).toEqual({
      id: "file:runtime",
      district: "Runtime",
      path: "src/runtime.ts",
      loc: "240",
      health: "87 (critical; change)",
      impact: "73 (coupling)",
      href: "/planetnik/files/size#runtime",
    })
    expect(rows[2]).toMatchObject({
      health: "Unavailable",
      impact: "Unavailable",
      href: null,
    })
  })
})
