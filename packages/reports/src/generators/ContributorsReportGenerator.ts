import type {
	CodeAnalysisResults,
	ContributorsAnalysisResults,
} from "@planetnik/analyzer";
import type { RichTextReport } from "../core/RichTextReport.js";

export class ContributorsReportGenerator {
	static addContributorsToReport(
		report: RichTextReport,
		results: CodeAnalysisResults,
	): void {
		const contribResults = results.contributorsAnalysisResults;

		report.addParagraph(
			"An overview of contributor trends.",
			"margin-top: 12px; color: grey",
		);

		ContributorsReportGenerator.addSummary(report, contribResults);
		ContributorsReportGenerator.addContributorsList(report, contribResults);
		ContributorsReportGenerator.addContributorsPerYear(report, contribResults);
		ContributorsReportGenerator.addContributorsPerMonth(report, contribResults);
		ContributorsReportGenerator.addPeopleDependencies(report, contribResults);
	}

	private static addSummary(
		report: RichTextReport,
		contribResults: ContributorsAnalysisResults,
	): void {
		report.startSection("Summary", "");
		report.startUnorderedList();
		report.addListItem(
			`Total contributors: <b>${contribResults.contributors.length}</b>`,
		);
		report.addListItem(
			`Latest commit: <b>${contribResults.latestCommitDate}</b>`,
		);

		const active30 = contribResults.contributors.filter(
			(c) => c.commitsCount30Days > 0,
		).length;
		const active90 = contribResults.contributors.filter(
			(c) => c.commitsCount90Days > 0,
		).length;
		const active180 = contribResults.contributors.filter(
			(c) => c.commitsCount180Days > 0,
		).length;
		const active365 = contribResults.contributors.filter(
			(c) => c.commitsCount365Days > 0,
		).length;

		report.addListItem(
			`Active contributors (past 30 days): <b>${active30}</b>`,
		);
		report.addListItem(
			`Active contributors (past 90 days): <b>${active90}</b>`,
		);
		report.addListItem(
			`Active contributors (past 6 months): <b>${active180}</b>`,
		);
		report.addListItem(`Active contributors (past year): <b>${active365}</b>`);
		report.endUnorderedList();
		report.endSection();
	}

	private static addContributorsList(
		report: RichTextReport,
		contribResults: ContributorsAnalysisResults,
	): void {
		if (contribResults.contributors.length === 0) return;

		report.startSection("Contributors", "Sorted by total commits");
		report.startTable();
		report.addTableHeaderLeft(
			"Contributor",
			"Total Commits",
			"30 Days",
			"90 Days",
			"6 Months",
			"1 Year",
			"First Commit",
			"Latest Commit",
		);

		for (const contrib of contribResults.contributors.slice(0, 100)) {
			report.startTableRow();
			report.addTableCell(contrib.email);
			report.addTableCell(`${contrib.commitsCount}`);
			report.addTableCell(`${contrib.commitsCount30Days}`);
			report.addTableCell(`${contrib.commitsCount90Days}`);
			report.addTableCell(`${contrib.commitsCount180Days}`);
			report.addTableCell(`${contrib.commitsCount365Days}`);
			report.addTableCell(contrib.firstCommitDate);
			report.addTableCell(contrib.latestCommitDate);
			report.endTableRow();
		}

		report.endTable();
		report.endSection();
	}

	private static addContributorsPerYear(
		report: RichTextReport,
		contribResults: ContributorsAnalysisResults,
	): void {
		if (contribResults.contributorsPerYear.length === 0) return;

		report.startSection("Contributors Per Year", "");
		report.startTable();
		report.addTableHeaderLeft("Year", "Contributors");

		for (const slot of contribResults.contributorsPerYear) {
			report.startTableRow();
			report.addTableCell(slot.timeSlot);
			report.addTableCell(`${slot.contributorsCount}`);
			report.endTableRow();
		}

		report.endTable();
		report.endSection();
	}

	private static addContributorsPerMonth(
		report: RichTextReport,
		contribResults: ContributorsAnalysisResults,
	): void {
		if (contribResults.contributorsPerMonth.length === 0) return;

		report.startSection("Contributors Per Month", "");
		report.startTable();
		report.addTableHeaderLeft("Month", "Contributors");

		for (const slot of contribResults.contributorsPerMonth.slice(0, 36)) {
			report.startTableRow();
			report.addTableCell(slot.timeSlot);
			report.addTableCell(`${slot.contributorsCount}`);
			report.endTableRow();
		}

		report.endTable();
		report.endSection();
	}

	private static addPeopleDependencies(
		report: RichTextReport,
		contribResults: ContributorsAnalysisResults,
	): void {
		if (contribResults.peopleDependencies.length === 0) return;

		report.startSection(
			"People Dependencies",
			"Contributors who work on the same files",
		);
		report.startTable();
		report.addTableHeaderLeft("Contributor 1", "Contributor 2", "Shared Files");

		for (const dep of contribResults.peopleDependencies.slice(0, 50)) {
			report.startTableRow();
			report.addTableCell(dep.fromComponent);
			report.addTableCell(dep.toComponent);
			report.addTableCell(`${dep.count}`);
			report.endTableRow();
		}

		report.endTable();
		report.endSection();
	}
}
