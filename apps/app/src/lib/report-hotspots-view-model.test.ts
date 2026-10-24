import { describe, expect, test } from "bun:test"
import { buildReportHotspotsViewModel } from "./report-hotspots-view-model.js"

const baseHotspots = {
  totalHotspots: 3,
  severityCounts: { critical: 1, high: 1, medium: 1, low: 0 },
  kindCounts: { files: 1, units: 1, components: 1 },
  dominantCounts: { structuralRisk: 1, changePressure: 1, coordinationCost: 1, knowledgeRisk: 0 },
  topHotspots: [
    {
      name: "src/runtime/index.ts",
      score: 8.8,
      severity: "Critical",
      kind: "file",
      dominantDimension: "coordinationCost",
      suggestedAction: "Stabilize the runtime boundary.",
    },
  ],
  rows: [
    {
      name: "src/runtime/index.ts",
      route: "/files/churn",
      kind: "file",
      parent: "runtime",
      score: 8.8,
      severity: "Critical",
      dominantDimension: "coordinationCost",
      size: 1100,
      commitsCount: 18,
      contributorsCount: 4,
      temporalLinks: 7,
      complexity: 12,
      structuralRisk: 6.1,
      changePressure: 7.4,
      coordinationCost: 8.8,
      knowledgeRisk: 4.2,
      suggestedAction: "Stabilize the runtime boundary.",
      reasons: ["High coordination cost", "Sustained change pressure"],
    },
  ],
} as const

describe("report hotspots view model", () => {
  test("builds stat cards with accent colors", () => {
    const viewModel = buildReportHotspotsViewModel({ reportName: "Effect TS", hotspots: baseHotspots })

    expect(viewModel.heading).toBe("Effect TS")
    expect(viewModel.cards).toEqual([
      { label: "Hotspots", value: "3", detail: null },
      { label: "Critical", value: "1", detail: null, accentColor: "#dc2626" },
      { label: "High", value: "1", detail: null, accentColor: "#ea580c" },
      { label: "Knowledge-Led", value: "0", detail: null },
      { label: "Coordination-Led", value: "1", detail: null },
    ])
  })

  test("builds severityData and severityColors for present severities only", () => {
    const viewModel = buildReportHotspotsViewModel({ reportName: "Effect TS", hotspots: baseHotspots })

    expect(viewModel.severityData).toEqual([
      { label: "Critical", value: 1 },
      { label: "High", value: 1 },
      { label: "Medium", value: 1 },
    ])
    expect(viewModel.severityColors).toEqual(["#dc2626", "#ea580c", "#d97706"])
  })

  test("builds kindData and dominantDimensionData", () => {
    const viewModel = buildReportHotspotsViewModel({ reportName: "Effect TS", hotspots: baseHotspots })

    expect(viewModel.kindData).toEqual([
      { label: "Files", value: 1, detail: "1 hotspots" },
      { label: "Units", value: 1, detail: "1 hotspots" },
      { label: "Components", value: 1, detail: "1 hotspots" },
    ])
    expect(viewModel.dominantDimensionData).toEqual([
      { label: "Structural Risk", value: 1, detail: "1 hotspots" },
      { label: "Change Pressure", value: 1, detail: "1 hotspots" },
      { label: "Coordination Cost", value: 1, detail: "1 hotspots" },
    ])
  })

  test("builds topHotspotData", () => {
    const viewModel = buildReportHotspotsViewModel({ reportName: "Effect TS", hotspots: baseHotspots })

    expect(viewModel.topHotspotData).toEqual([{ label: "src/runtime/index.ts", value: 8.8 }])
  })

  test("builds hotspotRows with all dimension scores", () => {
    const viewModel = buildReportHotspotsViewModel({ reportName: "Effect TS", hotspots: baseHotspots })

    expect(viewModel.hotspotRows[0]).toMatchObject({
      name: "src/runtime/index.ts",
      kind: "File",
      parent: "runtime",
      score: 8.8,
      severity: "Critical",
      dominantDimension: "Coordination Cost",
      structuralRisk: 6.1,
      coordinationCost: 8.8,
      reasons: "High coordination cost • Sustained change pressure",
    })
  })
})
