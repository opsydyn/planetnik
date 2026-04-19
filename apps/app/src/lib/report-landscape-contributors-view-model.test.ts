import { describe, expect, test } from "bun:test"
import { buildReportLandscapeContributorsViewModel } from "./report-landscape-contributors-view-model.js"

describe("report landscape contributors view model", () => {
  test("builds shared landscape contributor cards, bars, and rows", () => {
    const viewModel = buildReportLandscapeContributorsViewModel({
      slug: "alanpcurrie-landscape",
      contributors: [
        {
          email: "alan@example.com",
          userName: "Alan Currie",
          displayName: "Alan Currie",
          status: "Active",
          commitsAllTime: 42,
          commits30Days: 8,
          commits90Days: 16,
          commits180Days: 24,
          commits365Days: 32,
          firstCommit: "2024-01-03",
          lastCommit: "2026-03-31",
          percentage: "",
          filesTouched: null,
          componentsTouched: null,
          primaryComponent: "",
          knowledgeSignal: "Cross-context knowledge",
          repositoryCount: 4,
          latestCommitDate: "Tue Mar 31 2026 00:00:00 GMT+0000 (Greenwich Mean Time)",
          isBot: false,
          repositories: [
            { name: "web-app", repoKey: "acme__web-app" },
            { name: "api", repoKey: "acme__api" },
          ],
        },
        {
          email: "bot@example.com",
          userName: "Renovate",
          displayName: "Renovate",
          status: "Active",
          commitsAllTime: 15,
          commits30Days: 5,
          commits90Days: 10,
          commits180Days: 12,
          commits365Days: 15,
          firstCommit: "2025-01-03",
          lastCommit: "2026-03-28",
          percentage: "",
          filesTouched: null,
          componentsTouched: null,
          primaryComponent: "",
          knowledgeSignal: "",
          repositoryCount: 1,
          latestCommitDate: "Sat Mar 28 2026 00:00:00 GMT+0000 (Greenwich Mean Time)",
          isBot: true,
          repositories: [{ name: "web-app", repoKey: "acme__web-app" }],
        },
      ],
    })

    expect(viewModel.cards).toEqual([
      { label: "Contributors", value: "2" },
      { label: "Active (30d)", value: "2" },
      { label: "Multi-Repo", value: "1" },
      { label: "Bots", value: "1" },
    ])
    expect(viewModel.topContributorBars).toEqual([
      {
        label: "Alan Currie",
        value: 4,
        href: "/reports/alanpcurrie-landscape/contributors/alan$40example.com",
      },
      {
        label: "Renovate",
        value: 1,
        href: "/reports/alanpcurrie-landscape/contributors/bot$40example.com",
      },
    ])
    expect(viewModel.rows).toEqual([
      {
        id: "alan@example.com",
        displayName: "Alan Currie",
        href: "/reports/alanpcurrie-landscape/contributors/alan$40example.com",
        email: "alan@example.com",
        commitsCount: 42,
        commits30d: 8,
        commits90d: 16,
        repositoryCount: 4,
        latestCommitDate: "2026-03-31",
        type: "Human",
        repositories: "web-app • api",
      },
      {
        id: "bot@example.com",
        displayName: "Renovate",
        href: "/reports/alanpcurrie-landscape/contributors/bot$40example.com",
        email: "bot@example.com",
        commitsCount: 15,
        commits30d: 5,
        commits90d: 10,
        repositoryCount: 1,
        latestCommitDate: "2026-03-28",
        type: "Bot",
        repositories: "web-app",
      },
    ])
  })
})
