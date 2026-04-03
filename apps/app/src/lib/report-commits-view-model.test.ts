import { describe, expect, test } from "bun:test";
import { buildReportCommitsViewModel } from "./report-commits-view-model.js";

describe("report commits view model", () => {
	test("builds hosted commit summary cards and sections", () => {
		const viewModel = buildReportCommitsViewModel({
			reportName: "Effect TS",
			commits: {
				totalCommits: 64,
				totalContributors: 3,
				activeContributors: {
					days30: 2,
					days90: 3,
					days365: 3,
				},
				repoAgeDays: 420,
				activeDays: 118,
				rookieCount: 1,
				activity: [
					{ label: "Past 30 days", value: 2, detail: "2 contributors" },
					{ label: "Past 90 days", value: 3, detail: "3 contributors" },
				],
				timeline: [
					{ timeSlot: "2024", commits: 18, contributors: 2 },
					{ timeSlot: "2025", commits: 22, contributors: 3 },
				],
				extensions: [
					{
						extension: "ts",
						commitsCount: 42,
						committersCount: 3,
						filesCount: 16,
						commitsCount30Days: 8,
						commitsCount90Days: 18,
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Effect TS");
		expect(viewModel.subtitle).toBe(
			"Commit activity and contributor cadence from the linked Planetnik dataset.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "Total Commits", value: "64", detail: null },
			{ label: "All-Time Contributors", value: "3", detail: null },
			{ label: "Active (30d)", value: "2", detail: null },
			{ label: "Rookies", value: "1", detail: null },
		]);
		expect(viewModel.sections).toEqual([
			{
				title: "Active contributors over time",
				rows: [
					{ label: "Past 30 days", value: "2 contributors" },
					{ label: "Past 90 days", value: "3 contributors" },
				],
			},
			{
				title: "Commits and contributors per year",
				rows: [
					{ label: "2024", value: "18 commits · 2 contributors" },
					{ label: "2025", value: "22 commits · 3 contributors" },
				],
			},
			{
				title: "Commits by file extension",
				rows: [
					{
						label: ".ts",
						value: "42 commits · 3 committers · 16 files · 8 (30d) · 18 (90d)",
					},
				],
			},
		]);
	});
});
