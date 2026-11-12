import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { PortfolioActionEvidence, PortfolioActionQueue, PortfolioActionSignal } from "@planetnik/common"
import {
  actionQueueArtifactCacheKey,
  loadActionQueueArtifactManifest,
  parseActionQueueArtifactParams,
  readActionQueueArtifactPage,
} from "../datasets/actionQueueArtifactRoutes.js"
import {
  ACTION_QUEUE_ARTIFACT_VERSION,
  type ActionQueueArtifactManifest,
  chunkPortfolioActionQueue,
} from "../datasets/actionQueueArtifacts.js"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function queue(): PortfolioActionQueue {
  const first: PortfolioActionEvidence = {
    datasetId: "dataset",
    repositoryId: "repo",
    snapshotId: "snapshot",
    generatedAt: "2026-09-06T00:00:00.000Z",
    domain: "coupling",
    shard: "files_main.json",
    record: "files[index=0]",
    href: "/datasets/dataset/overview",
    label: "src",
    observed: { name: "src", linesOfCode: 10 },
  }
  const signal: PortfolioActionSignal = {
    id: "coupling:component",
    repositoryId: "repo",
    targetId: "file",
    targetLabel: "src",
    team: { id: "team", label: "Team" },
    domain: "coupling",
    priorityBand: "high",
    sourcePriority: { label: "severity", value: "High" },
    observedAt: "2026-09-06T00:00:00.000Z",
    action: { key: "reduce-coupling", label: "Reduce coupling" },
    explanation: "Reduce coupling for src.",
    facts: [{ label: "severity", value: "High" }],
    evidence: [first],
  }
  return {
    contractVersion: 1,
    rankingPolicyVersion: 1,
    asOf: "2026-09-06T00:00:00.000Z",
    filters: { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: "current" },
    items: [
      {
        id: "action:repo:file",
        repositoryId: "repo",
        repositoryTitle: "Repository",
        target: { id: "file", label: "src" },
        teams: [{ id: "team", label: "Team" }],
        primaryAction: signal.action,
        alternateActions: [],
        priorityBand: "high",
        trend: "unknown",
        freshness: "fresh",
        corroboration: 1,
        factors: [
          { key: "priority", label: "Priority band", value: "high", explanation: "High" },
          { key: "corroboration", label: "Corroboration", value: 1, explanation: "One domain" },
          { key: "trend", label: "Trend", value: "unknown", explanation: "Unknown" },
          { key: "freshness", label: "Freshness", value: "fresh", explanation: "Fresh" },
        ],
        signals: [signal],
        evidence: [first],
        status: "untracked",
      },
    ],
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

function queueWithMultipleSignals(): PortfolioActionQueue {
  const source = queue()
  const item = source.items[0]!
  const firstEvidence = item.evidence[0]!
  const secondEvidence: PortfolioActionEvidence = {
    ...firstEvidence,
    domain: "hotspot",
    shard: "hotspots.json",
    record: "hotspots[index=0]",
    label: "src hotspot",
  }
  const firstSignal = item.signals[0]!
  const secondSignal: PortfolioActionSignal = {
    ...firstSignal,
    id: "hotspot:file",
    domain: "hotspot",
    targetLabel: "src hotspot",
    action: { key: "reduce-hotspot", label: "Reduce the hotspot" },
    evidence: [secondEvidence],
  }
  return {
    ...source,
    items: [
      {
        ...item,
        corroboration: 2,
        factors: item.factors.map((factor) =>
          factor.key === "corroboration" ? { ...factor, value: 2, explanation: "Two domains" } : factor,
        ),
        signals: [firstSignal, secondSignal],
        evidence: [firstEvidence, secondEvidence],
      },
    ],
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

  test("uses the selected window content fingerprint in each cache key", () => {
    const manifest = {
      projectionVersion: 2,
      filterOptions: { repositories: [], teams: [], priorities: [], domains: [] },
      windows: [
        {
          window: "current",
          totalItems: 1,
          complete: true,
          pageSize: 250,
          pageCount: 1,
          chunks: ["current/1.json"],
          contentFingerprint: "b".repeat(64),
          asOf: "2026-09-06T00:00:00.000Z",
          coverage: queue().coverage,
        },
        {
          window: "7d",
          totalItems: 1,
          complete: true,
          pageSize: 250,
          pageCount: 1,
          chunks: ["7d/1.json"],
          contentFingerprint: "c".repeat(64),
          asOf: "2026-09-06T00:00:00.000Z",
          coverage: queue().coverage,
        },
      ],
    } as ActionQueueArtifactManifest

    const currentKey = actionQueueArtifactCacheKey(manifest, { window: "current", page: 1 })
    const sevenDayKey = actionQueueArtifactCacheKey(manifest, { window: "7d", page: 1 })
    expect(currentKey).toMatch(new RegExp(`^${"b".repeat(64)}:[a-f0-9]{64}:2:current:1$`))
    expect(sevenDayKey).toMatch(new RegExp(`^${"c".repeat(64)}:[a-f0-9]{64}:2:7d:1$`))
    expect(currentKey).not.toBe(sevenDayKey)
  })

  test("invalidates every page when manifest-wide filter options change", () => {
    const manifest = {
      projectionVersion: 2,
      filterOptions: { repositories: [], teams: [], priorities: [], domains: [] },
      windows: [
        {
          window: "current",
          totalItems: 1,
          complete: true,
          pageSize: 250,
          pageCount: 1,
          chunks: ["current/1.json"],
          contentFingerprint: "b".repeat(64),
          asOf: "2026-09-06T00:00:00.000Z",
          coverage: queue().coverage,
        },
        {
          window: "7d",
          totalItems: 1,
          complete: true,
          pageSize: 250,
          pageCount: 1,
          chunks: ["7d/1.json"],
          contentFingerprint: "c".repeat(64),
          asOf: "2026-09-06T00:00:00.000Z",
          coverage: queue().coverage,
        },
      ],
    } as ActionQueueArtifactManifest
    const changed = {
      ...manifest,
      filterOptions: {
        ...manifest.filterOptions,
        repositories: [{ id: "repo", label: "Repository" }],
      },
    }

    for (const window of ["current", "7d"] as const) {
      expect(actionQueueArtifactCacheKey(changed, { window, page: 1 })).not.toBe(
        actionQueueArtifactCacheKey(manifest, { window, page: 1 }),
      )
    }
  })

  test("loads a valid page and preserves exact evidence anchors", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-route-"))
    roots.push(root)
    const sourceFingerprint = "a".repeat(64)
    const contentFingerprint = "b".repeat(64)
    const original = queueWithMultipleSignals()
    mkdirSync(join(root, "current"), { recursive: true })
    writeFileSync(
      join(root, "manifest.json"),
      JSON.stringify({
        version: ACTION_QUEUE_ARTIFACT_VERSION,
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
            contentFingerprint,
            asOf: original.asOf,
            coverage: original.coverage,
          },
        ],
      }),
    )
    writeFileSync(join(root, "current/1.json"), JSON.stringify(chunkPortfolioActionQueue(original)[0]))

    const manifest = loadActionQueueArtifactManifest(root)
    expect(manifest.tag).toBe("ready")
    if (manifest.tag !== "ready") return
    const page = readActionQueueArtifactPage(root, manifest.manifest, { window: "current", page: 1 })
    expect(page?.queue.items).toEqual(original.items)
    expect(page?.queue.coverage).toEqual(original.coverage)
    expect(page?.contentFingerprint).toBe(contentFingerprint)
    expect(actionQueueArtifactCacheKey(manifest.manifest, { window: "current", page: 1 })).toMatch(
      new RegExp(`^${contentFingerprint}:[a-f0-9]{64}:1:current:1$`),
    )
  })

  test("returns no page for an absent or malformed artifact", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-route-"))
    roots.push(root)
    expect(loadActionQueueArtifactManifest(root).tag).toBe("missing")
    writeFileSync(join(root, "manifest.json"), JSON.stringify({ version: 2 }))
    expect(loadActionQueueArtifactManifest(root).tag).toBe("invalid")
  })

  test("fails closed on a legacy v1 manifest", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-route-"))
    roots.push(root)
    writeFileSync(
      join(root, "manifest.json"),
      JSON.stringify({
        version: 1,
        projectionVersion: 1,
        sourceFingerprint: "a".repeat(64),
        generatedAt: "2026-09-06T00:00:00.000Z",
        filterOptions: { repositories: [], teams: [], priorities: [], domains: [] },
        windows: [],
      }),
    )
    expect(loadActionQueueArtifactManifest(root).tag).toBe("invalid")
  })

  test("rejects unknown filter values and mixed-provenance chunks", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-route-"))
    roots.push(root)
    const original = queue()
    mkdirSync(join(root, "current"), { recursive: true })
    const manifestValue = {
      version: ACTION_QUEUE_ARTIFACT_VERSION,
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
          contentFingerprint: "b".repeat(64),
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
        ...chunkPortfolioActionQueue({ ...original, asOf: "2026-09-07T00:00:00.000Z" })[0],
      }),
    )
    const manifest = loadActionQueueArtifactManifest(root)
    expect(manifest.tag).toBe("ready")
    if (manifest.tag !== "ready") return
    expect(readActionQueueArtifactPage(root, manifest.manifest, { window: "current", page: 1 })).toBeUndefined()
  })

  test("rejects compact chunks with an out-of-range evidence reference", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-route-"))
    roots.push(root)
    const original = queue()
    mkdirSync(join(root, "current"), { recursive: true })
    writeFileSync(
      join(root, "manifest.json"),
      JSON.stringify({
        version: ACTION_QUEUE_ARTIFACT_VERSION,
        projectionVersion: 1,
        sourceFingerprint: "a".repeat(64),
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
            contentFingerprint: "b".repeat(64),
            asOf: original.asOf,
            coverage: original.coverage,
          },
        ],
      }),
    )
    const chunk = chunkPortfolioActionQueue(original)[0]
    writeFileSync(
      join(root, "current/1.json"),
      JSON.stringify({
        ...chunk,
        items: [
          {
            ...chunk.items[0],
            signals: [{ ...chunk.items[0]?.signals[0], evidenceRefs: [[1, "missing"]] }],
          },
        ],
      }),
    )
    const manifest = loadActionQueueArtifactManifest(root)
    expect(manifest.tag).toBe("ready")
    if (manifest.tag !== "ready") return
    expect(readActionQueueArtifactPage(root, manifest.manifest, { window: "current", page: 1 })).toBeUndefined()
  })

  test("fails closed on unsafe or mismatched evidence and malformed item shapes", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-action-route-"))
    roots.push(root)
    const original = queueWithMultipleSignals()
    mkdirSync(join(root, "current"), { recursive: true })
    writeFileSync(
      join(root, "manifest.json"),
      JSON.stringify({
        version: ACTION_QUEUE_ARTIFACT_VERSION,
        projectionVersion: 1,
        sourceFingerprint: "a".repeat(64),
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
            contentFingerprint: "b".repeat(64),
            asOf: original.asOf,
            coverage: original.coverage,
          },
        ],
      }),
    )
    const chunk = chunkPortfolioActionQueue(original)[0]!
    const manifest = loadActionQueueArtifactManifest(root)
    expect(manifest.tag).toBe("ready")
    if (manifest.tag !== "ready") return

    const writeChunk = (value: unknown) => writeFileSync(join(root, "current/1.json"), JSON.stringify(value))
    writeChunk({
      ...chunk,
      evidenceBases: chunk.evidenceBases.map((base) => ({ ...base, href: "javascript:alert(1)" })),
    })
    expect(readActionQueueArtifactPage(root, manifest.manifest, { window: "current", page: 1 })).toBeUndefined()

    writeChunk({
      ...chunk,
      evidenceBases: chunk.evidenceBases.map((base) => ({ ...base, repositoryId: "other-repository" })),
    })
    expect(readActionQueueArtifactPage(root, manifest.manifest, { window: "current", page: 1 })).toBeUndefined()

    const signal = chunk.items[0]!.signals[0]!
    const { facts: _facts, ...malformedSignal } = signal
    writeChunk({
      ...chunk,
      items: [{ ...chunk.items[0], signals: [malformedSignal] }],
    })
    expect(readActionQueueArtifactPage(root, manifest.manifest, { window: "current", page: 1 })).toBeUndefined()
  })
})
