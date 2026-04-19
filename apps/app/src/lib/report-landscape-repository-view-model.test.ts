import { describe, expect, test } from "bun:test"
import { buildReportLandscapeRepositoryViewModel } from "./report-landscape-repository-view-model.js"

describe("report landscape repository view model", () => {
  test("builds hosted repository dashboard cards, links, and contributor table rows", () => {
    const viewModel = buildReportLandscapeRepositoryViewModel({
      slug: "platform-landscape",
      repository: {
        repoKey: "acme__web-app",
        name: "web-app",
        description: "Customer-facing web application.",
        latestCommitDate: "Tue Mar 31 2026 00:00:00 GMT+0000 (Greenwich Mean Time)",
        commits30d: 12,
        commits90d: 34,
        contributorsCount: 4,
        filesCount: 128,
        linesOfCode: 18450,
        duplicationPercentage: 2.4,
        links: [{ label: "Open repository", href: "https://github.com/acme/web-app" }],
        contributors: [
          {
            email: "alan@example.com",
            displayName: "Alan Currie",
            commitsCount: 18,
            commits30d: 6,
            commits90d: 12,
            firstCommitDate: "Wed Jan 03 2024 00:00:00 GMT+0000 (Greenwich Mean Time)",
            latestCommitDate: "Tue Mar 31 2026 00:00:00 GMT+0000 (Greenwich Mean Time)",
            type: "Human",
            glueScore: "8.8",
            structuralImpact: "7.1",
            snackRisk: "2.4",
            signal: "Glue",
          },
        ],
        topContributors: [
          {
            email: "alan@example.com",
            displayName: "Alan Currie",
            commitsCount: 18,
            commits30d: 6,
            commits90d: 12,
            firstCommitDate: "Wed Jan 03 2024 00:00:00 GMT+0000 (Greenwich Mean Time)",
            latestCommitDate: "Tue Mar 31 2026 00:00:00 GMT+0000 (Greenwich Mean Time)",
            type: "Human",
            glueScore: "8.8",
            structuralImpact: "7.1",
            snackRisk: "2.4",
            signal: "Glue",
          },
        ],
      },
    })

    expect(viewModel.heading).toBe("web-app")
    expect(viewModel.subtitle).toBe("Repository drilldown within the current hosted landscape report.")
    expect(viewModel.cards).toEqual([
      { label: "Lines of Code", value: "18,450", detail: null },
      { label: "Files", value: "128", detail: null },
      { label: "Contributors", value: "4", detail: null },
      { label: "Commits (30d)", value: "12", detail: null },
      { label: "Commits (90d)", value: "34", detail: null },
      { label: "Latest Commit", value: "2026-03-31", detail: null },
      { label: "Duplication", value: "2.4%", detail: null },
    ])
    expect(viewModel.links).toEqual([
      {
        label: "Open repository",
        href: "https://github.com/acme/web-app",
      },
    ])
    expect(viewModel.contributorRows).toEqual([
      {
        id: "alan@example.com",
        contributor: "Alan Currie",
        href: "/reports/platform-landscape/repositories/acme__web-app/contributors/alan$40example.com",
        email: "alan@example.com",
        type: "Human",
        commitsCount: 18,
        commits30d: 6,
        commits90d: 12,
        glueScore: "8.8",
        structuralImpact: "7.1",
        snackRisk: "2.4",
        signal: "Glue",
        firstCommitDate: "2024-01-03",
        latestCommitDate: "2026-03-31",
      },
    ])
  })
})
