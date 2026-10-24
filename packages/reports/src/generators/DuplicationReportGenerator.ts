import type { CodeAnalysisResults } from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"

export class DuplicationReportGenerator {
  static addDuplicationToReport(report: RichTextReport, results: CodeAnalysisResults): void {
    report.startSection("Duplication", "")

    const dup = results.duplicationAnalysisResults

    // Overall stats
    report.startTable()
    report.addTableHeaderLeft("Metric", "Value")

    report.startTableRow()
    report.addTableCell("Duplication percentage")
    report.addTableCell(`${dup.overallDuplication.getDuplicationPercentage().toFixed(1)}%`)
    report.endTableRow()

    report.startTableRow()
    report.addTableCell("Duplicated lines")
    report.addTableCell(`${dup.overallDuplication.duplicatedLinesOfCode}`)
    report.endTableRow()

    report.startTableRow()
    report.addTableCell("Cleaned lines")
    report.addTableCell(`${dup.overallDuplication.cleanedLinesOfCode}`)
    report.endTableRow()

    report.startTableRow()
    report.addTableCell("Number of duplicates")
    report.addTableCell(`${dup.overallDuplication.numberOfDuplicates}`)
    report.endTableRow()

    report.startTableRow()
    report.addTableCell("Files with duplicates")
    report.addTableCell(`${dup.overallDuplication.numberOfFilesWithDuplicates}`)
    report.endTableRow()

    report.endTable()

    // Per extension
    if (dup.duplicationPerExtension.length > 0) {
      report.addLevel3Header("Duplication Per Extension")
      report.startTable()
      report.addTableHeaderLeft("Extension", "Duplicated Lines", "Cleaned Lines", "Percentage")
      for (const ext of dup.duplicationPerExtension) {
        report.startTableRow()
        report.addTableCell(ext.key)
        report.addTableCell(`${ext.duplicatedLinesOfCode}`)
        report.addTableCell(`${ext.cleanedLinesOfCode}`)
        report.addTableCell(`${ext.getDuplicationPercentage().toFixed(1)}%`)
        report.endTableRow()
      }
      report.endTable()
    }

    // Longest duplicates
    if (dup.longestDuplicates.length > 0) {
      report.addLevel3Header("Longest Duplicates")
      report.startTable()
      report.addTableHeaderLeft("Block Size", "Files")
      for (const d of dup.longestDuplicates.slice(0, 20)) {
        report.startTableRow()
        report.addTableCell(`${d.blockSize}`)
        const files = d.duplicatedFileBlocks.map((b) => `${b.sourceFile?.relativePath ?? ""}:${b.startLine}`).join(", ")
        report.addTableCell(files)
        report.endTableRow()
      }
      report.endTable()
    }

    report.endSection()
  }
}
