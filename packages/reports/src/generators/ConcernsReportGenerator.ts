import type { CodeAnalysisResults, ConcernsAnalysisResults } from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"

export class ConcernsReportGenerator {
  static addConcernsToReport(report: RichTextReport, results: CodeAnalysisResults): void {
    report.addParagraph(
      "Aspects in the source code identified through RegEx patterns.",
      "margin-top: 12px; color: grey",
    )

    ConcernsReportGenerator.addIntro(report)
    ConcernsReportGenerator.addSummary(report, results)
    ConcernsReportGenerator.addConcernsDetails(report, results)
  }

  private static addIntro(report: RichTextReport): void {
    report.startSection("Intro", "")
    report.startUnorderedList()
    report.addListItem(
      "Features of interest are any aspects of a software system that can be identified through patterns in code.",
    )
    report.addListItem(
      "Features of interest provide you with a way to focus your attention on relevant parts of the codebase.",
    )
    report.addListItem("Typical examples include, security, TODOs, logging.")
    report.addListItem(
      "A feature of interest may be present in multiple files. Any source code file may be in zero or multiple features of interest.",
    )
    report.endUnorderedList()
    report.endSection()
  }

  private static addSummary(report: RichTextReport, results: CodeAnalysisResults): void {
    const concernsResults = results.concernsAnalysisResults
    if (concernsResults.length === 0) {
      report.addParagraph("No concerns defined.")
      return
    }

    report.startSection("Overview", "")
    for (const group of concernsResults) {
      report.addLevel2Header(group.key.toUpperCase())
      if (group.concerns.length > 1) {
        const mainLoc = results.mainAspectAnalysisResults.linesOfCode
        for (const concern of group.concerns) {
          if (ConcernsReportGenerator.isDerived(concern.name)) continue
          const pct = mainLoc > 0 ? ((100.0 * concern.linesOfCode) / mainLoc).toFixed(1) : "0.0"
          report.addContentInDiv(
            `${concern.name}: <b>${concern.filesCount}</b> files, <b>${concern.linesOfCode}</b> LOC (${pct}%)`,
          )
        }
      }
    }
    report.endSection()
  }

  private static addConcernsDetails(report: RichTextReport, results: CodeAnalysisResults): void {
    let groupCounter = 0
    for (const group of results.concernsAnalysisResults) {
      if (group.concerns.length <= 1) {
        report.addParagraph("No concerns defined.")
        continue
      }
      if (group.key.toLowerCase() === "unclassified") continue

      groupCounter++
      ConcernsReportGenerator.renderConcernGroup(report, results, group, groupCounter)
    }
  }

  private static renderConcernGroup(
    report: RichTextReport,
    results: CodeAnalysisResults,
    group: ConcernsAnalysisResults,
    groupCounter: number,
  ): void {
    report.startSection(`${groupCounter} ${group.key.toUpperCase()} Concerns`, "")
    report.startUnorderedList()
    report.addListItem(
      `The "${group.key}" group contains <b>${group.concerns.length}</b> concern${group.concerns.length > 1 ? "s" : ""}.`,
    )
    report.startUnorderedList()
    for (const c of group.concerns) {
      report.addListItem(c.name)
    }
    report.endUnorderedList()
    report.endUnorderedList()

    let concernCounter = 0
    for (const concern of group.concerns) {
      if (concern.name.toLowerCase() === "multiple classifications") continue
      if (concern.name.toLowerCase() === "unclassified") continue

      concernCounter++
      const mainLoc = results.mainAspectAnalysisResults.linesOfCode
      const pct = mainLoc > 0 ? ((100.0 * concern.linesOfCode) / mainLoc).toFixed(1) : "0.0"

      report.startSubSection(`${groupCounter}.${concernCounter} ${concern.name}`, "")
      report.startUnorderedList()
      report.addListItem(`Files: <b>${concern.filesCount}</b>`)
      report.addListItem(`Lines of code: <b>${concern.linesOfCode}</b> (${pct}% of main)`)
      report.endUnorderedList()

      // Per-extension breakdown
      if (concern.linesOfCodePerExtension.length > 0) {
        report.startTable()
        report.addTableHeaderLeft("Extension", "Files", "Lines of Code")
        for (let i = 0; i < concern.linesOfCodePerExtension.length; i++) {
          const locMetric = concern.linesOfCodePerExtension[i]!
          const fileMetric = concern.fileCountPerExtension[i]
          report.startTableRow()
          report.addTableCell(locMetric.name)
          report.addTableCell(`${fileMetric?.value ?? 0}`)
          report.addTableCell(`${locMetric.value}`)
          report.endTableRow()
        }
        report.endTable()
      }
    }
    report.endSection()
  }

  private static isDerived(name: string): boolean {
    return (
      name.trim().startsWith("- ") ||
      name.toLowerCase() === "unclassified" ||
      name.toLowerCase() === "multiple classifications"
    )
  }
}
