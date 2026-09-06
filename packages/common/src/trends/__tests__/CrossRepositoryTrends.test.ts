import { describe, expect, test } from "bun:test"
import { buildCrossRepositoryTrends, type CrossRepositoryTrendDataset } from "../CrossRepositoryTrends.js"

const BASELINE_A = "11111111-1111-4111-8111-111111111111"
const CURRENT_A = "22222222-2222-4222-8222-222222222222"
const CURRENT_B = "33333333-3333-4333-8333-333333333333"

function context(
  snapshotId: string,
  generatedAt: string,
  repositoryId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    mode: "single_repository",
    reportMode: "single_repository",
    title: repositoryId,
    dataVersion: 2,
    repositoryId: `repo:${repositoryId}`,
    snapshotId,
    generatedAt,
    ...overrides,
  }
}

function snapshot(
  snapshotId: string,
  generatedAt: string,
  repositoryId: string,
  metrics: ReadonlyArray<{ id: string; value: number }>,
) {
  return { context: context(snapshotId, generatedAt, repositoryId), metrics: { metrics } }
}

function compatibleHistory(repositoryId: string, baseline: number, current: number) {
  const baselineContext = context(BASELINE_A, "2026-09-01T00:00:00.000Z", repositoryId)
  const currentContext = context(CURRENT_A, "2026-09-04T00:00:00.000Z", repositoryId)
  return {
    status: "compatible" as const,
    comparison: {
      status: "compatible" as const,
      baseline: {
        dataVersion: 2 as const,
        mode: "single_repository" as const,
        title: repositoryId,
        repositoryId: `repo:${repositoryId}`,
        snapshotId: BASELINE_A,
        generatedAt: baselineContext.generatedAt,
      },
      current: {
        dataVersion: 2 as const,
        mode: "single_repository" as const,
        title: repositoryId,
        repositoryId: `repo:${repositoryId}`,
        snapshotId: CURRENT_A,
        generatedAt: currentContext.generatedAt,
      },
      deltas: [
        {
          id: "LINES_OF_CODE_MAIN",
          baseline,
          current,
          delta: current - baseline,
          direction:
            current === baseline
              ? ("unchanged" as const)
              : current > baseline
                ? ("increase" as const)
                : ("decrease" as const),
          provenance: {
            baseline: {
              snapshotId: BASELINE_A,
              generatedAt: baselineContext.generatedAt,
              shard: "metrics.json" as const,
              record: "metrics[id=LINES_OF_CODE_MAIN]",
            },
            current: {
              snapshotId: CURRENT_A,
              generatedAt: currentContext.generatedAt,
              shard: "metrics.json" as const,
              record: "metrics[id=LINES_OF_CODE_MAIN]",
            },
          },
        },
      ],
    },
  }
}

describe("buildCrossRepositoryTrends", () => {
  test("sums only the shared metric contract and preserves deterministic provenance", () => {
    const datasets: CrossRepositoryTrendDataset[] = [
      {
        id: "zulu",
        title: "Zulu",
        mode: "single_repository",
        availability: "ready",
        current: snapshot(CURRENT_B, "2026-09-05T00:00:00.000Z", "zulu", [
          { id: "LINES_OF_CODE_MAIN", value: 200 },
          { id: "TOTAL_NUMBER_OF_FILES", value: 20 },
          { id: "REPO_ONLY_METRIC", value: 900 },
        ]),
      },
      {
        id: "alpha",
        title: "Alpha",
        mode: "single_repository",
        availability: "ready",
        current: snapshot(CURRENT_A, "2026-09-04T00:00:00.000Z", "alpha", [
          { id: "TOTAL_NUMBER_OF_FILES", value: 10 },
          { id: "LINES_OF_CODE_MAIN", value: 100 },
        ]),
        history: compatibleHistory("alpha", 80, 100),
      },
    ]

    const result = buildCrossRepositoryTrends(datasets)

    expect(result.status).toBe("ready")
    expect(result.coverage).toEqual({
      catalogueEntries: 2,
      repositoryEntries: 2,
      includedRepositories: 2,
      plannedEntries: 0,
      unavailableEntries: 0,
      excludedEntries: 0,
      compatibleHistories: 1,
      missingHistories: 1,
      incompatibleHistories: 0,
      invalidHistories: 0,
    })
    expect(result.datasets.map((dataset) => dataset.id)).toEqual(["alpha", "zulu"])
    expect(result.metrics[0]).toMatchObject({
      id: "LINES_OF_CODE_MAIN",
      current: 300,
      baseline: 80,
      delta: 20,
      currentCoverage: 2,
      baselineCoverage: 1,
      deltaCoverage: 1,
      currentRepositories: ["alpha", "zulu"],
      baselineRepositories: ["alpha"],
      deltaRepositories: ["alpha"],
    })
    expect(result.metrics[0]?.provenance).toEqual({
      current: [
        {
          snapshotId: CURRENT_A,
          generatedAt: "2026-09-04T00:00:00.000Z",
          shard: "metrics.json",
          record: "metrics[id=LINES_OF_CODE_MAIN]",
        },
        {
          snapshotId: CURRENT_B,
          generatedAt: "2026-09-05T00:00:00.000Z",
          shard: "metrics.json",
          record: "metrics[id=LINES_OF_CODE_MAIN]",
        },
      ],
      baseline: [
        {
          snapshotId: BASELINE_A,
          generatedAt: "2026-09-01T00:00:00.000Z",
          shard: "metrics.json",
          record: "metrics[id=LINES_OF_CODE_MAIN]",
        },
      ],
    })
    expect(result.metrics.find((metric) => metric.id === "NUMBER_OF_UNITS")).toMatchObject({
      current: null,
      baseline: null,
      delta: null,
      currentCoverage: 0,
    })
  })

  test("keeps planned, landscape, and malformed entries explicit", () => {
    const result = buildCrossRepositoryTrends([
      {
        id: "planned",
        title: "Planned",
        mode: "single_repository",
        availability: "planned",
      },
      {
        id: "landscape",
        title: "Landscape",
        mode: "landscape",
        availability: "ready",
        current: snapshot(CURRENT_A, "2026-09-04T00:00:00.000Z", "landscape", []),
      },
      {
        id: "broken",
        title: "Broken",
        mode: "single_repository",
        availability: "ready",
        current: {
          context: context(CURRENT_A, "2026-09-04T00:00:00.000Z", "broken", { dataVersion: 1 }),
          metrics: { metrics: [] },
        },
      },
    ])

    expect(result.status).toBe("empty")
    expect(result.coverage).toEqual({
      catalogueEntries: 3,
      repositoryEntries: 2,
      includedRepositories: 0,
      plannedEntries: 1,
      unavailableEntries: 1,
      excludedEntries: 1,
      compatibleHistories: 0,
      missingHistories: 0,
      incompatibleHistories: 0,
      invalidHistories: 0,
    })
    expect(result.datasets).toEqual([
      expect.objectContaining({
        id: "broken",
        status: "unavailable",
        reason: "Snapshots must use canonical dataVersion 2.",
      }),
      expect.objectContaining({ id: "landscape", status: "excluded" }),
      expect.objectContaining({ id: "planned", status: "planned" }),
    ])
  })

  test("aggregates metric and entity movement without inventing deltas", () => {
    const history = compatibleHistory("alpha", 10, 12)
    const entityComparisons = {
      components: {
        status: "compatible" as const,
        domain: "components" as const,
        baseline: history.comparison.baseline,
        current: history.comparison.current,
        deltas: [
          {
            domain: "components" as const,
            id: "component:alpha",
            baseline: { health: "healthy" },
            current: { health: "watch" },
            changedFields: ["health"],
            direction: "changed" as const,
            provenance: {
              baseline: {
                snapshotId: BASELINE_A,
                generatedAt: history.comparison.baseline.generatedAt,
                shards: ["files_main.json"],
                records: ["files[index=0]"],
              },
              current: {
                snapshotId: CURRENT_A,
                generatedAt: history.comparison.current.generatedAt,
                shards: ["files_main.json"],
                records: ["files[index=0]"],
              },
            },
          },
        ],
      },
      hotspots: { status: "missing" as const, missing: "entities" as const, message: "No hotspots" },
      controls: { status: "missing" as const, missing: "entities" as const, message: "No controls" },
      ownership: { status: "missing" as const, missing: "entities" as const, message: "No ownership" },
    }

    const result = buildCrossRepositoryTrends([
      {
        id: "alpha",
        title: "Alpha",
        mode: "single_repository",
        availability: "partial",
        current: snapshot(CURRENT_A, "2026-09-04T00:00:00.000Z", "alpha", [{ id: "LINES_OF_CODE_MAIN", value: 12 }]),
        history: { ...history, entityComparisons },
      },
    ])

    expect(result.movement).toEqual({
      repositoriesWithCompatibleHistory: 1,
      metricChanged: 1,
      metricAdded: 0,
      metricRemoved: 0,
      entityChanged: 1,
      entityAdded: 0,
      entityRemoved: 0,
      totalChanged: 2,
    })
    expect(result.datasets[0]).toMatchObject({
      status: "included",
      availability: "partial",
      history: {
        status: "compatible",
        baselineSnapshotId: BASELINE_A,
        currentSnapshotId: CURRENT_A,
      },
      movement: { totalChanged: 2 },
    })
  })

  test("fails closed on duplicate dataset identities instead of double-counting", () => {
    const current = snapshot(CURRENT_A, "2026-09-04T00:00:00.000Z", "alpha", [{ id: "LINES_OF_CODE_MAIN", value: 10 }])
    const result = buildCrossRepositoryTrends([
      { id: "alpha", title: "Alpha", mode: "single_repository", availability: "ready", current },
      { id: "alpha", title: "Alpha duplicate", mode: "single_repository", availability: "ready", current },
    ])

    expect(result.coverage.includedRepositories).toBe(1)
    expect(result.coverage.unavailableEntries).toBe(1)
    expect(result.metrics[0]).toMatchObject({ current: 10, currentCoverage: 1 })
    expect(result.datasets[1]).toMatchObject({
      id: "alpha",
      status: "unavailable",
      reason: "Duplicate dataset ids cannot be included in a portfolio roll-up.",
    })
  })
})
