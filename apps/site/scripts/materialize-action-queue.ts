import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { Effect } from "effect"
import { materializeActionQueueArtifacts } from "../src/lib/datasets/actionQueueArtifactMaterializer.js"
import { defaultActionQueueArtifactDirectory } from "../src/lib/datasets/actionQueueArtifactRoutes.js"
import { materializeStreamingActionQueueArtifacts } from "../src/lib/datasets/actionQueueExternalMaterializer.js"
import {
  parseActionQueueMaterializationMode,
  parseActionQueuePartitionCount,
} from "../src/lib/datasets/actionQueueMaterializationMode.js"
import {
  createDatasetActionQueueReader,
  STATIC_ACTION_QUEUE_ITEM_LIMIT,
} from "../src/lib/datasets/actionQueueSource.js"
import { createStreamingActionQueueSource } from "../src/lib/datasets/actionQueueStreamingSource.js"
import { loadDatasetCatalog } from "../src/lib/datasets/catalogSource.js"

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
