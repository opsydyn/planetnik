import type { RepositoryAnalysisResult, RepositoryTag } from "@planetnik/analyzer"

export class TagStats {
  tag: RepositoryTag
  repositoryAnalysisResults: RepositoryAnalysisResult[] = []

  constructor(tag: RepositoryTag) {
    this.tag = tag
  }
}
