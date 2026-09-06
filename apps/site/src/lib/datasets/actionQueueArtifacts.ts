import { createHash } from "node:crypto"
import type {
  PortfolioActionPriorityBand,
  PortfolioActionQueue,
  PortfolioActionQueueCoverage,
  PortfolioActionQueueItem,
  PortfolioActionSignalDomain,
  PortfolioActionWindow,
} from "@planetnik/common"

export const ACTION_QUEUE_ARTIFACT_VERSION = 1 as const
export const ACTION_QUEUE_PAGE_SIZE = 250
export const ACTION_QUEUE_MANIFEST_FILE = "manifest.json"
export const ACTION_QUEUE_WINDOWS: readonly PortfolioActionWindow[] = [
  "current",
  "latest-compatible",
  "7d",
  "30d",
  "90d",
]

export type ActionQueueArtifactFilterOptions = {
  readonly repositories: readonly { readonly id: string; readonly label: string }[]
  readonly teams: readonly { readonly id: string; readonly label: string }[]
  readonly priorities: readonly PortfolioActionPriorityBand[]
  readonly domains: readonly PortfolioActionSignalDomain[]
}

export type ActionQueueArtifactChunk = {
  readonly version: typeof ACTION_QUEUE_ARTIFACT_VERSION
  readonly window: PortfolioActionWindow
  readonly page: number
  readonly pageSize: number
  readonly totalItems: number
  readonly asOf: string
  readonly coverage: PortfolioActionQueueCoverage
  readonly items: readonly PortfolioActionQueueItem[]
}

export type ActionQueueArtifactWindow = {
  readonly window: PortfolioActionWindow
  readonly totalItems: number
  readonly complete: boolean
  readonly pageSize: number
  readonly pageCount: number
  readonly chunks: readonly string[]
  readonly asOf: string
  readonly coverage: PortfolioActionQueueCoverage
}

export type ActionQueueArtifactManifest = {
  readonly version: typeof ACTION_QUEUE_ARTIFACT_VERSION
  readonly projectionVersion: number
  readonly sourceFingerprint: string
  readonly generatedAt: string
  readonly filterOptions: ActionQueueArtifactFilterOptions
  readonly windows: readonly ActionQueueArtifactWindow[]
}

function assertPageSize(pageSize: number): void {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("pageSize must be a positive integer.")
}

export function chunkPortfolioActionQueue(
  queue: PortfolioActionQueue,
  pageSize: number = ACTION_QUEUE_PAGE_SIZE,
  totalItems: number = queue.items.length,
): readonly ActionQueueArtifactChunk[] {
  assertPageSize(pageSize)
  if (!Number.isInteger(totalItems) || totalItems < queue.items.length)
    throw new Error("totalItems must be an integer at least as large as the queue item count.")
  const chunks: ActionQueueArtifactChunk[] = []
  // `totalItems` may describe a larger ranked queue than the materialized
  // prefix. Page files must only represent items that actually exist in this
  // artifact; the manifest carries the full total separately.
  for (let offset = 0; offset < queue.items.length; offset += pageSize) {
    chunks.push({
      version: ACTION_QUEUE_ARTIFACT_VERSION,
      window: queue.filters.window,
      page: chunks.length + 1,
      pageSize,
      totalItems,
      asOf: queue.asOf,
      coverage: queue.coverage,
      items: queue.items.slice(offset, offset + pageSize),
    })
  }
  return chunks
}

export function fingerprintActionQueueSource(sourceIds: readonly string[], projectionVersion: number): string {
  if (!Number.isInteger(projectionVersion) || projectionVersion < 1)
    throw new Error("projectionVersion must be a positive integer.")
  const canonical = JSON.stringify({ projectionVersion, sourceIds: [...sourceIds].sort() })
  return createHash("sha256").update(canonical).digest("hex")
}
