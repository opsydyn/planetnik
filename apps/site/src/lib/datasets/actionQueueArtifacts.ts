import { createHash } from "node:crypto"
import type { PortfolioActionQueue, PortfolioActionQueueItem, PortfolioActionWindow } from "@planetnik/common"

export const ACTION_QUEUE_ARTIFACT_VERSION = 1 as const
export const ACTION_QUEUE_PAGE_SIZE = 250

export type ActionQueueArtifactChunk = {
  readonly version: typeof ACTION_QUEUE_ARTIFACT_VERSION
  readonly window: PortfolioActionWindow
  readonly page: number
  readonly pageSize: number
  readonly totalItems: number
  readonly items: readonly PortfolioActionQueueItem[]
}

export type ActionQueueArtifactWindow = {
  readonly window: PortfolioActionWindow
  readonly totalItems: number
  readonly pageSize: number
  readonly pageCount: number
  readonly chunks: readonly string[]
}

export type ActionQueueArtifactManifest = {
  readonly version: typeof ACTION_QUEUE_ARTIFACT_VERSION
  readonly projectionVersion: number
  readonly sourceFingerprint: string
  readonly generatedAt: string
  readonly windows: Readonly<Record<PortfolioActionWindow, ActionQueueArtifactWindow>>
}

function assertPageSize(pageSize: number): void {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("pageSize must be a positive integer.")
}

export function chunkPortfolioActionQueue(
  queue: PortfolioActionQueue,
  pageSize: number = ACTION_QUEUE_PAGE_SIZE,
): readonly ActionQueueArtifactChunk[] {
  assertPageSize(pageSize)
  const totalItems = queue.items.length
  const chunks: ActionQueueArtifactChunk[] = []
  for (let offset = 0; offset < totalItems; offset += pageSize) {
    chunks.push({
      version: ACTION_QUEUE_ARTIFACT_VERSION,
      window: queue.filters.window,
      page: chunks.length + 1,
      pageSize,
      totalItems,
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
