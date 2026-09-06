import { Effect } from "effect"
import { materializeActionQueueArtifacts } from "../src/lib/datasets/actionQueueArtifactMaterializer.js"
import { defaultActionQueueArtifactDirectory } from "../src/lib/datasets/actionQueueArtifactRoutes.js"
import {
  createDatasetActionQueueReader,
  STATIC_ACTION_QUEUE_ITEM_LIMIT,
} from "../src/lib/datasets/actionQueueSource.js"
import { loadDatasetCatalog } from "../src/lib/datasets/catalogSource.js"

const outputDir = defaultActionQueueArtifactDirectory()
const { catalog } = loadDatasetCatalog()
const reader = createDatasetActionQueueReader({ catalog })
const source = {
  sourceIds: reader.sourceIds,
  readWindow: (window: Parameters<typeof reader.readWindow>[0], options?: Parameters<typeof reader.readWindow>[1]) =>
    reader.readWindow(window, options),
}

const manifest = await Effect.runPromise(
  materializeActionQueueArtifacts({ source, outputDir, itemLimit: STATIC_ACTION_QUEUE_ITEM_LIMIT }),
)
console.log(`Materialized bounded action queue artifacts for ${manifest.windows.length} windows at ${outputDir}`)
