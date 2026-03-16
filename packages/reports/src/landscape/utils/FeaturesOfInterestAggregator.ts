import type { RepositoryAnalysisResult } from "@planetnik/analyzer"
import type { ConcernInfo } from "./RepositoryConcernData.js"
import { RepositoryConcernData } from "./RepositoryConcernData.js"

export interface RepositoryWithConcerns {
  name: string
  concerns: { name: string; filesCount: number; numberOfRegexLineMatches: number }[]
}

export class FeaturesOfInterestAggregator {
  repositoryAnalysisResults: RepositoryAnalysisResult[]

  concernsMap: Map<string, RepositoryConcernData[]> = new Map()
  repositoriesMap: Map<string, RepositoryConcernData[]> = new Map()
  repositoriesConcernMap: Map<string, RepositoryConcernData> = new Map()
  repositories: RepositoryConcernData[][] = []
  concerns: RepositoryConcernData[][] = []

  constructor(repositoryAnalysisResults: RepositoryAnalysisResult[]) {
    this.repositoryAnalysisResults = repositoryAnalysisResults
  }

  aggregateFeaturesOfInterest(
    limit: number,
    getConcerns: (repo: RepositoryAnalysisResult) => RepositoryWithConcerns | null,
  ): void {
    for (const repository of this.repositoryAnalysisResults) {
      const repoWithConcerns = getConcerns(repository)
      if (!repoWithConcerns || repoWithConcerns.concerns.length === 0) continue

      const repositoryName = repository.name

      for (const concern of repoWithConcerns.concerns) {
        if (concern.filesCount <= 0 || concern.name.toLowerCase() === "unclassified") continue

        const concernName = concern.name
        if (!this.concernsMap.has(concernName)) {
          this.concernsMap.set(concernName, [])
        }
        if (!this.repositoriesMap.has(repositoryName)) {
          this.repositoriesMap.set(repositoryName, [])
        }

        const concernInfo: ConcernInfo = {
          name: concern.name,
          filesCount: concern.filesCount,
          numberOfRegexLineMatches: concern.numberOfRegexLineMatches,
        }
        const data = new RepositoryConcernData(repositoryName, concernInfo, repository)
        this.concernsMap.get(concernName)!.push(data)
        this.repositoriesMap.get(repositoryName)!.push(data)
        this.repositoriesConcernMap.set(`${repositoryName}::${concernName}`, data)
      }
    }

    for (const list of this.concernsMap.values()) {
      list.sort((a, b) => b.concern.filesCount - a.concern.filesCount)
    }
    for (const list of this.repositoriesMap.values()) {
      list.sort((a, b) => b.concern.filesCount - a.concern.filesCount)
    }

    this.repositories = Array.from(this.repositoriesMap.values())
    this.repositories.sort(
      (a, b) =>
        b.reduce((s, c) => s + c.concern.numberOfRegexLineMatches, 0) -
        a.reduce((s, c) => s + c.concern.numberOfRegexLineMatches, 0),
    )

    this.concerns = Array.from(this.concernsMap.values())
    this.concerns.sort(
      (a, b) => b.reduce((s, c) => s + c.concern.filesCount, 0) - a.reduce((s, c) => s + c.concern.filesCount, 0),
    )

    if (this.repositories.length > limit) {
      this.repositories = this.repositories.slice(0, limit)
    }
  }
}
