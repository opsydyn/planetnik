import type { CodeAnalysisResults, ContributorsAnalysisResults } from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"

export class CommitsReportGenerator {
  static addCommitsToReport(report: RichTextReport, results: CodeAnalysisResults): void {
    const analysis = results.contributorsAnalysisResults

    report.addParagraph("An overview of commit trends.", "margin-top: 12px; color: grey")

    CommitsReportGenerator.addOverviewSection(report, analysis)
    CommitsReportGenerator.addPerYearSection(report, analysis)
    CommitsReportGenerator.addPerMonthSection(report, analysis)
    CommitsReportGenerator.addPerWeekSection(report, analysis)
    CommitsReportGenerator.addPerDaySection(report, analysis)
  }

  private static addOverviewSection(report: RichTextReport, analysis: ContributorsAnalysisResults): void {
    report.startSection("Overview", "")
    report.startUnorderedList()
    report.addListItem(`Total commits: <b>${analysis.commitsCount}</b>`)
    report.addListItem(`Latest commit date: <b>${analysis.latestCommitDate}</b>`)
    report.addListItem(`Total contributors: <b>${analysis.contributors.length}</b>`)
    report.endUnorderedList()
    report.endSection()
  }

  private static addPerYearSection(report: RichTextReport, analysis: ContributorsAnalysisResults): void {
    if (analysis.contributorsPerYear.length === 0) return

    report.startSection("Per Year", "")
    report.startTable()
    report.addTableHeaderLeft("Year", "Commits", "Contributors")
    for (const slot of analysis.contributorsPerYear) {
      report.startTableRow()
      report.addTableCell(slot.timeSlot)
      report.addTableCell(`${slot.commitsCount}`)
      report.addTableCell(`${slot.contributorsCount}`)
      report.endTableRow()
    }
    report.endTable()
    report.endSection()
  }

  private static addPerMonthSection(report: RichTextReport, analysis: ContributorsAnalysisResults): void {
    if (analysis.contributorsPerMonth.length === 0) return

    report.startSection("Per Month", "")
    report.startTable()
    report.addTableHeaderLeft("Month", "Commits", "Contributors")
    for (const slot of analysis.contributorsPerMonth.slice(0, 60)) {
      report.startTableRow()
      report.addTableCell(slot.timeSlot)
      report.addTableCell(`${slot.commitsCount}`)
      report.addTableCell(`${slot.contributorsCount}`)
      report.endTableRow()
    }
    report.endTable()
    report.endSection()
  }

  private static addPerWeekSection(report: RichTextReport, analysis: ContributorsAnalysisResults): void {
    if (analysis.contributorsPerWeek.length === 0) return

    report.startSection("Per Week", "")
    report.startTable()
    report.addTableHeaderLeft("Week", "Commits", "Contributors")
    for (const slot of analysis.contributorsPerWeek.slice(0, 104)) {
      report.startTableRow()
      report.addTableCell(slot.timeSlot)
      report.addTableCell(`${slot.commitsCount}`)
      report.addTableCell(`${slot.contributorsCount}`)
      report.endTableRow()
    }
    report.endTable()
    report.endSection()
  }

  private static addPerDaySection(report: RichTextReport, analysis: ContributorsAnalysisResults): void {
    if (analysis.contributorsPerDay.length === 0) return

    report.startSection("Per Day", "")
    report.startTable()
    report.addTableHeaderLeft("Day", "Commits", "Contributors")
    for (const slot of analysis.contributorsPerDay.slice(0, 365)) {
      report.startTableRow()
      report.addTableCell(slot.timeSlot)
      report.addTableCell(`${slot.commitsCount}`)
      report.addTableCell(`${slot.contributorsCount}`)
      report.endTableRow()
    }
    report.endTable()
    report.endSection()
  }
}
