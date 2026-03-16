import type { NumericMetric } from "@planetnik/analyzer"
import { FormattingUtils } from "@planetnik/common"
import { SimpleOneBarChart } from "../charts/SimpleOneBarChart.js"
import type { RichTextReport } from "../core/RichTextReport.js"

export class ChartUtils {
  static addVolumeBarChart(report: RichTextReport, metrics: NumericMetric[], activeColor = "#00aced"): void {
    const filtered = metrics.filter((m) => m.value > 0)
    if (filtered.length === 0) return

    const maxValue = Math.max(...filtered.map((m) => m.value))

    const chart = new SimpleOneBarChart()
    chart.width = 800
    chart.maxBarWidth = 200
    chart.barHeight = 20
    chart.activeColor = activeColor

    report.startDiv("width: 100%; overflow-x: auto")
    for (const metric of filtered) {
      const percentage = (100.0 * metric.value) / maxValue
      const textRight = `${FormattingUtils.formatCount(metric.value)} LOC (${FormattingUtils.getFormattedPercentage(percentage)}%)`
      report.addContentInDiv(chart.getPercentageSvg(percentage, metric.name, textRight))
    }
    report.endDiv()
  }
}
