import { describe, expect, test } from "bun:test"
import type { PortfolioActionQueue } from "@planetnik/common"
import {
  ACTION_QUEUE_ARTIFACT_VERSION,
  chunkPortfolioActionQueue,
  fingerprintActionQueueSource,
} from "../datasets/actionQueueArtifacts.js"

function queue(ids: readonly string[]): PortfolioActionQueue {
  return {
    contractVersion: 1,
    rankingPolicyVersion: 1,
    asOf: "2026-09-06T00:00:00.000Z",
    filters: { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: "current" },
    items: ids.map((id) => ({ id })) as unknown as PortfolioActionQueue["items"],
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
})
