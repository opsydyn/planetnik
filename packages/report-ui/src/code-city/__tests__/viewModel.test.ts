import { describe, expect, test } from "bun:test"
import type { CodeCityModel, CodeCitySignals } from "@planetnik/common"
import { getCodeCityAudiencePresentation } from "../audience.js"
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
  units: [
    {
      id: "unit:runtime-helper",
      fileId: "file:runtime",
      shortName: "helper",
      longName: "Runtime.helper",
      relativeFileName: "src/runtime.ts",
      linesOfCode: 18,
      mcCabeIndex: 7,
      numberOfParameters: 2,
      startLine: 40,
      endLine: 57,
      districtIds: ["district:runtime"],
      metrics: signals({ footprint: { loc: 18, buildingCount: 0 } }),
      evidence: [{ kind: "unit", id: "unit:runtime-helper", route: "/units/complexity#helper" }],
    },
    {
      id: "unit:runtime-start",
      fileId: "file:runtime",
      shortName: "start",
      longName: "Runtime.start",
      relativeFileName: "src/runtime.ts",
      linesOfCode: 22,
      mcCabeIndex: 11,
      numberOfParameters: 1,
      startLine: 10,
      endLine: 31,
      districtIds: ["district:runtime"],
      metrics: signals({ footprint: { loc: 22, buildingCount: 0 } }),
      evidence: [{ kind: "unit", id: "unit:runtime-start", route: null }],
    },
  ],
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
    counts: { files: 3, districts: 2, units: 2, edges: 1, diagnostics: 0 },
  },
  layout: {
    contractVersion: 1,
    seed: "code-city-v1:fixture",
    districtOrder: ["district:runtime", "district:web"],
    buildingOrder: ["file:runtime", "file:web", "file:missing"],
    unitOrder: ["unit:runtime-start", "unit:runtime-helper"],
  },
  legend: { channels: [] },
})

const metricsObject = (metrics: ReadonlyArray<{ readonly label: string; readonly value: string }>) =>
  Object.fromEntries(metrics.map(({ label, value }) => [label, value]))

describe("buildCodeCityInspectorModel", () => {
  test("builds deterministic architecture tethers for context membership and resolved routes", () => {
    const inspector = buildCodeCityInspectorModel(
      modelFixture(),
      { kind: "building", id: "file:runtime" },
      "/planetnik/",
    )

    expect(inspector?.relationships).toEqual([
      {
        id: "membership:district:runtime",
        label: "Context membership",
        summary: "Runtime",
        href: null,
      },
      {
        id: "edge:runtime-web",
        label: "Dependency route",
        summary: "Runtime → Web · 2 dependencies",
        href: "/planetnik/topology#runtime-web",
      },
    ])
  })

  test("labels unresolved dependency endpoints instead of presenting them as routes", () => {
    const model = modelFixture()
    const inspector = buildCodeCityInspectorModel(
      {
        ...model,
        edges: [
          ...model.edges,
          {
            id: "edge:runtime-unknown",
            kind: "component_dependency",
            decompositionKey: "primary",
            sourceDistrictId: "district:runtime",
            targetDistrictId: null,
            count: 1,
            locFrom: null,
            evidenceCount: null,
            resolution: "source",
            evidence: [],
          },
        ],
      },
      { kind: "district", id: "district:runtime" },
      "/planetnik/",
    )

    expect(inspector?.relationships).toContainEqual({
      id: "edge:runtime-unknown",
      label: "Unresolved dependency",
      summary: "Runtime ↝ Unavailable target · 1 dependency",
      href: null,
    })
  })

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
    expect(inspector?.visualFacts).toEqual([
      { label: "Material", value: "Brick" },
      { label: "Archetype", value: "Tower" },
      { label: "Roof", value: "Capped" },
      { label: "Texture", value: "Checker" },
      { label: "Context span", value: "Single district" },
      {
        label: "Active lens",
        value:
          "Health has no separate geometry cue; it uses a restrained emissive surface tint without changing the building form.",
      },
    ])
    expect(inspector?.units).toEqual([
      {
        id: "unit:runtime-start",
        label: "Runtime.start",
        range: "Lines 10–31",
        loc: "22",
        complexity: "McCabe 11",
        evidence: [],
      },
      {
        id: "unit:runtime-helper",
        label: "Runtime.helper",
        range: "Lines 40–57",
        loc: "18",
        complexity: "McCabe 7",
        evidence: [{ label: "Unit: unit:runtime-helper", href: "/planetnik/units/complexity#helper" }],
      },
    ])
  })

  test("returns null when nothing is selected", () => {
    expect(buildCodeCityInspectorModel(modelFixture(), null, "/planetnik/")).toBeNull()
  })

  test("puts stakeholder impact and health first without changing their values", () => {
    const inspector = buildCodeCityInspectorModel(
      modelFixture(),
      { kind: "district", id: "district:runtime" },
      "/",
      "health",
      getCodeCityAudiencePresentation("stakeholder"),
    )

    expect(inspector?.metrics.slice(0, 2)).toEqual([
      { label: "Impact", value: "73 (coupling)" },
      { label: "Health", value: "87 (critical; change)" },
    ])
  })

  test("explains a selected district's parcel, landmark, texture, and active lens treatment", () => {
    const inspector = buildCodeCityInspectorModel(
      modelFixture(),
      { kind: "district", id: "district:runtime" },
      "/planetnik/",
      "ownership",
    )

    expect(inspector?.visualFacts).toEqual([
      { label: "Parcel", value: "Civic" },
      { label: "Landmark", value: "Super hub" },
      { label: "Texture", value: "Gridded" },
      {
        label: "Active lens",
        value:
          "Ownership has no separate geometry cue; it uses a restrained emissive surface tint without changing the city layout.",
      },
    ])
  })

  test("explains the cross-context buttress cue only for multi-district buildings", () => {
    const model = modelFixture()
    const multiDistrict: CodeCityModel = {
      ...model,
      buildings: model.buildings.map((building) =>
        building.id === "file:runtime" ? { ...building, districtIds: ["district:runtime", "district:web"] } : building,
      ),
    }

    expect(
      buildCodeCityInspectorModel(multiDistrict, { kind: "building", id: "file:runtime" }, "/planetnik/")?.visualFacts,
    ).toContainEqual({ label: "Context span", value: "Multi-district · buttressed when focused" })
    expect(buildCodeCityFallbackRows(multiDistrict, "/planetnik/").find((row) => row.id === "file:runtime")?.form).toBe(
      "Tower · capped roof · multi-district",
    )
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
  test("preserves deterministic district and building order and leaves missing values unavailable", () => {
    const rows = buildCodeCityFallbackRows(modelFixture(), "/planetnik/")

    expect(rows.map(({ id }) => id)).toEqual([
      "district:runtime",
      "district:web",
      "file:runtime",
      "file:web",
      "file:missing",
    ])
    expect(rows[0]).toMatchObject({
      kind: "district",
      id: "district:runtime",
      entity: "Runtime",
      district: "Runtime",
      loc: "240",
    })
    expect(rows[2]).toEqual({
      kind: "building",
      id: "file:runtime",
      entity: "src/runtime.ts",
      district: "Runtime",
      path: "src/runtime.ts",
      loc: "240",
      health: "87 (critical; change)",
      impact: "73 (coupling)",
      form: "Tower · capped roof",
      landmark: "Super hub",
      href: "/planetnik/files/size#runtime",
    })
    expect(rows[0]).toMatchObject({
      form: "Civic parcel",
      landmark: "Super hub",
    })
    expect(rows[4]).toMatchObject({
      health: "Unavailable",
      impact: "Unavailable",
      href: null,
    })
  })
})
