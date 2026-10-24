import { SourceCodeAspectUtils } from "../aspects/SourceCodeAspectUtils.js"
import type { CodeConfiguration } from "../core/CodeConfiguration.js"
import { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js"
import { DependenciesFinderExtractor } from "../dependencies/DependenciesFinderExtractor.js"
import type { Dependency } from "../dependencies/Dependency.js"
import { DependencyUtils } from "../dependencies/DependencyUtils.js"
import { LanguageAnalyzerFactory } from "../lang/LanguageAnalyzerFactory.js"
import type { MetricsList } from "../metrics/MetricsList.js"
import { AspectAnalysisResults } from "../results/AspectAnalysisResults.js"
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"
import type { LogicalDecompositionAnalysisResults } from "../results/LogicalDecompositionAnalysisResults.js"
import { LogicalDecompositionAnalysisResults as LDResults } from "../results/LogicalDecompositionAnalysisResults.js"
import { AnalysisUtils } from "./AnalysisUtils.js"
import { SourceCodeFiles } from "./SourceCodeFiles.js"

export class LogicalDecompositionAnalyzer {
  private results: CodeAnalysisResults
  private codeConfiguration: CodeConfiguration
  private metricsList: MetricsList
  private logicalDecompositionResults: LogicalDecompositionAnalysisResults[]
  private textSummary: string[]
  private start: number

  constructor(results: CodeAnalysisResults) {
    this.results = results
    this.logicalDecompositionResults = results.logicalDecompositionsAnalysisResults
    this.codeConfiguration = results.codeConfiguration!
    this.metricsList = results.metricsList
    this.start = results.analysisStartTimeMs
    this.textSummary = results.textSummary
  }

  analyze(): void {
    const allDependencies = this.shouldExtractBuiltInDependencies() ? this.extractBuiltInDependencies() : []
    this.results.allDependencies = allDependencies

    for (const logicalDecomposition of this.codeConfiguration.logicalDecompositions) {
      const ldResults = new LDResults(logicalDecomposition.name)
      ldResults.logicalDecomposition = logicalDecomposition
      this.logicalDecompositionResults.push(ldResults)

      for (const component of logicalDecomposition.components) {
        component.sourceFiles = SourceCodeFiles.getSourceFilesFromScope(
          component,
          this.getScopeSourceFiles(logicalDecomposition.scope),
        )
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

      const componentDependencies = logicalDecomposition.dependenciesFinder.useBuiltInDependencyFinders
        ? DependencyUtils.getComponentDependencies(allDependencies, logicalDecomposition.name)
        : []

      // Run dependency analysis via DependenciesFinderExtractor for explicit/simple/meta rules.
      const finder = new DependenciesFinderExtractor(logicalDecomposition)
      const finderDependencies = finder.findComponentDependencies(this.codeConfiguration.main)
      componentDependencies.push(...finderDependencies)

      ldResults.componentDependencies.push(...componentDependencies)
      ldResults.allDependencies.push(...finder.allDependencies)

      const metricFriendlyName = logicalDecomposition.name.toUpperCase().replace(/ /g, "_").replace(/-/g, "_")

      this.metricsList
        .addMetric()
        .setId(AnalysisUtils.getMetricId(`NUMBER_OF_DEPENDENCIES_DECOMPOSITION_${metricFriendlyName}`))
        .setValue(componentDependencies.length)

      this.metricsList
        .addMetric()
        .setId(
          AnalysisUtils.getMetricId(`NUMBER_OF_PLACES_WITH_CYCLIC_DEPENDENCIES_DECOMPOSITION_${metricFriendlyName}`),
        )
        .setValue(DependencyUtils.getCyclicDependencyPlacesCount(componentDependencies))
    }
  }

  private shouldExtractBuiltInDependencies(): boolean {
    if (this.codeConfiguration.analysis.skipDependencies) {
      return false
    }

    return this.codeConfiguration.logicalDecompositions.some(
      (logicalDecomposition) => logicalDecomposition.dependenciesFinder.useBuiltInDependencyFinders,
    )
  }

  private extractBuiltInDependencies(): Dependency[] {
    const dependenciesAnalysis = new DependenciesAnalysis()

    for (const aspectPerExtension of SourceCodeAspectUtils.getAspectsPerExtensions(this.codeConfiguration.main)) {
      if (aspectPerExtension.sourceFiles.length === 0) {
        continue
      }

      const sourceFileSample = aspectPerExtension.sourceFiles[0]
      if (!sourceFileSample) {
        continue
      }

      const languageAnalyzer = LanguageAnalyzerFactory.getInstance().getLanguageAnalyzer(sourceFileSample.extension)
      const localAnalysis = languageAnalyzer.extractDependencies(aspectPerExtension.sourceFiles)
      dependenciesAnalysis.dependencies.push(...localAnalysis.dependencies)
      dependenciesAnalysis.errors.push(...localAnalysis.errors)
    }

    return dependenciesAnalysis.dependencies
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
      default:
        return this.codeConfiguration.main.sourceFiles
    }
  }

  private attachComponentToSourceFiles(component: {
    name: string
    filtering: string
    sourceFiles: Array<{
      logicalComponents: Array<{ name: string; filtering: string }>
    }>
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
