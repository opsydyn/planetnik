import { describe, expect, test } from "bun:test"
import { buildReportTopologyViewModel } from "./report-topology-view-model.js"

describe("report topology view model", () => {
  test("builds hosted topology summary cards and ranked lists", () => {
    const viewModel = buildReportTopologyViewModel({
      slug: "effect-ts",
      reportName: "Effect TS",
      topology: {
        availablePeriods: ["All Time", "Quarter", "Month"],
        strongestConnections: [
          {
            periodLabel: "All Time",
            from: "alan@example.com",
            fromDisplayName: "Alan Currie",
            to: "sam@example.com",
            toDisplayName: "Sam Example",
            sharedCommits: 12,
            filesCount: 3,
          },
        ],
        topGlueContributors: [
          {
            email: "alan@example.com",
            displayName: "Alan Currie",
            glueScore: 8.8,
            dominantDimension: "coordination_relief",
          },
        ],
        topSnackingContributors: [
          {
            email: "sam@example.com",
            displayName: "Sam Example",
            snackingScore: 6.4,
            dominantDimension: "knowledge_spread",
          },
        ],
        periodsData: {},
        impactPeriods: {},
      },
    })

    expect(viewModel.heading).toBe("Effect TS")
    expect(viewModel.subtitle).toBe(
      "Contributor topology summary from shared file modifications in the linked Planetnik dataset.",
    )
    expect(viewModel.cards).toEqual([
      { label: "Available Periods", value: "3", detail: "All Time, Quarter, Month" },
      { label: "Strongest Links", value: "1", detail: null },
      { label: "Glue Signals", value: "1", detail: null },
      { label: "Snacking Signals", value: "1", detail: null },
    ])
    expect(viewModel.strongestConnections).toEqual([
      {
        label: "Alan Currie ↔ Sam Example",
        value: "All Time · 12 shared commits across 3 files",
      },
    ])
    expect(viewModel.glueContributors).toEqual([
      {
        label: "Alan Currie",
        value: "Glue 8.8 · coordination relief",
      },
    ])
    expect(viewModel.snackingContributors).toEqual([
      {
        label: "Sam Example",
        value: "Snacking 6.4 · knowledge spread",
      },
    ])
  })
})
