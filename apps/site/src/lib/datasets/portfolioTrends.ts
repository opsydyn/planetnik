import type {
  CrossRepositoryHistoryInput,
  CrossRepositoryMetricDefinition,
  CrossRepositoryTrendDataset,
  CrossRepositoryTrends,
  DatasetCatalog,
} from "@planetnik/common"
import { buildCrossRepositoryTrends } from "@planetnik/common"
import { resolveDatasetsRoot } from "../../loaders/planetnik-loader.js"
import {
  type DatasetSnapshotHistoryEntry,
  readDatasetCurrentSnapshot,
  readDatasetSnapshotHistory,
  type SnapshotHistoryReadResult,
} from "./snapshotHistory.js"

function historyInput(result: SnapshotHistoryReadResult): CrossRepositoryHistoryInput {
  if (result.tag === "missing") return { status: "missing", message: result.message }
  if (result.tag === "invalid") return { status: "invalid", message: result.message }

  const comparison = result.history.comparison
  if (comparison.status === "compatible") {
    return {
      status: "compatible",
      comparison,
      entityComparisons: result.history.entityComparisons,
    }
  }
  if (comparison.status === "incompatible") {
    return { status: "incompatible", message: comparison.message, comparison }
  }
  return { status: "missing", message: comparison.message, comparison }
}

function currentFromHistory(result: SnapshotHistoryReadResult): DatasetSnapshotHistoryEntry | undefined {
  if (result.tag !== "ready") return undefined
  const comparison = result.history.comparison
  if (comparison.status !== "compatible") return undefined
  return result.history.entries.find((entry) => entry.context.snapshotId === comparison.current.snapshotId)
}

export function readDatasetPortfolioTrends(options: {
  readonly catalog: DatasetCatalog
  readonly datasetsRoot?: string
  readonly definitions?: readonly CrossRepositoryMetricDefinition[]
}): CrossRepositoryTrends {
  const datasetsRoot = options.datasetsRoot ?? resolveDatasetsRoot()
  const inputs: CrossRepositoryTrendDataset[] = options.catalog.datasets.map((dataset) => {
    const historyResult = readDatasetSnapshotHistory(dataset.id, { datasetsRoot })
    const historyCurrent = currentFromHistory(historyResult)
    const currentResult = historyCurrent
      ? { tag: "ready" as const, snapshot: historyCurrent }
      : readDatasetCurrentSnapshot(dataset.id, { datasetsRoot })

    return {
      id: dataset.id,
      title: dataset.title,
      mode: dataset.mode,
      availability: dataset.availability,
      ...(currentResult.tag === "ready" ? { current: currentResult.snapshot.snapshot } : {}),
      history: historyInput(historyResult),
    }
  })

  return buildCrossRepositoryTrends(inputs, options.definitions)
}
