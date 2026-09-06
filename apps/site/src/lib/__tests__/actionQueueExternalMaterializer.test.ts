import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type {
  PortfolioActionQueueCoverage,
  PortfolioActionSignal,
  PortfolioActionSignalDomain,
  PortfolioActionTeam,
} from "@planetnik/common"
import { readActionQueueArtifactPage } from "../datasets/actionQueueArtifactRoutes.js"
import {
  ACTION_QUEUE_ARTIFACT_PROJECTION_VERSION,
  type ActionQueueArtifactManifest,
  fingerprintActionQueueSource,
} from "../datasets/actionQueueArtifacts.js"
import {
  type ActionQueueStreamingSource,
  actionQueueStreamPartitionForKey,
  materializeStreamingActionQueueArtifacts,
} from "../datasets/actionQueueExternalMaterializer.js"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

const asOf = "2026-09-06T00:00:00.000Z"
const team: PortfolioActionTeam = { id: "core", label: "Core" }

function coverage(): PortfolioActionQueueCoverage {
  return {
    datasets: {
      included: [{ datasetId: "fixture", repositoryId: "repo:fixture" }],
      planned: [],
      excluded: [],
      unavailable: [],
    },
    domains: {
      hotspot: { status: "present", datasetCount: 1, signalCount: 3 },
      control: { status: "present", datasetCount: 1, signalCount: 1 },
      security: { status: "missing", datasetCount: 0, signalCount: 0 },
      impact: { status: "missing", datasetCount: 0, signalCount: 0 },
      coupling: { status: "missing", datasetCount: 0, signalCount: 0 },
      ownership: { status: "missing", datasetCount: 0, signalCount: 0 },
      trend: { status: "present", datasetCount: 1, signalCount: 1 },
    },
    diagnostics: [],
  }
}

function signal(
  repositoryId: string,
  targetId: string,
  domain: PortfolioActionSignalDomain,
  priorityBand: PortfolioActionSignal["priorityBand"] = "high",
  patch: Partial<PortfolioActionSignal> = {},
): PortfolioActionSignal {
  const action =
    domain === "control"
      ? { key: "restore-control", label: "Restore the failed quality control" }
      : domain === "trend"
        ? { key: "review-trend", label: "Review the recent movement" }
        : { key: "stabilize-hotspot", label: "Stabilize the hotspot" }
  return {
    id: `${domain}:${repositoryId}:${targetId}`,
    repositoryId,
    targetId,
    targetLabel: targetId,
    team,
    domain,
    priorityBand,
    sourcePriority: {
      label: domain === "trend" ? "direction" : "severity",
      value: domain === "trend" ? "worsening" : "High",
    },
    observedAt: asOf,
    action,
    explanation: `${action.label} for ${targetId}.`,
    facts: [{ label: "target", value: targetId }],
    evidence: [
      {
        datasetId: "fixture",
        repositoryId,
        snapshotId: "22222222-2222-4222-8222-222222222222",
        generatedAt: asOf,
        domain,
        shard: "hotspots.json",
        record: `${domain}[${targetId}]`,
        href: `/datasets/fixture/${domain}`,
        label: targetId,
        observed: { targetId },
      },
    ],
    ...patch,
  }
}

function source(changed = false): ActionQueueStreamingSource {
  const rows = [
    {
      key: "repo:fixture\u0000alpha",
      repositoryTitle: "Fixture",
      signal: signal("repo:fixture", "alpha", "hotspot", "high"),
    },
    {
      key: "repo:fixture\u0000alpha",
      repositoryTitle: "Fixture",
      signal: signal("repo:fixture", "alpha", "control", "critical"),
    },
    {
      key: "repo:fixture\u0000alpha",
      repositoryTitle: "Fixture",
      signal: signal("repo:fixture", "alpha", "trend", "unrated"),
    },
    {
      key: "repo:fixture\u0000bravo",
      repositoryTitle: "Fixture",
      signal: signal("repo:fixture", "bravo", "hotspot", "high", changed ? { explanation: "changed" } : {}),
    },
    {
      key: "repo:fixture\u0000charlie",
      repositoryTitle: "Fixture",
      signal: signal("repo:fixture", "charlie", "hotspot", "low"),
    },
    {
      key: "repo:fixture\u0000trend-only",
      repositoryTitle: "Fixture",
      signal: signal("repo:fixture", "trend-only", "trend", "unrated"),
    },
  ]
  return {
    sourceIds: ["fixture\u0000fixture\u000022222222-2222-4222-8222-222222222222\u00002026-09-06T00:00:00.000Z"],
    metadata: {
      asOf,
      coverage: coverage(),
      filterOptions: {
        repositories: [{ id: "repo:fixture", label: "Fixture" }],
        teams: [team],
        priorities: ["critical", "high", "medium", "low", "unrated"],
        domains: ["control", "hotspot", "trend"],
      },
    },
    streamSignals: async (emit) => {
      for (const row of rows) emit(row)
    },
  }
}

function materializedWindow(manifest: ActionQueueArtifactManifest, window: "current" | "latest-compatible") {
  return manifest.windows.find((entry) => entry.window === window)!
}

describe("materializeStreamingActionQueueArtifacts", () => {
  test("partitions, ranks, merges, and writes compact complete pages deterministically", async () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-stream-materializer-"))
    roots.push(root)
    const outputDir = join(root, "artifacts")
    const manifest = await materializeStreamingActionQueueArtifacts({
      source: source(),
      outputDir,
      windows: ["current", "latest-compatible"],
      pageSize: 2,
      partitionCount: 3,
    })
    const current = materializedWindow(manifest, "current")
    expect(current).toMatchObject({ totalItems: 3, complete: true, pageSize: 2, pageCount: 2 })
    expect(current.chunks).toEqual(["current/1.json", "current/2.json"])
    const ids: string[] = []
    for (let page = 1; page <= current.pageCount; page += 1) {
      const result = readActionQueueArtifactPage(`${root}/artifacts`, manifest, { window: "current", page })!
      ids.push(...result.queue.items.map((item) => item.target.id))
      const raw = JSON.parse(readFileSync(join(outputDir, `current/${page}.json`), "utf8")) as Record<string, unknown>
      expect(raw.items).toBeArray()
      expect((raw.items as Record<string, unknown>[])[0]).not.toHaveProperty("evidence")
    }
    expect(ids).toEqual(["alpha", "bravo", "charlie"])
    expect(materializedWindow(manifest, "latest-compatible").totalItems).toBe(3)
    expect(manifest.sourceFingerprint).not.toBe(
      fingerprintActionQueueSource(source().sourceIds, ACTION_QUEUE_ARTIFACT_PROJECTION_VERSION),
    )
    expect(manifest.generatedAt).toBe(asOf)
    expect(
      readdirSync(root).filter(
        (entry) => entry.startsWith(".action-queue-stream-") || entry.startsWith(".action-queue-"),
      ),
    ).toEqual([])

    const second = await materializeStreamingActionQueueArtifacts({
      source: source(),
      outputDir: join(root, "second"),
      windows: ["current", "latest-compatible"],
      pageSize: 2,
      partitionCount: 3,
    })
    expect(second).toEqual(manifest)
  })

  test("uses deterministic partition assignment and changes only affected content fingerprints", async () => {
    expect(actionQueueStreamPartitionForKey("repo:fixture\u0000alpha", 7)).toBe(
      actionQueueStreamPartitionForKey("repo:fixture\u0000alpha", 7),
    )
    expect(actionQueueStreamPartitionForKey("repo:fixture\u0000alpha", 7)).not.toBe(
      actionQueueStreamPartitionForKey("repo:fixture\u0000bravo", 7),
    )
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-stream-fingerprint-"))
    roots.push(root)
    const first = await materializeStreamingActionQueueArtifacts({
      source: source(),
      outputDir: join(root, "first"),
      windows: ["current"],
    })
    const second = await materializeStreamingActionQueueArtifacts({
      source: source(true),
      outputDir: join(root, "second"),
      windows: ["current"],
    })
    expect(second.sourceFingerprint).toBe(first.sourceFingerprint)
    expect(second.windows[0]?.contentFingerprint).not.toBe(first.windows[0]?.contentFingerprint)
  })

  test("cleans staging files and leaves an existing destination on stream failure", async () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-stream-failure-"))
    roots.push(root)
    const outputDir = join(root, "artifacts")
    const marker = join(outputDir, "marker.txt")
    const failing: ActionQueueStreamingSource = {
      ...source(),
      streamSignals: async (emit) => {
        emit({
          key: "repo:fixture\u0000alpha",
          repositoryTitle: "Fixture",
          signal: signal("repo:fixture", "alpha", "hotspot"),
        })
        throw new Error("synthetic stream failure")
      },
    }
    await expect(materializeStreamingActionQueueArtifacts({ source: failing, outputDir })).rejects.toThrow(
      "synthetic stream failure",
    )
    expect(existsSync(marker)).toBe(false)
    expect(
      readdirSync(root).filter(
        (entry) => entry.startsWith(".action-queue-stream-") || entry.startsWith(".action-queue-"),
      ),
    ).toEqual([])
  })
})
