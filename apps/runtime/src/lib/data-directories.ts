import { existsSync } from "node:fs"
import { join } from "node:path"

const dataSentinelFiles = ["report_context.json", "analysisResults.json", "landscape_overview.json"] as const

export function getDatasetCandidateDirs(datasetsRoot: string, datasetName: string): string[] {
  return [
    join(datasetsRoot, datasetName, "data"),
    join(datasetsRoot, datasetName, "reports", "data"),
    join(datasetsRoot, datasetName, "_planetnik", "reports", "data"),
    join(datasetsRoot, datasetName, "_planetnik_landscape", "reports", "data"),
  ]
}

export function getFlexibleDataDirCandidates(path: string): string[] {
  return [
    path,
    join(path, "data"),
    join(path, "reports", "data"),
    join(path, "_planetnik", "reports", "data"),
    join(path, "_planetnik_landscape", "reports", "data"),
  ]
}

export function isRecognizedDataDir(dir: string, fileExists: (path: string) => boolean = existsSync): boolean {
  return fileExists(dir) && dataSentinelFiles.some((fileName) => fileExists(join(dir, fileName)))
}

export function resolveRecognizedDataDir(
  candidates: Iterable<string>,
  fileExists: (path: string) => boolean = existsSync,
): string | undefined {
  for (const candidate of candidates) {
    if (isRecognizedDataDir(candidate, fileExists)) {
      return candidate
    }
  }

  return undefined
}

export function resolveNamedDatasetDataDir(
  datasetName: string | undefined,
  datasetsRoot: string,
  fileExists: (path: string) => boolean = existsSync,
): string | undefined {
  if (!datasetName) return undefined

  return resolveRecognizedDataDir(getDatasetCandidateDirs(datasetsRoot, datasetName), fileExists)
}
