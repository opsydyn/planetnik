import type { CodeAnalysisResults } from "@planetnik/analyzer";
import type { RichTextReport } from "../core/RichTextReport.js";

export class MetricsReportGenerator {
	static addMetricsToReport(
		report: RichTextReport,
		results: CodeAnalysisResults,
	): void {
		report.startSection("Metrics", "");

		const metrics = results.metricsList.metrics;
		if (metrics.length === 0) return;

		report.startTable();
		report.addTableHeaderLeft("Metric ID", "Description", "Value");

		for (const metric of metrics) {
			report.startTableRow();
			report.addTableCell(metric.id);
			report.addTableCell(metric.description);
			report.addTableCell(`${metric.value}`);
			report.endTableRow();
		}

		report.endTable();
		report.endSection();
	}
}
