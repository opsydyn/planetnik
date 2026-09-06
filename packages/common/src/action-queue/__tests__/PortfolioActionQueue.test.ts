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
  buildPortfolioActionQueue,
  filterPortfolioActionQueue,
} from "../index.js"
import type {
  HostedActionStatus,
  PortfolioActionDatasetInput,
  PortfolioActionEvidence,
  PortfolioActionQueue,
  PortfolioActionQueueFilters,
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

const queueRecord = (
  domain: Exclude<PortfolioActionSignalDomain, "trend">,
  id: string,
  targetId: string,
  values: Readonly<Record<string, unknown>>,
  observedAt: string | null = "2026-09-06T00:00:00Z",
  team?: { readonly id: string; readonly label: string },
): PortfolioActionSourceRecord =>
  sourceRecord(domain, id, values, {
    targetId,
    targetLabel: `Label ${targetId}`,
    observedAt,
    ...(team ? { team } : {}),
  })

const trendInput = (
  targetId: string,
  baselineValues: Readonly<Record<string, unknown>>,
  currentValues: Readonly<Record<string, unknown>>,
  observedAt: string | null = "2026-09-06T00:00:00Z",
): PortfolioActionDatasetInput["trendInputs"][number] => ({
  targetId,
  targetLabel: `Label ${targetId}`,
  baselineValues,
  currentValues,
  baselineEvidence: [actionEvidence("trend", `baseline:${targetId}`, { snapshotId: "old" })],
  currentEvidence: [actionEvidence("trend", `current:${targetId}`)],
  observedAt,
})

describe("portfolio action queue building", () => {
  test("groups canonical targets while preserving distinct identities, ordered actions, teams, evidence, and visible factors", () => {
    const shared = "target:shared"
    const input = datasetInput(
      {
        security: {
          status: "present",
          records: [queueRecord("security", "security", shared, { open: true, severity: "high" })],
        },
        control: {
          status: "present",
          records: [
            queueRecord("control", "control-a", shared, { status: "TOLERATED" }, undefined, {
              id: "z-team",
              label: "Z Team",
            }),
            queueRecord("control", "control-b", shared, { status: "TOLERATED" }, undefined, {
              id: "z-team",
              label: "Z Team",
            }),
          ],
        },
        hotspot: {
          status: "present",
          records: [
            queueRecord("hotspot", "hotspot", shared, { kind: "file", severity: "High" }, undefined, {
              id: "a-team",
              label: "A Team",
            }),
            {
              ...queueRecord("hotspot", "same-label-a", "target:a", { kind: "file", severity: "Low" }),
              targetLabel: "Same",
            },
            {
              ...queueRecord("hotspot", "same-label-b", "target:b", { kind: "file", severity: "Low" }),
              targetLabel: "Same",
            },
          ],
        },
      },
      {
        historyStatus: "compatible",
        trendInputs: [trendInput(shared, { complexity: 3 }, { complexity: 4 })],
      },
    )

    const queue = buildPortfolioActionQueue([input], { window: "latest-compatible" })
    const item = queue.items.find((candidate) => candidate.target.id === shared)!
    expect(item.signals).toHaveLength(5)
    expect(item.corroboration).toBe(4)
    expect(item.primaryAction.key).toBe("patch-dependency")
    expect(item.alternateActions.map((action) => action.key)).toEqual([
      "restore-control",
      "stabilize-hotspot",
      "review-trend",
    ])
    expect(item.teams).toEqual([
      { id: "a-team", label: "A Team" },
      { id: "unassigned", label: "Unassigned" },
      { id: "z-team", label: "Z Team" },
    ])
    expect(item.evidence).toHaveLength(6)
    expect(item.factors.map((factor) => factor.key)).toEqual(["priority", "corroboration", "trend", "freshness"])
    expect(item.factors.map((factor) => factor.value)).toEqual(["high", 4, "worsening", "fresh"])
    expect(item.factors.every((factor) => factor.explanation.length > 0)).toBe(true)
    expect(JSON.stringify(queue)).not.toContain('"score"')
    expect(
      queue.items.filter((candidate) => candidate.target.label === "Same").map((candidate) => candidate.target.id),
    ).toEqual(["target:a", "target:b"])
  })

  test("applies the exact lexicographic ranking vector", () => {
    const input = datasetInput(
      {
        hotspot: {
          status: "present",
          records: [
            queueRecord(
              "hotspot",
              "critical",
              "a-critical",
              { kind: "file", severity: "Critical" },
              "2026-06-01T00:00:00Z",
            ),
            queueRecord("hotspot", "corroborated", "b-corroborated", { kind: "file", severity: "High" }),
            queueRecord(
              "hotspot",
              "worsening",
              "c-worsening",
              { kind: "file", severity: "High" },
              "2026-08-01T00:00:00Z",
            ),
            queueRecord("hotspot", "stable", "d-stable", { kind: "file", severity: "High" }),
            queueRecord("hotspot", "fresh-a", "e-fresh-a", { kind: "file", severity: "High" }),
            queueRecord("hotspot", "fresh-b", "f-fresh-b", { kind: "file", severity: "High" }),
            queueRecord("hotspot", "stale", "g-stale", { kind: "file", severity: "High" }, "2026-06-01T00:00:00Z"),
          ],
        },
        ownership: {
          status: "present",
          records: [
            queueRecord("ownership", "corroborated-own", "b-corroborated", {
              reasons: ["Knowledge concentration"],
              severity: "High",
            }),
            queueRecord("ownership", "corroborated-own-2", "b-corroborated", {
              reasons: ["No backup"],
              severity: "High",
            }),
          ],
        },
        coupling: {
          status: "present",
          records: [
            queueRecord("coupling", "corroborated-coupling", "b-corroborated", {
              kind: "component",
              riskTier: "High",
            }),
          ],
        },
      },
      {
        historyStatus: "compatible",
        trendInputs: [
          trendInput("c-worsening", { complexity: 1 }, { complexity: 2 }, "2026-08-01T00:00:00Z"),
          trendInput("d-stable", { complexity: 2 }, { complexity: 2 }),
        ],
      },
    )

    expect(
      buildPortfolioActionQueue([input], { window: "latest-compatible" }).items.map((item) => item.target.id),
    ).toEqual(["a-critical", "b-corroborated", "c-worsening", "d-stable", "e-fresh-a", "f-fresh-b", "g-stale"])
  })

  test("derives allowlisted trend directions and fixed freshness boundaries", () => {
    const riskFields = [
      "severity",
      "status",
      "riskTier",
      "score",
      "impact_score",
      "structuralRisk",
      "changePressure",
      "coordinationCost",
      "knowledgeRisk",
      "temporalLinks",
      "complexity",
      "commitsCount",
    ] as const
    const ordinalPair = (field: (typeof riskFields)[number]): readonly [string | number, string | number] => {
      if (field === "severity" || field === "riskTier") return ["Low", "High"]
      if (field === "status") return ["OK", "FAILED"]
      return [1, 2]
    }
    const allowlistedRecords = riskFields.map((field) =>
      queueRecord("hotspot", `allowlisted-${field}`, `allowlisted-${field}`, { kind: "file", severity: "High" }),
    )
    const records = [
      queueRecord("hotspot", "mixed", "mixed", { kind: "file", severity: "High" }),
      queueRecord("hotspot", "worse", "worse", { kind: "file", severity: "High" }),
      queueRecord("hotspot", "better", "better", { kind: "file", severity: "High" }),
      queueRecord("hotspot", "stable", "stable", { kind: "file", severity: "High" }),
      queueRecord("hotspot", "generic", "generic", { kind: "file", severity: "High" }),
      queueRecord("hotspot", "opposed", "opposed", { kind: "file", severity: "High" }),
      queueRecord("hotspot", "fresh-7", "fresh-7", { kind: "file", severity: "Low" }, "2026-08-30T00:00:00Z"),
      queueRecord("hotspot", "recent-8", "recent-8", { kind: "file", severity: "Low" }, "2026-08-29T00:00:00Z"),
      queueRecord("hotspot", "recent-30", "recent-30", { kind: "file", severity: "Low" }, "2026-08-07T00:00:00Z"),
      queueRecord("hotspot", "aging-31", "aging-31", { kind: "file", severity: "Low" }, "2026-08-06T00:00:00Z"),
      queueRecord("hotspot", "aging-90", "aging-90", { kind: "file", severity: "Low" }, "2026-06-08T00:00:00Z"),
      queueRecord("hotspot", "stale-91", "stale-91", { kind: "file", severity: "Low" }, "2026-06-07T00:00:00Z"),
      queueRecord("hotspot", "unknown", "unknown", { kind: "file", severity: "Low" }, null),
    ]
    const input = datasetInput(
      { hotspot: { status: "present", records: [...records, ...allowlistedRecords] } },
      {
        historyStatus: "compatible",
        trendInputs: [
          trendInput("mixed", { complexity: 1, commitsCount: 4 }, { complexity: 2, commitsCount: 3 }),
          trendInput("worse", { complexity: 1 }, { complexity: 2 }),
          trendInput("better", { impact_score: 2 }, { impact_score: 1 }),
          trendInput("stable", { knowledgeRisk: 2 }, { knowledgeRisk: 2 }),
          trendInput("generic", { changed: false }, { changed: true }),
          trendInput("opposed", { complexity: 1 }, { complexity: 2 }),
          trendInput("opposed", { impact_score: 2 }, { impact_score: 1 }),
          ...riskFields.map((field) => {
            const [baseline, current] = ordinalPair(field)
            return trendInput(`allowlisted-${field}`, { [field]: baseline }, { [field]: current })
          }),
        ],
      },
    )
    const queue = buildPortfolioActionQueue([input], { window: "latest-compatible" })
    const byTarget = new Map(queue.items.map((item) => [item.target.id, item]))
    expect(["mixed", "worse", "better", "stable", "generic"].map((id) => byTarget.get(id)!.trend)).toEqual([
      "unknown",
      "worsening",
      "improving",
      "stable",
      "unknown",
    ])
    expect(
      ["fresh-7", "recent-8", "recent-30", "aging-31", "aging-90", "stale-91", "unknown"].map(
        (id) => byTarget.get(id)!.freshness,
      ),
    ).toEqual(["fresh", "recent", "recent", "aging", "aging", "stale", "unknown"])
    expect(byTarget.get("generic")!.signals.some((signal) => signal.domain === "trend")).toBe(false)
    expect(byTarget.get("mixed")!.signals.some((signal) => signal.domain === "trend")).toBe(false)
    expect(byTarget.get("opposed")!.trend).toBe("unknown")
    expect(byTarget.get("opposed")!.signals.filter((signal) => signal.domain === "trend")).toHaveLength(2)
    expect(riskFields.map((field) => byTarget.get(`allowlisted-${field}`)!.trend)).toEqual(
      riskFields.map(() => "worsening"),
    )
  })

  test("selects current, compatible, and day-window evidence without reading the machine clock", () => {
    const noObservation = queueRecord("hotspot", "unknown", "unknown", { kind: "file", severity: "High" }, null)
    const recent = queueRecord(
      "hotspot",
      "recent",
      "recent",
      { kind: "file", severity: "High" },
      "2026-09-02T00:00:00Z",
    )
    const old = queueRecord("hotspot", "old", "old", { kind: "file", severity: "High" }, "2026-08-01T00:00:00Z")
    const first = datasetInput(
      { hotspot: { status: "present", records: [noObservation, recent, old] } },
      {
        historyStatus: "compatible",
        trendInputs: [trendInput("recent", { complexity: 1 }, { complexity: 2 }, "2026-09-02T00:00:00Z")],
      },
    )
    const second = datasetInput(
      {},
      {
        datasetId: "second",
        repositoryId: "repo-2",
        repositoryTitle: "Second",
        current: { snapshotId: "snap-2", generatedAt: "2026-09-07T00:00:00Z", domains: {} },
      },
    )

    const current = buildPortfolioActionQueue([second, first], { window: "current" })
    const compatible = buildPortfolioActionQueue([first, second], { window: "latest-compatible" })
    const sevenDays = buildPortfolioActionQueue([first, second], { window: "7d" })
    expect(current.asOf).toBe("2026-09-07T00:00:00Z")
    expect(current.items.flatMap((item) => item.signals).some((signal) => signal.domain === "trend")).toBe(false)
    expect(compatible.items.find((item) => item.target.id === "recent")!.trend).toBe("worsening")
    expect(sevenDays.items.map((item) => item.target.id).sort()).toEqual(["recent", "unknown"])
    expect(sevenDays.items.find((item) => item.target.id === "unknown")!.freshness).toBe("unknown")
  })

  test("fails dataset selection closed and aggregates declared domain coverage deterministically", () => {
    const ready = datasetInput({
      hotspot: {
        status: "present",
        records: [queueRecord("hotspot", "ready", "ready", { kind: "file", severity: "High" })],
      },
      control: { status: "invalid", records: [], message: "bad" },
    })
    const duplicate = { ...ready, repositoryId: "other" }
    const landscape = datasetInput({}, { datasetId: "landscape", mode: "landscape" })
    const planned = datasetInput({}, { datasetId: "planned", availability: "planned" })
    const { current: _current, ...withoutCurrent } = datasetInput({})
    const missing: PortfolioActionDatasetInput = { ...withoutCurrent, datasetId: "missing" }
    const queue = buildPortfolioActionQueue([planned, landscape, ready, duplicate, missing], { window: "current" })

    expect(queue.items).toEqual([])
    expect(queue.coverage.datasets.included).toEqual([])
    expect(queue.coverage.datasets.unavailable.map((entry) => entry.datasetId)).toEqual(["demo", "missing"])
    expect(queue.coverage.datasets.excluded.map((entry) => entry.datasetId)).toEqual(["landscape"])
    expect(queue.coverage.datasets.planned.map((entry) => entry.datasetId)).toEqual(["planned"])
    expect(queue.coverage.domains.hotspot).toEqual({ status: "missing", datasetCount: 0, signalCount: 0 })
    expect(queue.coverage.diagnostics.some((diagnostic) => diagnostic.reason.includes("duplicate datasetId"))).toBe(
      true,
    )

    const declared = buildPortfolioActionQueue([ready], { window: "current" })
    expect(declared.coverage.datasets.included).toEqual([{ datasetId: "demo", repositoryId: "repo" }])
    expect(declared.coverage.domains.hotspot).toEqual({ status: "present", datasetCount: 1, signalCount: 1 })
    expect(declared.coverage.domains.control).toEqual({
      status: "invalid",
      datasetCount: 1,
      signalCount: 0,
      message: "bad",
    })
    expect(declared.coverage.domains.security).toEqual({ status: "missing", datasetCount: 0, signalCount: 0 })
  })

  test("filters an immutable queue projection using normalized filter values", () => {
    const input = datasetInput({
      hotspot: {
        status: "present",
        records: [
          queueRecord("hotspot", "platform", "platform", { kind: "file", severity: "High" }, undefined, {
            id: "platform",
            label: "Platform",
          }),
          queueRecord("hotspot", "product", "product", { kind: "file", severity: "Low" }, undefined, {
            id: "product",
            label: "Product",
          }),
        ],
      },
    })
    const source = buildPortfolioActionQueue([input], { window: "current" })
    const before = JSON.stringify(source)
    const filters: PortfolioActionQueueFilters = {
      repositoryIds: ["repo", "repo"],
      teamIds: ["platform", "platform"],
      priorityBands: ["high", "high"],
      domains: ["hotspot", "hotspot"],
      window: "current",
    }
    const filtered = filterPortfolioActionQueue(source, filters)
    expect(filtered.items.map((item) => item.target.id)).toEqual(["platform"])
    expect(filtered.filters).toEqual({
      repositoryIds: ["repo"],
      teamIds: ["platform"],
      priorityBands: ["high"],
      domains: ["hotspot"],
      window: "current",
    })
    expect(filtered.coverage).toBe(source.coverage)
    expect(filtered.items[0]!.factors).toBe(source.items[0]!.factors)
    expect(JSON.stringify(source)).toBe(before)
  })

  test("rejects a filter window that does not match the prebuilt queue", () => {
    const source = buildPortfolioActionQueue([datasetInput({})], { window: "current" })
    expect(() =>
      filterPortfolioActionQueue(source, {
        repositoryIds: [],
        teamIds: [],
        priorityBands: [],
        domains: [],
        window: "7d",
      }),
    ).toThrow("Cannot filter a current queue with a 7d window")
  })
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
    expect(adaptOwnershipSignals(input)[0]!.facts).toContainEqual({
      label: "reasons[0]",
      value: "Knowledge concentration",
    })

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

  test("does not emit repository security actions from landscape input", () => {
    const input = datasetInput(
      {
        security: {
          status: "present",
          records: [sourceRecord("security", "landscape-alert", { open: true, severity: "critical" })],
        },
      },
      { mode: "landscape" },
    )

    expect(adaptSecuritySignals(input)).toEqual([])
    const result = adaptPortfolioActionSignals(input)
    expect(result.signals).toEqual([])
    expect(result.domainCoverage.security).toEqual({ status: "present", datasetCount: 1, signalCount: 0 })
  })

  test("falls back from null or blank coupling risk tiers without treating blanks as pressure", () => {
    const input = datasetInput({
      coupling: {
        status: "present",
        records: [
          sourceRecord("coupling", "null-tier", {
            kind: "component",
            riskTier: null,
            severity: "Critical",
            dependencyEdges: 1,
          }),
          sourceRecord("coupling", "blank-tier-with-pressure", {
            kind: "component",
            riskTier: "  ",
            severity: "High",
            inboundEdges: 1,
          }),
          sourceRecord("coupling", "blank-tier-only", {
            kind: "component",
            riskTier: " ",
            severity: "High",
          }),
        ],
      },
    })

    expect(
      adaptCouplingSignals(input).map(({ id, priorityBand, sourcePriority }) => ({ id, priorityBand, sourcePriority })),
    ).toEqual([
      { id: "null-tier", priorityBand: "critical", sourcePriority: { label: "severity", value: "Critical" } },
      { id: "blank-tier-with-pressure", priorityBand: "high", sourcePriority: { label: "severity", value: "High" } },
    ])
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

  test("fails trend closed when declared data has incompatible history", () => {
    const hotspot = sourceRecord("hotspot", "incompatible-hotspot", { severity: "High", kind: "component" })
    const input = datasetInput(
      { hotspot: { status: "present", records: [hotspot] }, trend: { status: "present", records: [] } },
      {
        historyStatus: "incompatible",
        trendInputs: [
          {
            targetId: hotspot.targetId,
            targetLabel: hotspot.targetLabel,
            baselineValues: { complexity: 10 },
            currentValues: { complexity: 12 },
            baselineEvidence: [actionEvidence("trend", "baseline", { snapshotId: "old" })],
            currentEvidence: [actionEvidence("trend", "current")],
            observedAt: hotspot.observedAt,
          },
        ],
      },
    )

    const result = adaptPortfolioActionSignals(input)
    expect(result.signals.some((signal) => signal.domain === "trend")).toBe(false)
    expect(result.domainCoverage.trend.status).toBe("invalid")
    expect(result.diagnostics).toContainEqual({
      datasetId: "demo",
      severity: "error",
      reason: "trend domain is invalid: history is incompatible",
    })
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
