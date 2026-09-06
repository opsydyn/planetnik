import { describe, expect, test } from "bun:test"
import { compareCanonicalEntitySnapshots, type SnapshotEntityDomain } from "../SnapshotEntityTrends.js"

const BASELINE_ID = "11111111-1111-4111-8111-111111111111"
const CURRENT_ID = "22222222-2222-4222-8222-222222222222"

const context = (snapshotId: string, generatedAt: string, overrides: Record<string, unknown> = {}) => ({
  mode: "single_repository",
  reportMode: "single_repository",
  title: "Entity fixture",
  dataVersion: 2,
  repositoryId: "repo:entity-fixture",
  snapshotId,
  generatedAt,
  ...overrides,
})

const record = (
  id: string,
  values: Record<string, unknown>,
  records: readonly string[],
  shards: readonly string[],
) => ({ id, values, provenance: { records, shards } })

const snapshot = (
  snapshotId: string,
  generatedAt: string,
  domain: SnapshotEntityDomain,
  records: ReturnType<typeof record>[],
) => ({
  context: context(snapshotId, generatedAt),
  entities: {
    [domain]: {
      present: true,
      records,
    },
  },
})

describe("compareCanonicalEntitySnapshots", () => {
  test("returns deterministic entity deltas with changed fields and exact provenance", () => {
    const result = compareCanonicalEntitySnapshots(
      snapshot(CURRENT_ID, "2026-09-04T00:00:00.000Z", "components", [
        record(
          "component:primary:api",
          { linesOfCode: 120, files: 4, status: "healthy" },
          ["files[index=0]"],
          ["files_main.json"],
        ),
        record("component:primary:new", { linesOfCode: 8 }, ["files[index=3]"], ["files_main.json"]),
        record("component:primary:stable", { linesOfCode: 20 }, ["files[index=1]"], ["files_main.json"]),
      ]),
      snapshot(BASELINE_ID, "2026-09-01T00:00:00.000Z", "components", [
        record(
          "component:primary:api",
          { linesOfCode: 100, files: 4, status: "healthy" },
          ["files[index=0]"],
          ["files_main.json"],
        ),
        record("component:primary:old", { linesOfCode: 12 }, ["files[index=2]"], ["files_main.json"]),
        record("component:primary:stable", { linesOfCode: 20 }, ["files[index=1]"], ["files_main.json"]),
      ]),
      "components",
    )

    expect(result.status).toBe("compatible")
    if (result.status !== "compatible") return

    expect(result.domain).toBe("components")
    expect(result.deltas).toEqual([
      expect.objectContaining({ id: "component:primary:api", direction: "changed", changedFields: ["linesOfCode"] }),
      expect.objectContaining({
        id: "component:primary:new",
        direction: "added",
        baseline: null,
        current: { linesOfCode: 8 },
      }),
      expect.objectContaining({
        id: "component:primary:old",
        direction: "removed",
        baseline: { linesOfCode: 12 },
        current: null,
      }),
      expect.objectContaining({ id: "component:primary:stable", direction: "unchanged", changedFields: [] }),
    ])
    expect(result.deltas[0]?.provenance).toEqual({
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
    })
  })

  test("rejects missing entity collections, duplicate ids, and non-JSON values", () => {
    const baseline = snapshot(BASELINE_ID, "2026-09-01T00:00:00.000Z", "hotspots", [
      record("hotspot:file:src/app.ts", { score: 4 }, ["fileHotspots[index=0]"], ["hotspots.json"]),
    ])

    expect(
      compareCanonicalEntitySnapshots(
        { context: context(CURRENT_ID, "2026-09-04T00:00:00.000Z"), entities: {} },
        baseline,
        "hotspots",
      ),
    ).toEqual({
      status: "missing",
      missing: "entities",
      message: "Current snapshot is missing the hotspots entity collection.",
    })

    expect(
      compareCanonicalEntitySnapshots(
        {
          context: context(CURRENT_ID, "2026-09-04T00:00:00.000Z"),
          entities: {
            hotspots: {
              present: true,
              records: [
                record("duplicate", { score: 1 }, ["fileHotspots[index=0]"], ["hotspots.json"]),
                record("duplicate", { score: 2 }, ["fileHotspots[index=1]"], ["hotspots.json"]),
              ],
            },
          },
        },
        baseline,
        "hotspots",
      ),
    ).toMatchObject({ status: "incompatible", reason: "entities" })

    expect(
      compareCanonicalEntitySnapshots(
        {
          context: context(CURRENT_ID, "2026-09-04T00:00:00.000Z"),
          entities: {
            hotspots: {
              present: true,
              records: [record("bad", { score: Number.NaN }, ["fileHotspots[index=0]"], ["hotspots.json"])],
            },
          },
        },
        baseline,
        "hotspots",
      ),
    ).toMatchObject({ status: "incompatible", reason: "entities" })
  })

  test("rejects incompatible snapshot identity before comparing entities", () => {
    const baseline = snapshot(BASELINE_ID, "2026-09-01T00:00:00.000Z", "controls", [
      record("control:quality:FILES", { status: "ok" }, ["goals[0].controls[0]"], ["controls.json"]),
    ])

    expect(
      compareCanonicalEntitySnapshots(
        {
          ...snapshot(CURRENT_ID, "2026-09-04T00:00:00.000Z", "controls", []),
          context: context(CURRENT_ID, "2026-09-04T00:00:00.000Z", { repositoryId: "repo:other" }),
        },
        baseline,
        "controls",
      ),
    ).toEqual({
      status: "incompatible",
      reason: "repository_id",
      message: "Snapshots must describe the same repository identity.",
    })
  })
})
