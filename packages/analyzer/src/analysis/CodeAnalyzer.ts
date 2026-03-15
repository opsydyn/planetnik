import type { CodeAnalyzerSettingsType } from "../core/CodeAnalyzerSettings.js"
import type { CodeConfiguration } from "../core/CodeConfiguration.js"
import { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"
import { AnalysisUtils } from "./AnalysisUtils.js"
import { BasicsAnalyzer } from "./BasicsAnalyzer.js"
import { ConcernsAnalyzer } from "./ConcernsAnalyzer.js"
import { ControlsAnalyzer } from "./ControlsAnalyzer.js"
import { DuplicationAnalyzer } from "./DuplicationAnalyzer.js"
import { FileSizeAnalyzer } from "./FileSizeAnalyzer.js"
import { LogicalDecompositionAnalyzer } from "./LogicalDecompositionAnalyzer.js"
import { UnitsAnalyzer } from "./UnitsAnalyzer.js"

export class CodeAnalyzer {
  private settings: CodeAnalyzerSettingsType
  private codeConfiguration: CodeConfiguration
  private configFilePath: string

  constructor(settings: CodeAnalyzerSettingsType, codeConfiguration: CodeConfiguration, configFilePath: string) {
    this.settings = settings
    this.codeConfiguration = codeConfiguration
    this.configFilePath = configFilePath
  }

  analyze(): CodeAnalysisResults {
    const results = new CodeAnalysisResults()
    results.metadata = this.codeConfiguration.metadata
    const start = Date.now()
    results.analysisStartTimeMs = start
    results.codeConfiguration = this.codeConfiguration

    // BasicsAnalyzer always runs
    new BasicsAnalyzer(results, this.configFilePath).analyze()

    if (this.shouldAnalyzeLogicalDecomposition()) {
      new LogicalDecompositionAnalyzer(results).analyze()
    }

    if (this.shouldAnalyzeConcerns()) {
      new ConcernsAnalyzer(results).analyze()
    }

    if (this.shouldAnalyzeFileSize()) {
      new FileSizeAnalyzer(results).analyze()
    }

    if (this.shouldAnalyzeUnits()) {
      new UnitsAnalyzer(results).analyze()
    }

    // FileHistoryAnalyzer and ContributorsAnalyzer: deferred to Step 6
    // (require external git history file parsing)

    if (this.shouldAnalyzeDuplication()) {
      new DuplicationAnalyzer(results).analyze()
    }

    if (this.shouldAnalyzeControls()) {
      new ControlsAnalyzer(results).analyze()
    }

    this.addTotalAnalysisTimeMetric(results, start)

    return results
  }

  private shouldAnalyzeConcerns(): boolean {
    return this.settings.analyzeConcerns || this.settings.createMetricsList || this.settings.analyzeControls
  }

  private shouldAnalyzeFileSize(): boolean {
    return this.settings.analyzeFileSize || this.settings.createMetricsList || this.settings.analyzeControls
  }

  private shouldAnalyzeUnits(): boolean {
    return (
      this.settings.analyzeUnitSize ||
      this.settings.analyzeConditionalComplexity ||
      this.settings.createMetricsList ||
      this.settings.analyzeControls
    )
  }

  private shouldAnalyzeDuplication(): boolean {
    return this.settings.analyzeDuplication || this.settings.createMetricsList || this.settings.analyzeControls
  }

  private shouldAnalyzeControls(): boolean {
    return this.settings.analyzeControls
  }

  private shouldAnalyzeLogicalDecomposition(): boolean {
    return this.settings.analyzeLogicalDecomposition || this.settings.createMetricsList || this.settings.analyzeControls
  }

  private addTotalAnalysisTimeMetric(results: CodeAnalysisResults, start: number): void {
    const elapsed = Date.now() - start
    results.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("TOTAL_ANALYSIS_TIME_IN_MILLIS"))
      .setDescription("Total analysis time in milliseconds")
      .setValue(elapsed)
  }
}
