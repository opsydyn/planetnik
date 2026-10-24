import { describe, expect, test } from "bun:test"
import { CodeAnalysisResults } from "@planetnik/analyzer"
import { ImpactExporter, type ImpactSourceHotspot } from "../exporters/ImpactExportInfo"

function createHotspot(overrides: Partial<ImpactSourceHotspot>): ImpactSourceHotspot {
  return {
    id: "file:default",
    kind: "file",
    name: "default",
    parent: "default-parent",
    route: "/files/churn",
    score: 0,
    severity: "Medium",
    size: 100,
    commitsCount: 10,
    contributorsCount: 2,
    temporalLinks: 0,
    complexity: 0,
    dimensions: {
      structuralRisk: 20,
      changePressure: 20,
      coordinationCost: 20,
      knowledgeRisk: 20,
    },
    dominantDimension: "structuralRisk",
    suggestedAction: "Review this area.",
    reasons: ["default reason"],
    ...overrides,
  }
}

describe("ImpactExporter", () => {
  test("exportImpact keeps only high-signal opportunities and deduplicates units by parent file", () => {
    const exported = ImpactExporter.exportImpact(
      new CodeAnalysisResults(),
      {
        componentHotspots: [
          createHotspot({
            id: "component:primary:Core",
            kind: "component",
            name: "Core",
            parent: "primary",
            route: "/components",
            contributorsCount: 2,
            temporalLinks: 8,
            complexity: 6,
            dimensions: {
              structuralRisk: 60,
              changePressure: 60,
              coordinationCost: 50,
              knowledgeRisk: 40,
            },
          }),
          createHotspot({
            id: "component:primary:LowValue",
            kind: "component",
            name: "LowValue",
            parent: "primary",
            route: "/components",
            contributorsCount: 1,
            temporalLinks: 0,
            complexity: 0,
            dimensions: {
              structuralRisk: 5,
              changePressure: 5,
              coordinationCost: 5,
              knowledgeRisk: 5,
            },
          }),
        ],
        fileHotspots: [
          createHotspot({
            id: "file:src/core/CoreService.java",
            name: "src/core/CoreService.java",
            parent: "Core",
            route: "/files/churn",
            contributorsCount: 2,
            temporalLinks: 4,
            complexity: 10,
            dimensions: {
              structuralRisk: 60,
              changePressure: 50,
              coordinationCost: 40,
              knowledgeRisk: 30,
            },
          }),
          createHotspot({
            id: "file:src/core/LowValue.java",
            name: "src/core/LowValue.java",
            parent: "Core",
            route: "/files/churn",
            contributorsCount: 1,
            temporalLinks: 0,
            complexity: 0,
            dimensions: {
              structuralRisk: 5,
              changePressure: 5,
              coordinationCost: 5,
              knowledgeRisk: 5,
            },
          }),
        ],
        unitHotspots: [
          createHotspot({
            id: "unit:src/core/CoreService.java:10",
            kind: "unit",
            name: "importantUnitA",
            parent: "src/core/CoreService.java",
            route: "/units/complexity",
            commitsCount: 20,
            contributorsCount: 1,
            temporalLinks: 5,
            complexity: 18,
            dimensions: {
              structuralRisk: 70,
              changePressure: 70,
              coordinationCost: 50,
              knowledgeRisk: 50,
            },
          }),
          createHotspot({
            id: "unit:src/core/CoreService.java:40",
            kind: "unit",
            name: "importantUnitB",
            parent: "src/core/CoreService.java",
            route: "/units/complexity",
            commitsCount: 18,
            contributorsCount: 1,
            temporalLinks: 5,
            complexity: 16,
            dimensions: {
              structuralRisk: 68,
              changePressure: 65,
              coordinationCost: 45,
              knowledgeRisk: 40,
            },
          }),
          createHotspot({
            id: "unit:src/core/CoreService.java:80",
            kind: "unit",
            name: "thirdUnitSameFile",
            parent: "src/core/CoreService.java",
            route: "/units/complexity",
            commitsCount: 18,
            contributorsCount: 1,
            temporalLinks: 5,
            complexity: 14,
            dimensions: {
              structuralRisk: 55,
              changePressure: 55,
              coordinationCost: 35,
              knowledgeRisk: 35,
            },
          }),
          createHotspot({
            id: "unit:src/catalog/CatalogService.java:12",
            kind: "unit",
            name: "catalogHotspot",
            parent: "src/catalog/CatalogService.java",
            route: "/units/complexity",
            commitsCount: 16,
            contributorsCount: 1,
            temporalLinks: 5,
            complexity: 14,
            dimensions: {
              structuralRisk: 60,
              changePressure: 60,
              coordinationCost: 40,
              knowledgeRisk: 35,
            },
          }),
          createHotspot({
            id: "unit:src/catalog/LowValue.java:12",
            kind: "unit",
            name: "lowValueUnit",
            parent: "src/catalog/LowValue.java",
            route: "/units/complexity",
            commitsCount: 12,
            contributorsCount: 1,
            temporalLinks: 1,
            complexity: 4,
            dimensions: {
              structuralRisk: 10,
              changePressure: 10,
              coordinationCost: 10,
              knowledgeRisk: 10,
            },
          }),
        ],
      },
      "2026-03-19T00:00:00.000Z",
    )

    expect(exported.impact_opportunities.map((opportunity) => opportunity.id)).toEqual(
      expect.arrayContaining([
        "component:primary:Core",
        "file:src/core/CoreService.java",
        "unit:src/core/CoreService.java:10",
        "unit:src/core/CoreService.java:40",
        "unit:src/catalog/CatalogService.java:12",
      ]),
    )
    expect(exported.impact_opportunities.map((opportunity) => opportunity.id)).not.toContain(
      "unit:src/core/CoreService.java:80",
    )
    expect(exported.impact_opportunities.map((opportunity) => opportunity.id)).not.toContain(
      "unit:src/catalog/LowValue.java:12",
    )
  })

  test("exportImpact limits snacking candidates to high-activity low-leverage items and deduplicates unit parents", () => {
    const exported = ImpactExporter.exportImpact(
      new CodeAnalysisResults(),
      {
        componentHotspots: [],
        fileHotspots: [],
        unitHotspots: [
          createHotspot({
            id: "unit:src/core/Builder.java:10",
            kind: "unit",
            name: "setValue",
            parent: "src/core/Builder.java",
            route: "/units/complexity",
            commitsCount: 24,
            contributorsCount: 3,
            temporalLinks: 0,
            complexity: 1,
            dimensions: {
              structuralRisk: 5,
              changePressure: 70,
              coordinationCost: 5,
              knowledgeRisk: 5,
            },
          }),
          createHotspot({
            id: "unit:src/core/Builder.java:20",
            kind: "unit",
            name: "setOtherValue",
            parent: "src/core/Builder.java",
            route: "/units/complexity",
            commitsCount: 22,
            contributorsCount: 3,
            temporalLinks: 0,
            complexity: 1,
            dimensions: {
              structuralRisk: 5,
              changePressure: 68,
              coordinationCost: 5,
              knowledgeRisk: 5,
            },
          }),
          createHotspot({
            id: "unit:src/catalog/Flags.java:10",
            kind: "unit",
            name: "toggleFlag",
            parent: "src/catalog/Flags.java",
            route: "/units/complexity",
            commitsCount: 20,
            contributorsCount: 3,
            temporalLinks: 0,
            complexity: 1,
            dimensions: {
              structuralRisk: 5,
              changePressure: 66,
              coordinationCost: 5,
              knowledgeRisk: 5,
            },
          }),
          createHotspot({
            id: "unit:src/catalog/RealWork.java:10",
            kind: "unit",
            name: "realWork",
            parent: "src/catalog/RealWork.java",
            route: "/units/complexity",
            commitsCount: 20,
            contributorsCount: 3,
            temporalLinks: 0,
            complexity: 12,
            dimensions: {
              structuralRisk: 50,
              changePressure: 60,
              coordinationCost: 30,
              knowledgeRisk: 20,
            },
          }),
        ],
      },
      "2026-03-19T00:00:00.000Z",
    )

    expect(exported.snacking_candidates).toHaveLength(2)
    expect(exported.snacking_candidates.map((candidate) => candidate.id)).toEqual(
      expect.arrayContaining(["unit:src/catalog/Flags.java:10"]),
    )
    expect(
      exported.snacking_candidates.filter((candidate) => candidate.id.startsWith("unit:src/core/Builder.java:")),
    ).toHaveLength(1)
    expect(exported.snacking_candidates[0]!.visible_activity_score).toBeGreaterThan(
      exported.snacking_candidates[0]!.structural_impact_score,
    )
  })
})
