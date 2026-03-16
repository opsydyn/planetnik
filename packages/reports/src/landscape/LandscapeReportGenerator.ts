import type { LandscapeAnalysisResults, RepositoryAnalysisResult } from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"

export class LandscapeReportGenerator {
  static generate(report: RichTextReport, results: LandscapeAnalysisResults): void {
    report.addLevel1Header(results.metadata.name || "Landscape Overview")
    if (results.metadata.description) {
      report.addParagraph(results.metadata.description)
    }

    LandscapeReportGenerator.addOverviewSection(report, results)
    LandscapeReportGenerator.addExtensionsSection(report, results)
    LandscapeReportGenerator.addRepositoriesSection(report, results)
    LandscapeReportGenerator.addContributorsSection(report, results)
  }

  private static addOverviewSection(report: RichTextReport, results: LandscapeAnalysisResults): void {
    report.startSection("Overview", "")

    report.startTable()
    report.addTableHeaderLeft("Metric", "Value")

    LandscapeReportGenerator.addMetricRow(report, "Repositories", results.getRepositoryCount().toString())
    LandscapeReportGenerator.addMetricRow(report, "Main LOC", results.totalMainLoc.toLocaleString())
    LandscapeReportGenerator.addMetricRow(report, "Test LOC", results.totalTestLoc.toLocaleString())
    LandscapeReportGenerator.addMetricRow(report, "Total Files (main)", results.totalMainFilesCount.toLocaleString())
    LandscapeReportGenerator.addMetricRow(report, "Contributors", results.allContributors.length.toString())
    LandscapeReportGenerator.addMetricRow(report, "Languages", results.linesOfCodePerExtension.size.toString())

    if (results.firstCommitDate) {
      LandscapeReportGenerator.addMetricRow(report, "First Commit", results.firstCommitDate)
    }
    if (results.latestCommitDate) {
      LandscapeReportGenerator.addMetricRow(report, "Latest Commit", results.latestCommitDate)
    }

    report.endTable()
    report.endSection()
  }

  private static addExtensionsSection(report: RichTextReport, results: LandscapeAnalysisResults): void {
    if (results.linesOfCodePerExtension.size === 0) return

    report.startSection("Languages", "Lines of code per programming language across all repositories")

    const sorted = Array.from(results.linesOfCodePerExtension.entries()).sort((a, b) => b[1] - a[1])

    report.startTable()
    report.addTableHeaderLeft("Extension", "LOC", "Repositories")
    for (const [ext, loc] of sorted) {
      report.startTableRow()
      report.addTableCell(ext)
      report.addTableCell(loc.toLocaleString())
      report.addTableCell((results.repositoriesPerExtension.get(ext) ?? 0).toString())
      report.endTableRow()
    }
    report.endTable()
    report.endSection()
  }

  private static addRepositoriesSection(report: RichTextReport, results: LandscapeAnalysisResults): void {
    if (results.repositoryAnalysisResults.length === 0) return

    report.startSection("Repositories", `${results.getRepositoryCount()} repositories analyzed`)

    report.startTable()
    report.addTableHeaderLeft("Repository", "Main LOC", "Test LOC", "Files", "Contributors", "Latest Commit")

    for (const repo of results.repositoryAnalysisResults) {
      report.startTableRow()
      report.addTableCell(repo.name)
      report.addTableCell(repo.mainLoc.toLocaleString())
      report.addTableCell(repo.testLoc.toLocaleString())
      report.addTableCell(repo.mainFilesCount.toLocaleString())
      report.addTableCell(repo.contributors.length.toString())
      report.addTableCell(repo.latestCommitDate || "-")
      report.endTableRow()
    }

    report.endTable()
    report.endSection()
  }

  private static addContributorsSection(report: RichTextReport, results: LandscapeAnalysisResults): void {
    if (results.allContributors.length === 0) return

    report.startSection("Contributors", `${results.allContributors.length} contributors across all repositories`)

    report.startTable()
    report.addTableHeaderLeft("Contributor", "Total Commits", "Recent (30d)", "First Commit", "Latest Commit")

    for (const contributor of results.allContributors.slice(0, 100)) {
      report.startTableRow()
      report.addTableCell(contributor.email)
      report.addTableCell(contributor.commitsCount.toString())
      report.addTableCell(contributor.commitsCount30Days.toString())
      report.addTableCell(contributor.firstCommitDate || "-")
      report.addTableCell(contributor.latestCommitDate || "-")
      report.endTableRow()
    }

    report.endTable()
    report.endSection()
  }

  private static addMetricRow(report: RichTextReport, label: string, value: string): void {
    report.startTableRow()
    report.addTableCell(`<strong>${label}</strong>`)
    report.addTableCell(value)
    report.endTableRow()
  }
}
