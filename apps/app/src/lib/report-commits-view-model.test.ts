import { describe, expect, test } from "bun:test"
import { buildReportCommitsViewModel } from "./report-commits-view-model.js"

const baseCommits = {
  totalCommits: 64,
  totalContributors: 3,
  activeContributors: { days30: 2, days90: 3, days365: 3 },
  repoAgeDays: 420,
  activeDays: 118,
  rookieCount: 1,
  activity: [
    { label: "Past 30 days", value: 2, detail: "2 contributors" },
    { label: "Past 90 days", value: 3, detail: "3 contributors" },
  ],
  timeline: [
    { timeSlot: "2024", commits: 18, contributors: 2 },
    { timeSlot: "2025", commits: 22, contributors: 3 },
  ],
  extensions: [
    {
      extension: "ts",
      commitsCount: 42,
      committersCount: 3,
      filesCount: 16,
      commitsCount30Days: 8,
      commitsCount90Days: 18,
    },
    {
      extension: "json",
      commitsCount: 5,
      committersCount: 1,
      filesCount: 3,
      commitsCount30Days: 0,
      commitsCount90Days: 0,
    },
  ],
}

describe("report commits view model", () => {
  test("builds stat cards including active windows and optional age fields", () => {
    const viewModel = buildReportCommitsViewModel({
      reportName: "Effect TS",
      commits: baseCommits,
    })

    expect(viewModel.heading).toBe("Effect TS")
    expect(viewModel.subtitle).toBe("Commit activity and contributor cadence from the linked Planetnik dataset.")
    expect(viewModel.cards).toEqual([
      { label: "Total Commits", value: "64", detail: null },
      { label: "All-Time Contributors", value: "3", detail: null },
      { label: "Active (30d)", value: "2", detail: null },
      { label: "Active (90d)", value: "3", detail: null },
      { label: "Active (1yr)", value: "3", detail: null },
      { label: "Rookies", value: "1", detail: null },
      { label: "Repo Age (Days)", value: "420", detail: null },
      { label: "Active Days", value: "118", detail: null },
    ])
  })

  test("omits age cards when repoAgeDays and activeDays are null", () => {
    const viewModel = buildReportCommitsViewModel({
      reportName: "Effect TS",
      commits: { ...baseCommits, repoAgeDays: null, activeDays: null },
    })

    expect(viewModel.cards.map((c) => c.label)).toEqual([
      "Total Commits",
      "All-Time Contributors",
      "Active (30d)",
      "Active (90d)",
      "Active (1yr)",
      "Rookies",
    ])
  })

  test("builds timeline series sorted by year", () => {
    const viewModel = buildReportCommitsViewModel({
      reportName: "Effect TS",
      commits: {
        ...baseCommits,
        timeline: [
          { timeSlot: "2025", commits: 22, contributors: 3 },
          { timeSlot: "2024", commits: 18, contributors: 2 },
        ],
      },
    })

    expect(viewModel.timelineSeries).toEqual([
      {
        name: "Commits",
        data: [
          { label: "2024", value: 18 },
          { label: "2025", value: 22 },
        ],
        color: "#3b82f6",
      },
      {
        name: "Contributors",
        data: [
          { label: "2024", value: 2 },
          { label: "2025", value: 3 },
        ],
        color: "#22c55e",
      },
    ])
  })

  test("builds activity data for distribution chart", () => {
    const viewModel = buildReportCommitsViewModel({
      reportName: "Effect TS",
      commits: baseCommits,
    })

    expect(viewModel.activityData).toEqual([
      { label: "Past 30 days", value: 2, detail: "2 contributors" },
      { label: "Past 90 days", value: 3, detail: "3 contributors" },
    ])
  })

  test("builds extension bar data sorted by commits descending, capped at 15", () => {
    const viewModel = buildReportCommitsViewModel({
      reportName: "Effect TS",
      commits: baseCommits,
    })

    expect(viewModel.extensionBarData).toEqual([
      { label: ".ts", value: 42 },
      { label: ".json", value: 5 },
    ])
  })

  test("builds extension rows with formatted counts, dash for zero 30d/90d", () => {
    const viewModel = buildReportCommitsViewModel({
      reportName: "Effect TS",
      commits: baseCommits,
    })

    expect(viewModel.extensionRows).toEqual([
      {
        extension: "ts",
        commitsCount: "42",
        committersCount: "3",
        filesCount: "16",
        commitsCount30Days: "8",
        commitsCount90Days: "18",
      },
      {
        extension: "json",
        commitsCount: "5",
        committersCount: "1",
        filesCount: "3",
        commitsCount30Days: "—",
        commitsCount90Days: "—",
      },
    ])
  })
})
