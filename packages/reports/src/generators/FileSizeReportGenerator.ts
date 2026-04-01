import type { CodeAnalysisResults } from "@planetnik/analyzer";
import type { RichTextReport } from "../core/RichTextReport.js";
import { RiskDistributionReportUtils } from "./RiskDistributionReportUtils.js";

export class FileSizeReportGenerator {
	static addFileSizeToReport(
		report: RichTextReport,
		results: CodeAnalysisResults,
	): void {
		report.startSection("File Size", "");

		const filesResults = results.filesAnalysisResults;
		if (!filesResults) return;

		// Overall distribution
		if (filesResults.overallFileSizeDistribution) {
			report.addLevel3Header("Overall File Size Distribution");
			RiskDistributionReportUtils.addRiskDistributionTable(
				report,
				filesResults.overallFileSizeDistribution,
			);
		}

		// Per-extension distributions
		if (filesResults.fileSizeDistributionPerExtension.length > 0) {
			report.addLevel3Header("File Size Distribution Per Extension");
			for (const dist of filesResults.fileSizeDistributionPerExtension) {
				RiskDistributionReportUtils.addRiskDistributionTable(report, dist);
			}
		}

		// Longest files
		if (filesResults.longestFiles.length > 0) {
			report.addLevel3Header("Longest Files");
			report.startTable();
			report.addTableHeaderLeft("File", "Lines of Code");
			for (const file of filesResults.longestFiles) {
				report.startTableRow();
				report.addTableCell(file.relativePath);
				report.addTableCell(`${file.linesOfCode}`);
				report.endTableRow();
			}
			report.endTable();
		}

		report.endSection();
	}
}
