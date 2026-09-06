import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { PortfolioActionQueue, PortfolioActionWindow } from "@planetnik/common"
import { Effect } from "effect"
import {
  type ActionQueueArtifactSource,
  materializeActionQueueArtifacts,
} from "../datasets/actionQueueArtifactMaterializer.js"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function queue(window: PortfolioActionWindow, ids: readonly string[]): PortfolioActionQueue {
  return {
    contractVersion: 1,
    rankingPolicyVersion: 1,
    asOf: "2026-09-06T00:00:00.000Z",
    filters: { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window },
    items: ids.map((id) => ({ id, signals: [], evidence: [] })) as unknown as PortfolioActionQueue["items"],
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

describe("action queue artifact materializer", () => {
  test("writes ordered chunks and a source-fingerprinted manifest", async () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-artifacts-"))
    roots.push(root)
    const outputDir = join(root, "artifacts")
    const source: ActionQueueArtifactSource = {
      sourceIds: ["repo-a:snapshot-1"],
      readWindow: (window) => queue(window, ["first", "second", "third"]),
    }

    const manifest = await Effect.runPromise(
      materializeActionQueueArtifacts({
        source,
        outputDir,
        windows: ["current"],
        pageSize: 2,
      }),
    )

    expect(manifest.windows).toHaveLength(1)
    expect(manifest.projectionVersion).toBe(2)
    expect(manifest.windows[0]).toMatchObject({
      window: "current",
      totalItems: 3,
      complete: true,
      pageSize: 2,
      pageCount: 2,
      chunks: ["current/1.json", "current/2.json"],
    })
    expect(manifest.filterOptions.priorities).toEqual(["critical", "high", "medium", "low", "unrated"])
    expect(manifest.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/u)
    expect(manifest.windows[0]?.contentFingerprint).toMatch(/^[a-f0-9]{64}$/u)
    expect(existsSync(join(outputDir, "manifest.json"))).toBe(true)
    const firstChunk = JSON.parse(readFileSync(join(outputDir, "current/1.json"), "utf8")) as {
      readonly evidenceBases: readonly unknown[]
      readonly items: readonly Record<string, unknown>[]
    }
    expect(firstChunk).toMatchObject({
      asOf: "2026-09-06T00:00:00.000Z",
      totalItems: 3,
    })
    expect(firstChunk.evidenceBases).toEqual([])
    expect(firstChunk.items[0]).not.toHaveProperty("evidence")
    expect(
      JSON.parse(readFileSync(join(outputDir, "current/1.json"), "utf8")).items.map((item: { id: string }) => item.id),
    ).toEqual(["first", "second"])
    expect(
      JSON.parse(readFileSync(join(outputDir, "current/2.json"), "utf8")).items.map((item: { id: string }) => item.id),
    ).toEqual(["third"])
    expect(readdirSync(root).filter((entry) => entry.startsWith(".action-queue-"))).toEqual([])
  })

  test("keeps bounded artifacts to the materialized prefix while preserving the full total", async () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-artifacts-bounded-"))
    roots.push(root)
    const outputDir = join(root, "artifacts")
    const source: ActionQueueArtifactSource = {
      sourceIds: ["repo-a:snapshot-1"],
      readWindow: (window) => ({ queue: queue(window, ["first", "second", "third"]), totalItems: 5 }),
    }

    const manifest = await Effect.runPromise(
      materializeActionQueueArtifacts({
        source,
        outputDir,
        windows: ["current"],
        pageSize: 2,
      }),
    )

    expect(manifest.windows[0]).toMatchObject({
      totalItems: 5,
      complete: false,
      pageCount: 2,
      chunks: ["current/1.json", "current/2.json"],
    })
    expect(
      JSON.parse(readFileSync(join(outputDir, "current/2.json"), "utf8")).items.map((item: { id: string }) => item.id),
    ).toEqual(["third"])
    expect(readdirSync(join(outputDir, "current"))).toEqual(["1.json", "2.json"])
  })

  test("changes only the affected window fingerprint when queue content changes", async () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-artifacts-fingerprint-"))
    roots.push(root)
    const firstOutputDir = join(root, "first")
    const secondOutputDir = join(root, "second")
    const source = (changed: boolean): ActionQueueArtifactSource => ({
      sourceIds: ["repo-a:snapshot-1"],
      readWindow: (window) => queue(window, window === "current" ? ["current"] : changed ? ["changed"] : ["shared"]),
    })

    const firstManifest = await Effect.runPromise(
      materializeActionQueueArtifacts({
        source: source(false),
        outputDir: firstOutputDir,
        windows: ["current", "7d"],
        pageSize: 2,
      }),
    )
    const secondManifest = await Effect.runPromise(
      materializeActionQueueArtifacts({
        source: source(true),
        outputDir: secondOutputDir,
        windows: ["current", "7d"],
        pageSize: 2,
      }),
    )

    const firstCurrent = firstManifest.windows.find((window) => window.window === "current")!
    const firstSevenDay = firstManifest.windows.find((window) => window.window === "7d")!
    const secondCurrent = secondManifest.windows.find((window) => window.window === "current")!
    const secondSevenDay = secondManifest.windows.find((window) => window.window === "7d")!
    expect(secondManifest.sourceFingerprint).toBe(firstManifest.sourceFingerprint)
    expect(secondCurrent.contentFingerprint).toBe(firstCurrent.contentFingerprint)
    expect(secondSevenDay.contentFingerprint).not.toBe(firstSevenDay.contentFingerprint)
  })
})
