import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type {
  CanonicalComponentDependencyRecord,
  CanonicalFileRecord,
  CanonicalHotspotRecord,
  CanonicalImpactShard,
  CanonicalReportContext,
  CanonicalUnitRecord,
  CodeCitySnapshotInput,
} from "@planetnik/common"
import { isValidV2ReportContext, resolveDatasetsRoot } from "../../loaders/planetnik-loader.js"
import { type CodeCityCollectionEntry, toCodeCitySnapshotInput } from "../codeCitySnapshot.js"
import { resolveNamedDatasetDataDir } from "../dataDirectories.js"

const safeDatasetIdPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u

export function normaliseEvidencePath(value: string | undefined): string | null {
  if (!value) return null
  const [path] = value.trim().split(/[?#]/u, 1)
  const normalised = path?.replace(/^\/+|\/+$/gu, "") ?? ""
  if (!normalised || normalised === "overview" || normalised === "code-city") return null
  if (normalised.split("/").some((segment) => segment === "..")) return null
  return normalised
}

type DatasetReportSummary = Record<string, unknown>

type DatasetMetricRecord = {
  readonly id?: string
  readonly value?: number
}

export type DatasetReportSnapshot = {
  readonly dataDir: string
  readonly context: CanonicalReportContext
  readonly summary: DatasetReportSummary | null
  readonly filesMain: readonly CanonicalFileRecord[]
  readonly filesTest: readonly CanonicalFileRecord[]
  readonly units: readonly CanonicalUnitRecord[]
  readonly dependencies: readonly CanonicalComponentDependencyRecord[]
  readonly hotspots: readonly CanonicalHotspotRecord[]
  readonly impact: CanonicalImpactShard | undefined
  readonly metrics: readonly DatasetMetricRecord[]
}

export type DatasetReportReadResult =
  | { readonly tag: "ready"; readonly snapshot: DatasetReportSnapshot }
  | { readonly tag: "missing"; readonly message: string }
  | { readonly tag: "invalid"; readonly message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readJsonFile(dataDir: string, fileName: string): unknown {
  return JSON.parse(readFileSync(join(dataDir, fileName), "utf-8")) as unknown
}

function readShard(dataDir: string, context: CanonicalReportContext, capability: string): unknown | null {
  const fileName = context.canonicalShards?.[capability]
  if (!fileName) return null
  return readJsonFile(dataDir, fileName)
}

function readRecordShard(
  dataDir: string,
  context: CanonicalReportContext,
  capability: string,
): Record<string, unknown> | null {
  const raw = readShard(dataDir, context, capability)
  return isRecord(raw) ? raw : null
}

function readRecordArray<T>(
  dataDir: string,
  context: CanonicalReportContext,
  capability: string,
  key: string,
): readonly T[] {
  const raw = readRecordShard(dataDir, context, capability)
  const values = raw?.[key]
  return Array.isArray(values) ? (values as readonly T[]) : []
}

const entries = <T>(records: readonly T[]): CodeCityCollectionEntry<T>[] => records.map((data) => ({ data }))

export function readDatasetReport(
  datasetId: string,
  options: { readonly datasetsRoot?: string } = {},
): DatasetReportReadResult {
  if (!safeDatasetIdPattern.test(datasetId)) {
    return { tag: "invalid", message: "Dataset id is not a safe catalogue identifier." }
  }

  const datasetsRoot = options.datasetsRoot ?? resolveDatasetsRoot()
  const dataDir = resolveNamedDatasetDataDir(datasetId, datasetsRoot)
  if (!dataDir || !existsSync(dataDir)) {
    return {
      tag: "missing",
      message: `Dataset '${datasetId}' has no recognised report data directory.`,
    }
  }

  try {
    const rawContext = readJsonFile(dataDir, "report_context.json")
    if (!isRecord(rawContext) || rawContext.dataVersion !== 2 || !isValidV2ReportContext(dataDir, rawContext)) {
      return { tag: "invalid", message: "Dataset report requires a valid canonical v2 report context." }
    }

    const context = rawContext as CanonicalReportContext
    const summary = readRecordShard(dataDir, context, "summary")
    const filesMain = readRecordArray<CanonicalFileRecord>(dataDir, context, "filesMain", "files")
    const filesTest = readRecordArray<CanonicalFileRecord>(dataDir, context, "filesTest", "files")
    const units = readRecordArray<CanonicalUnitRecord>(dataDir, context, "units", "units")
    const dependencies = readRecordArray<CanonicalComponentDependencyRecord>(
      dataDir,
      context,
      "componentDependencies",
      "dependencies",
    )
    const hotspotsShard = readRecordShard(dataDir, context, "hotspots")
    const hotspots = [
      ...(Array.isArray(hotspotsShard?.fileHotspots) ? hotspotsShard.fileHotspots : []),
      ...(Array.isArray(hotspotsShard?.unitHotspots) ? hotspotsShard.unitHotspots : []),
      ...(Array.isArray(hotspotsShard?.componentHotspots) ? hotspotsShard.componentHotspots : []),
    ] as readonly CanonicalHotspotRecord[]
    const impactRaw = readShard(dataDir, context, "impact")
    const impact = isRecord(impactRaw) ? (impactRaw as CanonicalImpactShard) : undefined
    const metrics = readRecordArray<DatasetMetricRecord>(dataDir, context, "metrics", "metrics")

    return {
      tag: "ready",
      snapshot: {
        dataDir,
        context,
        summary,
        filesMain,
        filesTest,
        units,
        dependencies,
        hotspots,
        impact,
        metrics,
      },
    }
  } catch (error) {
    return {
      tag: "invalid",
      message:
        error instanceof Error ? `Could not read dataset report: ${error.message}` : "Could not read dataset report.",
    }
  }
}

export function toDatasetCodeCitySnapshotInput(snapshot: DatasetReportSnapshot): CodeCitySnapshotInput {
  return toCodeCitySnapshotInput({
    context: snapshot.context,
    filesMain: entries(snapshot.filesMain),
    filesTest: entries(snapshot.filesTest),
    units: entries(snapshot.units),
    dependencies: entries(snapshot.dependencies),
    hotspots: entries(snapshot.hotspots),
    impact: snapshot.impact,
  })
}
