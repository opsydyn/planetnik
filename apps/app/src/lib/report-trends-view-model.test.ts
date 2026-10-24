import { describe, expect, test } from "bun:test"
import { buildReportTrendsViewModel } from "./report-trends-view-model.js"

describe("report trends view model", () => {
  test("builds the hosted empty-state trend summary", () => {
    const viewModel = buildReportTrendsViewModel({
      reportName: "Effect TS",
      trends: {
        available: false,
        message: "Trend data requires multiple analysis snapshots over time.",
        hint: "Run planetnik generateReports periodically. Each run adds a snapshot to the trend baseline.",
      },
    })

    expect(viewModel.heading).toBe("Effect TS")
    expect(viewModel.subtitle).toBe("Trend history is not yet exported by the linked Planetnik dataset.")
    expect(viewModel.message).toBe("Trend data requires multiple analysis snapshots over time.")
    expect(viewModel.hint).toBe(
      "Run planetnik generateReports periodically. Each run adds a snapshot to the trend baseline.",
    )
    expect(viewModel.statusLabel).toBe("Awaiting history")
  })
})
