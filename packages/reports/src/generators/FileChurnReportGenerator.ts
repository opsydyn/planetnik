import type {
  CodeAnalysisResults,
  FilesHistoryAnalysisResults,
  SourceFile as SourceFileType,
} from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"
import { RiskDistributionReportUtils } from "./RiskDistributionReportUtils.js"

export class FileChurnReportGenerator {
  static addFileChurnToReport(report: RichTextReport, results: CodeAnalysisResults): void {
    const histResults = results.filesHistoryAnalysisResults

    report.addParagraph(
      "File change frequency (churn) shows the distribution of file updates (days with at least one commit).",
      "margin-top: 12px; color: grey",
    )

    FileChurnReportGenerator.addChangeFrequencyOverall(report, histResults)
    FileChurnReportGenerator.addContributorsCountOverall(report, histResults)
    FileChurnReportGenerator.addMostChangedFilesList(report, histResults)
    FileChurnReportGenerator.addFilesWithMostContributors(report, histResults)
    FileChurnReportGenerator.addFilesWithLeastContributors(report, histResults)
  }

  private static addChangeFrequencyOverall(report: RichTextReport, histResults: FilesHistoryAnalysisResults): void {
    if (!histResults.changeDistribution) return

    report.startSection("File Change Frequency Overall", "The number of recorded file updates")
    RiskDistributionReportUtils.addRiskDistributionTable(report, histResults.changeDistribution)
    report.endSection()
  }

  private static addContributorsCountOverall(report: RichTextReport, histResults: FilesHistoryAnalysisResults): void {
    if (!histResults.contributorsCountDistribution) return

    report.startSection("Contributors Count Frequency Overall", "The number of file contributors")
    RiskDistributionReportUtils.addRiskDistributionTable(report, histResults.contributorsCountDistribution)
    report.endSection()
  }

  private static addMostChangedFilesList(report: RichTextReport, histResults: FilesHistoryAnalysisResults): void {
    FileChurnReportGenerator.addFileList(report, "Most Frequently Changed Files", histResults.mostChangedFiles)
  }

  private static addFilesWithMostContributors(report: RichTextReport, histResults: FilesHistoryAnalysisResults): void {
    FileChurnReportGenerator.addFileList(report, "Files With Most Contributors", histResults.filesWithMostContributors)
  }

  private static addFilesWithLeastContributors(report: RichTextReport, histResults: FilesHistoryAnalysisResults): void {
    FileChurnReportGenerator.addFileList(
      report,
      "Files With Least Contributors",
      histResults.filesWithLeastContributors,
    )
  }

  private static addFileList(report: RichTextReport, title: string, files: SourceFileType[]): void {
    if (files.length === 0) return

    report.startSection(`${title} (Top ${files.length})`, "")
    report.startTable()
    report.addTableHeaderLeft("File", "Lines of Code", "First Changed", "Last Changed", "Changes", "Contributors")

    for (const file of files) {
      const fmh = file.fileModificationHistory
      report.startTableRow()
      report.addTableCell(file.relativePath)
      report.addTableCell(`${file.linesOfCode}`)
      report.addTableCell(fmh?.getOldestDate() ?? "")
      report.addTableCell(fmh?.getLatestDate() ?? "")
      report.addTableCell(`${fmh?.dates?.length ?? 0}`)
      report.addTableCell(`${fmh?.countContributors() ?? 0}`)
      report.endTableRow()
    }

    report.endTable()
    report.endSection()
  }
}
