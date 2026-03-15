import type { CodeConfiguration } from "../core/CodeConfiguration.js"
import type { MetricsList } from "../metrics/MetricsList.js"
import { AspectAnalysisResults } from "../results/AspectAnalysisResults.js"
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"
import type { LogicalDecompositionAnalysisResults } from "../results/LogicalDecompositionAnalysisResults.js"
import { LogicalDecompositionAnalysisResults as LDResults } from "../results/LogicalDecompositionAnalysisResults.js"
import { AnalysisUtils } from "./AnalysisUtils.js"

export class LogicalDecompositionAnalyzer {
  private codeConfiguration: CodeConfiguration
  private metricsList: MetricsList
  private logicalDecompositionResults: LogicalDecompositionAnalysisResults[]
  private textSummary: string[]
  private start: number

  constructor(results: CodeAnalysisResults) {
    this.codeAnalysisResults = results
    this.logicalDecompositionResults = results.logicalDecompositionsAnalysisResults
    this.codeConfiguration = results.codeConfiguration!
    this.metricsList = results.metricsList
    this.start = results.analysisStartTimeMs
    this.textSummary = results.textSummary
  }

  analyze(): void {
    for (const logicalDecomposition of this.codeConfiguration.logicalDecompositions) {
      const ldResults = new LDResults(logicalDecomposition.name)
      ldResults.logicalDecomposition = logicalDecomposition
      this.logicalDecompositionResults.push(ldResults)

      for (const component of logicalDecomposition.components) {
        const componentResults = new AspectAnalysisResults(component.name)
        ldResults.components.push(componentResults)
        AnalysisUtils.analyze(
          `DECOMPOSITION_${logicalDecomposition.name}`,
          component,
          null,
          null,
          componentResults,
          this.metricsList,
          this.textSummary,
          this.start,
        )
      }

      const metricFriendlyName = logicalDecomposition.name.toUpperCase().replace(/ /g, "_").replace(/-/g, "_")
      this.metricsList
        .addMetric()
        .setId(AnalysisUtils.getMetricId(`NUMBER_OF_DEPENDENCIES_DECOMPOSITION_${metricFriendlyName}`))
        .setValue(0)

      this.metricsList
        .addMetric()
        .setId(
          AnalysisUtils.getMetricId(`NUMBER_OF_PLACES_WITH_CYCLIC_DEPENDENCIES_DECOMPOSITION_${metricFriendlyName}`),
        )
        .setValue(0)
    }
  }
}
