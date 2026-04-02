import { describe, expect, test } from "bun:test";
import { buildReportContributorDetailViewModel } from "./report-contributor-detail-view-model.js";

describe("report contributor detail view model", () => {
	test("builds contributor drilldown cards and ranked lists", () => {
		const viewModel = buildReportContributorDetailViewModel({
			slug: "effect-ts",
			reportName: "Effect TS",
			contributor: {
				email: "alan@example.com",
				userName: "Alan Currie",
				displayName: "Alan Currie",
				status: "Active",
				commitsCount: 42,
				commitsCount30Days: 8,
				commitsCount90Days: 16,
				commitsCount180Days: 24,
				commitsCount365Days: 32,
				firstCommitDate: "2024-01-03",
				latestCommitDate: "2026-03-31",
				percentage: "14.2",
				activeDays: 18,
				filesCount: 12,
				collaboratorsCount: 4,
				topCollaboratorEmail: "sam@example.com",
				topCollaboratorDisplayName: "Sam Example",
				extensions: [
					{ extension: "ts", commits: 30, files: 8 },
					{ extension: "astro", commits: 12, files: 4 },
				],
				logicalComponents: [
					{ name: "runtime", files: 6, linesOfCode: 4200 },
					{ name: "reports", files: 4, linesOfCode: 1900 },
				],
				collaborators: [
					{
						email: "sam@example.com",
						displayName: "Sam Example",
						sharedFiles: 6,
					},
				],
				topFiles: [
					{
						relativePath: "src/routes/reports/index.ts",
						extension: "ts",
						commits: 12,
						logicalComponents: ["runtime"],
						concerns: ["api"],
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Alan Currie");
		expect(viewModel.subtitle).toBe(
			"Contributor drilldown for the linked Planetnik report dataset.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "All-Time Commits", value: "42", detail: null },
			{ label: "Active Days", value: "18", detail: null },
			{ label: "Files Touched", value: "12", detail: null },
			{ label: "Collaborators", value: "4", detail: "Top collaborator: Sam Example" },
		]);
		expect(viewModel.facts).toEqual([
			{ label: "Email", value: "alan@example.com" },
			{ label: "Status", value: "Active" },
			{ label: "Commit Share", value: "14.2" },
			{ label: "30 / 90 / 180 / 365 Days", value: "8 / 16 / 24 / 32" },
			{ label: "First Commit", value: "2024-01-03" },
			{ label: "Latest Commit", value: "2026-03-31" },
		]);
		expect(viewModel.extensions).toEqual([
			{ label: ".ts", value: "30 commits across 8 files" },
			{ label: ".astro", value: "12 commits across 4 files" },
		]);
		expect(viewModel.components).toEqual([
			{ label: "runtime", value: "4,200 loc across 6 files" },
			{ label: "reports", value: "1,900 loc across 4 files" },
		]);
		expect(viewModel.topFiles).toEqual([
			{
				label: "src/routes/reports/index.ts",
				value: "12 commits · runtime · api",
			},
		]);
		expect(viewModel.backHref).toBe("/reports/effect-ts/contributors");
	});
});
