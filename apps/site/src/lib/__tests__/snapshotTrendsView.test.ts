import { describe, expect, test } from "bun:test"
import type {
  CanonicalReportContext,
  SnapshotComparison,
  SnapshotEntityComparison,
  SnapshotMetricDelta,
} from "@planetnik/common"
import type { DatasetSnapshotHistoryEntry, SnapshotHistoryReadResult } from "../datasets/snapshotHistory.js"
import { buildSnapshotTrendViewModel } from "../datasets/snapshotTrendsView.js"

const BASELINE_ID = "11111111-1111-4111-8111-111111111111"
const CURRENT_ID = "22222222-2222-4222-8222-222222222222"

function entry(snapshotId: string, generatedAt: string, relativeDataDir: string): DatasetSnapshotHistoryEntry {
  const context = { snapshotId, generatedAt } as CanonicalReportContext
  return {
    dataDir: `/tmp/${relativeDataDir}`,
    relativeDataDir,
    context,
    snapshot: { context, metrics: { metrics: [{ id: "FILES", value: 10 }] } },
  }
}

function entryWithEntities(
  snapshotId: string,
  generatedAt: string,
  relativeDataDir: string,
  entities: DatasetSnapshotHistoryEntry["snapshot"]["entities"],
): DatasetSnapshotHistoryEntry {
  const context = { snapshotId, generatedAt } as CanonicalReportContext
  return {
    dataDir: `/tmp/${relativeDataDir}`,
    relativeDataDir,
    context,
    snapshot: { context, metrics: { metrics: [{ id: "FILES", value: 10 }] }, entities },
  }
}

function compatibleComparison(): SnapshotComparison {
  const baseline = {
    dataVersion: 2 as const,
    mode: "single_repository" as const,
    title: "Fixture",
    repositoryId: "repo:fixture",
    snapshotId: BASELINE_ID,
    generatedAt: "2026-09-01T00:00:00.000Z",
  }
  const current = { ...baseline, snapshotId: CURRENT_ID, generatedAt: "2026-09-04T00:00:00.000Z" }
  const delta: SnapshotMetricDelta = {
    id: "FILES",
    baseline: 10,
    current: 12,
    delta: 2,
    direction: "increase",
    provenance: {
      baseline: {
        snapshotId: BASELINE_ID,
        generatedAt: baseline.generatedAt,
        shard: "metrics.json",
        record: "metrics[id=FILES]",
      },
      current: {
        snapshotId: CURRENT_ID,
        generatedAt: current.generatedAt,
        shard: "metrics.json",
        record: "metrics[id=FILES]",
      },
    },
  }
  return { status: "compatible", baseline, current, deltas: [delta] }
}

describe("buildSnapshotTrendViewModel", () => {
  test("maps a compatible comparison to snapshot and metric evidence rows", () => {
    const result: SnapshotHistoryReadResult = {
      tag: "ready",
      history: {
        manifestPath: "/tmp/data/snapshot-history.json",
        entries: [
          entry(CURRENT_ID, "2026-09-04T00:00:00.000Z", "."),
          entry(BASELINE_ID, "2026-09-01T00:00:00.000Z", "history/older"),
        ],
        comparison: compatibleComparison(),
      },
    }

    expect(buildSnapshotTrendViewModel(result)).toEqual({
      status: "compatible",
      message: "Latest snapshot compared with its immediate predecessor.",
      baseline: { snapshotId: BASELINE_ID, generatedAt: "2026-09-01T00:00:00.000Z", relativeDataDir: "history/older" },
      current: { snapshotId: CURRENT_ID, generatedAt: "2026-09-04T00:00:00.000Z", relativeDataDir: "." },
      project: {
        baseline: {
          snapshotId: BASELINE_ID,
          metricCount: 1,
          entityCount: 0,
          recordCounts: { components: 0, hotspots: 0, controls: 0, ownership: 0 },
          missingDomains: ["components", "hotspots", "controls", "ownership"],
          emptyDomains: [],
        },
        current: {
          snapshotId: CURRENT_ID,
          metricCount: 1,
          entityCount: 0,
          recordCounts: { components: 0, hotspots: 0, controls: 0, ownership: 0 },
          missingDomains: ["components", "hotspots", "controls", "ownership"],
          emptyDomains: [],
        },
        movement: {
          metricChanged: 1,
          metricAdded: 0,
          metricRemoved: 0,
          entityChanged: 0,
          entityAdded: 0,
          entityRemoved: 0,
          totalChanged: 1,
        },
        coverage: {
          status: "unavailable",
          caveat: "No entity lenses are available in either snapshot; project movement covers metrics only.",
        },
      },
      rows: [
        {
          id: "FILES",
          baseline: 10,
          current: 12,
          delta: 2,
          direction: "increase",
          baselineRecord: "metrics[id=FILES]",
          currentRecord: "metrics[id=FILES]",
        },
      ],
    })
  })

  test("maps entity comparisons into grouped rows with field and provenance evidence", () => {
    const entityComparison: SnapshotEntityComparison = {
      status: "compatible",
      domain: "components",
      baseline: {
        dataVersion: 2,
        mode: "single_repository",
        title: "Fixture",
        repositoryId: "repo:fixture",
        snapshotId: BASELINE_ID,
        generatedAt: "2026-09-01T00:00:00.000Z",
      },
      current: {
        dataVersion: 2,
        mode: "single_repository",
        title: "Fixture",
        repositoryId: "repo:fixture",
        snapshotId: CURRENT_ID,
        generatedAt: "2026-09-04T00:00:00.000Z",
      },
      deltas: [
        {
          domain: "components",
          id: "component:primary:api",
          baseline: { linesOfCode: 10, status: "healthy" },
          current: { linesOfCode: 14, status: "watch" },
          changedFields: ["linesOfCode", "status"],
          direction: "changed",
          provenance: {
            baseline: {
              snapshotId: BASELINE_ID,
              generatedAt: "2026-09-01T00:00:00.000Z",
              shards: ["files_main.json"],
              records: ["files[index=0]"],
            },
            current: {
              snapshotId: CURRENT_ID,
              generatedAt: "2026-09-04T00:00:00.000Z",
              shards: ["files_main.json"],
              records: ["files[index=0]"],
            },
          },
        },
      ],
    }

    const result: SnapshotHistoryReadResult = {
      tag: "ready",
      history: {
        manifestPath: "/tmp/data/snapshot-history.json",
        entries: [
          entry(CURRENT_ID, "2026-09-04T00:00:00.000Z", "."),
          entry(BASELINE_ID, "2026-09-01T00:00:00.000Z", "history/older"),
        ],
        comparison: compatibleComparison(),
        entityComparisons: {
          components: entityComparison,
          hotspots: { status: "missing", missing: "entities", message: "Hotspot entities are unavailable." },
          controls: { status: "missing", missing: "entities", message: "Control entities are unavailable." },
          ownership: { status: "missing", missing: "entities", message: "Ownership entities are unavailable." },
        },
      },
    }

    const view = buildSnapshotTrendViewModel(result)

    expect(view.status).toBe("compatible")
    if (view.status !== "compatible") return
    expect(view.entitySections).toEqual([
      {
        domain: "components",
        label: "Components",
        status: "compatible",
        message: "",
        rows: [
          {
            id: "component:primary:api",
            baseline: { linesOfCode: 10, status: "healthy" },
            current: { linesOfCode: 14, status: "watch" },
            direction: "changed",
            changedFields: ["linesOfCode", "status"],
            baselineShards: ["files_main.json"],
            baselineRecords: ["files[index=0]"],
            currentShards: ["files_main.json"],
            currentRecords: ["files[index=0]"],
          },
        ],
      },
      {
        domain: "hotspots",
        label: "Hotspots",
        status: "missing",
        message: "Hotspot entities are unavailable.",
        rows: [],
      },
      {
        domain: "controls",
        label: "Controls",
        status: "missing",
        message: "Control entities are unavailable.",
        rows: [],
      },
      {
        domain: "ownership",
        label: "Ownership",
        status: "missing",
        message: "Ownership entities are unavailable.",
        rows: [],
      },
    ])
  })

  test("adds a project roll-up and explicit coverage caveat", () => {
    const result: SnapshotHistoryReadResult = {
      tag: "ready",
      history: {
        manifestPath: "/tmp/data/snapshot-history.json",
        entries: [
          entryWithEntities(CURRENT_ID, "2026-09-04T00:00:00.000Z", ".", {
            components: {
              present: true,
              records: [
                {
                  id: "component:primary:api",
                  values: {},
                  provenance: { shards: ["files_main.json"], records: ["files[index=0]"] },
                },
              ],
            },
            hotspots: { present: true, records: [] },
            controls: { present: false, records: [] },
            ownership: {
              present: true,
              records: [
                {
                  id: "contributor:dev@example.com",
                  values: {},
                  provenance: { shards: ["contributors.json"], records: ["contributors[index=0]"] },
                },
              ],
            },
          }),
          entryWithEntities(BASELINE_ID, "2026-09-01T00:00:00.000Z", "history/older", {
            components: {
              present: true,
              records: [
                {
                  id: "component:primary:api",
                  values: {},
                  provenance: { shards: ["files_main.json"], records: ["files[index=0]"] },
                },
              ],
            },
            hotspots: { present: true, records: [] },
            controls: { present: false, records: [] },
            ownership: { present: true, records: [] },
          }),
        ],
        comparison: compatibleComparison(),
        entityComparisons: {
          components: {
            status: "compatible",
            domain: "components",
            baseline: compatibleComparison().baseline,
            current: compatibleComparison().current,
            deltas: [],
          },
          hotspots: {
            status: "compatible",
            domain: "hotspots",
            baseline: compatibleComparison().baseline,
            current: compatibleComparison().current,
            deltas: [],
          },
          controls: { status: "missing", missing: "entities", message: "Controls are unavailable." },
          ownership: {
            status: "compatible",
            domain: "ownership",
            baseline: compatibleComparison().baseline,
            current: compatibleComparison().current,
            deltas: [
              {
                domain: "ownership",
                id: "contributor:dev@example.com",
                baseline: null,
                current: {},
                changedFields: [],
                direction: "added",
                provenance: {
                  current: {
                    snapshotId: CURRENT_ID,
                    generatedAt: "2026-09-04T00:00:00.000Z",
                    shards: ["contributors.json"],
                    records: ["contributors[index=0]"],
                  },
                },
              },
            ],
          },
        },
      },
    }

    const view = buildSnapshotTrendViewModel(result)

    expect(view.status).toBe("compatible")
    if (view.status !== "compatible") return
    expect(view.project).toEqual({
      baseline: {
        snapshotId: BASELINE_ID,
        metricCount: 1,
        entityCount: 1,
        recordCounts: { components: 1, hotspots: 0, controls: 0, ownership: 0 },
        missingDomains: ["controls"],
        emptyDomains: ["hotspots", "ownership"],
      },
      current: {
        snapshotId: CURRENT_ID,
        metricCount: 1,
        entityCount: 2,
        recordCounts: { components: 1, hotspots: 0, controls: 0, ownership: 1 },
        missingDomains: ["controls"],
        emptyDomains: ["hotspots"],
      },
      movement: {
        metricChanged: 1,
        metricAdded: 0,
        metricRemoved: 0,
        entityChanged: 1,
        entityAdded: 1,
        entityRemoved: 0,
        totalChanged: 2,
      },
      coverage: {
        status: "partial",
        caveat:
          "Coverage differs between snapshots; added or removed entities in affected lenses may reflect collection availability rather than product change.",
      },
    })
  })

  test("preserves missing and incompatible states for honest UI copy", () => {
    expect(
      buildSnapshotTrendViewModel({
        tag: "missing",
        message: "Snapshot history manifest is not present.",
      }),
    ).toEqual({ status: "missing", message: "Snapshot history manifest is not present.", rows: [] })
    expect(
      buildSnapshotTrendViewModel({
        tag: "ready",
        history: {
          manifestPath: "/tmp/data/snapshot-history.json",
          entries: [],
          comparison: {
            status: "incompatible",
            reason: "repository_id",
            message: "Snapshots must describe the same repository identity.",
          },
        },
      }),
    ).toEqual({
      status: "incompatible",
      message: "Snapshots must describe the same repository identity.",
      rows: [],
    })
  })
})
