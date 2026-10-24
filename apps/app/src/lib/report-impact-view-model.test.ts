import { describe, expect, test } from "bun:test"
import { buildReportImpactViewModel } from "./report-impact-view-model.js"

const baseImpact = {
  title: "Impact Report",
  timestamp: "2026-04-02T12:00:00.000Z",
  visibleActivity: { commits: 48, contributors: 6, changedFiles: 18, changedUnits: 11 },
  structuralImpact: { overallScore: 7.4, dominantDimension: "coordination_relief" },
  impactDimensions: [
    { label: "Coordination relief", score: 7.4 },
    { label: "Knowledge spread", score: 6.2 },
  ],
  topOpportunities: [
    {
      name: "Runtime auth boundary",
      kind: "component",
      parent: "runtime",
      impactScore: 8.8,
      dominantDimension: "coordination_relief",
      suggestedAction: "Stabilize the boundary and reduce repeated coordination.",
      reasons: ["auth boundary is too wide"],
      complexityReduction: 3.1,
      boundaryShaping: 7.2,
      knowledgeSpread: 2.0,
      coordinationRelief: 8.8,
      changeEnablement: 4.5,
    },
  ],
  snackingCandidates: [
    {
      name: "Small refactors in report cards",
      kind: "file",
      visibleActivityScore: 6.4,
      structuralImpactScore: 2.1,
      delta: 4.3,
      reason: "Visible motion is outpacing structural leverage.",
    },
  ],
  conceptMappings: [
    {
      concept: "Auth boundary sprawl",
      dimension: "coordination_relief",
      evidenceCount: 4,
      examples: ["component · auth"],
    },
  ],
} as const

describe("report impact view model", () => {
  test("builds stat cards", () => {
    const viewModel = buildReportImpactViewModel({ reportName: "Effect TS", impact: baseImpact })

    expect(viewModel.heading).toBe("Effect TS")
    expect(viewModel.cards[0]).toMatchObject({ label: "Visible Commits", value: "48" })
    expect(viewModel.cards[3]).toMatchObject({
      label: "Structural Impact",
      value: "7.4",
      detail: "Coordination relief",
    })
    expect(viewModel.cards[4]).toMatchObject({ label: "Impact Opportunities", value: "1" })
    expect(viewModel.cards[5]).toMatchObject({ label: "Snacking Candidates", value: "1" })
  })

  test("builds dimensionChartData and topOpportunityData", () => {
    const viewModel = buildReportImpactViewModel({ reportName: "Effect TS", impact: baseImpact })

    expect(viewModel.dimensionChartData).toEqual([
      { label: "Coordination relief", value: 7.4 },
      { label: "Knowledge spread", value: 6.2 },
    ])
    expect(viewModel.topOpportunityData).toEqual([{ label: "Runtime auth boundary", value: 8.8 }])
  })

  test("builds snackingChartData with delta and detail strings", () => {
    const viewModel = buildReportImpactViewModel({ reportName: "Effect TS", impact: baseImpact })

    expect(viewModel.snackingChartData).toEqual([
      { label: "Small refactors in report cards", value: 4.3, detail: "activity 6.4", detailSecondary: "impact 2.1" },
    ])
  })

  test("builds conceptCards", () => {
    const viewModel = buildReportImpactViewModel({ reportName: "Effect TS", impact: baseImpact })

    expect(viewModel.conceptCards).toEqual([
      {
        concept: "Auth boundary sprawl",
        dimension: "Coordination relief",
        evidenceCount: 4,
        examples: ["component · auth"],
      },
    ])
  })

  test("builds opportunityRows with dimension scores and reasons", () => {
    const viewModel = buildReportImpactViewModel({ reportName: "Effect TS", impact: baseImpact })

    expect(viewModel.opportunityRows[0]).toMatchObject({
      name: "Runtime auth boundary",
      kind: "Component",
      impactScore: 8.8,
      dominantDimension: "Coordination relief",
      boundaryShaping: 7.2,
      reasons: "auth boundary is too wide",
    })
  })

  test("builds snackingRows with delta", () => {
    const viewModel = buildReportImpactViewModel({ reportName: "Effect TS", impact: baseImpact })

    expect(viewModel.snackingRows[0]).toMatchObject({
      name: "Small refactors in report cards",
      delta: 4.3,
      reason: "Visible motion is outpacing structural leverage.",
    })
  })

  test("playbookItems is empty without hrefs", () => {
    const viewModel = buildReportImpactViewModel({ reportName: "Effect TS", impact: baseImpact })
    expect(viewModel.playbookItems).toEqual([])
  })

  test("playbookItems includes four items when hrefs are provided", () => {
    const viewModel = buildReportImpactViewModel({
      reportName: "Effect TS",
      impact: baseImpact,
      playbookHrefs: {
        hotspots: "/hotspots",
        components: "/components",
        contributors: "/contributors",
        controls: "/controls",
      },
    })
    expect(viewModel.playbookItems).toHaveLength(4)
    expect(viewModel.playbookItems[0]).toMatchObject({ href: "/hotspots", label: "Open Hotspots" })
  })
})
