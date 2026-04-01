import type { RiskDistributionStats } from "@planetnik/analyzer";
import { FormattingUtils, Palette } from "@planetnik/common";
import { SimpleOneBarChart } from "../charts/SimpleOneBarChart.js";
import { RiskDistributionReportUtils } from "../generators/RiskDistributionReportUtils.js";

export class PieChartUtils {
	static getRiskDistributionChart(
		distribution: RiskDistributionStats,
		labels: string[],
		palette: Palette = Palette.getRiskPalette(),
	): string {
		const chart = new SimpleOneBarChart();
		chart.width = 800;
		chart.barHeight = 100;
		chart.maxBarWidth = 400;
		chart.barStartXOffset = 0;

		const totalValue = distribution.getTotalValue();
		const values = RiskDistributionReportUtils.getRowData(distribution);

		const joinedValues = values
			.map(
				(v) =>
					`${FormattingUtils.getFormattedPercentage((100.0 * v) / totalValue)}%`,
			)
			.join(" | ");

		const stackedBarSvg = chart.getStackedBarSvg(
			values,
			palette,
			distribution.key,
			joinedValues,
		);

		let html = "<div style='width: 100%; overflow-x: auto'>";
		html += `<div>${stackedBarSvg}</div>`;
		html +=
			"<div style='font-size:90%;margin-top:20px;width:100%;text-alight:right'>";
		html += `Legend: ${chart.getLegend(labels, palette)}`;
		html += "</div>";
		html += "</div>";

		return html;
	}
}
