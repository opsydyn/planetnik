import type { CodeAnalysisResults, CodeAnalyzerSettingsType } from "@planetnik/analyzer"
import { RichTextReport } from "../core/RichTextReport.js"
import type { FindingsAuthoringDocument } from "../findings/FindingsAuthoring.js"
import { CommitsReportGenerator } from "./CommitsReportGenerator.js"
import { ConcernsReportGenerator } from "./ConcernsReportGenerator.js"
import { ConditionalComplexityReportGenerator } from "./ConditionalComplexityReportGenerator.js"
import { ContributorsReportGenerator } from "./ContributorsReportGenerator.js"
import { ControlsReportGenerator } from "./ControlsReportGenerator.js"
import { DuplicationReportGenerator } from "./DuplicationReportGenerator.js"
import { FileChurnReportGenerator } from "./FileChurnReportGenerator.js"
import { FileHistoryReportGenerator } from "./FileHistoryReportGenerator.js"
import { FileSizeReportGenerator } from "./FileSizeReportGenerator.js"
import { FileTemporalDependenciesReportGenerator } from "./FileTemporalDependenciesReportGenerator.js"
import { FindingsReportGenerator } from "./FindingsReportGenerator.js"
import { LogicalComponentsReportGenerator } from "./LogicalComponentsReportGenerator.js"
import { MetricsReportGenerator } from "./MetricsReportGenerator.js"
import { OverviewReportGenerator } from "./OverviewReportGenerator.js"
import { TrendReportGenerator } from "./TrendReportGenerator.js"
import { UnitsSizeReportGenerator } from "./UnitsSizeReportGenerator.js"

export class BasicSourceCodeReportGenerator {
  private analysisResults: CodeAnalysisResults
  private settings: CodeAnalyzerSettingsType
  private findings: FindingsAuthoringDocument | null

  private overviewReport = new RichTextReport("overview", "SourceCodeOverview.html")
  private logicalComponentsReport = new RichTextReport("components", "Components.html")
  private logicalComponentsAndDependenciesReport = new RichTextReport(
    "componentDependencies",
    "ComponentsAndDependencies.html",
  )
  private concernsReport = new RichTextReport("concerns", "FeaturesOfInterest.html")
  private duplicationReport = new RichTextReport("duplication", "Duplication.html")
  private fileSizeReport = new RichTextReport("fileSize", "FileSize.html")
  private fileHistoryReport = new RichTextReport("fileAge", "FileAge.html")
  private fileChangeFrequencyReport = new RichTextReport("fileChurn", "FileChangeFrequency.html")
  private fileTemporalDependenciesReport = new RichTextReport("temporalDependencies", "FileTemporalDependencies.html")
  private unitSizeReport = new RichTextReport("unitSize", "UnitSize.html")
  private conditionalComplexityReport = new RichTextReport("conditionalComplexity", "ConditionalComplexity.html")
  private commitsReport = new RichTextReport("commits", "Commits.html")
  private contributorsReport = new RichTextReport("contributors", "Contributors.html")
  private findingsReport = new RichTextReport("findings", "Notes.html")
  private metricsReport = new RichTextReport("metrics", "Metrics.html")
  private trendReport = new RichTextReport("trend", "Trend.html")
  private controlsReport = new RichTextReport("controls", "Controls.html")

  constructor(
    settings: CodeAnalyzerSettingsType,
    analysisResults: CodeAnalysisResults,
    findings: FindingsAuthoringDocument | null = null,
  ) {
    this.settings = settings
    this.analysisResults = analysisResults
    this.findings = findings

    this.overviewReport.displayName = "Source Code Overview"
    this.logicalComponentsReport.displayName = "Components"
    this.logicalComponentsAndDependenciesReport.displayName = "Static Component Dependencies"
    this.concernsReport.displayName = "Features of Interest"
    this.duplicationReport.displayName = "Duplication"
    this.fileSizeReport.displayName = "File Size"
    this.fileHistoryReport.displayName = "File Age & Freshness"
    this.fileChangeFrequencyReport.displayName = "File Change Frequency"
    this.fileTemporalDependenciesReport.displayName = "Temporal Dependencies"
    this.unitSizeReport.displayName = "Unit Size"
    this.conditionalComplexityReport.displayName = "Conditional Complexity"
    this.commitsReport.displayName = "Commits"
    this.contributorsReport.displayName = "Contributors"
    this.findingsReport.displayName = "Notes & Findings"
    this.metricsReport.displayName = "Metrics"
    this.trendReport.displayName = "Trend"
    this.controlsReport.displayName = "Goals & Controls"
  }

  report(): RichTextReport[] {
    this.createBasicReport()

    const reports: RichTextReport[] = [this.overviewReport]

    if (this.settings.analyzeLogicalDecomposition) {
      reports.push(this.logicalComponentsReport)
      if (this.settings.analyzeStaticDependencies) {
        reports.push(this.logicalComponentsAndDependenciesReport)
      }
    }

    if (this.settings.analyzeDuplication) reports.push(this.duplicationReport)
    if (this.settings.analyzeFileSize) reports.push(this.fileSizeReport)

    if (this.settings.analyzeFileHistory) {
      const hasHistory = this.analysisResults.filesHistoryAnalysisResults.history.length > 0
      if (hasHistory) {
        reports.push(this.fileHistoryReport)
        reports.push(this.fileChangeFrequencyReport)
        reports.push(this.fileTemporalDependenciesReport)
        reports.push(this.commitsReport)
        reports.push(this.contributorsReport)
      }
    }

    if (this.settings.analyzeUnitSize) reports.push(this.unitSizeReport)
    if (this.settings.analyzeConditionalComplexity) reports.push(this.conditionalComplexityReport)
    if (this.settings.analyzeConcerns) reports.push(this.concernsReport)
    if (this.settings.analyzeFindings) reports.push(this.findingsReport)

    if (this.settings.createMetricsList) {
      reports.push(this.metricsReport)
      reports.push(this.trendReport)
    }

    if (this.settings.analyzeControls) reports.push(this.controlsReport)

    return reports
  }

  private createBasicReport(): void {
    OverviewReportGenerator.addScopeAnalysisToReport(this.overviewReport, this.analysisResults)

    if (this.settings.analyzeLogicalDecomposition) {
      LogicalComponentsReportGenerator.addComponentsToReport(this.logicalComponentsReport, this.analysisResults, true)
      if (this.settings.analyzeStaticDependencies) {
        LogicalComponentsReportGenerator.addComponentsToReport(
          this.logicalComponentsAndDependenciesReport,
          this.analysisResults,
          false,
        )
      }
    }

    if (this.settings.analyzeConcerns) {
      ConcernsReportGenerator.addConcernsToReport(this.concernsReport, this.analysisResults)
    }

    if (this.settings.analyzeDuplication) {
      DuplicationReportGenerator.addDuplicationToReport(this.duplicationReport, this.analysisResults)
    }

    if (this.settings.analyzeFileSize) {
      FileSizeReportGenerator.addFileSizeToReport(this.fileSizeReport, this.analysisResults)
    }

    if (this.settings.analyzeFileHistory) {
      const hasHistory = this.analysisResults.filesHistoryAnalysisResults.history.length > 0
      if (hasHistory) {
        FileHistoryReportGenerator.addFileHistoryToReport(this.fileHistoryReport, this.analysisResults)
        FileChurnReportGenerator.addFileChurnToReport(this.fileChangeFrequencyReport, this.analysisResults)
        FileTemporalDependenciesReportGenerator.addTemporalDependenciesToReport(
          this.fileTemporalDependenciesReport,
          this.analysisResults,
        )
        CommitsReportGenerator.addCommitsToReport(this.commitsReport, this.analysisResults)
        ContributorsReportGenerator.addContributorsToReport(this.contributorsReport, this.analysisResults)
      }
    }

    if (this.settings.analyzeUnitSize) {
      UnitsSizeReportGenerator.addUnitsSizeToReport(this.unitSizeReport, this.analysisResults)
    }

    if (this.settings.analyzeConditionalComplexity) {
      ConditionalComplexityReportGenerator.addConditionalComplexityToReport(
        this.conditionalComplexityReport,
        this.analysisResults,
      )
    }

    if (this.settings.analyzeFindings) {
      FindingsReportGenerator.addFindingsToReport(this.findingsReport, this.findings)
    }

    if (this.settings.createMetricsList) {
      MetricsReportGenerator.addMetricsToReport(this.metricsReport, this.analysisResults)
      TrendReportGenerator.addTrendToReport(this.trendReport, this.analysisResults)
    }

    if (this.settings.analyzeControls) {
      ControlsReportGenerator.addControlsToReport(this.controlsReport, this.analysisResults)
    }
  }
}
