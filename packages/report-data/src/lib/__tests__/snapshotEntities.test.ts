import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readSnapshotEntities } from "../datasets/snapshotEntities.js"

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2))
}

function createDataRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "planetnik-snapshot-entities-"))
  temporaryRoots.push(root)
  return root
}

const context = {
  canonicalShards: {
    filesMain: "files_main.json",
    units: "units.json",
    componentDependencies: "component_dependencies.json",
    hotspots: "hotspots.json",
    controls: "controls.json",
    contributors: "contributors.json",
  },
}

describe("readSnapshotEntities", () => {
  test("derives component, hotspot, control, and ownership entities from canonical JSON shards", () => {
    const dataDir = createDataRoot()
    writeJson(join(dataDir, "files_main.json"), {
      files: [
        { id: "file:src/api.ts", linesOfCode: 20, components: ["api"] },
        { id: "file:src/worker.ts", linesOfCode: 8, components: ["runtime"] },
      ],
    })
    writeJson(join(dataDir, "units.json"), {
      units: [{ id: "unit:src/api.ts:1", linesOfCode: 5, components: ["api"] }],
    })
    writeJson(join(dataDir, "component_dependencies.json"), {
      dependencies: [
        {
          decompositionKey: "primary",
          fromComponent: "api",
          toComponent: "runtime",
          fromComponentId: "component:primary:api",
          toComponentId: "component:primary:runtime",
          count: 2,
        },
      ],
    })
    writeJson(join(dataDir, "hotspots.json"), {
      fileHotspots: [{ id: "file:src/api.ts", kind: "file", score: 7, severity: "Medium" }],
      componentHotspots: [{ id: "component:primary:api", kind: "component", score: 4 }],
    })
    writeJson(join(dataDir, "controls.json"), {
      goals: [{ goal: "Keep it simple", controls: [{ metricId: "FILES", metricValue: 2, status: "OK" }] }],
    })
    writeJson(join(dataDir, "contributors.json"), {
      contributors: [{ id: "contributor:dev@example.com", email: "dev@example.com", commitsCount: 4 }],
    })

    const result = readSnapshotEntities(dataDir, context)

    expect(result.tag).toBe("ready")
    if (result.tag !== "ready") return

    expect(result.entities.components).toEqual(
      expect.objectContaining({
        present: true,
        records: expect.arrayContaining([
          expect.objectContaining({
            id: "component:primary:api",
            values: expect.objectContaining({ files: 1, units: 1, linesOfCode: 20, outboundEdges: 1 }),
            provenance: {
              shards: ["files_main.json", "units.json", "component_dependencies.json"],
              records: ["files[index=0]", "units[index=0]", "dependencies[index=0]"],
            },
          }),
        ]),
      }),
    )
    expect(result.entities.hotspots?.records).toEqual([
      expect.objectContaining({
        id: "file:src/api.ts",
        provenance: { shards: ["hotspots.json"], records: ["fileHotspots[index=0]"] },
      }),
      expect.objectContaining({
        id: "component:primary:api",
        provenance: { shards: ["hotspots.json"], records: ["componentHotspots[index=0]"] },
      }),
    ])
    expect(result.entities.controls?.records[0]).toEqual(
      expect.objectContaining({
        id: "control:Keep it simple:FILES",
        values: expect.objectContaining({ goal: "Keep it simple", metricId: "FILES", metricValue: 2 }),
        provenance: { shards: ["controls.json"], records: ["goals[index=0].controls[index=0]"] },
      }),
    )
    expect(result.entities.ownership?.records[0]).toEqual(
      expect.objectContaining({
        id: "contributor:dev@example.com",
        provenance: { shards: ["contributors.json"], records: ["contributors[index=0]"] },
      }),
    )
  })

  test("keeps absent optional domains explicit and rejects malformed shard JSON", () => {
    const dataDir = createDataRoot()
    writeJson(join(dataDir, "files_main.json"), { files: [] })

    const result = readSnapshotEntities(dataDir, {
      canonicalShards: { filesMain: "files_main.json" },
    })
    expect(result.tag).toBe("ready")
    if (result.tag !== "ready") return
    expect(result.entities.components).toEqual(expect.objectContaining({ present: true, records: [] }))
    expect(result.entities.hotspots).toEqual(expect.objectContaining({ present: false, records: [] }))
    expect(result.entities.controls).toEqual(expect.objectContaining({ present: false, records: [] }))
    expect(result.entities.ownership).toEqual(expect.objectContaining({ present: false, records: [] }))

    writeFileSync(join(dataDir, "files_main.json"), "not-json")
    expect(readSnapshotEntities(dataDir, { canonicalShards: { filesMain: "files_main.json" } })).toEqual({
      tag: "invalid",
      message: "Could not read canonical filesMain shard 'files_main.json'.",
    })
  })
})
