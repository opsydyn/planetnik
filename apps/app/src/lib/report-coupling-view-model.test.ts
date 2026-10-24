import { describe, expect, test } from "bun:test"
import { buildReportCouplingViewModel } from "./report-coupling-view-model.js"

const baseCoupling = {
  decompositionKey: "primary",
  temporalWindowLabel: "Quarter",
  aggregate: {
    totalComponents: 2,
    overloadedComponents: 1,
    knowledgeExposedComponents: 2,
    averageLoad: 6.2,
    averageBalance: 5.8,
    averageRisk: 6.8,
    maxRisk: 8.1,
    topRiskComponent: "api",
  },
  riskTierCounts: {
    critical: 1,
    high: 0,
    medium: 1,
    low: 0,
  },
  dimensionMix: [
    { id: "staticCoupling", label: "Static", value: 5.2, color: "#58A6FF" },
    { id: "temporalCoupling", label: "Temporal", value: 4.0, color: "#8b5cf6" },
  ],
  dominantBreakdown: [{ label: "Knowledge", value: 1, detail: "1 components", color: "#ef4444" }],
  topRiskComponents: [
    {
      component: "api",
      systemicRisk: 8.1,
      riskTier: "Critical" as const,
      dominantDimension: "Knowledge",
      explainability: ["single-owner knowledge exposure", "High coordination cost"],
    },
  ],
  inventory: [
    {
      component: "api",
      systemicRisk: 8.1,
      overallLoad: 7.2,
      balanceScore: 5.8,
      riskTier: "Critical" as const,
      dominantDimension: "Knowledge",
      dominantDimensionId: "knowledgeRisk",
      files: 1,
      linesOfCode: 250,
      contributors: 1,
      incomingDependencies: 5,
      outgoingDependencies: 0,
      staticPartners: 3,
      temporalPartners: 1,
      contributorOverlap: 1,
      hotspotPressure: 0.8,
      staticCoupling: 7.5,
      temporalCoupling: 4.0,
      coordinationCoupling: 6.1,
      knowledgeRisk: 9.2,
      explainability: ["single-owner knowledge exposure", "High coordination cost"],
    },
  ],
} as const

describe("report coupling view model", () => {
  test("builds cards and BalancedCouplingModel from runtime data", () => {
    const viewModel = buildReportCouplingViewModel({
      reportName: "web-app",
      coupling: baseCoupling,
    })

    expect(viewModel.heading).toBe("web-app")
    expect(viewModel.decompositionKey).toBe("primary")
    expect(viewModel.temporalWindowLabel).toBe("Quarter")

    expect(viewModel.cards).toEqual([
      { label: "Components", value: "2", detail: null },
      { label: "Overloaded", value: "1", detail: null, accentColor: "#dc2626" },
      { label: "Knowledge Exposed", value: "2", detail: null, accentColor: "#d97706" },
      { label: "Average Risk", value: "6.8", detail: "Quarter" },
    ])

    // Model aggregate
    expect(viewModel.model.aggregate.averageLoad).toBe(6.2)
    expect(viewModel.model.aggregate.averageBalance).toBe(5.8)
    expect(viewModel.model.aggregate.maxRisk).toBe(8.1)
    expect(viewModel.model.aggregate.topRiskComponent).toBe("api")
    expect(viewModel.model.aggregate.dimensionMix[0]).toMatchObject({
      id: "staticCoupling",
      label: "Static",
      value: 5.2,
      color: "#58A6FF",
    })

    // Snapshot mapping
    const snap = viewModel.model.snapshots[0]!
    expect(snap.id).toBe("api")
    expect(snap.dominantDimension).toBe("knowledgeRisk")
    expect(snap.staticPartners).toBe(3)
    expect(snap.hotspotPressure).toBe(0.8)

    // Grid rows
    expect(viewModel.couplingRows[0]).toMatchObject({
      id: "api",
      component: "api",
      riskTier: "Critical",
      systemicRisk: 8.1,
      explainability: "single-owner knowledge exposure • High coordination cost",
    })

    // Risk tier chart
    expect(viewModel.riskTierData).toEqual([
      { label: "Critical", value: 1 },
      { label: "Medium", value: 1 },
    ])

    // Top risk data
    expect(viewModel.topRiskData).toEqual([{ label: "api", value: 8.1 }])
  })
})
