import { describe, expect, test } from "bun:test"
import { buildTemporalForceGraph } from "../../topology/forceGraph.js"
import { normalizeTemporalCommit } from "../temporalCommit.js"

describe("normalizeTemporalCommit", () => {
  test("normalizes Date and ISO timestamp values to sortable ISO dates", () => {
    expect(normalizeTemporalCommit(new Date("2026-04-18T12:34:56.000Z"))).toBe("2026-04-18")
    expect(normalizeTemporalCommit("2026-04-19T09:10:11.000Z")).toBe("2026-04-19")
  })

  test("preserves non-date strings and blanks safely", () => {
    expect(normalizeTemporalCommit("unknown")).toBe("unknown")
    expect(normalizeTemporalCommit("   ")).toBe("")
    expect(normalizeTemporalCommit(null)).toBe("")
  })
})

describe("buildTemporalForceGraph", () => {
  test("uses normalized latest commit metadata when temporal rows include Date instances", () => {
    const graph = buildTemporalForceGraph([
      {
        periodKey: "30_days",
        periodLabel: "Past 30 Days",
        periodDays: 30,
        file1: "tokio/src/runtime/mod.rs",
        file2: "tokio/src/runtime/task.rs",
        sameCommits: 2,
        commitsFile1: 5,
        commitsFile2: 4,
        latestCommit: new Date("2026-04-18T12:34:56.000Z"),
      },
      {
        periodKey: "30_days",
        periodLabel: "Past 30 Days",
        periodDays: 30,
        file1: "tokio/src/runtime/mod.rs",
        file2: "tokio/src/runtime/task.rs",
        sameCommits: 3,
        commitsFile1: 5,
        commitsFile2: 4,
        latestCommit: "2026-04-19",
      },
    ])

    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0]?.meta).toBe("Latest commit 2026-04-19")
  })
})
