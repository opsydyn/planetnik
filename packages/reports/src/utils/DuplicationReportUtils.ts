import type { DuplicationMetric } from "@planetnik/analyzer";
import { FormattingUtils } from "@planetnik/common";
import { Alignment, SimpleOneBarChart } from "../charts/SimpleOneBarChart.js";
import type { RichTextReport } from "../core/RichTextReport.js";

export class DuplicationReportUtils {
	static addDuplicationPerAspect(
		report: RichTextReport,
		duplicationMetrics: DuplicationMetric[],
	): void {
		const chart = new SimpleOneBarChart();
		chart.width = 800;
		chart.barHeight = 20;
		chart.alignment = Alignment.LEFT;
		chart.activeColor = "crimson";
		chart.backgroundColor = "green";

		let maxCleanedLines = 1;
		for (const metric of duplicationMetrics) {
			maxCleanedLines = Math.max(maxCleanedLines, metric.cleanedLinesOfCode);
		}

		report.startDiv(
			"width: 100%; overflow-x: auto; max-height: 300px; overflow-y: scroll;",
		);

		const sorted = [...duplicationMetrics].sort(
			(a, b) => b.duplicatedLinesOfCode - a.duplicatedLinesOfCode,
		);
		for (const metric of sorted) {
			chart.maxBarWidth = Math.floor(
				(200.0 * metric.cleanedLinesOfCode) / maxCleanedLines,
			);
			const percentage =
				(100.0 * metric.duplicatedLinesOfCode) / metric.cleanedLinesOfCode;
			const textRight = `${FormattingUtils.getFormattedPercentage(percentage)}% (${FormattingUtils.formatCount(metric.duplicatedLinesOfCode)} lines)`;
			const svg = chart.getPercentageSvg(percentage, metric.key, textRight);
			report.addContentInDiv(svg);
		}

		report.endDiv();
	}

	static addOverallDuplication(
		report: RichTextReport,
		metric: DuplicationMetric,
	): void {
		const chart = new SimpleOneBarChart();
		chart.width = 800;
		chart.barHeight = 40;
		chart.alignment = Alignment.LEFT;
		chart.activeColor = "crimson";
		chart.backgroundColor = "green";
		chart.maxBarWidth = 200;

		const percentage =
			(100.0 * metric.duplicatedLinesOfCode) / metric.cleanedLinesOfCode;
		const textRight = `${FormattingUtils.getFormattedPercentage(percentage)}% (${FormattingUtils.formatCount(metric.duplicatedLinesOfCode)} lines)`;
		const svg = chart.getPercentageSvg(percentage, metric.key, textRight);

		report.startDiv("width: 100%; overflow-x: auto");
		report.addContentInDiv(svg);
		report.endDiv();
	}
}
