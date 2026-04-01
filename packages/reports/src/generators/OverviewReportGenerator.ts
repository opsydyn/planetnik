import type { CodeAnalysisResults } from "@planetnik/analyzer";
import type { RichTextReport } from "../core/RichTextReport.js";

export class OverviewReportGenerator {
	static addScopeAnalysisToReport(
		report: RichTextReport,
		results: CodeAnalysisResults,
	): void {
		const main = results.mainAspectAnalysisResults;
		if (!main) return;

		report.startSection("Source Code Overview", "");

		report.startTable();
		report.addTableHeaderLeft("Metric", "Value");
		report.startTableRow();
		report.addTableCell("Main source files");
		report.addTableCell(`${main.filesCount}`);
		report.endTableRow();
		report.startTableRow();
		report.addTableCell("Lines of code (main)");
		report.addTableCell(`${main.linesOfCode}`);
		report.endTableRow();

		// Per-extension breakdown
		if (main.linesOfCodePerExtension.length > 0) {
			for (const ext of main.linesOfCodePerExtension) {
				report.startTableRow();
				report.addTableCell(`  - ${ext.name}`);
				report.addTableCell(`${ext.value}`);
				report.endTableRow();
			}
		}

		// Duplication
		const dup = results.duplicationAnalysisResults.overallDuplication;
		report.startTableRow();
		report.addTableCell("Duplication");
		report.addTableCell(`${dup.getDuplicationPercentage().toFixed(1)}%`);
		report.endTableRow();

		// Units
		const units = results.unitsAnalysisResults;
		report.startTableRow();
		report.addTableCell("Units (functions/methods)");
		report.addTableCell(`${units.allUnits.length}`);
		report.endTableRow();

		report.endTable();
		report.endSection();
	}
}
