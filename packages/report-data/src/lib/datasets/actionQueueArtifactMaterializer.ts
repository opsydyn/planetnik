import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import type {
  PortfolioActionQueue,
  PortfolioActionQueueBuildResult,
  PortfolioActionSignalDomain,
  PortfolioActionWindow,
} from "@planetnik/common"
import { Effect } from "effect"
import {
  ACTION_QUEUE_ARTIFACT_PROJECTION_VERSION,
  ACTION_QUEUE_ARTIFACT_VERSION,
  ACTION_QUEUE_MANIFEST_FILE,
  ACTION_QUEUE_PAGE_SIZE,
  ACTION_QUEUE_WINDOWS,
  type ActionQueueArtifactFilterOptions,
  type ActionQueueArtifactManifest,
  type ActionQueueArtifactWindow,
  chunkPortfolioActionQueue,
  fingerprintActionQueueSource,
  fingerprintActionQueueWindow,
} from "./actionQueueArtifacts.js"

export type ActionQueueArtifactSource = {
  readonly sourceIds: readonly string[]
  readonly readWindow: (
    window: PortfolioActionWindow,
    options?: { readonly itemLimit?: number },
  ) => PortfolioActionQueue | PortfolioActionQueueBuildResult
}

export type MaterializeActionQueueArtifactsOptions = {
  readonly source: ActionQueueArtifactSource
  readonly outputDir: string
  readonly windows?: readonly PortfolioActionWindow[]
  readonly pageSize?: number
  readonly projectionVersion?: number
  /** Optional bounded prefix for memory-safe fallback artifacts. */
  readonly itemLimit?: number
}

const defaultWindows: readonly PortfolioActionWindow[] = ACTION_QUEUE_WINDOWS

function filterOptionsFromQueue(queue: PortfolioActionQueue): ActionQueueArtifactFilterOptions {
  const repositories = new Map<string, { id: string; label: string }>()
  const teams = new Map<string, { id: string; label: string }>()
  const domains = new Set<PortfolioActionSignalDomain>()
  for (const item of queue.items) {
    if (!item || typeof item !== "object") continue
    if (item.repositoryId && item.repositoryTitle)
      repositories.set(item.repositoryId, { id: item.repositoryId, label: item.repositoryTitle })
    if (Array.isArray(item.teams)) for (const team of item.teams) if (team?.id && team.label) teams.set(team.id, team)
    if (Array.isArray(item.signals)) for (const signal of item.signals) if (signal?.domain) domains.add(signal.domain)
  }
  return {
    repositories: [...repositories.values()].sort((left, right) => left.id.localeCompare(right.id)),
    teams: [...teams.values()].sort((left, right) => left.id.localeCompare(right.id)),
    priorities: ["critical", "high", "medium", "low", "unrated"],
    domains: ["control", "coupling", "hotspot", "impact", "ownership", "security", "trend"].filter((domain) =>
      domains.has(domain as PortfolioActionSignalDomain),
    ) as PortfolioActionSignalDomain[],
  }
}

function mergeFilterOptions(
  left: ActionQueueArtifactFilterOptions,
  right: ActionQueueArtifactFilterOptions,
): ActionQueueArtifactFilterOptions {
  const repositories = new Map(left.repositories.map((entry) => [entry.id, entry]))
  const teams = new Map(left.teams.map((entry) => [entry.id, entry]))
  for (const entry of right.repositories) repositories.set(entry.id, entry)
  for (const entry of right.teams) teams.set(entry.id, entry)
  return {
    repositories: [...repositories.values()].sort((a, b) => a.id.localeCompare(b.id)),
    teams: [...teams.values()].sort((a, b) => a.id.localeCompare(b.id)),
    priorities: left.priorities,
    domains: [...new Set([...left.domains, ...right.domains])].sort(),
  }
}

function materializerError(message: string, cause: unknown): Error {
  return new Error(`${message}: ${cause instanceof Error ? cause.message : String(cause)}`)
}

function chunkPath(window: PortfolioActionWindow, page: number): string {
  return `${window}/${page}.json`
}

function writeJson(path: string, value: unknown): Effect.Effect<void, Error> {
  return Effect.tryPromise({
    try: async () => {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, `${JSON.stringify(value)}\n`, "utf8")
    },
    catch: (cause) => materializerError(`Unable to write action queue artifact '${path}'`, cause),
  })
}

type MaterializedWindow = {
  readonly metadata: ActionQueueArtifactWindow
  readonly filterOptions: ActionQueueArtifactFilterOptions
}

function writeWindow(
  temporaryDir: string,
  source: ActionQueueArtifactSource,
  window: PortfolioActionWindow,
  pageSize: number,
  projectionVersion: number,
  itemLimit: number | undefined,
): Effect.Effect<MaterializedWindow, Error> {
  return Effect.gen(function* () {
    const result = yield* Effect.try({
      try: () => source.readWindow(window, itemLimit === undefined ? undefined : { itemLimit }),
      catch: (cause) => materializerError(`Unable to build action queue window '${window}'`, cause),
    })
    const queue = "queue" in result ? result.queue : result
    const totalItems = "totalItems" in result ? result.totalItems : queue.items.length
    const chunks = chunkPortfolioActionQueue(queue, pageSize, totalItems)
    const contentFingerprint = fingerprintActionQueueWindow(
      queue,
      source.sourceIds,
      projectionVersion,
      pageSize,
      totalItems,
    )
    yield* Effect.forEach(chunks, (chunk) => writeJson(join(temporaryDir, chunkPath(window, chunk.page)), chunk), {
      concurrency: 1,
      discard: true,
    })
    return {
      metadata: {
        window,
        totalItems,
        complete: totalItems === queue.items.length,
        pageSize,
        pageCount: chunks.length,
        chunks: chunks.map((chunk) => chunkPath(window, chunk.page)),
        contentFingerprint,
        asOf: queue.asOf,
        coverage: queue.coverage,
      },
      filterOptions: filterOptionsFromQueue(queue),
    }
  })
}

export function materializeActionQueueArtifacts(
  options: MaterializeActionQueueArtifactsOptions,
): Effect.Effect<ActionQueueArtifactManifest, Error> {
  const pageSize = options.pageSize ?? ACTION_QUEUE_PAGE_SIZE
  const projectionVersion = options.projectionVersion ?? ACTION_QUEUE_ARTIFACT_PROJECTION_VERSION
  const windows = options.windows ?? defaultWindows
  if (!windows.length) return Effect.fail(new Error("At least one action queue window is required."))
  const seenWindows = new Set<PortfolioActionWindow>()
  for (const window of windows) {
    if (seenWindows.has(window)) return Effect.fail(new Error(`Duplicate action queue window '${window}'.`))
    seenWindows.add(window)
  }

  const parentDir = dirname(options.outputDir)
  const sourceFingerprint = fingerprintActionQueueSource(options.source.sourceIds, projectionVersion)
  return Effect.acquireUseRelease(
    Effect.tryPromise({
      try: async () => {
        await mkdir(parentDir, { recursive: true })
        return mkdtemp(join(parentDir, ".action-queue-"))
      },
      catch: (cause) => materializerError(`Unable to create action queue staging directory '${parentDir}'`, cause),
    }),
    (temporaryDir) =>
      Effect.gen(function* () {
        const materializedWindows = yield* Effect.forEach(
          windows,
          (window) => writeWindow(temporaryDir, options.source, window, pageSize, projectionVersion, options.itemLimit),
          { concurrency: 1 },
        )
        const manifest: ActionQueueArtifactManifest = {
          version: ACTION_QUEUE_ARTIFACT_VERSION,
          projectionVersion,
          sourceFingerprint,
          generatedAt: new Date().toISOString(),
          filterOptions: materializedWindows.reduce<ActionQueueArtifactFilterOptions>(
            (options, window) => mergeFilterOptions(options, window.filterOptions),
            {
              repositories: [],
              teams: [],
              priorities: ["critical", "high", "medium", "low", "unrated"],
              domains: [],
            },
          ),
          windows: materializedWindows.map((window) => window.metadata),
        }
        yield* writeJson(join(temporaryDir, ACTION_QUEUE_MANIFEST_FILE), manifest)
        yield* Effect.tryPromise({
          try: async () => {
            await rm(options.outputDir, { recursive: true, force: true })
            await rename(temporaryDir, options.outputDir)
          },
          catch: (cause) => materializerError(`Unable to publish action queue artifacts '${options.outputDir}'`, cause),
        })
        return manifest
      }),
    (temporaryDir) =>
      Effect.tryPromise({
        try: () => rm(temporaryDir, { recursive: true, force: true }),
        catch: (cause) => materializerError(`Unable to remove action queue staging directory '${temporaryDir}'`, cause),
      }).pipe(
        Effect.catch(() => Effect.succeed(undefined)),
        Effect.asVoid,
      ),
  )
}
