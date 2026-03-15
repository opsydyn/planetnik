import type { CodeAnalysisResults } from "@planetnik/analyzer"
import { Range } from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"

export class ControlsReportGenerator {
  static addControlsToReport(report: RichTextReport, results: CodeAnalysisResults): void {
    const goalsResults = results.controlResults.goalsAnalysisResults
    if (goalsResults.length === 0) return

    report.startSection("Goals & Controls", "")

    for (const goalResult of goalsResults) {
      const goal = goalResult.metricsWithGoal?.goal || "Controls"
      report.addLevel3Header(goal)

      report.startTable()
      report.addTableHeaderLeft("Metric", "Value", "Desired Range", "Status")

      for (const controlStatus of goalResult.controlStatuses) {
        const metricName = controlStatus.control?.metric ?? ""
        const metricValue = controlStatus.metric ? `${controlStatus.metric.value}` : ""
        const desiredRange = controlStatus.control ? Range.getTextDescription(controlStatus.control.desiredRange) : ""
        const status = controlStatus.status
        const statusStyle = status === "OK" ? "color: green" : status === "FAILED" ? "color: red" : "color: orange"

        report.startTableRow()
        report.addTableCell(metricName)
        report.addTableCell(metricValue)
        report.addTableCell(desiredRange)
        report.addTableCell(status, statusStyle)
        report.endTableRow()
      }

      report.endTable()
    }

    report.endSection()
  }
}
