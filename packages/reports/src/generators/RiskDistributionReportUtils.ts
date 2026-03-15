import type { RiskDistributionStats } from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"

export class RiskDistributionReportUtils {
  static addRiskDistributionTable(report: RichTextReport, stats: RiskDistributionStats): void {
    if (stats.key) {
      report.addLevel4Header(stats.key)
    }

    report.startTable()
    report.addTableHeaderLeft("Risk", "Count", "Lines of Code", "Percentage")

    const total = stats.getTotalValue()
    const rows = [
      ["Negligible", stats.negligibleRiskCount, stats.negligibleRiskValue],
      ["Low", stats.lowRiskCount, stats.lowRiskValue],
      ["Medium", stats.mediumRiskCount, stats.mediumRiskValue],
      ["High", stats.highRiskCount, stats.highRiskValue],
      ["Very High", stats.veryHighRiskCount, stats.veryHighRiskValue],
    ] as const

    for (const [label, count, value] of rows) {
      const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0"
      report.startTableRow()
      report.addTableCell(label)
      report.addTableCell(`${count}`)
      report.addTableCell(`${value}`)
      report.addTableCell(`${pct}%`)
      report.endTableRow()
    }

    report.endTable()
  }
}
