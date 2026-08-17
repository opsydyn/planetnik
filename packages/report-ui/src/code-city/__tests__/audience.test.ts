import { describe, expect, test } from "bun:test"
import type { CodeCityModel } from "@planetnik/common"
import {
  buildCodeCityAudiencePresentation,
  getCodeCityAudiencePresentation,
  resolveCodeCityAudience,
} from "../audience.js"

const modelFixture = (options: { readonly missingOptionalShards?: readonly string[] } = {}): CodeCityModel => ({
  contractVersion: 1,
  snapshot: { repositoryId: "repo:fixture", title: "Fixture" },
  districts: [
    {
      id: "district:app",
      kind: "component",
      label: "App",
      decompositionKey: "primary",
      pathPrefix: null,
      buildingIds: ["file:app"],
      metrics: {
        footprint: { loc: 12, buildingCount: 1 },
        complexity: { maxMcCabe: 3, unitCount: 1 },
        health: { score: 90, severity: "healthy", dominantDimension: null },
        change: { commits: 2, temporalLinks: 1 },
        ownership: { contributorIds: ["ada"], contributorCount: 1 },
        impact: { score: 2, dimension: "coupling", sourceId: "impact:app" },
      },
      evidence: [],
      derived: false,
    },
  ],
  buildings: [
    {
      id: "file:app",
      relativePath: "src/app.ts",
      extension: "ts",
      sourceSets: ["main"],
      components: ["app"],
      districtIds: ["district:app"],
      primaryDistrictId: "district:app",
      metrics: {
        footprint: { loc: 12, buildingCount: 1 },
        complexity: { maxMcCabe: 3, unitCount: 1 },
        health: { score: 90, severity: "healthy", dominantDimension: null },
        change: { commits: 2, temporalLinks: 1 },
        ownership: { contributorIds: ["ada"], contributorCount: 1 },
        impact: { score: 2, dimension: "coupling", sourceId: "impact:app" },
      },
      evidence: [],
    },
  ],
  units: [],
  edges: [
    {
      id: "edge:app",
      kind: "component_dependency",
      decompositionKey: "primary",
      sourceDistrictId: "district:app",
      targetDistrictId: "district:app",
      count: 1,
      locFrom: 12,
      evidenceCount: 1,
      resolution: "both",
      evidence: [],
    },
  ],
  coverage: {
    presentShards: ["files_main.json"],
    missingOptionalShards: options.missingOptionalShards ?? [],
    diagnostics: [],
    derivedDistrictIds: [],
    counts: { files: 1, districts: 1, units: 0, edges: 1, diagnostics: 0 },
  },
  layout: {
    contractVersion: 1,
    seed: "code-city-v1:fixture",
    districtOrder: ["district:app"],
    buildingOrder: ["file:app"],
    unitOrder: [],
  },
  legend: { channels: [] },
})

describe("resolveCodeCityAudience", () => {
  test("unknown values use the onboarding audience", () => {
    expect(resolveCodeCityAudience("unknown")).toBe("onboarding")
    expect(resolveCodeCityAudience(null)).toBe("onboarding")
  })

  test("architecture review prioritises boundary evidence", () => {
    const mode = getCodeCityAudiencePresentation("architecture-review")
    expect(mode).toMatchObject({
      openingQuestion: "Where are the boundaries and pressures?",
      routeEmphasis: "selection",
      firstAction: "Inspect a hub or boundary crossing",
    })
    expect(mode.inspectorMetricOrder.slice(0, 3)).toEqual(["impact", "health", "ownership"])
  })

  test("presentation reports missing coverage without inventing a value", () => {
    const model = modelFixture({ missingOptionalShards: ["impact"] })
    const presentation = buildCodeCityAudiencePresentation(model, "stakeholder")
    expect(presentation.coverageNote).toContain("impact")
    expect(presentation.coverageNote).toContain("unavailable")
  })

  test("complete coverage has a stable truthful note", () => {
    expect(buildCodeCityAudiencePresentation(modelFixture(), "onboarding").coverageNote).toBe(
      "All available signals are represented.",
    )
  })
})
