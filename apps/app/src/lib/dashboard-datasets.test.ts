import { describe, expect, test } from "bun:test"
import { buildDashboardDatasetLinks } from "./dashboard-datasets.js"

describe("dashboard dataset links", () => {
  test("links to an existing hosted report when analysis roots match", () => {
    const links = buildDashboardDatasetLinks(
      [
        {
          name: "alanpcurrie",
          dataDir: "/Users/alan/Projects/planetnik/datasets/alanpcurrie/data",
          title: "alanpcurrie Landscape",
          reportMode: "landscape",
        },
      ],
      [
        {
          id: "report-1",
          workspaceId: "workspace-1",
          slug: "alanpcurrie-landscape",
          name: "alanpcurrie Landscape",
          kind: "planetnik-report",
          status: "connected",
          analysisRoot: "/Users/alan/Projects/planetnik/datasets/alanpcurrie/data/",
          createdAt: "2026-04-03T10:00:00.000Z",
          updatedAt: "2026-04-03T10:00:00.000Z",
          lastSyncedAt: "2026-04-03T10:00:00.000Z",
        },
      ],
    )

    expect(links).toEqual([
      {
        kind: "existing-report",
        dataset: {
          name: "alanpcurrie",
          dataDir: "/Users/alan/Projects/planetnik/datasets/alanpcurrie/data",
          title: "alanpcurrie Landscape",
          reportMode: "landscape",
        },
        label: "alanpcurrie Landscape",
        href: "/reports/alanpcurrie-landscape/overview",
      },
    ])
  })

  test("falls back to a create action when no hosted report exists yet", () => {
    const links = buildDashboardDatasetLinks(
      [
        {
          name: "alanpcurrie",
          dataDir: "/Users/alan/Projects/planetnik/datasets/alanpcurrie/data",
          title: "alanpcurrie Landscape",
          reportMode: "landscape",
        },
      ],
      [],
    )

    expect(links).toEqual([
      {
        kind: "create-report",
        dataset: {
          name: "alanpcurrie",
          dataDir: "/Users/alan/Projects/planetnik/datasets/alanpcurrie/data",
          title: "alanpcurrie Landscape",
          reportMode: "landscape",
        },
        label: "alanpcurrie Landscape",
        datasetName: "alanpcurrie",
      },
    ])
  })
})
