import type { CodeConfiguration } from "../core/CodeConfiguration.js"
import { DependenciesFinderExtractor } from "../dependencies/DependenciesFinderExtractor.js"
import { DependencyUtils } from "../dependencies/DependencyUtils.js"
import type { MetricsList } from "../metrics/MetricsList.js"
import { AspectAnalysisResults } from "../results/AspectAnalysisResults.js"
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"
import type { LogicalDecompositionAnalysisResults } from "../results/LogicalDecompositionAnalysisResults.js"
import { LogicalDecompositionAnalysisResults as LDResults } from "../results/LogicalDecompositionAnalysisResults.js"
import { AnalysisUtils } from "./AnalysisUtils.js"
import { SourceCodeFiles } from "./SourceCodeFiles.js"

export class LogicalDecompositionAnalyzer {
  private codeConfiguration: CodeConfiguration
  private metricsList: MetricsList
  private logicalDecompositionResults: LogicalDecompositionAnalysisResults[]
  private textSummary: string[]
  private start: number

  constructor(results: CodeAnalysisResults) {
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
        component.sourceFiles = SourceCodeFiles.getSourceFilesFromScope(component, this.getScopeSourceFiles(logicalDecomposition.scope))
        component.filtering = logicalDecomposition.name
        this.attachComponentToSourceFiles(component)
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

      // Run dependency analysis via DependenciesFinderExtractor
      const finder = new DependenciesFinderExtractor(logicalDecomposition)
      const finderDependencies = finder.findComponentDependencies(this.codeConfiguration.main)
      ldResults.componentDependencies.push(...finderDependencies)
      ldResults.allDependencies.push(...finder.allDependencies)

      const metricFriendlyName = logicalDecomposition.name.toUpperCase().replace(/ /g, "_").replace(/-/g, "_")

      this.metricsList
        .addMetric()
        .setId(AnalysisUtils.getMetricId(`NUMBER_OF_DEPENDENCIES_DECOMPOSITION_${metricFriendlyName}`))
        .setValue(finderDependencies.length)

      this.metricsList
        .addMetric()
        .setId(
          AnalysisUtils.getMetricId(`NUMBER_OF_PLACES_WITH_CYCLIC_DEPENDENCIES_DECOMPOSITION_${metricFriendlyName}`),
        )
        .setValue(DependencyUtils.getCyclicDependencyPlacesCount(finderDependencies))
    }
  }

  private getScopeSourceFiles(scope: string): typeof this.codeConfiguration.main.sourceFiles {
    switch (scope) {
      case "test":
        return this.codeConfiguration.test.sourceFiles
      case "generated":
        return this.codeConfiguration.generated.sourceFiles
      case "buildAndDeployment":
        return this.codeConfiguration.buildAndDeployment.sourceFiles
      case "other":
        return this.codeConfiguration.other.sourceFiles
      case "main":
      default:
        return this.codeConfiguration.main.sourceFiles
    }
  }

  private attachComponentToSourceFiles(component: {
    name: string
    filtering: string
    sourceFiles: Array<{ logicalComponents: Array<{ name: string; filtering: string }> }>
  }): void {
    for (const sourceFile of component.sourceFiles) {
      const alreadyAssigned = sourceFile.logicalComponents.some(
        (existing) => existing.name === component.name && existing.filtering === component.filtering,
      )
      if (!alreadyAssigned) {
        sourceFile.logicalComponents.push(component)
      }
    }
  }
}
