import type {
  FileExport,
  LandscapeConfiguration,
  RepositoryAnalysisResult,
  RepositoryTag,
  TagGroup,
} from "@planetnik/analyzer"
import type { NumericMetricEntry } from "./LandscapeGeneratorUtils.js"
import { LandscapeGeneratorUtils } from "./LandscapeGeneratorUtils.js"
import { TagStats } from "./TagStats.js"

export class TagMap {
  private config: LandscapeConfiguration
  private tagGroups: TagGroup[]
  private tagStatsMap: Map<string, TagStats> = new Map()
  private repositoryTagsMap: Map<string, RepositoryTag[]> = new Map()

  constructor(config: LandscapeConfiguration, tagGroups: TagGroup[]) {
    this.config = config
    this.tagGroups = tagGroups
  }

  updateTagMap(
    repositories: RepositoryAnalysisResult[],
    getExtensionMetrics: (repo: RepositoryAnalysisResult) => NumericMetricEntry[],
    getFiles: (repo: RepositoryAnalysisResult) => FileExport[],
  ): void {
    for (const repository of repositories) {
      const linesOfCodePerExtension = LandscapeGeneratorUtils.getLinesOfCodePerExtension(
        this.config,
        getExtensionMetrics(repository),
      )
      linesOfCodePerExtension.sort((a, b) => b.value - a.value)
      const mainTech = linesOfCodePerExtension.length > 0 ? linesOfCodePerExtension[0].name : ""

      const allTags: RepositoryTag[] = []
      for (const group of this.tagGroups) {
        allTags.push(...group.repositoryTags)
      }

      let tagged = false
      const files = getFiles(repository)

      for (const tag of allTags) {
        if (this.isTagged(repository, mainTech, tag, linesOfCodePerExtension, files)) {
          this.addRepositoryTag(repository, tag)
          this.updateTagStats(repository, tag)
          tagged = true
        }
      }

      if (!tagged) {
        if (!this.tagStatsMap.has("")) {
          this.tagStatsMap.set("", new TagStats({ tag: "", patterns: [] } as unknown as RepositoryTag))
        }
        this.tagStatsMap.get("")!.repositoryAnalysisResults.push(repository)
      }
    }
  }

  private updateTagStats(repository: RepositoryAnalysisResult, tag: RepositoryTag): void {
    const key = tag.getKey()
    if (!this.tagStatsMap.has(key)) {
      this.tagStatsMap.set(key, new TagStats(tag))
    }
    this.tagStatsMap.get(key)!.repositoryAnalysisResults.push(repository)
  }

  private addRepositoryTag(repository: RepositoryAnalysisResult, tag: RepositoryTag): void {
    const key = repository.analysisResultsPath
    if (!this.repositoryTagsMap.has(key)) {
      this.repositoryTagsMap.set(key, [])
    }
    this.repositoryTagsMap.get(key)!.push(tag)
  }

  private isTagged(
    repository: RepositoryAnalysisResult,
    mainTech: string,
    tag: RepositoryTag,
    linesOfCodePerExtension: NumericMetricEntry[],
    files: FileExport[],
  ): boolean {
    if (tag.excludesMainTechnology(mainTech) || tag.excludeName(repository.name)) {
      return false
    }

    return (
      tag.matchesName(repository.name) ||
      tag.matchesMainTechnology(mainTech) ||
      tag.matchesAnyTechnology(linesOfCodePerExtension) ||
      tag.matchesPath(files)
    )
  }

  getTagStats(key: string): TagStats | undefined {
    return this.tagStatsMap.get(key)
  }

  containsKey(key: string): boolean {
    return this.tagStatsMap.has(key)
  }

  keySet(): Set<string> {
    return new Set(this.tagStatsMap.keys())
  }

  getRepositoryTags(repository: RepositoryAnalysisResult): RepositoryTag[] {
    return this.repositoryTagsMap.get(repository.analysisResultsPath) ?? []
  }

  tagsCount(): number {
    return this.tagStatsMap.has("") ? this.tagStatsMap.size - 1 : this.tagStatsMap.size
  }
}
