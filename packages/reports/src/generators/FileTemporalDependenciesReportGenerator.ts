import type { CodeAnalysisResults, FilePairChangedTogether } from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"

export class FileTemporalDependenciesReportGenerator {
  static addTemporalDependenciesToReport(report: RichTextReport, results: CodeAnalysisResults): void {
    const histResults = results.filesHistoryAnalysisResults
    const maxTemporalDependenciesDepthDays = results.codeConfiguration?.analysis.maxTemporalDependenciesDepthDays ?? 180

    report.addParagraph(
      "A temporal dependency occurs when developers change two or more files at the same time (i.e. they are a part of the same commit).",
      "margin-top: 12px; color: grey",
    )

    const periods = [
      {
        id: "30_days",
        label: "Past 30 Days",
        filePairs: histResults.filePairsChangedTogether30Days,
        active: true,
        enabled: maxTemporalDependenciesDepthDays >= 30,
      },
      {
        id: "90_days",
        label: "Past 3 Months",
        filePairs: histResults.filePairsChangedTogether90Days,
        active: false,
        enabled: maxTemporalDependenciesDepthDays >= 90,
      },
      {
        id: "180_days",
        label: "Past 6 Months",
        filePairs: histResults.filePairsChangedTogether180Days,
        active: false,
        enabled: maxTemporalDependenciesDepthDays >= 180,
      },
      {
        id: "all_time",
        label: `Past ${maxTemporalDependenciesDepthDays} Days`,
        filePairs: histResults.filePairsChangedTogether,
        active: false,
        enabled: maxTemporalDependenciesDepthDays > 180,
      },
    ].filter((period) => period.enabled)

    report.startTabGroup()
    for (const period of periods) {
      report.addTab(period.id, period.label, period.active)
    }
    report.endTabGroup()

    for (const period of periods) {
      FileTemporalDependenciesReportGenerator.addTabContent(report, period.id, period.filePairs, period.active)
    }
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
