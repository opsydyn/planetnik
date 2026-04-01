import type { CodeAnalysisResults } from "@planetnik/analyzer";
import type { RichTextReport } from "../core/RichTextReport.js";

export class TrendReportGenerator {
	static addTrendToReport(
		report: RichTextReport,
		_results: CodeAnalysisResults,
	): void {
		report.startSection("Intro", "");
		report.startUnorderedList();
		report.addListItem(
			"Trend report shows difference in metrics between the latest measurements and previous reference measurements.",
		);
		report.endUnorderedList();
		report.endSection();

		// Trend analysis requires reference results stored as zip files
		// This is a placeholder that matches the Java structure
		report.addParagraph("No reference analysis results have been defined.");
	}
}
