import { describe, expect, test } from "bun:test"
import {
  adaptControlSignals,
  adaptCouplingSignals,
  adaptHotspotSignals,
  adaptImpactSignals,
  adaptOwnershipSignals,
  adaptPortfolioActionSignals,
  adaptSecuritySignals,
  adaptTrendSignals,
} from "../index.js"
import type {
  HostedActionStatus,
  PortfolioActionDatasetInput,
  PortfolioActionEvidence,
  PortfolioActionQueue,
  PortfolioActionSignalDomain,
  PortfolioActionSourceRecord,
} from "../PortfolioActionQueue.js"

const evidence = {
  datasetId: "demo",
  repositoryId: "repo",
  snapshotId: "snap",
  generatedAt: "2026-09-06T00:00:00Z",
  domain: "hotspot" as const,
  shard: "hotspots.json",
  record: "files[0]",
  href: "/datasets/demo/files",
  label: "hotspot",
  observed: { severity: "High" },
}
const fixtureQueue = (): PortfolioActionQueue => ({
  contractVersion: 1,
  rankingPolicyVersion: 1,
  asOf: evidence.generatedAt,
  filters: { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: "current" },
  items: [
    {
      id: "action:repo:file",
      repositoryId: "repo",
      repositoryTitle: "Demo",
      target: { id: "file", label: "file.ts" },
      teams: [{ id: "unassigned", label: "Unassigned" }],
      primaryAction: { key: "hotspot", label: "Review hotspot" },
      alternateActions: [],
      priorityBand: "high",
      trend: "unknown",
      freshness: "fresh",
      corroboration: 1,
      factors: [],
      signals: [
        {
          id: "signal-1",
          repositoryId: "repo",
          targetId: "file",
          targetLabel: "file.ts",
          team: { id: "unassigned", label: "Unassigned" },
          domain: "hotspot",
          priorityBand: "high",
          sourcePriority: { label: "severity", value: "High" },
          observedAt: evidence.generatedAt,
          action: { key: "hotspot", label: "Review hotspot" },
          explanation: "High hotspot",
          facts: [],
          evidence: [evidence],
        },
      ],
      evidence: [evidence],
      status: "untracked",
    },
  ],
  coverage: {
    datasets: { included: [{ datasetId: "demo", repositoryId: "repo" }], planned: [], excluded: [], unavailable: [] },
    domains: {
      hotspot: { status: "present", datasetCount: 1, signalCount: 1 },
      control: { status: "missing", datasetCount: 0, signalCount: 0 },
      security: { status: "missing", datasetCount: 0, signalCount: 0 },
      impact: { status: "missing", datasetCount: 0, signalCount: 0 },
      coupling: { status: "missing", datasetCount: 0, signalCount: 0 },
      ownership: { status: "missing", datasetCount: 0, signalCount: 0 },
      trend: { status: "missing", datasetCount: 0, signalCount: 0 },
    },
    diagnostics: [],
  },
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
    const status: HostedActionStatus = {
      itemId: queue.items[0]!.id,
      snapshotId: "snap",
      state: "acknowledged",
      changedAt: evidence.generatedAt,
      changedBy: "user",
    }
    const before = JSON.stringify(queue)
    expect(JSON.parse(JSON.stringify({ queue, status })).status.itemId).toBe(queue.items[0]!.id)
    expect(JSON.stringify(queue)).toBe(before)
  })
})

const actionEvidence = (
  domain: PortfolioActionSignalDomain,
  record: string,
  overrides: Partial<PortfolioActionEvidence> = {},
): PortfolioActionEvidence => ({
  datasetId: "demo",
  repositoryId: "repo",
  snapshotId: "snap",
  generatedAt: "2026-09-06T00:00:00Z",
  domain,
  shard: `${domain}.json`,
  record,
  href: `/datasets/demo/repositories/repo/${domain}`,
  label: `${domain} evidence`,
  observed: {},
  ...overrides,
})

const sourceRecord = (
  domain: PortfolioActionSignalDomain,
  id: string,
  values: Readonly<Record<string, unknown>>,
  overrides: Partial<PortfolioActionSourceRecord> = {},
): PortfolioActionSourceRecord => ({
  id,
  targetId: `target:${id}`,
  targetLabel: id,
  observedAt: "2026-09-06T00:00:00Z",
  values,
  evidence: [actionEvidence(domain, `records[id=${id}]`)],
  ...overrides,
})

const datasetInput = (
  domains: NonNullable<PortfolioActionDatasetInput["current"]>["domains"],
  overrides: Partial<PortfolioActionDatasetInput> = {},
): PortfolioActionDatasetInput => ({
  datasetId: "demo",
  repositoryId: "repo",
  repositoryTitle: "Demo",
  mode: "single_repository",
  availability: "ready",
  current: {
    snapshotId: "snap",
    generatedAt: "2026-09-06T00:00:00Z",
    domains,
  },
  trendInputs: [],
  historyStatus: "missing",
  ...overrides,
})

describe("portfolio action signal adapters", () => {
  test("maps every actionable source domain through its focused adapter", () => {
    const input = datasetInput({
      hotspot: {
        status: "present",
        records: [
          sourceRecord("hotspot", "hot", {
            severity: "Critical",
            name: "large.ts",
            kind: "file",
            route: "/files/large.ts",
          }),
        ],
      },
      control: {
        status: "present",
        records: [
          sourceRecord("control", "failed", { status: "FAILED" }),
          sourceRecord("control", "tolerated", { status: "TOLERATED" }),
          sourceRecord("control", "ok", { status: "OK" }),
        ],
      },
      security: {
        status: "present",
        records: [
          sourceRecord("security", "alert", { open: true, severity: "high" }),
          sourceRecord("security", "closed", { open: false, severity: "critical" }),
        ],
      },
      impact: {
        status: "present",
        records: [75, 55, 35, 34].map((impact_score) =>
          sourceRecord("impact", `impact-${impact_score}`, { impact_score }),
        ),
      },
      coupling: {
        status: "present",
        records: [
          sourceRecord("coupling", "tier", { kind: "component", riskTier: "High" }),
          sourceRecord("coupling", "deps", { kind: "component", dependencyEdges: 2 }),
          sourceRecord("coupling", "inbound", { kind: "component", inboundEdges: 1 }),
          sourceRecord("coupling", "outbound", { kind: "component", outboundEdges: 3 }),
          sourceRecord("coupling", "edge", { kind: "dependency", dependencyEdges: 9 }, { targetId: "target:tier" }),
        ],
      },
      ownership: {
        status: "present",
        records: [
          sourceRecord("ownership", "knowledge", { severity: "High", reasons: ["Knowledge concentration"] }),
          sourceRecord("ownership", "ownership", { severity: "Medium", reasons: ["ownership gap"] }),
          sourceRecord("ownership", "backup", { severity: "Low", reasons: ["No backup"] }),
          sourceRecord("ownership", "contributor", { severity: "Unknown", reasons: ["single contributor"] }),
          sourceRecord("ownership", "count-only", { contributorCount: 1 }),
        ],
      },
    })

    expect(adaptHotspotSignals(input)).toHaveLength(1)
    expect(adaptControlSignals(input).map((signal) => signal.priorityBand)).toEqual(["critical", "high"])
    expect(adaptSecuritySignals(input).map((signal) => signal.priorityBand)).toEqual(["high"])
    expect(adaptImpactSignals(input).map((signal) => signal.priorityBand)).toEqual([
      "critical",
      "high",
      "medium",
      "low",
    ])
    const couplingSignals = adaptCouplingSignals(input)
    expect(couplingSignals).toHaveLength(4)
    expect(couplingSignals.find((signal) => signal.id === "tier")!.evidence).toHaveLength(2)
    expect(couplingSignals.some((signal) => signal.id === "edge")).toBe(false)
    expect(adaptOwnershipSignals(input).map((signal) => signal.priorityBand)).toEqual([
      "high",
      "medium",
      "low",
      "unrated",
    ])

    const result = adaptPortfolioActionSignals(input)
    expect(result.signals).toHaveLength(16)
    const hotspotSignal = result.signals.find((signal) => signal.id === "hot")!
    expect(hotspotSignal).toMatchObject({
      id: "hot",
      targetId: "target:hot",
      targetLabel: "hot",
      team: { id: "unassigned", label: "Unassigned" },
      observedAt: "2026-09-06T00:00:00Z",
      action: { key: "stabilize-hotspot", label: "Stabilize the hotspot" },
      priorityBand: "critical",
      sourcePriority: { label: "severity", value: "Critical" },
    })
    expect(hotspotSignal.facts).toContainEqual({ label: "severity", value: "Critical" })
    expect(hotspotSignal.evidence).toEqual(input.current!.domains.hotspot!.records[0]!.evidence)
    expect(result.domainCoverage.trend).toEqual({ status: "missing", datasetCount: 0, signalCount: 0 })
    expect(result.diagnostics).toEqual([])
  })

  test("preserves unknown severity as unrated and explicit teams", () => {
    const input = datasetInput({
      hotspot: {
        status: "present",
        records: [
          sourceRecord(
            "hotspot",
            "unknown",
            { severity: "Unexpected", kind: "unit" },
            { team: { id: "platform", label: "Platform" } },
          ),
        ],
      },
    })
    expect(adaptHotspotSignals(input)[0]).toMatchObject({
      priorityBand: "unrated",
      sourcePriority: { label: "severity", value: "Unexpected" },
      team: { id: "platform", label: "Platform" },
    })
  })

  test("compares known risk fields only and cannot create a standalone trend", () => {
    const hotspot = sourceRecord("hotspot", "hot", { severity: "High", kind: "component" })
    const trendEvidence = (record: string, snapshotId: string) => actionEvidence("trend", record, { snapshotId })
    const input = datasetInput(
      { hotspot: { status: "present", records: [hotspot] }, trend: { status: "present", records: [] } },
      {
        historyStatus: "compatible",
        trendInputs: [
          {
            targetId: hotspot.targetId,
            targetLabel: hotspot.targetLabel,
            baselineValues: { complexity: 10 },
            currentValues: { complexity: 12 },
            baselineEvidence: [trendEvidence("baseline-worse", "old")],
            currentEvidence: [trendEvidence("current-worse", "snap")],
            observedAt: hotspot.observedAt,
          },
          {
            targetId: hotspot.targetId,
            targetLabel: hotspot.targetLabel,
            baselineValues: { impact_score: 60 },
            currentValues: { impact_score: 50 },
            baselineEvidence: [trendEvidence("baseline-better", "old")],
            currentEvidence: [trendEvidence("current-better", "snap")],
            observedAt: hotspot.observedAt,
          },
          {
            targetId: hotspot.targetId,
            targetLabel: hotspot.targetLabel,
            baselineValues: { knowledgeRisk: 2 },
            currentValues: { knowledgeRisk: 2 },
            baselineEvidence: [trendEvidence("baseline-stable", "old")],
            currentEvidence: [trendEvidence("current-stable", "snap")],
            observedAt: hotspot.observedAt,
          },
          {
            targetId: hotspot.targetId,
            targetLabel: hotspot.targetLabel,
            baselineValues: { displayName: "Before" },
            currentValues: { displayName: "After" },
            baselineEvidence: [trendEvidence("baseline-other", "old")],
            currentEvidence: [trendEvidence("current-other", "snap")],
            observedAt: hotspot.observedAt,
          },
          {
            targetId: "target:trend-only",
            targetLabel: "trend only",
            baselineValues: { complexity: 1 },
            currentValues: { complexity: 2 },
            baselineEvidence: [trendEvidence("baseline-only", "old")],
            currentEvidence: [trendEvidence("current-only", "snap")],
            observedAt: hotspot.observedAt,
          },
        ],
      },
    )
    expect(adaptTrendSignals(input, adaptHotspotSignals(input)).map((signal) => signal.sourcePriority.value)).toEqual([
      "worsening",
      "improving",
      "stable",
    ])
    expect(adaptPortfolioActionSignals(input).signals.filter((signal) => signal.domain === "trend")).toHaveLength(3)
  })

  test("fails closed for malformed records, provenance, and duplicate IDs", () => {
    const duplicate = sourceRecord("hotspot", "duplicate", { severity: "High", kind: "file" })
    const input = datasetInput({
      hotspot: { status: "present", records: [duplicate, { ...duplicate, targetId: "target:other" }] },
      control: {
        status: "present",
        records: [
          sourceRecord("control", "missing-target", { status: "FAILED" }, { targetId: "" }),
          sourceRecord(
            "control",
            "missing-href",
            { status: "FAILED" },
            { evidence: [actionEvidence("control", "missing-href", { href: "" })] },
          ),
          sourceRecord(
            "control",
            "unsafe-href",
            { status: "FAILED" },
            { evidence: [actionEvidence("control", "unsafe-href", { href: "https://example.com/steal" })] },
          ),
        ],
      },
      impact: { status: "present", records: [] },
    })

    const result = adaptPortfolioActionSignals(input)
    expect(result.signals).toEqual([])
    expect(result.domainCoverage.hotspot.status).toBe("invalid")
    expect(result.domainCoverage.control.status).toBe("invalid")
    expect(result.domainCoverage.impact).toEqual({ status: "present", datasetCount: 1, signalCount: 0 })
    expect(result.domainCoverage.security).toEqual({ status: "missing", datasetCount: 0, signalCount: 0 })
    expect(result.diagnostics.map((diagnostic) => diagnostic.reason)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("duplicate source record id"),
        expect.stringContaining("targetId"),
        expect.stringContaining("href"),
      ]),
    )
  })

  test("rejects mismatched or incomplete exact provenance identities and selectors", () => {
    const invalidEvidence = [
      actionEvidence("security", "missing-dataset", { datasetId: "" }),
      actionEvidence("security", "wrong-repository", { repositoryId: "other" }),
      actionEvidence("security", "wrong-snapshot", { snapshotId: "other" }),
      actionEvidence("security", "blank-shard", { shard: " " }),
      actionEvidence("security", "blank-record", { record: "" }),
      actionEvidence("security", "traversal", { href: "/datasets/demo/../secret" }),
    ]
    const records = invalidEvidence.map((evidence, index) =>
      sourceRecord("security", `bad-${index}`, { open: true, severity: "high" }, { evidence: [evidence] }),
    )
    const result = adaptPortfolioActionSignals(datasetInput({ security: { status: "present", records } }))
    expect(result.signals).toEqual([])
    expect(result.domainCoverage.security.status).toBe("invalid")
    expect(result.diagnostics).toHaveLength(invalidEvidence.length)
  })
})
