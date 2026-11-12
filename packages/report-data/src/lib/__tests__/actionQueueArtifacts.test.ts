import { describe, expect, test } from "bun:test"
import type { PortfolioActionEvidence, PortfolioActionQueue, PortfolioActionSignal } from "@planetnik/common"
import {
  ACTION_QUEUE_ARTIFACT_VERSION,
  chunkPortfolioActionQueue,
  expandActionQueueArtifactItems,
  fingerprintActionQueueSource,
  fingerprintActionQueueWindow,
} from "../datasets/actionQueueArtifacts.js"

function queue(ids: readonly string[]): PortfolioActionQueue {
  return {
    contractVersion: 1,
    rankingPolicyVersion: 1,
    asOf: "2026-09-06T00:00:00.000Z",
    filters: { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: "current" },
    items: ids.map((id) => ({ id, signals: [], evidence: [] })) as unknown as PortfolioActionQueue["items"],
    coverage: {
      datasets: { included: [], planned: [], excluded: [], unavailable: [] },
      domains: {
        hotspot: { status: "missing", datasetCount: 0, signalCount: 0 },
        control: { status: "missing", datasetCount: 0, signalCount: 0 },
        security: { status: "missing", datasetCount: 0, signalCount: 0 },
        impact: { status: "missing", datasetCount: 0, signalCount: 0 },
        coupling: { status: "missing", datasetCount: 0, signalCount: 0 },
        ownership: { status: "missing", datasetCount: 0, signalCount: 0 },
        trend: { status: "missing", datasetCount: 0, signalCount: 0 },
      },
      diagnostics: [],
    },
  }
}

function evidence(record: string): PortfolioActionEvidence {
  return {
    datasetId: "dataset",
    repositoryId: "repo",
    snapshotId: "snapshot",
    generatedAt: "2026-09-06T00:00:00.000Z",
    domain: "coupling",
    shard: "files_main.json",
    record,
    href: "/datasets/dataset/overview",
    label: "src",
    observed: { name: "src", linesOfCode: 10 },
  }
}

function queueWithRepeatedEvidence(): PortfolioActionQueue {
  const first = evidence("files[index=0]")
  const second = evidence("files[index=1]")
  const signal: PortfolioActionSignal = {
    id: "coupling:component",
    repositoryId: "repo",
    targetId: "component",
    targetLabel: "src",
    team: { id: "team", label: "Team" },
    domain: "coupling",
    priorityBand: "high",
    sourcePriority: { label: "severity", value: "High" },
    observedAt: "2026-09-06T00:00:00.000Z",
    action: { key: "reduce-coupling", label: "Reduce the coupling pressure" },
    explanation: "Reduce the coupling pressure for src; source severity is High.",
    facts: [{ label: "severity", value: "High" }],
    evidence: [first, second],
  }
  const base = queue([])
  return {
    ...base,
    items: [
      {
        id: "action:repo:component",
        repositoryId: "repo",
        repositoryTitle: "Repository",
        target: { id: "component", label: "src" },
        teams: [{ id: "team", label: "Team" }],
        primaryAction: signal.action,
        alternateActions: [],
        priorityBand: "high",
        trend: "unknown",
        freshness: "fresh",
        corroboration: 1,
        factors: [
          { key: "priority", label: "Priority band", value: "high", explanation: "Priority" },
          { key: "corroboration", label: "Corroboration", value: 1, explanation: "One domain" },
          { key: "trend", label: "Trend", value: "unknown", explanation: "Unknown" },
          { key: "freshness", label: "Freshness", value: "fresh", explanation: "Fresh" },
        ],
        signals: [signal],
        evidence: [first, second],
        status: "untracked",
      },
    ],
  }
}

describe("action queue artifacts", () => {
  test("chunks a ranked queue without changing item order", () => {
    const source = queue(["first", "second", "third"])

    const chunks = chunkPortfolioActionQueue(source, 2)

    expect(chunks.map((chunk) => chunk.items.map((item) => item.id))).toEqual([["first", "second"], ["third"]])
    expect(chunks[0]).toMatchObject({
      version: ACTION_QUEUE_ARTIFACT_VERSION,
      window: "current",
      page: 1,
      pageSize: 2,
      totalItems: 3,
    })
    expect(chunks[1]).toMatchObject({ page: 2, pageSize: 2, totalItems: 3 })
  })

  test("compacts repeated evidence bases and rehydrates the exact queue items", () => {
    const source = queueWithRepeatedEvidence()
    const [chunk] = chunkPortfolioActionQueue(source, 2)

    expect(chunk.evidenceBases).toHaveLength(1)
    expect(chunk.items[0]).not.toHaveProperty("evidence")
    expect(chunk.items[0]?.signals[0]?.evidenceRefs).toEqual([
      [0, "files[index=0]"],
      [0, "files[index=1]"],
    ])
    expect(expandActionQueueArtifactItems(chunk.items, chunk.evidenceBases)).toEqual(source.items)
    expect(JSON.stringify({ items: chunk.items, evidenceBases: chunk.evidenceBases }).length).toBeLessThan(
      JSON.stringify({ items: source.items }).length,
    )
  })

  test("returns no chunks for an empty queue", () => {
    expect(chunkPortfolioActionQueue(queue([]), 2)).toEqual([])
  })

  test("rejects an invalid chunk size", () => {
    expect(() => chunkPortfolioActionQueue(queue(["only"]), 0)).toThrow("pageSize must be a positive integer.")
    expect(() => chunkPortfolioActionQueue(queue(["only"]), 1.5)).toThrow("pageSize must be a positive integer.")
  })

  test("fingerprints sorted source identities and projection version", () => {
    const first = fingerprintActionQueueSource(["repo-b:snapshot-2", "repo-a:snapshot-1"], 1)

    expect(fingerprintActionQueueSource(["repo-a:snapshot-1", "repo-b:snapshot-2"], 1)).toBe(first)
    expect(fingerprintActionQueueSource(["repo-a:snapshot-1", "repo-b:snapshot-3"], 1)).not.toBe(first)
    expect(fingerprintActionQueueSource(["repo-a:snapshot-1", "repo-b:snapshot-2"], 2)).not.toBe(first)
  })

  test("fingerprints materialized window content independently of other windows", () => {
    const first = fingerprintActionQueueWindow(queue(["first"]), ["repo-a:snapshot-1"], 2, 250, 1)

    expect(first).toMatch(/^[a-f0-9]{64}$/u)
    expect(fingerprintActionQueueWindow(queue(["first"]), ["repo-a:snapshot-1"], 2, 250, 1)).toBe(first)
    expect(fingerprintActionQueueWindow(queue(["second"]), ["repo-a:snapshot-1"], 2, 250, 1)).not.toBe(first)
    expect(fingerprintActionQueueWindow(queue(["first"]), ["repo-a:snapshot-1"], 2, 500, 1)).not.toBe(first)
    expect(fingerprintActionQueueWindow(queue(["first"]), ["repo-a:snapshot-1"], 2, 250, 2)).not.toBe(first)
    expect(fingerprintActionQueueWindow(queue(["first"]), ["repo-b:snapshot-1"], 2, 250, 1)).not.toBe(first)
  })
})
