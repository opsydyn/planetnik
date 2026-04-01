import type {
	CodeAnalysisResults,
	FilesHistoryAnalysisResults,
	SourceFile as SourceFileType,
} from "@planetnik/analyzer";
import type { RichTextReport } from "../core/RichTextReport.js";
import { RiskDistributionReportUtils } from "./RiskDistributionReportUtils.js";

export class FileHistoryReportGenerator {
	static addFileHistoryToReport(
		report: RichTextReport,
		results: CodeAnalysisResults,
	): void {
		const histResults = results.filesHistoryAnalysisResults;

		report.addParagraph(
			"File age measurements show the distribution of file ages (days since the first commit) and the file freshness (days since the latest commit).",
			"margin-top: 12px; color: grey",
		);

		FileHistoryReportGenerator.addSummary(report, results, histResults);
		FileHistoryReportGenerator.addAgeDistribution(report, histResults);
		FileHistoryReportGenerator.addFreshnessDistribution(report, histResults);
		FileHistoryReportGenerator.addFileListSections(report, histResults);
	}

	private static addSummary(
		report: RichTextReport,
		results: CodeAnalysisResults,
		histResults: FilesHistoryAnalysisResults,
	): void {
		if (histResults.history.length === 0) return;

		report.startSection("Summary", "");
		report.startUnorderedList();
		report.addListItem(
			`Number of files: <b>${results.mainAspectAnalysisResults.filesCount}</b>`,
		);
		report.addListItem(`First update: <b>${histResults.firstDate}</b>`);
		report.addListItem(`Latest update: <b>${histResults.latestDate}</b>`);
		report.addListItem(
			`Days between first and latest update: <b>${histResults.daysBetweenFirstAndLastDate}</b> (${histResults.weeksBetweenFirstAndLastDate} weeks, estimated ${histResults.estimatedWorkingDays} working days)`,
		);
		report.addListItem(
			`Active days (at least one file change): <b>${histResults.activeDays}</b>`,
		);
		if (histResults.filesWithoutCommitHistoryCount > 0) {
			report.addListItem(
				`Files without commit history (ignored): <b>${histResults.filesWithoutCommitHistoryCount}</b> (${histResults.filesWithoutCommitHistoryLinesOfCode} lines of code)`,
			);
		}
		report.endUnorderedList();
		report.endSection();
	}

	private static addAgeDistribution(
		report: RichTextReport,
		histResults: FilesHistoryAnalysisResults,
	): void {
		if (!histResults.ageRiskDistribution) return;

		report.startSection("File Age Distribution", "Days since first update");
		RiskDistributionReportUtils.addRiskDistributionTable(
			report,
			histResults.ageRiskDistribution,
		);

		if (histResults.ageRiskDistributionPerExtension.length > 0) {
			report.startSubSection("Per Extension", "");
			for (const dist of histResults.ageRiskDistributionPerExtension) {
				RiskDistributionReportUtils.addRiskDistributionTable(report, dist);
			}
		}
		report.endSection();
	}

	private static addFreshnessDistribution(
		report: RichTextReport,
		histResults: FilesHistoryAnalysisResults,
	): void {
		if (!histResults.freshnesssRiskDistribution) return;

		report.startSection(
			"File Freshness Distribution",
			"Days since last update",
		);
		RiskDistributionReportUtils.addRiskDistributionTable(
			report,
			histResults.freshnesssRiskDistribution,
		);

		if (histResults.freshnesssRiskDistributionPerExtension.length > 0) {
			report.startSubSection("Per Extension", "");
			for (const dist of histResults.freshnesssRiskDistributionPerExtension) {
				RiskDistributionReportUtils.addRiskDistributionTable(report, dist);
			}
		}
		report.endSection();
	}

	private static addFileListSections(
		report: RichTextReport,
		histResults: FilesHistoryAnalysisResults,
	): void {
		FileHistoryReportGenerator.addFileList(
			report,
			"Oldest Files",
			histResults.oldestFiles,
		);
		FileHistoryReportGenerator.addFileList(
			report,
			"Files Not Recently Changed",
			histResults.mostPreviouslyChangedFiles,
		);
		FileHistoryReportGenerator.addFileList(
			report,
			"Youngest Files",
			histResults.youngestFiles,
		);
		FileHistoryReportGenerator.addFileList(
			report,
			"Most Recently Changed Files",
			histResults.mostRecentlyChangedFiles,
		);
	}

	private static addFileList(
		report: RichTextReport,
		title: string,
		files: SourceFileType[],
	): void {
		if (files.length === 0) return;

		report.startSection(`${title} (Top ${files.length})`, "");
		report.startTable();
		report.addTableHeaderLeft(
			"File",
			"Lines of Code",
			"First Changed",
			"Last Changed",
			"Changes",
		);

		for (const file of files) {
			const fmh = file.fileModificationHistory;
			report.startTableRow();
			report.addTableCell(file.relativePath);
			report.addTableCell(`${file.linesOfCode}`);
			report.addTableCell(fmh?.getOldestDate() ?? "");
			report.addTableCell(fmh?.getLatestDate() ?? "");
			report.addTableCell(`${fmh?.dates?.length ?? 0}`);
			report.endTableRow();
		}

		report.endTable();
		report.endSection();
	}
}
