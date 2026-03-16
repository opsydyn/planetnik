import type { CodeAnalysisResults, FilePairChangedTogether } from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"

export class FileTemporalDependenciesReportGenerator {
  static addTemporalDependenciesToReport(report: RichTextReport, results: CodeAnalysisResults): void {
    const histResults = results.filesHistoryAnalysisResults

    report.addParagraph(
      "A temporal dependency occurs when developers change two or more files at the same time (i.e. they are a part of the same commit).",
      "margin-top: 12px; color: grey",
    )

    report.startTabGroup()
    report.addTab("30_days", "Past 30 Days", true)
    report.addTab("90_days", "Past 3 Months", false)
    report.addTab("180_days", "Past 6 Months", false)
    report.addTab("all_time", "All Time", false)
    report.endTabGroup()

    FileTemporalDependenciesReportGenerator.addTabContent(
      report,
      "30_days",
      histResults.filePairsChangedTogether30Days,
      true,
    )
    FileTemporalDependenciesReportGenerator.addTabContent(
      report,
      "90_days",
      histResults.filePairsChangedTogether90Days,
      false,
    )
    FileTemporalDependenciesReportGenerator.addTabContent(
      report,
      "180_days",
      histResults.filePairsChangedTogether180Days,
      false,
    )
    FileTemporalDependenciesReportGenerator.addTabContent(
      report,
      "all_time",
      histResults.filePairsChangedTogether,
      false,
    )
  }

  private static addTabContent(
    report: RichTextReport,
    id: string,
    filePairs: FilePairChangedTogether[],
    active: boolean,
  ): void {
    report.startTabContentSection(id, active)
    FileTemporalDependenciesReportGenerator.addFileChangedTogetherList(report, filePairs)
    report.endTabContentSection()
  }

  private static addFileChangedTogetherList(report: RichTextReport, filePairs: FilePairChangedTogether[]): void {
    if (filePairs.length === 0) {
      report.addParagraph("No file pairs changed together.")
      return
    }

    const displayPairs = filePairs.slice(0, 50)

    report.addLineBreak()
    report.startSubSection(`Files Most Frequently Changed Together (Top ${displayPairs.length})`, "")

    report.startDiv("max-height: 400px; overflow-y: auto")
    report.startTable()
    report.addTableHeaderLeft("Pairs", "# Same Commits", "# Commits 1", "# Commits 2", "Latest Commit")

    for (const pair of displayPairs) {
      report.startTableRow()
      report.addTableCell(`${pair.sourceFile1Path}<br/>${pair.sourceFile2Path}`)

      const sharedCommits = pair.commits.length
      report.addTableCell(`${sharedCommits}`, "text-align: center")

      const c1 = pair.commitsCountFile1
      const pct1 = c1 > 0 && c1 >= sharedCommits ? ` (${((100.0 * sharedCommits) / c1).toFixed(0)}%)` : ""
      report.addTableCell(`${c1}${pct1}`)

      const c2 = pair.commitsCountFile2
      const pct2 = c2 > 0 && c2 >= sharedCommits ? ` (${((100.0 * sharedCommits) / c2).toFixed(0)}%)` : ""
      report.addTableCell(`${c2}${pct2}`)

      report.addTableCell(pair.latestCommit)
      report.endTableRow()
    }

    report.endTable()
    report.endDiv()
    report.endSection()
  }
}
