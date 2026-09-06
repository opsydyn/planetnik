import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { parseCanonicalSnapshotContext, type SnapshotProvenance } from "@planetnik/common"

const HISTORY_VERSION = 1
const MIN_RETAINED_SNAPSHOTS = 2
const ENTITY_ID_POLICY_KEYS = ["repository", "file", "unit", "component", "contributor"] as const

type SnapshotHistoryManifestEntry = {
  readonly dataDir: string
}

type SnapshotHistoryManifest = {
  readonly historyVersion: 1
  readonly snapshots: readonly SnapshotHistoryManifestEntry[]
}

type SnapshotRecord = {
  readonly directory: string
  readonly relativeDataDir: string
  readonly context: Record<string, unknown>
  readonly provenance: SnapshotProvenance
  readonly canonicalShards: readonly string[]
}

export type SnapshotRetentionSession = {
  readonly dataDir: string
  readonly keep: number
  readonly manifestPath: string
  readonly previousSnapshotId?: string
}

export type SnapshotRetentionResult = {
  readonly currentSnapshotId: string
  readonly archivedSnapshotIds: readonly string[]
  readonly snapshotCount: number
  readonly manifestPath: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function assertRetentionLimit(keep: number): void {
  if (!Number.isInteger(keep) || keep <= 0) {
    throw new Error("Snapshot retention keep must be a positive integer.")
  }
  if (keep < MIN_RETAINED_SNAPSHOTS) {
    throw new Error("Snapshot retention keep must be at least two snapshots to preserve a comparable pair.")
  }
}

function isSafeRelativePath(value: string): boolean {
  if (!value || value.includes("\\") || value.includes("\0") || isAbsolute(value)) return false
  return value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..")
}

function isSafeRelativeShardPath(value: string): boolean {
  return isSafeRelativePath(value) && value.endsWith(".json")
}

function isWithinRoot(root: string, candidate: string): boolean {
  const remainder = relative(root, candidate)
  return remainder === "" || (!remainder.startsWith("..") && !isAbsolute(remainder))
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8")) as unknown
}

function readManifest(dataDir: string): SnapshotHistoryManifest {
  const manifestPath = join(dataDir, "snapshot-history.json")
  if (!existsSync(manifestPath)) return { historyVersion: HISTORY_VERSION, snapshots: [] }

  let raw: unknown
  try {
    raw = readJson(manifestPath)
  } catch {
    throw new Error("Snapshot history manifest is not valid JSON.")
  }

  if (!isRecord(raw) || raw.historyVersion !== HISTORY_VERSION) {
    throw new Error("Snapshot history manifest must use historyVersion 1.")
  }
  if (!Array.isArray(raw.snapshots)) {
    throw new Error("Snapshot history manifest must contain a snapshots array.")
  }

  const seen = new Set<string>()
  const snapshots: SnapshotHistoryManifestEntry[] = []
  for (const value of raw.snapshots) {
    if (!isRecord(value) || typeof value.dataDir !== "string") {
      throw new Error("Snapshot history dataDir must be a safe relative path.")
    }
    const dataDirValue = value.dataDir.trim()
    if (dataDirValue !== "." && !isSafeRelativePath(dataDirValue)) {
      throw new Error("Snapshot history dataDir must be a safe relative path.")
    }
    if (seen.has(dataDirValue)) {
      throw new Error(`Snapshot history contains duplicate dataDir '${dataDirValue}'.`)
    }
    seen.add(dataDirValue)
    snapshots.push({ dataDir: dataDirValue })
  }

  return { historyVersion: HISTORY_VERSION, snapshots }
}

function writeManifest(dataDir: string, snapshots: readonly SnapshotHistoryManifestEntry[]): void {
  const manifestPath = join(dataDir, "snapshot-history.json")
  mkdirSync(dataDir, { recursive: true })
  const temporaryPath = `${manifestPath}.tmp-${process.pid}-${Date.now()}`
  try {
    writeFileSync(
      temporaryPath,
      `${JSON.stringify({ historyVersion: HISTORY_VERSION, snapshots }, null, 2)}\n`,
      "utf-8",
    )
    renameSync(temporaryPath, manifestPath)
  } finally {
    if (existsSync(temporaryPath)) rmSync(temporaryPath, { force: true })
  }
}

function readSnapshotRecord(
  root: string,
  entry: SnapshotHistoryManifestEntry,
  required: boolean,
): SnapshotRecord | undefined {
  const directory = resolve(root, entry.dataDir)
  if (!isWithinRoot(resolve(root), directory)) {
    throw new Error(`Snapshot history entry '${entry.dataDir}' must resolve beneath the report data directory.`)
  }
  if (!existsSync(directory)) {
    if (!required) return undefined
    throw new Error(`Snapshot history entry '${entry.dataDir}' is not a directory.`)
  }
  try {
    if (!statSync(directory).isDirectory()) {
      throw new Error(`Snapshot history entry '${entry.dataDir}' is not a directory.`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("is not a directory")) throw error
    throw new Error(`Snapshot history entry '${entry.dataDir}' is not a directory.`)
  }

  const contextPath = join(directory, "report_context.json")
  if (!existsSync(contextPath)) {
    if (!required) return undefined
    throw new Error(`Snapshot history entry '${entry.dataDir}' requires a canonical v2 report context.`)
  }

  let rawContext: unknown
  try {
    rawContext = readJson(contextPath)
  } catch {
    throw new Error(`Snapshot history entry '${entry.dataDir}' requires a canonical v2 report context.`)
  }
  if (!isRecord(rawContext)) {
    throw new Error(`Snapshot history entry '${entry.dataDir}' requires a canonical v2 report context.`)
  }

  const parsedContext = parseCanonicalSnapshotContext(rawContext)
  if (parsedContext.kind === "invalid") {
    throw new Error(`Snapshot history entry '${entry.dataDir}' has invalid context: ${parsedContext.message}`)
  }

  const capabilities = rawContext.capabilities
  const canonicalShards = rawContext.canonicalShards
  if (
    !Array.isArray(capabilities) ||
    !capabilities.every((value): value is string => typeof value === "string" && value.trim().length > 0) ||
    !isRecord(canonicalShards)
  ) {
    throw new Error(`Snapshot history entry '${entry.dataDir}' requires a canonical shard inventory.`)
  }

  const shardPaths: string[] = []
  const shardNames = Object.keys(canonicalShards)
  if (capabilities.length !== shardNames.length || !capabilities.every((key) => shardNames.includes(key))) {
    throw new Error(`Snapshot history entry '${entry.dataDir}' has an inconsistent canonical shard inventory.`)
  }

  const seenShardPaths = new Set<string>()
  for (const [key, value] of Object.entries(canonicalShards)) {
    if (typeof value !== "string" || !isSafeRelativeShardPath(value)) {
      throw new Error(
        `Snapshot history entry '${entry.dataDir}' has an unsafe relative canonical shard path for '${key}'.`,
      )
    }
    if (seenShardPaths.has(value)) {
      throw new Error(`Snapshot history entry '${entry.dataDir}' contains duplicate canonical shard paths.`)
    }
    seenShardPaths.add(value)
    const shardPath = join(directory, value)
    if (!existsSync(shardPath) || !statSync(shardPath).isFile()) {
      throw new Error(`Snapshot history entry '${entry.dataDir}' is missing canonical shard '${value}'.`)
    }
    shardPaths.push(value)
  }

  const requiredCapabilities =
    parsedContext.value.mode === "single_repository" ? ["summary", "metrics", "contributors"] : ["analysis", "overview"]
  if (!requiredCapabilities.every((key) => shardNames.includes(key))) {
    throw new Error(`Snapshot history entry '${entry.dataDir}' is missing required canonical shards.`)
  }

  const entityIdPolicy = rawContext.entityIdPolicy
  if (
    !isRecord(entityIdPolicy) ||
    !ENTITY_ID_POLICY_KEYS.every(
      (key) => typeof entityIdPolicy[key] === "string" && entityIdPolicy[key].trim().length > 0,
    )
  ) {
    throw new Error(`Snapshot history entry '${entry.dataDir}' requires a complete entity ID policy.`)
  }

  return {
    directory,
    relativeDataDir: entry.dataDir,
    context: rawContext,
    provenance: parsedContext.value,
    canonicalShards: shardPaths,
  }
}

function snapshotIdentity(snapshot: SnapshotRecord): string {
  return snapshot.provenance.repositoryId ?? snapshot.provenance.title
}

function assertCompatibleHistory(current: SnapshotRecord, archive: SnapshotRecord): void {
  if (current.provenance.mode !== archive.provenance.mode || snapshotIdentity(current) !== snapshotIdentity(archive)) {
    throw new Error("Snapshot history entries must describe one repository identity and report mode.")
  }
}

function copyCanonicalSnapshot(root: string, snapshot: SnapshotRecord, targetDataDir: string): SnapshotRecord {
  const targetDirectory = resolve(root, targetDataDir)
  if (!isWithinRoot(resolve(root), targetDirectory)) {
    throw new Error("Snapshot archive directory must resolve beneath the report data directory.")
  }
  if (existsSync(targetDirectory)) {
    const existing = readSnapshotRecord(root, { dataDir: targetDataDir }, true)
    if (!existing || existing.provenance.snapshotId !== snapshot.provenance.snapshotId) {
      throw new Error(`Snapshot archive directory '${targetDataDir}' already contains a different snapshot.`)
    }
    assertCompatibleHistory(snapshot, existing)
    return existing
  }

  mkdirSync(targetDirectory, { recursive: true })
  copyFileSync(join(snapshot.directory, "report_context.json"), join(targetDirectory, "report_context.json"))
  for (const shardPath of snapshot.canonicalShards) {
    const destination = join(targetDirectory, shardPath)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(join(snapshot.directory, shardPath), destination)
  }

  const copied = readSnapshotRecord(root, { dataDir: targetDataDir }, true)
  if (!copied) throw new Error(`Snapshot archive directory '${targetDataDir}' could not be read after copying.`)
  return copied
}

function compareNewest(left: SnapshotRecord, right: SnapshotRecord): number {
  return (
    right.provenance.generatedAt.localeCompare(left.provenance.generatedAt) ||
    right.provenance.snapshotId.localeCompare(left.provenance.snapshotId)
  )
}

function removePrunedArchive(root: string, entry: SnapshotHistoryManifestEntry): void {
  if (!entry.dataDir.startsWith("history/")) return
  const directory = resolve(root, entry.dataDir)
  if (!isWithinRoot(resolve(root), directory) || directory === resolve(root)) return
  rmSync(directory, { recursive: true, force: true })
}

export function beginSnapshotRetention(dataDir: string, keep: number): SnapshotRetentionSession {
  assertRetentionLimit(keep)
  const root = resolve(dataDir)
  const manifestPath = join(root, "snapshot-history.json")
  const manifest = readManifest(root)
  const current = readSnapshotRecord(root, { dataDir: "." }, false)
  const archiveEntries = manifest.snapshots.filter((entry) => entry.dataDir !== ".")
  const archives = archiveEntries.map((entry) => readSnapshotRecord(root, entry, true)!)

  const seenSnapshotIds = new Set<string>()
  for (const archive of archives) {
    if (seenSnapshotIds.has(archive.provenance.snapshotId)) {
      throw new Error(`Snapshot history contains duplicate snapshotId '${archive.provenance.snapshotId}'.`)
    }
    seenSnapshotIds.add(archive.provenance.snapshotId)
    if (current) assertCompatibleHistory(current, archive)
  }

  let previousSnapshotId: string | undefined
  if (current) {
    previousSnapshotId = current.provenance.snapshotId
    if (!seenSnapshotIds.has(current.provenance.snapshotId)) {
      const archiveDir = `history/${current.provenance.snapshotId}`
      const archived = copyCanonicalSnapshot(root, current, archiveDir)
      assertCompatibleHistory(current, archived)
      archives.push(archived)
      seenSnapshotIds.add(archived.provenance.snapshotId)
    }
  }

  const orderedArchives = [...archives].sort(compareNewest).map((archive) => ({ dataDir: archive.relativeDataDir }))
  if (current || orderedArchives.length > 0) writeManifest(root, orderedArchives)

  return {
    dataDir: root,
    keep,
    manifestPath,
    ...(previousSnapshotId ? { previousSnapshotId } : {}),
  }
}

export function finishSnapshotRetention(session: SnapshotRetentionSession): SnapshotRetentionResult {
  const current = readSnapshotRecord(session.dataDir, { dataDir: "." }, true)
  if (!current) throw new Error("Current canonical snapshot is unavailable after export.")

  const manifest = readManifest(session.dataDir)
  const archiveEntries = manifest.snapshots.filter((entry) => entry.dataDir !== ".")
  const archives = archiveEntries.map((entry) => readSnapshotRecord(session.dataDir, entry, true)!)
  const seenSnapshotIds = new Set<string>()
  const uniqueArchives: SnapshotRecord[] = []
  for (const archive of archives) {
    assertCompatibleHistory(current, archive)
    if (archive.provenance.snapshotId === current.provenance.snapshotId) continue
    if (seenSnapshotIds.has(archive.provenance.snapshotId)) {
      throw new Error(`Snapshot history contains duplicate snapshotId '${archive.provenance.snapshotId}'.`)
    }
    seenSnapshotIds.add(archive.provenance.snapshotId)
    uniqueArchives.push(archive)
  }

  const retainedArchives = uniqueArchives.sort(compareNewest).slice(0, session.keep - 1)
  const retainedIds = new Set(retainedArchives.map((archive) => archive.provenance.snapshotId))
  for (const archive of uniqueArchives) {
    if (!retainedIds.has(archive.provenance.snapshotId)) {
      removePrunedArchive(session.dataDir, { dataDir: archive.relativeDataDir })
    }
  }

  const snapshots = [{ dataDir: "." }, ...retainedArchives.map((archive) => ({ dataDir: archive.relativeDataDir }))]
  writeManifest(session.dataDir, snapshots)

  return {
    currentSnapshotId: current.provenance.snapshotId,
    archivedSnapshotIds: retainedArchives.map((archive) => archive.provenance.snapshotId),
    snapshotCount: snapshots.length,
    manifestPath: session.manifestPath,
  }
}
