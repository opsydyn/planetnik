import { describe, expect, test } from "bun:test"
import type { HostedActionStatus, PortfolioActionQueue } from "../PortfolioActionQueue.js"

const evidence = { datasetId: "demo", repositoryId: "repo", snapshotId: "snap", generatedAt: "2026-09-06T00:00:00Z", domain: "hotspot" as const, shard: "hotspots.json", record: "files[0]", href: "/datasets/demo/files", label: "hotspot", observed: { severity: "High" } }
const fixtureQueue = (): PortfolioActionQueue => ({
  contractVersion: 1, rankingPolicyVersion: 1, asOf: evidence.generatedAt,
  filters: { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: "current" },
  items: [{ id: "action:repo:file", repositoryId: "repo", repositoryTitle: "Demo", target: { id: "file", label: "file.ts" }, teams: [{ id: "unassigned", label: "Unassigned" }], primaryAction: { key: "hotspot", label: "Review hotspot" }, alternateActions: [], priorityBand: "high", trend: "unknown", freshness: "fresh", corroboration: 1, factors: [], signals: [{ id: "signal-1", repositoryId: "repo", targetId: "file", targetLabel: "file.ts", team: { id: "unassigned", label: "Unassigned" }, domain: "hotspot", priorityBand: "high", sourcePriority: { label: "severity", value: "High" }, observedAt: evidence.generatedAt, action: { key: "hotspot", label: "Review hotspot" }, explanation: "High hotspot", facts: [], evidence: [evidence] }], evidence: [evidence], status: "untracked" }],
  coverage: { datasets: { included: [{ datasetId: "demo", repositoryId: "repo" }], planned: [], excluded: [], unavailable: [] }, domains: { hotspot: { status: "present", datasetCount: 1, signalCount: 1 }, control: { status: "missing", datasetCount: 0, signalCount: 0 }, security: { status: "missing", datasetCount: 0, signalCount: 0 }, impact: { status: "missing", datasetCount: 0, signalCount: 0 }, coupling: { status: "missing", datasetCount: 0, signalCount: 0 }, ownership: { status: "missing", datasetCount: 0, signalCount: 0 }, trend: { status: "missing", datasetCount: 0, signalCount: 0 } }, diagnostics: [] },
})

describe("PortfolioActionQueue", () => {
  test("keeps the public queue JSON-serialisable and versioned", () => {
    const queue = fixtureQueue()
    expect(JSON.parse(JSON.stringify(queue))).toEqual(queue)
    expect(queue.contractVersion).toBe(1)
    expect(queue.rankingPolicyVersion).toBe(1)
    expect(JSON.stringify(queue)).not.toContain('"score"')
  })
  test("keeps hosted status external to the queue", () => {
    const queue = fixtureQueue()
    const status: HostedActionStatus = { itemId: queue.items[0]!.id, snapshotId: "snap", state: "acknowledged", changedAt: evidence.generatedAt, changedBy: "user" }
    const before = JSON.stringify(queue)
    expect(JSON.parse(JSON.stringify({ queue, status })).status.itemId).toBe(queue.items[0]!.id)
    expect(JSON.stringify(queue)).toBe(before)
  })
})
