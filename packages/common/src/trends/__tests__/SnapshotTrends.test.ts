import { describe, expect, test } from "bun:test"
import { compareCanonicalSnapshots, compareLatestCanonicalSnapshots } from "../SnapshotTrends.js"

const BASELINE_ID = "11111111-1111-4111-8111-111111111111"
const CURRENT_ID = "22222222-2222-4222-8222-222222222222"
const TIED_ID = "33333333-3333-4333-8333-333333333333"

const context = (overrides: Record<string, unknown> = {}) => ({
  mode: "single_repository",
  reportMode: "single_repository",
  title: "Requests",
  dataVersion: 2,
  repositoryId: "repo:requests",
  snapshotId: BASELINE_ID,
  generatedAt: "2026-09-01T00:00:00.000Z",
  ...overrides,
})

const snapshot = (
  options: {
    context?: Record<string, unknown>
    metrics?: ReadonlyArray<Record<string, unknown>>
    includeMetrics?: boolean
  } = {},
) => ({
  context: context(options.context),
  ...(options.includeMetrics === false ? {} : { metrics: { metrics: options.metrics ?? [] } }),
})

describe("compareCanonicalSnapshots", () => {
  test("returns sorted metric deltas with snapshot and record provenance", () => {
    const result = compareCanonicalSnapshots(
      snapshot({
        context: {
          snapshotId: CURRENT_ID,
          generatedAt: "2026-09-04T00:00:00.000Z",
        },
        metrics: [
          { id: "LINES_OF_CODE_MAIN", value: 90 },
          { id: "FILES", value: 12 },
          { id: "ADDED_METRIC", value: 3 },
          { id: "UNCHANGED_METRIC", value: 4 },
        ],
      }),
      snapshot({
        metrics: [
          { id: "FILES", value: 10 },
          { id: "LINES_OF_CODE_MAIN", value: 100 },
          { id: "REMOVED_METRIC", value: 8 },
          { id: "UNCHANGED_METRIC", value: 4 },
        ],
      }),
    )

    expect(result.status).toBe("compatible")
    if (result.status !== "compatible") return

    expect(result.deltas).toEqual([
      {
        id: "ADDED_METRIC",
        baseline: null,
        current: 3,
        delta: null,
        direction: "added",
        provenance: {
          current: {
            snapshotId: CURRENT_ID,
            generatedAt: "2026-09-04T00:00:00.000Z",
            shard: "metrics.json",
            record: "metrics[id=ADDED_METRIC]",
          },
        },
      },
      {
        id: "FILES",
        baseline: 10,
        current: 12,
        delta: 2,
        direction: "increase",
        provenance: {
          baseline: {
            snapshotId: BASELINE_ID,
            generatedAt: "2026-09-01T00:00:00.000Z",
            shard: "metrics.json",
            record: "metrics[id=FILES]",
          },
          current: {
            snapshotId: CURRENT_ID,
            generatedAt: "2026-09-04T00:00:00.000Z",
            shard: "metrics.json",
            record: "metrics[id=FILES]",
          },
        },
      },
      {
        id: "LINES_OF_CODE_MAIN",
        baseline: 100,
        current: 90,
        delta: -10,
        direction: "decrease",
        provenance: {
          baseline: {
            snapshotId: BASELINE_ID,
            generatedAt: "2026-09-01T00:00:00.000Z",
            shard: "metrics.json",
            record: "metrics[id=LINES_OF_CODE_MAIN]",
          },
          current: {
            snapshotId: CURRENT_ID,
            generatedAt: "2026-09-04T00:00:00.000Z",
            shard: "metrics.json",
            record: "metrics[id=LINES_OF_CODE_MAIN]",
          },
        },
      },
      {
        id: "REMOVED_METRIC",
        baseline: 8,
        current: null,
        delta: null,
        direction: "removed",
        provenance: {
          baseline: {
            snapshotId: BASELINE_ID,
            generatedAt: "2026-09-01T00:00:00.000Z",
            shard: "metrics.json",
            record: "metrics[id=REMOVED_METRIC]",
          },
        },
      },
      {
        id: "UNCHANGED_METRIC",
        baseline: 4,
        current: 4,
        delta: 0,
        direction: "unchanged",
        provenance: {
          baseline: {
            snapshotId: BASELINE_ID,
            generatedAt: "2026-09-01T00:00:00.000Z",
            shard: "metrics.json",
            record: "metrics[id=UNCHANGED_METRIC]",
          },
          current: {
            snapshotId: CURRENT_ID,
            generatedAt: "2026-09-04T00:00:00.000Z",
            shard: "metrics.json",
            record: "metrics[id=UNCHANGED_METRIC]",
          },
        },
      },
    ])
  })

  test("is deterministic when the source metric arrays use different orders", () => {
    const first = compareCanonicalSnapshots(
      snapshot({
        context: { snapshotId: CURRENT_ID, generatedAt: "2026-09-04T00:00:00.000Z" },
        metrics: [
          { id: "B", value: 2 },
          { id: "A", value: 1 },
        ],
      }),
      snapshot({
        metrics: [
          { id: "A", value: 0 },
          { id: "B", value: 2 },
        ],
      }),
    )
    const second = compareCanonicalSnapshots(
      snapshot({
        context: { snapshotId: CURRENT_ID, generatedAt: "2026-09-04T00:00:00.000Z" },
        metrics: [
          { id: "A", value: 1 },
          { id: "B", value: 2 },
        ],
      }),
      snapshot({
        metrics: [
          { id: "B", value: 2 },
          { id: "A", value: 0 },
        ],
      }),
    )

    expect(first).toEqual(second)
  })

  test("reports missing snapshots and metric shards explicitly", () => {
    const baseline = snapshot({ metrics: [{ id: "FILES", value: 10 }] })

    expect(compareCanonicalSnapshots(undefined, baseline)).toEqual({
      status: "missing",
      missing: "current",
      message: "Current snapshot is missing.",
    })
    expect(
      compareCanonicalSnapshots(snapshot({ context: { snapshotId: CURRENT_ID }, includeMetrics: false }), baseline),
    ).toEqual({
      status: "missing",
      missing: "metrics",
      message: "Current snapshot is missing the metrics.json shard.",
    })
  })

  test("rejects incompatible versions, modes, and repository identities", () => {
    const baseline = snapshot()

    expect(
      compareCanonicalSnapshots(snapshot({ context: { snapshotId: CURRENT_ID, dataVersion: 1 } }), baseline),
    ).toEqual({
      status: "incompatible",
      reason: "data_version",
      message: "Snapshots must use canonical dataVersion 2.",
    })
    expect(
      compareCanonicalSnapshots(
        snapshot({ context: { snapshotId: CURRENT_ID, mode: "landscape", reportMode: "landscape" } }),
        baseline,
      ),
    ).toMatchObject({ status: "incompatible", reason: "report_mode" })
    expect(
      compareCanonicalSnapshots(
        snapshot({ context: { snapshotId: CURRENT_ID, repositoryId: "repo:other" } }),
        baseline,
      ),
    ).toMatchObject({ status: "incompatible", reason: "repository_id" })
  })

  test("rejects malformed metric shards and duplicate metric ids", () => {
    expect(
      compareCanonicalSnapshots(
        {
          context: context({ snapshotId: CURRENT_ID, generatedAt: "2026-09-04T00:00:00.000Z" }),
          metrics: { metrics: [{ id: "FILES", value: "12" }] },
        },
        snapshot(),
      ),
    ).toMatchObject({ status: "incompatible", reason: "metrics" })
    expect(
      compareCanonicalSnapshots(
        {
          context: context({ snapshotId: CURRENT_ID, generatedAt: "2026-09-04T00:00:00.000Z" }),
          metrics: {
            metrics: [
              { id: "FILES", value: 12 },
              { id: "FILES", value: 13 },
            ],
          },
        },
        snapshot(),
      ),
    ).toMatchObject({ status: "incompatible", reason: "metrics" })
  })
})

describe("compareLatestCanonicalSnapshots", () => {
  test("selects the two newest snapshots from an unsorted history", () => {
    const result = compareLatestCanonicalSnapshots([
      snapshot({
        context: { snapshotId: CURRENT_ID, generatedAt: "2026-09-04T00:00:00.000Z" },
        metrics: [{ id: "FILES", value: 12 }],
      }),
      snapshot({
        context: { snapshotId: BASELINE_ID, generatedAt: "2026-09-01T00:00:00.000Z" },
        metrics: [{ id: "FILES", value: 10 }],
      }),
      snapshot({
        context: { snapshotId: TIED_ID, generatedAt: "2026-09-03T00:00:00.000Z" },
        metrics: [{ id: "FILES", value: 11 }],
      }),
    ])

    expect(result.status).toBe("compatible")
    if (result.status !== "compatible") return

    expect(result.baseline.snapshotId).toBe(TIED_ID)
    expect(result.current.snapshotId).toBe(CURRENT_ID)
    expect(result.deltas).toEqual([expect.objectContaining({ id: "FILES", baseline: 11, current: 12, delta: 1 })])
  })

  test("uses snapshot id as a deterministic tie-breaker for equal timestamps", () => {
    const result = compareLatestCanonicalSnapshots([
      snapshot({
        context: { snapshotId: CURRENT_ID, generatedAt: "2026-09-04T00:00:00.000Z" },
        metrics: [{ id: "FILES", value: 12 }],
      }),
      snapshot({
        context: { snapshotId: BASELINE_ID, generatedAt: "2026-09-04T00:00:00.000Z" },
        metrics: [{ id: "FILES", value: 10 }],
      }),
      snapshot({
        context: { snapshotId: TIED_ID, generatedAt: "2026-09-04T00:00:00.000Z" },
        metrics: [{ id: "FILES", value: 11 }],
      }),
    ])

    expect(result.status).toBe("compatible")
    if (result.status !== "compatible") return

    expect(result.baseline.snapshotId).toBe(CURRENT_ID)
    expect(result.current.snapshotId).toBe(TIED_ID)
    expect(result.deltas).toEqual([expect.objectContaining({ id: "FILES", baseline: 12, current: 11, delta: -1 })])
  })

  test("reports a missing baseline when history has fewer than two snapshots", () => {
    expect(
      compareLatestCanonicalSnapshots([
        snapshot({ context: { snapshotId: CURRENT_ID, generatedAt: "2026-09-04T00:00:00.000Z" } }),
      ]),
    ).toEqual({
      status: "missing",
      missing: "baseline",
      message: "Snapshot history requires at least two snapshots.",
    })
  })

  test("rejects duplicate snapshot ids in history", () => {
    expect(
      compareLatestCanonicalSnapshots([
        snapshot({ context: { snapshotId: BASELINE_ID, generatedAt: "2026-09-01T00:00:00.000Z" } }),
        snapshot({ context: { snapshotId: BASELINE_ID, generatedAt: "2026-09-04T00:00:00.000Z" } }),
      ]),
    ).toEqual({
      status: "incompatible",
      reason: "snapshot_id",
      message: "Snapshot history contains duplicate snapshotId values.",
    })
  })

  test("rejects mixed repository identities anywhere in history", () => {
    expect(
      compareLatestCanonicalSnapshots([
        snapshot({
          context: {
            snapshotId: BASELINE_ID,
            generatedAt: "2026-09-01T00:00:00.000Z",
            repositoryId: "repo:other",
          },
        }),
        snapshot({
          context: { snapshotId: TIED_ID, generatedAt: "2026-09-03T00:00:00.000Z" },
        }),
        snapshot({
          context: { snapshotId: CURRENT_ID, generatedAt: "2026-09-04T00:00:00.000Z" },
        }),
      ]),
    ).toEqual({
      status: "incompatible",
      reason: "repository_id",
      message: "Snapshot history must describe one repository identity.",
    })
  })
})
