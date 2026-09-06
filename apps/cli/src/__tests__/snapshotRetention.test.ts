import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beginSnapshotRetention, finishSnapshotRetention } from "../snapshots/snapshotRetention.js"

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2), "utf-8")
}

function snapshotContext(snapshotId: string, generatedAt: string) {
  return {
    mode: "single_repository",
    reportMode: "single_repository",
    title: "Retention fixture",
    rootRoute: "/",
    dataVersion: 2,
    repositoryId: "repo:retention-fixture",
    snapshotId,
    generatedAt,
    source: "test",
    hasLandscape: false,
    hasSingleRepositoryAnalysis: true,
    primaryNavigation: [],
    capabilities: ["summary", "metrics", "contributors"],
    canonicalShards: {
      summary: "analysisResults.json",
      metrics: "metrics.json",
      contributors: "contributors.json",
    },
    compatibilityProjections: {
      metrics: "metrics.txt",
    },
    entityIdPolicy: {
      repository: "repo:<normalised repository key>",
      file: "file:<normalised relative path>",
      unit: "unit:<normalised relative path>:<start line>",
      component: "component:<decomposition key>:<component name>",
      contributor: "contributor:<lowercase trimmed email>",
    },
  }
}

function writeSnapshot(dataDir: string, snapshotId: string, generatedAt: string, linesOfCode = 10): void {
  mkdirSync(dataDir, { recursive: true })
  writeJson(join(dataDir, "report_context.json"), snapshotContext(snapshotId, generatedAt))
  writeJson(join(dataDir, "analysisResults.json"), { metadata: { name: "Retention fixture" } })
  writeJson(join(dataDir, "metrics.json"), {
    metrics: [{ id: "LINES_OF_CODE_MAIN", value: linesOfCode }],
  })
  writeJson(join(dataDir, "contributors.json"), { contributors: [] })
  writeFileSync(join(dataDir, "metrics.txt"), "legacy\n", "utf-8")
}

function readManifest(dataDir: string): { historyVersion: number; snapshots: Array<{ dataDir: string }> } {
  return JSON.parse(readFileSync(join(dataDir, "snapshot-history.json"), "utf-8")) as {
    historyVersion: number
    snapshots: Array<{ dataDir: string }>
  }
}

function createDataDir(): string {
  const root = mkdtempSync(join(tmpdir(), "planetnik-snapshot-retention-"))
  temporaryRoots.push(root)
  return join(root, "data")
}

describe("snapshot retention", () => {
  test("archives the previous canonical snapshot before overwrite and finalizes a bounded manifest", () => {
    const dataDir = createDataDir()
    const firstId = "11111111-1111-4111-8111-111111111111"
    const secondId = "22222222-2222-4222-8222-222222222222"
    writeSnapshot(dataDir, firstId, "2026-09-01T00:00:00.000Z")

    const session = beginSnapshotRetention(dataDir, 3)

    expect(session.previousSnapshotId).toBe(firstId)
    expect(existsSync(join(dataDir, "history", firstId, "report_context.json"))).toBe(true)
    expect(existsSync(join(dataDir, "history", firstId, "metrics.json"))).toBe(true)
    expect(existsSync(join(dataDir, "history", firstId, "metrics.txt"))).toBe(false)

    writeSnapshot(dataDir, secondId, "2026-09-02T00:00:00.000Z", 12)
    const result = finishSnapshotRetention(session)

    expect(result).toEqual({
      currentSnapshotId: secondId,
      archivedSnapshotIds: [firstId],
      snapshotCount: 2,
      manifestPath: join(dataDir, "snapshot-history.json"),
    })
    expect(readManifest(dataDir)).toEqual({
      historyVersion: 1,
      snapshots: [{ dataDir: "." }, { dataDir: `history/${firstId}` }],
    })
  })

  test("creates an honest one-snapshot manifest on the first retained export", () => {
    const dataDir = createDataDir()
    const snapshotId = "33333333-3333-4333-8333-333333333333"

    const session = beginSnapshotRetention(dataDir, 3)
    writeSnapshot(dataDir, snapshotId, "2026-09-03T00:00:00.000Z")
    const result = finishSnapshotRetention(session)

    expect(result.snapshotCount).toBe(1)
    expect(readManifest(dataDir)).toEqual({
      historyVersion: 1,
      snapshots: [{ dataDir: "." }],
    })
  })

  test("prunes the oldest archive and reuses an already-retained snapshot id", () => {
    const dataDir = createDataDir()
    const firstId = "11111111-1111-4111-8111-111111111111"
    const secondId = "22222222-2222-4222-8222-222222222222"
    const thirdId = "33333333-3333-4333-8333-333333333333"
    writeSnapshot(dataDir, firstId, "2026-09-01T00:00:00.000Z")
    const firstSession = beginSnapshotRetention(dataDir, 3)
    writeSnapshot(dataDir, secondId, "2026-09-02T00:00:00.000Z")
    finishSnapshotRetention(firstSession)

    const secondSession = beginSnapshotRetention(dataDir, 2)
    expect(existsSync(join(dataDir, "history", secondId, "metrics.json"))).toBe(true)
    writeSnapshot(dataDir, thirdId, "2026-09-03T00:00:00.000Z")
    const result = finishSnapshotRetention(secondSession)

    expect(result.archivedSnapshotIds).toEqual([secondId])
    expect(existsSync(join(dataDir, "history", firstId))).toBe(false)
    expect(readManifest(dataDir)).toEqual({
      historyVersion: 1,
      snapshots: [{ dataDir: "." }, { dataDir: `history/${secondId}` }],
    })
  })

  test("fails closed on unsafe canonical shard paths before changing history", () => {
    const dataDir = createDataDir()
    writeSnapshot(dataDir, "44444444-4444-4444-8444-444444444444", "2026-09-04T00:00:00.000Z")
    const context = snapshotContext("44444444-4444-4444-8444-444444444444", "2026-09-04T00:00:00.000Z")
    context.canonicalShards.metrics = "../metrics.json"
    writeJson(join(dataDir, "report_context.json"), context)

    expect(() => beginSnapshotRetention(dataDir, 3)).toThrow(/safe relative canonical shard/i)
    expect(existsSync(join(dataDir, "snapshot-history.json"))).toBe(false)
    expect(existsSync(join(dataDir, "history"))).toBe(false)
  })

  test("rejects invalid retention limits", () => {
    const dataDir = createDataDir()
    expect(() => beginSnapshotRetention(dataDir, 1)).toThrow(/at least two/i)
    expect(() => beginSnapshotRetention(dataDir, 2.5)).toThrow(/positive integer/i)
  })
})
