import { describe, expect, test } from "bun:test"
import { buildContributorForceGraph, buildTemporalForceGraph } from "../forceGraph"

describe("force graph builders", () => {
  test("buildContributorForceGraph creates weighted nodes and contributor links", () => {
    const graph = buildContributorForceGraph([
      { from: "alice@example.com", to: "bob@example.com", count: 3, files: ["a.ts", "b.ts"] },
      { from: "alice@example.com", to: "carol@example.com", count: 1, files: ["c.ts"] },
    ])

    expect(graph.nodes).toHaveLength(3)
    expect(graph.edges).toHaveLength(2)
    expect(graph.nodes.find((node) => node.id === "alice@example.com")).toMatchObject({
      label: "alice",
      href: "/contributors/alice$40example.com",
    })
    expect(graph.nodes.find((node) => node.id === "alice@example.com")?.size).toBeGreaterThan(
      graph.nodes.find((node) => node.id === "carol@example.com")?.size ?? 0,
    )
    expect(graph.edges[0]).toMatchObject({
      source: "alice@example.com",
      target: "bob@example.com",
      weight: 3,
      label: "3 shared files",
    })
  })

  test("buildTemporalForceGraph shortens labels while keeping full paths in metadata", () => {
    const graph = buildTemporalForceGraph([
      {
        periodKey: "30_days",
        periodLabel: "Past 30 Days",
        periodDays: 30,
        file1: "apps/site/src/pages/index.astro",
        file2: "apps/site/src/components/TopologyGraph.tsx",
        sameCommits: 4,
        commitsFile1: 10,
        commitsFile2: 7,
        latestCommit: "2026-03-16",
      },
      {
        periodKey: "30_days",
        periodLabel: "Past 30 Days",
        periodDays: 30,
        file1: "apps/site/src/pages/index.astro",
        file2: "apps/site/src/components/search/GlobalSearch.tsx",
        sameCommits: 2,
        commitsFile1: 10,
        commitsFile2: 3,
        latestCommit: "2026-03-17",
      },
    ])

    expect(graph.nodes).toHaveLength(3)
    expect(graph.edges).toHaveLength(2)
    expect(graph.nodes.find((node) => node.id === "apps/site/src/pages/index.astro")).toMatchObject({
      label: ".../pages/index.astro",
      meta: "apps/site/src/pages/index.astro",
    })
    expect(graph.edges[0]).toMatchObject({
      weight: 4,
      label: "4 shared commits",
    })
  })
})
