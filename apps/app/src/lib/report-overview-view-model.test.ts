import { describe, expect, test } from "bun:test"
import { buildReportOverviewViewModel } from "./report-overview-view-model.js"

describe("report overview view model", () => {
  test("builds overview cards for a single-repository report", () => {
    const viewModel = buildReportOverviewViewModel({
      report: {
        id: "report-1",
        workspaceId: "workspace-1",
        slug: "effect-ts",
        name: "Effect TS",
        kind: "planetnik-report",
        status: "connected",
        analysisRoot: "/datasets/effect-ts/data",
        createdAt: "2026-04-02T17:20:19.145Z",
        updatedAt: "2026-04-02T17:20:19.145Z",
        lastSyncedAt: "2026-04-02T17:20:19.145Z",
      },
      context: {
        mode: "single_repository",
        reportMode: "single_repository",
        title: "Effect TS",
        rootRoute: "/",
        dataVersion: 1,
        source: "analysisResults",
        hasLandscape: false,
        hasSingleRepositoryAnalysis: true,
        primaryNavigation: ["overview", "files", "contributors"],
      },
      artifact: {
        kind: "single_repository",
        projectName: "Effect TS",
        filesCount: 240,
        linesOfCode: 52000,
        duplicatedLines: 910,
        duplicationPercentage: 1.8,
      },
    })

    expect(viewModel.heading).toBe("Effect TS")
    expect(viewModel.subtitle).toBe("Connected single repository report backed by Planetnik analysis artifacts.")
    expect(viewModel.cards).toEqual([
      { label: "Files", value: "240", detail: null },
      { label: "Lines of Code", value: "52,000", detail: null },
      { label: "Duplication", value: "1.8%", detail: "910 duplicated lines" },
      { label: "Primary Sections", value: "3", detail: "overview, files, contributors" },
    ])
    expect(viewModel.highlights).toEqual(["Report mode: single repository", "Root route: /", "Source: analysisResults"])
  })

  test("builds overview cards for a landscape report", () => {
    const viewModel = buildReportOverviewViewModel({
      report: {
        id: "report-2",
        workspaceId: "workspace-1",
        slug: "platform-landscape",
        name: "Platform Landscape",
        kind: "planetnik-report",
        status: "connected",
        analysisRoot: "/datasets/platform-landscape/data",
        createdAt: "2026-04-02T17:20:19.145Z",
        updatedAt: "2026-04-02T17:20:19.145Z",
        lastSyncedAt: "2026-04-02T17:20:19.145Z",
      },
      context: {
        mode: "landscape",
        reportMode: "landscape",
        title: "Platform Landscape",
        rootRoute: "/landscape",
        dataVersion: 1,
        source: "landscape",
        hasLandscape: true,
        hasSingleRepositoryAnalysis: false,
        primaryNavigation: ["overview", "repositories"],
      },
      artifact: {
        kind: "landscape",
        title: "Landscape Overview",
        landscapeName: "Platform Landscape",
        repositoryCount: 12,
        contributorCount: 34,
        totalLinesOfCode: 91234,
        commits30d: 87,
        commits90d: 241,
      },
    })

    expect(viewModel.heading).toBe("Platform Landscape")
    expect(viewModel.subtitle).toBe("Connected landscape report backed by Planetnik analysis artifacts.")
    expect(viewModel.cards).toEqual([
      { label: "Repositories", value: "12", detail: null },
      { label: "Contributors", value: "34", detail: null },
      { label: "Lines of Code", value: "91,234", detail: null },
      { label: "Recent Activity", value: "87", detail: "241 commits in 90d" },
    ])
    expect(viewModel.highlights).toEqual(["Report mode: landscape", "Root route: /landscape", "Source: landscape"])
  })

  test("falls back gracefully when no artifact summary is available", () => {
    const viewModel = buildReportOverviewViewModel({
      report: {
        id: "report-3",
        workspaceId: "workspace-1",
        slug: "draft-report",
        name: "Draft Report",
        kind: "planetnik-report",
        status: "draft",
        analysisRoot: null,
        createdAt: "2026-04-02T17:20:19.145Z",
        updatedAt: "2026-04-02T17:20:19.145Z",
        lastSyncedAt: null,
      },
      context: null,
      artifact: null,
    })

    expect(viewModel.cards).toEqual([
      { label: "Status", value: "draft", detail: null },
      { label: "Source", value: "Unlinked", detail: "No validated dataset attached yet" },
    ])
    expect(viewModel.highlights).toEqual(["Report mode: unavailable", "Root route: unavailable", "Source: unavailable"])
  })
})
