import { existsSync, readFileSync } from "node:fs"
import { isAbsolute, join, relative, resolve } from "node:path"
import type {
  PortfolioActionPriorityBand,
  PortfolioActionQueue,
  PortfolioActionSignalDomain,
  PortfolioActionWindow,
} from "@planetnik/common"
import {
  ACTION_QUEUE_ARTIFACT_VERSION,
  ACTION_QUEUE_MANIFEST_FILE,
  ACTION_QUEUE_WINDOWS,
  type ActionQueueArtifactChunk,
  type ActionQueueArtifactEvidenceBase,
  type ActionQueueArtifactFilterOptions,
  type ActionQueueArtifactItem,
  type ActionQueueArtifactManifest,
  expandActionQueueArtifactItems,
  fingerprintActionQueueArtifactFilterOptions,
  isValidActionQueueArtifactEvidenceBase,
} from "./actionQueueArtifacts.js"

export type ActionQueueArtifactParams = {
  readonly window: PortfolioActionWindow
  readonly page: number
}

export type ActionQueueArtifactManifestReadResult =
  | { readonly tag: "ready"; readonly manifest: ActionQueueArtifactManifest }
  | { readonly tag: "missing"; readonly message: string }
  | { readonly tag: "invalid"; readonly message: string }

export type ActionQueueArtifactPage = {
  readonly params: ActionQueueArtifactParams
  readonly queue: PortfolioActionQueue
  readonly totalItems: number
  readonly pageSize: number
  readonly pageCount: number
  readonly complete: boolean
  readonly sourceFingerprint: string
  readonly contentFingerprint: string
  readonly projectionVersion: number
  readonly filterOptions: ActionQueueArtifactFilterOptions
  readonly chunkPath: string
}

const sourceFingerprintPattern = /^[a-f0-9]{64}$/u
const positiveInteger = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0
const nonNegativeInteger = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0
const priorityBands: readonly PortfolioActionPriorityBand[] = ["critical", "high", "medium", "low", "unrated"]
const signalDomains: readonly PortfolioActionSignalDomain[] = [
  "control",
  "coupling",
  "hotspot",
  "impact",
  "ownership",
  "security",
  "trend",
]
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

function validEvidenceBase(value: unknown): value is ActionQueueArtifactEvidenceBase {
  return isValidActionQueueArtifactEvidenceBase(value)
}

function validWindow(value: unknown): value is PortfolioActionWindow {
  return typeof value === "string" && ACTION_QUEUE_WINDOWS.includes(value as PortfolioActionWindow)
}

function validRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes("\0") || isAbsolute(value)) {
    return false
  }
  return !value.split("/").some((segment) => !segment || segment === "." || segment === "..")
}

function validFilterOptions(value: unknown): value is ActionQueueArtifactFilterOptions {
  if (!isRecord(value)) return false
  for (const key of ["repositories", "teams"] as const) {
    if (
      !Array.isArray(value[key]) ||
      !value[key].every(
        (entry) =>
          isRecord(entry) &&
          typeof entry.id === "string" &&
          entry.id.length > 0 &&
          typeof entry.label === "string" &&
          entry.label.length > 0,
      )
    )
      return false
  }
  return (
    Array.isArray(value.priorities) &&
    value.priorities.every(
      (entry): entry is PortfolioActionPriorityBand =>
        typeof entry === "string" && priorityBands.includes(entry as PortfolioActionPriorityBand),
    ) &&
    Array.isArray(value.domains) &&
    value.domains.every(
      (entry): entry is PortfolioActionSignalDomain =>
        typeof entry === "string" && signalDomains.includes(entry as PortfolioActionSignalDomain),
    )
  )
}

function validCoverage(value: unknown): boolean {
  return isRecord(value) && isRecord(value.datasets) && isRecord(value.domains) && Array.isArray(value.diagnostics)
}

function parseManifest(value: unknown): ActionQueueArtifactManifest | undefined {
  if (!isRecord(value)) return undefined
  if (
    value.version !== ACTION_QUEUE_ARTIFACT_VERSION ||
    !positiveInteger(value.projectionVersion) ||
    typeof value.sourceFingerprint !== "string" ||
    !sourceFingerprintPattern.test(value.sourceFingerprint) ||
    typeof value.generatedAt !== "string" ||
    !validFilterOptions(value.filterOptions) ||
    !Array.isArray(value.windows)
  )
    return undefined

  const windows = value.windows.flatMap((entry): ActionQueueArtifactManifest["windows"][number][] => {
    if (!isRecord(entry) || !validWindow(entry.window)) return []
    if (
      !nonNegativeInteger(entry.totalItems) ||
      typeof entry.complete !== "boolean" ||
      !positiveInteger(entry.pageSize) ||
      !nonNegativeInteger(entry.pageCount) ||
      typeof entry.contentFingerprint !== "string" ||
      !sourceFingerprintPattern.test(entry.contentFingerprint) ||
      typeof entry.asOf !== "string" ||
      !validCoverage(entry.coverage) ||
      !Array.isArray(entry.chunks) ||
      entry.chunks.length !== entry.pageCount ||
      !entry.chunks.every(validRelativePath)
    )
      return []
    return [
      {
        window: entry.window,
        totalItems: entry.totalItems,
        complete: entry.complete,
        pageSize: entry.pageSize,
        pageCount: entry.pageCount,
        chunks: entry.chunks,
        contentFingerprint: entry.contentFingerprint,
        asOf: entry.asOf,
        coverage: entry.coverage as never,
      },
    ]
  })
  if (windows.length !== value.windows.length || new Set(windows.map((entry) => entry.window)).size !== windows.length)
    return undefined
  return {
    version: ACTION_QUEUE_ARTIFACT_VERSION,
    projectionVersion: value.projectionVersion,
    sourceFingerprint: value.sourceFingerprint,
    generatedAt: value.generatedAt,
    filterOptions: value.filterOptions,
    windows,
  }
}

export function parseActionQueueArtifactParams(
  windowValue: string | undefined,
  pageValue: string | undefined,
): ActionQueueArtifactParams | undefined {
  if (!validWindow(windowValue) || !pageValue || !/^\d+$/u.test(pageValue)) return undefined
  const page = Number(pageValue)
  if (!positiveInteger(page) || String(page) !== pageValue) return undefined
  return { window: windowValue, page }
}

export function actionQueueArtifactCacheKey(
  manifest: Pick<ActionQueueArtifactManifest, "filterOptions" | "projectionVersion" | "windows">,
  params: ActionQueueArtifactParams,
): string {
  const window = manifest.windows.find((entry) => entry.window === params.window)
  if (!window) throw new Error(`Action queue artifact window '${params.window}' is not present in the manifest.`)
  const filterOptionsFingerprint = fingerprintActionQueueArtifactFilterOptions(manifest.filterOptions)
  return `${window.contentFingerprint}:${filterOptionsFingerprint}:${manifest.projectionVersion}:${params.window}:${params.page}`
}

export function defaultActionQueueArtifactDirectory(): string {
  return (
    process.env.PLANETNIK_ACTION_QUEUE_ARTIFACT_DIR ??
    join(process.cwd(), "node_modules", ".astro", "planetnik-action-queue")
  )
}

export function loadActionQueueArtifactManifest(root: string): ActionQueueArtifactManifestReadResult {
  const path = join(root, ACTION_QUEUE_MANIFEST_FILE)
  if (!existsSync(path))
    return { tag: "missing", message: `Action queue artifact manifest is not present at '${path}'.` }
  try {
    const manifest = parseManifest(JSON.parse(readFileSync(path, "utf8")) as unknown)
    return manifest
      ? { tag: "ready", manifest }
      : { tag: "invalid", message: "Action queue artifact manifest has an invalid shape." }
  } catch {
    return { tag: "invalid", message: "Action queue artifact manifest is not valid JSON." }
  }
}

function withinRoot(root: string, path: string): boolean {
  const remainder = relative(resolve(root), resolve(path))
  return remainder !== "" && !remainder.startsWith("..") && !isAbsolute(remainder)
}

export function readActionQueueArtifactPage(
  root: string,
  manifest: ActionQueueArtifactManifest,
  params: ActionQueueArtifactParams,
): ActionQueueArtifactPage | undefined {
  const window = manifest.windows.find((entry) => entry.window === params.window)
  if (!window || params.page > window.pageCount) return undefined
  const chunkPath = window.chunks[params.page - 1]
  if (!chunkPath || !validRelativePath(chunkPath)) return undefined
  const absolutePath = join(root, chunkPath)
  if (!withinRoot(root, absolutePath) || !existsSync(absolutePath)) return undefined
  try {
    const value = JSON.parse(readFileSync(absolutePath, "utf8")) as unknown
    if (!isRecord(value) || value.version !== ACTION_QUEUE_ARTIFACT_VERSION || value.window !== params.window)
      return undefined
    if (value.page !== params.page || value.pageSize !== window.pageSize || value.totalItems !== window.totalItems)
      return undefined
    if (
      typeof value.asOf !== "string" ||
      value.asOf !== window.asOf ||
      !validCoverage(value.coverage) ||
      !Array.isArray(value.evidenceBases) ||
      !value.evidenceBases.every(validEvidenceBase) ||
      !Array.isArray(value.items)
    )
      return undefined
    const chunk = value as unknown as ActionQueueArtifactChunk
    const items = expandActionQueueArtifactItems(
      chunk.items as readonly ActionQueueArtifactItem[],
      chunk.evidenceBases as readonly ActionQueueArtifactEvidenceBase[],
    )
    if (!items) return undefined
    return {
      params,
      queue: {
        contractVersion: 1,
        rankingPolicyVersion: 1,
        asOf: window.asOf,
        filters: { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: params.window },
        items,
        coverage: window.coverage,
      },
      totalItems: window.totalItems,
      pageSize: window.pageSize,
      pageCount: window.pageCount,
      complete: window.complete,
      sourceFingerprint: manifest.sourceFingerprint,
      contentFingerprint: window.contentFingerprint,
      projectionVersion: manifest.projectionVersion,
      filterOptions: manifest.filterOptions,
      chunkPath,
    }
  } catch {
    return undefined
  }
}
