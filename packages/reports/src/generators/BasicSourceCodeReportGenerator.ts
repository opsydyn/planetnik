import type { CodeAnalysisResults, CodeAnalyzerSettingsType } from "@planetnik/analyzer"
import { RichTextReport } from "../core/RichTextReport.js"
import { ControlsReportGenerator } from "./ControlsReportGenerator.js"
import { DuplicationReportGenerator } from "./DuplicationReportGenerator.js"
import { FileSizeReportGenerator } from "./FileSizeReportGenerator.js"
import { MetricsReportGenerator } from "./MetricsReportGenerator.js"
import { OverviewReportGenerator } from "./OverviewReportGenerator.js"
import { UnitsSizeReportGenerator } from "./UnitsSizeReportGenerator.js"

export class BasicSourceCodeReportGenerator {
  private analysisResults: CodeAnalysisResults
  private settings: CodeAnalyzerSettingsType

  private overviewReport = new RichTextReport("overview", "SourceCodeOverview.html")
  private duplicationReport = new RichTextReport("duplication", "Duplication.html")
  private fileSizeReport = new RichTextReport("fileSize", "FileSize.html")
  private unitSizeReport = new RichTextReport("unitSize", "UnitSize.html")
  private controlsReport = new RichTextReport("controls", "Controls.html")
  private metricsReport = new RichTextReport("metrics", "Metrics.html")

  constructor(settings: CodeAnalyzerSettingsType, analysisResults: CodeAnalysisResults) {
    this.settings = settings
    this.analysisResults = analysisResults

    this.overviewReport.displayName = "Source Code Overview"
    this.duplicationReport.displayName = "Duplication"
    this.fileSizeReport.displayName = "File Size"
    this.unitSizeReport.displayName = "Unit Size"
    this.controlsReport.displayName = "Goals & Controls"
    this.metricsReport.displayName = "Metrics"
  }

  report(): RichTextReport[] {
    this.createBasicReport()

    const reports: RichTextReport[] = [this.overviewReport]

    if (this.settings.analyzeDuplication) reports.push(this.duplicationReport)
    if (this.settings.analyzeFileSize) reports.push(this.fileSizeReport)
    if (this.settings.analyzeUnitSize) reports.push(this.unitSizeReport)
    if (this.settings.analyzeControls) reports.push(this.controlsReport)

    reports.push(this.metricsReport)

    return reports
  }

  private createBasicReport(): void {
    OverviewReportGenerator.addScopeAnalysisToReport(this.overviewReport, this.analysisResults)

    if (this.settings.analyzeDuplication) {
      DuplicationReportGenerator.addDuplicationToReport(this.duplicationReport, this.analysisResults)
    }

    if (this.settings.analyzeFileSize) {
      FileSizeReportGenerator.addFileSizeToReport(this.fileSizeReport, this.analysisResults)
    }

    if (this.settings.analyzeUnitSize) {
      UnitsSizeReportGenerator.addUnitsSizeToReport(this.unitSizeReport, this.analysisResults)
    }

    if (this.settings.analyzeControls) {
      ControlsReportGenerator.addControlsToReport(this.controlsReport, this.analysisResults)
    }

    MetricsReportGenerator.addMetricsToReport(this.metricsReport, this.analysisResults)
  }
}
