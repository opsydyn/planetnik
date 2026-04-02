import { describe, expect, test } from "bun:test";
import { buildReportContributorsViewModel } from "./report-contributors-view-model.js";

describe("report contributors view model", () => {
	test("builds hosted contributor summary cards and rows", () => {
		const viewModel = buildReportContributorsViewModel({
			slug: "effect-ts",
			reportName: "Effect TS",
			contributors: [
				{
					email: "alan@example.com",
					userName: "Alan Currie",
					displayName: "Alan Currie",
					status: "Active",
					commitsAllTime: 42,
					commits30Days: 8,
					commits90Days: 16,
					commits180Days: 24,
					commits365Days: 32,
					firstCommit: "2024-01-03",
					lastCommit: "2026-03-31",
					percentage: "14.2",
					filesTouched: 12,
					componentsTouched: 1,
					primaryComponent: "runtime",
					knowledgeSignal: "Single-component specialist",
				},
				{
					email: "sam@example.com",
					userName: "",
					displayName: "sam@example.com",
					status: "Rookie",
					commitsAllTime: 8,
					commits30Days: 8,
					commits90Days: 8,
					commits180Days: 8,
					commits365Days: 8,
					firstCommit: "2026-02-18",
					lastCommit: "2026-03-30",
					percentage: "2.7",
					filesTouched: 4,
					componentsTouched: 5,
					primaryComponent: "reports",
					knowledgeSignal: "Cross-context knowledge",
				},
			],
		});

		expect(viewModel.heading).toBe("Effect TS");
		expect(viewModel.subtitle).toBe(
			"Contributor activity and knowledge spread from the linked Planetnik dataset.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "Contributors", value: "2", detail: "50 total commits" },
			{ label: "Top Contributor Share", value: "84.0%", detail: null },
			{ label: "Single-Component Specialists", value: "1", detail: null },
			{ label: "Cross-Component Contributors", value: "1", detail: null },
		]);
		expect(viewModel.rows).toEqual([
			{
				contributor: "Alan Currie",
				email: "alan@example.com",
				status: "Active",
				allTime: "42",
				commits30Days: "8",
				componentsTouched: "1",
				primaryComponent: "runtime",
				knowledgeSignal: "Single-component specialist",
				href: "/reports/effect-ts/contributors/alan@example.com",
			},
			{
				contributor: "sam@example.com",
				email: "",
				status: "Rookie",
				allTime: "8",
				commits30Days: "8",
				componentsTouched: "5",
				primaryComponent: "reports",
				knowledgeSignal: "Cross-context knowledge",
				href: "/reports/effect-ts/contributors/sam@example.com",
			},
		]);
	});
});
