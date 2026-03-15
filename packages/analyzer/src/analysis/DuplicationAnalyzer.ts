import type { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import type { CodeConfiguration } from "../core/CodeConfiguration.js"
import type { MetricsList } from "../metrics/MetricsList.js"
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"
import type { DuplicationAnalysisResults } from "../results/DuplicationAnalysisResults.js"
import { AnalysisUtils } from "./AnalysisUtils.js"

export class DuplicationAnalyzer {
  private codeConfiguration: CodeConfiguration
  private metricsList: MetricsList
  private duplicationResults: DuplicationAnalysisResults
  private main: NamedSourceCodeAspect
  private analysisResults: CodeAnalysisResults
  private textSummary: string[]

  constructor(results: CodeAnalysisResults) {
    this.duplicationResults = results.duplicationAnalysisResults
    this.codeConfiguration = results.codeConfiguration!
    this.metricsList = results.metricsList
    this.start = results.analysisStartTimeMs
    this.textSummary = results.textSummary
    this.analysisResults = results
    this.main = this.codeConfiguration.main
  }

  analyze(): void {
    if (this.skipDuplicationAnalysis()) {
      return
    }

    // TODO: Full DuplicationEngine implementation (Step 6)
    // For now, set basic metrics with zero values
    const totalNumberOfCleanedLines = 0
    const numberOfDuplicatedLines = 0
    const numberOfDuplicates = 0
    const numberOfFilesWithDuplicates = 0

    this.duplicationResults.overallDuplication.numberOfDuplicates = numberOfDuplicates
    this.duplicationResults.overallDuplication.cleanedLinesOfCode = totalNumberOfCleanedLines
    this.duplicationResults.overallDuplication.duplicatedLinesOfCode = numberOfDuplicatedLines
    this.duplicationResults.overallDuplication.numberOfFilesWithDuplicates = numberOfFilesWithDuplicates

    this.addSystemDuplicationMetrics(
      numberOfDuplicates,
      numberOfDuplicatedLines,
      totalNumberOfCleanedLines,
      numberOfFilesWithDuplicates,
    )
  }

  private skipDuplicationAnalysis(): boolean {
    return (
      this.codeConfiguration.analysis.skipDuplication ||
      this.main.getLinesOfCode() > this.codeConfiguration.analysis.locDuplicationThreshold
    )
  }

  private addSystemDuplicationMetrics(
    numberOfDuplicates: number,
    numberOfDuplicatedLines: number,
    totalNumberOfCleanedLines: number,
    numberOfFilesWithDuplicates: number,
  ): void {
    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("DUPLICATION_NUMBER_OF_DUPLICATES"))
      .setDescription("Number of duplicates")
      .setValue(numberOfDuplicates)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("DUPLICATION_NUMBER_OF_FILES_WITH_DUPLICATES"))
      .setDescription("Number of files with duplicates")
      .setValue(numberOfFilesWithDuplicates)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("DUPLICATION_NUMBER_OF_DUPLICATED_LINES"))
      .setDescription("Number of duplicated lines")
      .setValue(numberOfDuplicatedLines)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("DUPLICATION_NUMBER_OF_CLEANED_LINES"))
      .setDescription("Number of lines after cleaning for duplication calculations")
      .setValue(totalNumberOfCleanedLines)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("DUPLICATION_PERCENTAGE"))
      .setDescription("Duplication percentage")
      .setValue(totalNumberOfCleanedLines > 0 ? (100.0 * numberOfDuplicatedLines) / totalNumberOfCleanedLines : 0)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("UNIT_DUPLICATES_COUNT"))
      .setDescription("Unit duplicates")
      .setValue(this.analysisResults.duplicationAnalysisResults.unitDuplicates.length)
  }
}
