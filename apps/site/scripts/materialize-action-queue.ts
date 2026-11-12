import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { materializeActionQueueArtifacts } from "@planetnik/report-data/lib/datasets/actionQueueArtifactMaterializer"
import { defaultActionQueueArtifactDirectory } from "@planetnik/report-data/lib/datasets/actionQueueArtifactRoutes"
import { materializeStreamingActionQueueArtifacts } from "@planetnik/report-data/lib/datasets/actionQueueExternalMaterializer"
import {
  parseActionQueueMaterializationMode,
  parseActionQueuePartitionCount,
} from "@planetnik/report-data/lib/datasets/actionQueueMaterializationMode"
import {
  createDatasetActionQueueReader,
  STATIC_ACTION_QUEUE_ITEM_LIMIT,
} from "@planetnik/report-data/lib/datasets/actionQueueSource"
import { createStreamingActionQueueSource } from "@planetnik/report-data/lib/datasets/actionQueueStreamingSource"
import { loadDatasetCatalog } from "@planetnik/report-data/lib/datasets/catalogSource"
import { Effect } from "effect"

const outputDir = defaultActionQueueArtifactDirectory()
const mode = parseActionQueueMaterializationMode(process.env.PLANETNIK_ACTION_QUEUE_COMPLETE)
const { catalog } = loadDatasetCatalog()

function outputByteSize(path: string): number {
  const stats = statSync(path)
  if (!stats.isDirectory()) return stats.size
  return readdirSync(path, { withFileTypes: true }).reduce(
    (total, entry) => total + outputByteSize(join(path, entry.name)),
    0,
  )
}

function formatMiB(bytes: number): string {
  return (bytes / 1_048_576).toFixed(1)
}

if (mode === "complete") {
  const partitionCount = parseActionQueuePartitionCount(process.env.PLANETNIK_ACTION_QUEUE_PARTITIONS)
  const source = createStreamingActionQueueSource({ catalog })
  const startedAt = performance.now()
  let peakRss = process.memoryUsage().rss
  const sampleRss = () => {
    peakRss = Math.max(peakRss, process.memoryUsage().rss)
  }
  const sampler = setInterval(sampleRss, 100)
  let manifest: Awaited<ReturnType<typeof materializeStreamingActionQueueArtifacts>>
  try {
    manifest = await materializeStreamingActionQueueArtifacts({ source, outputDir, partitionCount })
  } finally {
    clearInterval(sampler)
    sampleRss()
  }
  const elapsedMs = performance.now() - startedAt
  const outputBytes = outputByteSize(outputDir)
  console.log(`mode=complete outputDir=${outputDir} partitions=${partitionCount}`)
  for (const window of manifest.windows)
    console.log(
      `window=${window.window} totalItems=${window.totalItems} pageCount=${window.pageCount} complete=${window.complete}`,
    )
  console.log(`outputBytes=${outputBytes}`)
  console.log(`elapsedMs=${Math.round(elapsedMs)}`)
  console.log(`peakRssBytes=${peakRss}`)
  console.log(`peakRssMiB=${formatMiB(peakRss)}`)
} else {
  const reader = createDatasetActionQueueReader({ catalog })
  const source = {
    sourceIds: reader.sourceIds,
    readWindow: (window: Parameters<typeof reader.readWindow>[0], options?: Parameters<typeof reader.readWindow>[1]) =>
      reader.readWindow(window, options),
  }

  const manifest = await Effect.runPromise(
    materializeActionQueueArtifacts({ source, outputDir, itemLimit: STATIC_ACTION_QUEUE_ITEM_LIMIT }),
  )
  console.log(`mode=bounded windows=${manifest.windows.length} outputDir=${outputDir}`)
}
