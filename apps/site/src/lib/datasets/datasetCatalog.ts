import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  type DatasetCatalog,
  type DatasetDescriptor,
  type DatasetMode,
  decodeDatasetCatalog,
  decodeDatasetDescriptor,
} from "@planetnik/common"
import { isValidV2ReportContext } from "../../loaders/planetnik-loader.js"
import { getDatasetCandidateDirs, resolveNamedDatasetDataDir } from "../dataDirectories.js"

export type DatasetCatalogSeed = {
  id: string
  title?: string
  description?: string
  mode?: DatasetMode
  sourceUrl?: string
  sourceRef?: string
  license?: string
  capturedAt?: string
  tags?: readonly string[]
  featured?: boolean
  shelf?: string
  order?: number
  availability?: "ready" | "partial" | "planned"
}

export type DatasetCatalogDiagnostic = {
  datasetId: string
  severity: "warning" | "error"
  reason: string
}

export type DatasetCatalogBuildResult = {
  catalog: DatasetCatalog
  diagnostics: DatasetCatalogDiagnostic[]
}

function invalidSeedManifest(message: string): never {
  throw new Error(`Invalid dataset catalogue manifest: ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function optionalString(entry: Record<string, unknown>, field: string): string | undefined {
  const value = entry[field]
  if (value === undefined) return undefined
  if (typeof value !== "string") invalidSeedManifest(`${field} must be a string`)
  return value
}

function optionalStringArray(entry: Record<string, unknown>, field: string): string[] | undefined {
  const value = entry[field]
  if (value === undefined) return undefined
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) {
    invalidSeedManifest(`${field} must be an array of strings`)
  }
  return [...value]
}

export function parseDatasetCatalogSeeds(raw: unknown): DatasetCatalogSeed[] {
  if (!isRecord(raw) || raw.catalogVersion !== 1) {
    invalidSeedManifest("catalogVersion must be 1")
  }
  if (!Array.isArray(raw.entries)) {
    invalidSeedManifest("entries must be an array")
  }

  return raw.entries.map((value, index) => {
    if (!isRecord(value)) invalidSeedManifest(`entry ${index} must be an object`)
    const id = value.id
    if (typeof id !== "string" || !id.trim()) {
      invalidSeedManifest(`entry ${index} requires a non-empty id`)
    }
    const mode = value.mode
    if (mode !== undefined && mode !== "single_repository" && mode !== "landscape") {
      invalidSeedManifest(`entry ${index}.mode is invalid`)
    }
    const availability = value.availability
    if (
      availability !== undefined &&
      availability !== "ready" &&
      availability !== "partial" &&
      availability !== "planned"
    ) {
      invalidSeedManifest(`entry ${index}.availability is invalid`)
    }
    const featured = value.featured
    if (featured !== undefined && typeof featured !== "boolean") {
      invalidSeedManifest(`entry ${index}.featured must be a boolean`)
    }
    const order = value.order
    if (order !== undefined && (typeof order !== "number" || !Number.isInteger(order) || order < 0)) {
      invalidSeedManifest(`entry ${index}.order must be a non-negative integer`)
    }

    return {
      id,
      ...(optionalString(value, "title") === undefined ? {} : { title: optionalString(value, "title") }),
      ...(optionalString(value, "description") === undefined
        ? {}
        : { description: optionalString(value, "description") }),
      ...(mode === undefined ? {} : { mode }),
      ...(optionalString(value, "sourceUrl") === undefined ? {} : { sourceUrl: optionalString(value, "sourceUrl") }),
      ...(optionalString(value, "sourceRef") === undefined ? {} : { sourceRef: optionalString(value, "sourceRef") }),
      ...(optionalString(value, "license") === undefined ? {} : { license: optionalString(value, "license") }),
      ...(optionalString(value, "capturedAt") === undefined ? {} : { capturedAt: optionalString(value, "capturedAt") }),
      ...(optionalStringArray(value, "tags") === undefined ? {} : { tags: optionalStringArray(value, "tags") }),
      ...(featured === undefined ? {} : { featured }),
      ...(optionalString(value, "shelf") === undefined ? {} : { shelf: optionalString(value, "shelf") }),
      ...(order === undefined ? {} : { order }),
      ...(availability === undefined ? {} : { availability }),
    }
  })
}

export function readDatasetCatalogSeeds(manifestPath: string): DatasetCatalogSeed[] {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf-8"))
  } catch {
    invalidSeedManifest(`could not read ${manifestPath}`)
  }

  return parseDatasetCatalogSeeds(raw)
}

const languageLabels: Record<string, string> = {
  css: "CSS",
  go: "Go",
  html: "HTML",
  java: "Java",
  js: "JavaScript",
  json: "JSON",
  py: "Python",
  rb: "Ruby",
  rust: "Rust",
  scala: "Scala",
  sh: "Shell",
  swift: "Swift",
  ts: "TypeScript",
  tsx: "TSX",
  tf: "Terraform",
  yaml: "YAML",
  yml: "YAML",
}

function readJsonRecord(dataDir: string, fileName: string): Record<string, unknown> | null {
  const path = join(dataDir, fileName)
  if (!existsSync(path)) return null

  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf-8"))
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function normaliseDatasetId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
}

function roundShare(value: number): number {
  return Math.round(value * 10) / 10
}

function getRecordArray(dataDir: string, fileName: string, key: string): Array<Record<string, unknown>> {
  const raw = readJsonRecord(dataDir, fileName)
  const items = raw?.[key]
  return Array.isArray(items)
    ? items.filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item),
      )
    : []
}

function languageName(extension: string): string {
  const key = extension.replace(/^\*?\.?/u, "").toLowerCase()
  return languageLabels[key] ?? (key ? key[0].toUpperCase() + key.slice(1) : "Unknown")
}

function deriveLanguages(dataDir: string, summary: Record<string, unknown> | null): DatasetDescriptor["languages"] {
  const byLanguage = new Map<string, number>()
  const files = getRecordArray(dataDir, "files_main.json", "files")

  for (const file of files) {
    const extension = asString(file.extension)
    const loc = asNumber(file.linesOfCode)
    if (!extension || loc === undefined) continue
    const key = extension.replace(/^\*?\.?/u, "").toLowerCase()
    byLanguage.set(key, (byLanguage.get(key) ?? 0) + loc)
  }

  if (byLanguage.size === 0) {
    const extensions = summary?.mainAspectAnalysisResults as Record<string, unknown> | undefined
    const summaryLanguages = extensions?.linesOfCodePerExtension
    if (Array.isArray(summaryLanguages)) {
      for (const item of summaryLanguages) {
        if (typeof item !== "object" || item === null || Array.isArray(item)) continue
        const record = item as Record<string, unknown>
        const extension = asString(record.extension)
        const loc = asNumber(record.linesOfCode)
        if (!extension || loc === undefined) continue
        const key = extension.replace(/^\*?\.?/u, "").toLowerCase()
        byLanguage.set(key, (byLanguage.get(key) ?? 0) + loc)
      }
    }
  }

  const totalLoc = [...byLanguage.values()].reduce((total, loc) => total + loc, 0)
  return [...byLanguage.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, loc]) => ({
      key,
      label: languageName(key),
      loc,
      share: totalLoc === 0 ? 0 : roundShare((loc / totalLoc) * 100),
    }))
}

function deriveSingleRepositoryStats(dataDir: string, summary: Record<string, unknown>): DatasetDescriptor["stats"] {
  const files = getRecordArray(dataDir, "files_main.json", "files")
  const contributors = getRecordArray(dataDir, "contributors.json", "contributors")
  const units = getRecordArray(dataDir, "units.json", "units")
  const dependencies = getRecordArray(dataDir, "dependencies.json", "dependencies")
  const dependencyLinks = getRecordArray(dataDir, "dependencies.json", "links")
  const componentDependencies = getRecordArray(dataDir, "component_dependencies.json", "dependencies")
  const commits = contributors.reduce((total, contributor) => {
    const value =
      asNumber(contributor.commitsAllTime) ??
      asNumber(contributor.commitsCount) ??
      asNumber(contributor.commitsCount365Days) ??
      0
    return total + value
  }, 0)
  const derivedFiles = asNumber(summary.filesCount) ?? (files.length || undefined)
  const derivedLoc =
    asNumber(summary.linesOfCode) ??
    (files.reduce((total, file) => total + (asNumber(file.linesOfCode) ?? 0), 0) || undefined)

  return {
    repositories: 1,
    ...(derivedFiles === undefined ? {} : { files: derivedFiles }),
    ...(derivedLoc === undefined ? {} : { loc: derivedLoc }),
    ...(units.length === 0 ? {} : { units: units.length }),
    ...(contributors.length === 0 ? {} : { contributors: contributors.length }),
    ...(commits === 0 ? {} : { commits }),
    ...((dependencies.length || dependencyLinks.length || componentDependencies.length) === 0
      ? {}
      : {
          dependencies: dependencies.length || dependencyLinks.length || componentDependencies.length,
        }),
  }
}

function deriveLandscapeStats(overview: Record<string, unknown>): DatasetDescriptor["stats"] {
  const totals = overview.totals as Record<string, unknown> | undefined
  const repositories = asNumber(overview.repositoryCount)
  const files = asNumber(totals?.mainFilesCount)
  const loc = asNumber(totals?.totalLinesOfCode)

  return {
    ...(repositories === undefined ? {} : { repositories }),
    ...(files === undefined ? {} : { files }),
    ...(loc === undefined ? {} : { loc }),
  }
}

function getCuration(
  seed: DatasetCatalogSeed | undefined,
  mode: DatasetMode,
  index: number,
): DatasetDescriptor["curation"] {
  return {
    featured: seed?.featured ?? false,
    shelf: seed?.shelf ?? (mode === "landscape" ? "Landscapes" : "Repository pilots"),
    order: seed?.order ?? 1000 + index,
  }
}

function getProvenance(seed: DatasetCatalogSeed | undefined): DatasetDescriptor["provenance"] {
  return {
    ...(seed?.sourceUrl === undefined ? {} : { sourceUrl: seed.sourceUrl }),
    ...(seed?.sourceRef === undefined ? {} : { sourceRef: seed.sourceRef }),
    ...(seed?.license === undefined ? {} : { license: seed.license }),
    ...(seed?.capturedAt === undefined ? {} : { capturedAt: seed.capturedAt }),
  }
}

function buildPlannedDescriptor(seed: DatasetCatalogSeed, index: number): DatasetDescriptor | undefined {
  const id = normaliseDatasetId(seed.id)
  if (!id || seed.availability !== "planned") return undefined
  const mode = seed.mode ?? "single_repository"

  return decodeDatasetDescriptor({
    id,
    slug: id,
    title: seed.title?.trim() || id,
    mode,
    provenance: getProvenance(seed),
    description: seed.description?.trim() || `Planned ${mode.replace("_", " ")} example.`,
    stats: {},
    languages: [],
    capabilities: [],
    tags: [...(seed.tags ?? [])],
    curation: getCuration(seed, mode, index),
    availability: "planned",
  })
}

function buildLocalDescriptor(
  datasetId: string,
  dataDir: string,
  seed: DatasetCatalogSeed | undefined,
  index: number,
): DatasetDescriptor {
  const context = readJsonRecord(dataDir, "report_context.json")
  if (context === null || context.dataVersion !== 2) {
    throw new Error("missing or invalid v2 report_context.json")
  }
  if (!isValidV2ReportContext(dataDir, context)) {
    throw new Error("missing or invalid v2 report_context.json")
  }

  const mode = context.mode as DatasetMode
  const summary = readJsonRecord(dataDir, "analysisResults.json")
  const overview = readJsonRecord(dataDir, "landscape_overview.json")
  const title =
    seed?.title?.trim() ||
    asString(context.title) ||
    asString((summary?.metadata as Record<string, unknown> | undefined)?.name) ||
    asString(overview?.landscapeName) ||
    datasetId
  const description =
    seed?.description?.trim() ||
    asString((summary?.metadata as Record<string, unknown> | undefined)?.description) ||
    `Static v2 ${mode === "landscape" ? "landscape" : "repository"} snapshot.`
  const stats =
    mode === "landscape" ? deriveLandscapeStats(overview ?? {}) : deriveSingleRepositoryStats(dataDir, summary ?? {})

  return decodeDatasetDescriptor({
    id: datasetId,
    slug: datasetId,
    title,
    mode,
    snapshot: {
      snapshotId: context.snapshotId,
      dataVersion: 2,
      generatedAt: context.generatedAt,
    },
    provenance: getProvenance(seed),
    description,
    stats,
    languages: mode === "landscape" ? [] : deriveLanguages(dataDir, summary),
    capabilities: Array.isArray(context.capabilities)
      ? context.capabilities.filter((value): value is string => typeof value === "string")
      : [],
    tags: [...(seed?.tags ?? [])],
    curation: getCuration(seed, mode, index),
    availability: seed?.availability === "partial" ? "partial" : "ready",
  })
}

export function buildDatasetCatalog(options: {
  datasetsRoot: string
  curation?: readonly DatasetCatalogSeed[]
}): DatasetCatalogBuildResult {
  const diagnostics: DatasetCatalogDiagnostic[] = []
  const seeds = options.curation ?? []
  const seedById = new Map(seeds.map((seed) => [normaliseDatasetId(seed.id), seed]))
  const descriptors: DatasetDescriptor[] = []
  const datasetNames = existsSync(options.datasetsRoot)
    ? readdirSync(options.datasetsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right))
    : []

  for (const [index, datasetName] of datasetNames.entries()) {
    const datasetId = normaliseDatasetId(datasetName)
    const dataDir = resolveNamedDatasetDataDir(datasetName, options.datasetsRoot)
    if (!dataDir) {
      const hasDirectory = getDatasetCandidateDirs(options.datasetsRoot, datasetName).some((candidate) =>
        existsSync(candidate),
      )
      if (hasDirectory) {
        diagnostics.push({
          datasetId,
          severity: "error",
          reason: "no recognised JSON data directory found",
        })
      }
      continue
    }

    try {
      descriptors.push(buildLocalDescriptor(datasetId, dataDir, seedById.get(datasetId), index))
    } catch (error) {
      diagnostics.push({
        datasetId,
        severity: "error",
        reason: error instanceof Error ? error.message : "invalid dataset snapshot",
      })
    }
  }

  for (const [index, seed] of seeds.entries()) {
    const datasetId = normaliseDatasetId(seed.id)
    if (!datasetId || descriptors.some((descriptor) => descriptor.id === datasetId)) continue
    try {
      const planned = buildPlannedDescriptor(seed, index)
      if (planned) descriptors.push(planned)
    } catch (error) {
      diagnostics.push({
        datasetId,
        severity: "error",
        reason: error instanceof Error ? error.message : "invalid catalogue seed",
      })
    }
  }

  return {
    catalog: decodeDatasetCatalog({ catalogVersion: 1, datasets: descriptors }),
    diagnostics,
  }
}
