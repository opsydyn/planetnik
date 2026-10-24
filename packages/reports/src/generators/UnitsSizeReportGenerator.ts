import type { CodeAnalysisResults } from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"
import { RiskDistributionReportUtils } from "./RiskDistributionReportUtils.js"

export class UnitsSizeReportGenerator {
  static addUnitsSizeToReport(report: RichTextReport, results: CodeAnalysisResults): void {
    report.startSection("Unit Size", "")

    const unitsResults = results.unitsAnalysisResults

    // Unit size distribution
    if (unitsResults.unitSizeRiskDistribution) {
      report.addLevel3Header("Unit Size Distribution")
      RiskDistributionReportUtils.addRiskDistributionTable(report, unitsResults.unitSizeRiskDistribution)
    }

    // Longest units
    if (unitsResults.longestUnits.length > 0) {
      report.addLevel3Header("Longest Units")
      report.startTable()
      report.addTableHeaderLeft("Unit", "File", "Lines", "McCabe Index")
      for (const unit of unitsResults.longestUnits) {
        report.startTableRow()
        report.addTableCell(unit.shortName)
        report.addTableCell(unit.sourceFile?.relativePath ?? "")
        report.addTableCell(`${unit.linesOfCode}`)
        report.addTableCell(`${unit.mcCabeIndex}`)
        report.endTableRow()
      }
      report.endTable()
    }

    report.endSection()
  }
}
