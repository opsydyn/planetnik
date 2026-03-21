import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { FileExport, LandscapeConfiguration, RepositoryAnalysisResult } from "@planetnik/analyzer"
import { TagMap } from "@planetnik/reports"

type FilesMainExport = {
  files?: Array<{
    relativePath?: string
    linesOfCode?: number
  }>
}

export function buildLandscapeTagMap(
  landscapeConfig: LandscapeConfiguration,
  repositories: RepositoryAnalysisResult[],
  landscapeRoot: string,
): TagMap {
  const tagMap = new TagMap(landscapeConfig, landscapeConfig.tagGroups)
  if (landscapeConfig.tagGroups.length === 0) {
    return tagMap
  }

  const filesByAnalysisPath = new Map<string, FileExport[]>()

  for (const repository of repositories) {
    filesByAnalysisPath.set(repository.analysisResultsPath, readRepositoryFiles(landscapeConfig, landscapeRoot, repository))
  }

  tagMap.updateTagMap(
    repositories,
    (repository) =>
      repository.linesOfCodePerExtension.map((entry) => ({
        name: `*.${entry.extension}`,
        value: entry.linesOfCode,
        description: [],
      })),
    (repository) => filesByAnalysisPath.get(repository.analysisResultsPath) ?? [],
  )

  return tagMap
}

function readRepositoryFiles(
  landscapeConfig: LandscapeConfiguration,
  landscapeRoot: string,
  repository: RepositoryAnalysisResult,
): FileExport[] {
  const analysisResultsPath = resolve(landscapeRoot, landscapeConfig.analysisRoot, repository.analysisResultsPath)
  const filesPath = analysisResultsPath.replace(/analysisResults\.json$/, "files_main.json")
  if (!existsSync(filesPath)) {
    return []
  }

  try {
    const parsed = JSON.parse(readFileSync(filesPath, "utf-8")) as FilesMainExport
    return (parsed.files ?? [])
      .filter((file): file is NonNullable<FilesMainExport["files"]>[number] => typeof file?.relativePath === "string")
      .map((file) => ({
        repository: repository.name,
        path: file.relativePath ?? "",
        scope: "main",
        linesOfCode: typeof file.linesOfCode === "number" ? file.linesOfCode : 0,
      }))
  } catch {
    return []
  }
}
