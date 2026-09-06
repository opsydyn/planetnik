import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { PortfolioActionQueue } from "@planetnik/common"
import {
  actionQueueArtifactCacheKey,
  loadActionQueueArtifactManifest,
  parseActionQueueArtifactParams,
  readActionQueueArtifactPage,
} from "../datasets/actionQueueArtifactRoutes.js"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function queue(): PortfolioActionQueue {
  return {
    contractVersion: 1,
    rankingPolicyVersion: 1,
    asOf: "2026-09-06T00:00:00.000Z",
    filters: { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: "current" },
    items: [{ id: "action:repo:file" }] as unknown as PortfolioActionQueue["items"],
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

describe("action queue artifact routes", () => {
  test("rejects unknown windows and non-positive or non-canonical pages", () => {
    expect(parseActionQueueArtifactParams("unknown", "1")).toBeUndefined()
    expect(parseActionQueueArtifactParams("current", "0")).toBeUndefined()
    expect(parseActionQueueArtifactParams("current", "-1")).toBeUndefined()
    expect(parseActionQueueArtifactParams("current", "1.5")).toBeUndefined()
    expect(parseActionQueueArtifactParams("current", "01")).toBeUndefined()
    expect(parseActionQueueArtifactParams("current", "2")).toEqual({ window: "current", page: 2 })
  })

  test("loads a valid page and preserves exact evidence anchors", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-route-"))
    roots.push(root)
    const sourceFingerprint = "a".repeat(64)
    const original = queue()
    mkdirSync(join(root, "current"), { recursive: true })
    writeFileSync(
      join(root, "manifest.json"),
      JSON.stringify({
        version: 1,
        projectionVersion: 1,
        sourceFingerprint,
        generatedAt: "2026-09-06T00:00:00.000Z",
        filterOptions: { repositories: [], teams: [], priorities: [], domains: [] },
        windows: [
          {
            window: "current",
            totalItems: 1,
            complete: true,
            pageSize: 250,
            pageCount: 1,
            chunks: ["current/1.json"],
            asOf: original.asOf,
            coverage: original.coverage,
          },
        ],
      }),
    )
    writeFileSync(
      join(root, "current/1.json"),
      JSON.stringify({
        version: 1,
        window: "current",
        page: 1,
        pageSize: 250,
        totalItems: 1,
        asOf: original.asOf,
        coverage: original.coverage,
        items: original.items,
      }),
    )

    const manifest = loadActionQueueArtifactManifest(root)
    expect(manifest.tag).toBe("ready")
    if (manifest.tag !== "ready") return
    const page = readActionQueueArtifactPage(root, manifest.manifest, { window: "current", page: 1 })
    expect(page?.queue.items).toEqual(original.items)
    expect(page?.queue.coverage).toEqual(original.coverage)
    expect(actionQueueArtifactCacheKey(manifest.manifest, { window: "current", page: 1 })).toBe(
      `${sourceFingerprint}:1:current:1`,
    )
  })

  test("returns no page for an absent or malformed artifact", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-route-"))
    roots.push(root)
    expect(loadActionQueueArtifactManifest(root).tag).toBe("missing")
    writeFileSync(join(root, "manifest.json"), JSON.stringify({ version: 2 }))
    expect(loadActionQueueArtifactManifest(root).tag).toBe("invalid")
  })

  test("rejects unknown filter values and mixed-provenance chunks", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-route-"))
    roots.push(root)
    const original = queue()
    mkdirSync(join(root, "current"), { recursive: true })
    const manifestValue = {
      version: 1,
      projectionVersion: 1,
      sourceFingerprint: "a".repeat(64),
      generatedAt: "2026-09-06T00:00:00.000Z",
      filterOptions: { repositories: [], teams: [], priorities: ["not-a-priority"], domains: [] },
      windows: [
        {
          window: "current",
          totalItems: 1,
          complete: true,
          pageSize: 250,
          pageCount: 1,
          chunks: ["current/1.json"],
          asOf: original.asOf,
          coverage: original.coverage,
        },
      ],
    }
    writeFileSync(join(root, "manifest.json"), JSON.stringify(manifestValue))
    expect(loadActionQueueArtifactManifest(root).tag).toBe("invalid")

    writeFileSync(
      join(root, "manifest.json"),
      JSON.stringify({ ...manifestValue, filterOptions: { repositories: [], teams: [], priorities: [], domains: [] } }),
    )
    writeFileSync(
      join(root, "current/1.json"),
      JSON.stringify({
        version: 1,
        window: "current",
        page: 1,
        pageSize: 250,
        totalItems: 1,
        asOf: "2026-09-07T00:00:00.000Z",
        coverage: original.coverage,
        items: original.items,
      }),
    )
    const manifest = loadActionQueueArtifactManifest(root)
    expect(manifest.tag).toBe("ready")
    if (manifest.tag !== "ready") return
    expect(readActionQueueArtifactPage(root, manifest.manifest, { window: "current", page: 1 })).toBeUndefined()
  })
})
