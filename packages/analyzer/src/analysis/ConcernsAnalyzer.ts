import type { CodeConfiguration } from "../core/CodeConfiguration.js"
import type { MetricsList } from "../metrics/MetricsList.js"
import { AspectAnalysisResults } from "../results/AspectAnalysisResults.js"
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"
import type { ConcernsAnalysisResults } from "../results/ConcernsAnalysisResults.js"
import { ConcernsAnalysisResults as ConcernsResults } from "../results/ConcernsAnalysisResults.js"
import { AnalysisUtils } from "./AnalysisUtils.js"
import { SourceCodeFiles } from "./SourceCodeFiles.js"

export class ConcernsAnalyzer {
  private codeConfiguration: CodeConfiguration
  private metricsList: MetricsList
  private analysisResults: ConcernsAnalysisResults[]
  private textSummary: string[]
  private start: number

  constructor(results: CodeAnalysisResults) {
    this.analysisResults = results.concernsAnalysisResults
    this.codeConfiguration = results.codeConfiguration!
    this.metricsList = results.metricsList
    this.start = results.analysisStartTimeMs
    this.textSummary = results.textSummary
  }

  analyze(): void {
    for (const group of this.codeConfiguration.concernGroups) {
      const concernsResults = new ConcernsResults(group.name)
      this.analysisResults.push(concernsResults)

      for (const concern of group.concerns) {
        concern.sourceFiles = SourceCodeFiles.getSourceFilesFromScope(concern, this.codeConfiguration.main.sourceFiles)
        concern.filtering = group.name
        this.attachConcernToSourceFiles(concern)
        const aspectResults = new AspectAnalysisResults(concern.name)
        concernsResults.concerns.push(aspectResults)
        AnalysisUtils.analyze(
          `CONCERN_${group.name}`,
          concern,
          null,
          null,
          aspectResults,
          this.metricsList,
          this.textSummary,
          this.start,
        )
      }
    }
  }

  private attachConcernToSourceFiles(concern: {
    name: string
    filtering: string
    sourceFiles: Array<{ concerns: Array<{ name: string; filtering: string }> }>
  }): void {
    for (const sourceFile of concern.sourceFiles) {
      const alreadyAssigned = sourceFile.concerns.some(
        (existing) => existing.name === concern.name && existing.filtering === concern.filtering,
      )
      if (!alreadyAssigned) {
        sourceFile.concerns.push(concern)
      }
    }
  }
}
