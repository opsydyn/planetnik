import { existsSync, readFileSync, statSync } from "node:fs"
import { isAbsolute, join, relative, resolve } from "node:path"
import type {
  CanonicalEntitySnapshotInput,
  CanonicalReportContext,
  SnapshotComparison,
  SnapshotEntityComparison,
  SnapshotEntityDomain,
} from "@planetnik/common"
import { compareCanonicalEntitySnapshots, compareLatestCanonicalSnapshots } from "@planetnik/common"
import { isValidV2ReportContext, resolveDatasetsRoot } from "../../loaders/planetnik-loader.js"
import { resolveNamedDatasetDataDir } from "../dataDirectories.js"
import { readSnapshotEntities } from "./snapshotEntities.js"

// ADR-0018: longitudinal views consume validated canonical v2 JSON snapshots,
// never presentation projections such as TXT or HTML.
type SnapshotHistoryManifestEntry = {
  readonly dataDir: string
}

type SnapshotHistoryManifest = {
  readonly historyVersion: 1
  readonly snapshots: readonly SnapshotHistoryManifestEntry[]
}

const safeDatasetIdPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u

export type DatasetSnapshotHistoryEntry = {
  readonly dataDir: string
  readonly relativeDataDir: string
  readonly context: CanonicalReportContext
  readonly snapshot: CanonicalEntitySnapshotInput
}

export type DatasetSnapshotHistory = {
  readonly manifestPath: string
  readonly entries: readonly DatasetSnapshotHistoryEntry[]
  readonly comparison: SnapshotComparison
  readonly entityComparisons?: Readonly<Record<SnapshotEntityDomain, SnapshotEntityComparison>>
}

export type SnapshotHistoryReadResult =
  | { readonly tag: "ready"; readonly history: DatasetSnapshotHistory }
  | { readonly tag: "missing"; readonly message: string }
  | { readonly tag: "invalid"; readonly message: string }

export type DatasetSnapshotReadResult =
  | { readonly tag: "ready"; readonly snapshot: DatasetSnapshotHistoryEntry }
  | { readonly tag: "missing"; readonly message: string }
  | { readonly tag: "invalid"; readonly message: string }

export function readDatasetSnapshotHistory(
  datasetId: string,
  options: { readonly datasetsRoot?: string } = {},
): SnapshotHistoryReadResult {
  if (!safeDatasetIdPattern.test(datasetId)) {
    return { tag: "invalid", message: "Dataset id is not a safe catalogue identifier." }
  }

  const datasetsRoot = options.datasetsRoot ?? resolveDatasetsRoot()
  const dataDir = resolveNamedDatasetDataDir(datasetId, datasetsRoot)
  if (!dataDir) {
    return {
      tag: "missing",
      message: `Dataset '${datasetId}' has no recognised report data directory.`,
    }
  }

  return readSnapshotHistory(dataDir)
}

/**
 * Read the current canonical snapshot for a named catalogue entry. This is
 * intentionally separate from history: a repository can contribute a current
 * portfolio footprint even when it has no second snapshot to compare.
 */
export function readDatasetCurrentSnapshot(
  datasetId: string,
  options: { readonly datasetsRoot?: string; readonly includeEntities?: boolean } = {},
): DatasetSnapshotReadResult {
  if (!safeDatasetIdPattern.test(datasetId)) {
    return { tag: "invalid", message: "Dataset id is not a safe catalogue identifier." }
  }

  const datasetsRoot = options.datasetsRoot ?? resolveDatasetsRoot()
  const dataDir = resolveNamedDatasetDataDir(datasetId, datasetsRoot)
  if (!dataDir) {
    return {
      tag: "missing",
      message: `Dataset '${datasetId}' has no recognised report data directory.`,
    }
  }

  const result = readHistoryEntry(
    resolve(dataDir),
    { dataDir: "." },
    { includeEntities: options.includeEntities ?? false },
  )
  if (result.tag === "invalid") return result
  return { tag: "ready", snapshot: result.value }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8")) as unknown
}

function isSafeRelativeDataDir(value: string): boolean {
  if (!value || value.includes("\\") || value.includes("\0") || isAbsolute(value)) return false
  if (
    value !== "." &&
    value.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    return false
  }
  return true
}

function isWithinRoot(root: string, candidate: string): boolean {
  const remainder = relative(root, candidate)
  return remainder === "" || (!remainder.startsWith("..") && !isAbsolute(remainder))
}

function parseManifest(raw: unknown): SnapshotHistoryManifest | { readonly message: string } {
  if (!isRecord(raw) || raw.historyVersion !== 1) {
    return { message: "Snapshot history manifest must use historyVersion 1." }
  }
  if (!Array.isArray(raw.snapshots)) {
    return { message: "Snapshot history manifest must contain a snapshots array." }
  }

  const seen = new Set<string>()
  const snapshots: SnapshotHistoryManifestEntry[] = []
  for (const value of raw.snapshots) {
    if (!isRecord(value) || typeof value.dataDir !== "string" || !isSafeRelativeDataDir(value.dataDir.trim())) {
      return { message: "Snapshot history dataDir must be a safe relative path." }
    }
    const dataDir = value.dataDir.trim()
    if (seen.has(dataDir)) {
      return { message: `Snapshot history contains duplicate dataDir '${dataDir}'.` }
    }
    seen.add(dataDir)
    snapshots.push({ dataDir })
  }

  return { historyVersion: 1, snapshots }
}

function readHistoryEntry(
  root: string,
  entry: SnapshotHistoryManifestEntry,
  options: { readonly includeEntities?: boolean } = {},
):
  | { readonly tag: "ready"; readonly value: DatasetSnapshotHistoryEntry }
  | { readonly tag: "invalid"; readonly message: string } {
  const snapshotDir = resolve(root, entry.dataDir)
  if (!isWithinRoot(resolve(root), snapshotDir)) {
    return { tag: "invalid", message: "Snapshot history dataDir must resolve beneath the report data directory." }
  }

  try {
    if (!statSync(snapshotDir).isDirectory()) {
      return { tag: "invalid", message: `Snapshot history entry '${entry.dataDir}' is not a directory.` }
    }
  } catch {
    return { tag: "invalid", message: `Snapshot history entry '${entry.dataDir}' is not a directory.` }
  }

  const contextPath = join(snapshotDir, "report_context.json")
  if (!existsSync(contextPath)) {
    return {
      tag: "invalid",
      message: `Snapshot history entry '${entry.dataDir}' requires a valid canonical v2 report context.`,
    }
  }

  let rawContext: unknown
  try {
    rawContext = readJson(contextPath)
  } catch {
    return {
      tag: "invalid",
      message: `Snapshot history entry '${entry.dataDir}' requires a valid canonical v2 report context.`,
    }
  }
  if (!isRecord(rawContext) || rawContext.dataVersion !== 2 || !isValidV2ReportContext(snapshotDir, rawContext)) {
    return {
      tag: "invalid",
      message: `Snapshot history entry '${entry.dataDir}' requires a valid canonical v2 report context.`,
    }
  }

  const context = rawContext as CanonicalReportContext
  const metricsFile = context.canonicalShards?.metrics
  let metrics: unknown
  if (metricsFile) {
    try {
      metrics = readJson(join(snapshotDir, metricsFile))
    } catch {
      return {
        tag: "invalid",
        message: `Snapshot history entry '${entry.dataDir}' has an unreadable metrics shard.`,
      }
    }
  }

  const entityResult = options.includeEntities === false ? undefined : readSnapshotEntities(snapshotDir, context)
  if (entityResult?.tag === "invalid") {
    return {
      tag: "invalid",
      message: `Snapshot history entry '${entry.dataDir}' has invalid entity shards: ${entityResult.message}`,
    }
  }

  return {
    tag: "ready",
    value: {
      dataDir: snapshotDir,
      relativeDataDir: entry.dataDir,
      context,
      snapshot:
        metrics === undefined
          ? entityResult
            ? { context, entities: entityResult.entities }
            : { context }
          : entityResult
            ? { context, metrics, entities: entityResult.entities }
            : { context, metrics },
    },
  }
}

const ENTITY_DOMAINS: readonly SnapshotEntityDomain[] = ["components", "hotspots", "controls", "ownership"]

function compareEntityHistory(
  entries: readonly DatasetSnapshotHistoryEntry[],
  comparison: SnapshotComparison,
): Readonly<Record<SnapshotEntityDomain, SnapshotEntityComparison>> {
  if (comparison.status === "compatible") {
    const baseline = entries.find((entry) => entry.context.snapshotId === comparison.baseline.snapshotId)?.snapshot
    const current = entries.find((entry) => entry.context.snapshotId === comparison.current.snapshotId)?.snapshot
    if (baseline && current) {
      return Object.fromEntries(
        ENTITY_DOMAINS.map((domain) => [domain, compareCanonicalEntitySnapshots(current, baseline, domain)]),
      ) as Record<SnapshotEntityDomain, SnapshotEntityComparison>
    }
  }

  if (comparison.status === "missing") {
    return Object.fromEntries(
      ENTITY_DOMAINS.map((domain) => [
        domain,
        {
          status: "missing",
          missing: comparison.missing === "metrics" ? "entities" : comparison.missing,
          message: comparison.message,
        } satisfies SnapshotEntityComparison,
      ]),
    ) as Record<SnapshotEntityDomain, SnapshotEntityComparison>
  }

  const incompatible = comparison as Extract<SnapshotComparison, { readonly status: "incompatible" }>
  return Object.fromEntries(
    ENTITY_DOMAINS.map((domain) => [
      domain,
      {
        status: "incompatible",
        reason: incompatible.reason,
        message: incompatible.message,
      } satisfies SnapshotEntityComparison,
    ]),
  ) as Record<SnapshotEntityDomain, SnapshotEntityComparison>
}

export function readSnapshotHistory(dataDir: string): SnapshotHistoryReadResult {
  const manifestPath = join(dataDir, "snapshot-history.json")
  if (!existsSync(manifestPath)) {
    return { tag: "missing", message: "Snapshot history manifest is not present." }
  }

  let rawManifest: unknown
  try {
    rawManifest = readJson(manifestPath)
  } catch {
    return { tag: "invalid", message: "Snapshot history manifest is not valid JSON." }
  }

  const manifest = parseManifest(rawManifest)
  if ("message" in manifest) return { tag: "invalid", message: manifest.message }

  const root = resolve(dataDir)
  const entries: DatasetSnapshotHistoryEntry[] = []
  for (const entry of manifest.snapshots) {
    const result = readHistoryEntry(root, entry)
    if (result.tag === "invalid") return result
    entries.push(result.value)
  }

  if (!manifest.snapshots.some((entry) => entry.dataDir === ".")) {
    return { tag: "missing", message: "Snapshot history manifest does not include the current snapshot." }
  }

  const comparison = compareLatestCanonicalSnapshots(entries.map((entry) => entry.snapshot))
  return {
    tag: "ready",
    history: {
      manifestPath,
      entries,
      comparison,
      entityComparisons: compareEntityHistory(entries, comparison),
    },
  }
}
