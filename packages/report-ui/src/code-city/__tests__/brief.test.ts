import { describe, expect, test } from "bun:test"
import type { CodeCityModel, CodeCitySignals } from "@planetnik/common"
import { buildCodeCityArchitectureBrief } from "../brief.js"
import { getCodeCityAudiencePresentation } from "../audience.js"
import type { CodeCityStory } from "../story.js"

const signals = (loc: number): CodeCitySignals => ({
  footprint: { loc, buildingCount: 1 },
  complexity: { maxMcCabe: null, unitCount: 0 },
  health: { score: null, severity: null, dominantDimension: null },
  change: { commits: null, temporalLinks: null },
  ownership: { contributorIds: [], contributorCount: 0 },
  impact: { score: null, dimension: null, sourceId: null },
})

const modelFixture = (): CodeCityModel => ({
  contractVersion: 1,
  snapshot: { repositoryId: "repo:fixture", title: "Fixture" },
  districts: [
    {
      id: "district:app",
      kind: "component",
      label: "App",
      decompositionKey: "primary",
      pathPrefix: "apps/app",
      buildingIds: ["file:app"],
      metrics: signals(20),
      evidence: [{ kind: "component", id: "app", route: "/components#app" }],
      derived: false,
    },
    {
      id: "district:shared",
      kind: "component",
      label: "Shared",
      decompositionKey: "primary",
      pathPrefix: "packages/shared",
      buildingIds: ["file:shared"],
      metrics: signals(20),
      evidence: [{ kind: "component", id: "shared", route: "/components#shared" }],
      derived: false,
    },
  ],
  buildings: [
    {
      id: "file:app",
      relativePath: "apps/app/main.ts",
      extension: "ts",
      sourceSets: ["main"],
      components: ["app"],
      districtIds: ["district:app"],
      primaryDistrictId: "district:app",
      metrics: signals(20),
      evidence: [],
    },
    {
      id: "file:shared",
      relativePath: "packages/shared/index.ts",
      extension: "ts",
      sourceSets: ["main"],
      components: ["shared"],
      districtIds: ["district:shared"],
      primaryDistrictId: "district:shared",
      metrics: signals(20),
      evidence: [],
    },
  ],
  units: [],
  edges: [
    {
      id: "edge:app-shared",
      kind: "component_dependency",
      decompositionKey: "primary",
      sourceDistrictId: "district:app",
      targetDistrictId: "district:shared",
      count: 8,
      locFrom: 20,
      evidenceCount: 0,
      resolution: "both",
      evidence: [],
    },
  ],
  coverage: {
    presentShards: ["files_main.json"],
    missingOptionalShards: [],
    diagnostics: [],
    derivedDistrictIds: [],
    counts: { files: 2, districts: 2, units: 0, edges: 1, diagnostics: 0 },
  },
  layout: {
    contractVersion: 1,
    seed: "fixture",
    districtOrder: ["district:app", "district:shared"],
    buildingOrder: ["file:app", "file:shared"],
    unitOrder: [],
  },
  legend: { channels: [] },
})

const storyFixture = (): CodeCityStory => ({
  audience: "architecture-review",
  steps: [
    {
      id: "orient",
      title: "Orient",
      body: "",
      target: null,
      relatedDistrictId: null,
      evidence: [
        { label: "App evidence", href: "/repo/components#app" },
        { label: "Ignored external route", href: "https://example.test/outside" },
      ],
      availability: "available",
      unavailableReason: null,
    },
    {
      id: "name",
      title: "Name",
      body: "",
      target: { kind: "district", id: "district:app" },
      relatedDistrictId: null,
      evidence: [{ label: "Shared evidence", href: "/repo/components#shared" }],
      availability: "available",
      unavailableReason: null,
    },
    {
      id: "connect",
      title: "Connect",
      body: "",
      target: { kind: "district", id: "district:app" },
      relatedDistrictId: "district:shared",
      evidence: [],
      availability: "available",
      unavailableReason: null,
    },
    {
      id: "prove",
      title: "Prove",
      body: "",
      target: { kind: "district", id: "district:app" },
      relatedDistrictId: null,
      evidence: [],
      availability: "available",
      unavailableReason: null,
    },
  ],
})

describe("buildCodeCityArchitectureBrief", () => {
  test("uses stable model rankings and report-scoped evidence", () => {
    const brief = buildCodeCityArchitectureBrief(
      modelFixture(),
      getCodeCityAudiencePresentation("architecture-review"),
      storyFixture(),
      "/repo",
    )

    expect(brief.facts.map(({ label }) => label)).toEqual([
      "Largest context",
      "Strongest boundary",
      "Evidence",
    ])
    expect(brief.facts.flatMap(({ evidence }) => evidence.map(({ href }) => href))).toEqual([
      "/repo/components#app",
      "/repo/components#shared",
    ])
    expect(brief.facts[0]?.value).toContain("App")
    expect(brief.facts[1]?.value).toContain("edge:app-shared")
  })

  test("changes mode copy without changing measured facts", () => {
    const model = modelFixture()
    const story = storyFixture()
    const onboarding = buildCodeCityArchitectureBrief(
      model,
      getCodeCityAudiencePresentation("onboarding"),
      story,
      "/repo",
    )
    const stakeholder = buildCodeCityArchitectureBrief(
      model,
      getCodeCityAudiencePresentation("stakeholder"),
      story,
      "/repo",
    )

    expect(stakeholder.lead).not.toBe(onboarding.lead)
    expect(stakeholder.nextAction).not.toBe(onboarding.nextAction)
    expect(stakeholder.facts).toEqual(onboarding.facts)
  })
})
