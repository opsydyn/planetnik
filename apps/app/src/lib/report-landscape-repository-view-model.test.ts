import { describe, expect, test } from "bun:test";
import { buildReportLandscapeRepositoryViewModel } from "./report-landscape-repository-view-model.js";

describe("report landscape repository view model", () => {
	test("builds hosted repository dashboard cards and contributor rows", () => {
		const viewModel = buildReportLandscapeRepositoryViewModel({
			reportName: "Platform Landscape",
			repository: {
				repoKey: "acme__web-app",
				name: "web-app",
				description: "Customer-facing web application.",
				latestCommitDate: "2026-03-31",
				commits30d: 12,
				commits90d: 34,
				contributorsCount: 4,
				filesCount: 128,
				linesOfCode: 18450,
				duplicationPercentage: 2.4,
				links: [{ label: "Open repository", href: "https://github.com/acme/web-app" }],
				topContributors: [
					{
						email: "alan@example.com",
						displayName: "Alan Currie",
						commitsCount: 18,
						commits30d: 6,
						commits90d: 12,
						firstCommitDate: "2024-01-03",
						latestCommitDate: "2026-03-31",
						type: "Human",
						signal: "Glue",
					},
				],
			},
		});

		expect(viewModel.heading).toBe("web-app");
		expect(viewModel.subtitle).toBe(
			"Repository drilldown within the current hosted landscape report.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "Lines of Code", value: "18,450", detail: null },
			{ label: "Files", value: "128", detail: null },
			{ label: "Contributors", value: "4", detail: null },
			{ label: "Commits (30d)", value: "12", detail: null },
			{ label: "Commits (90d)", value: "34", detail: null },
			{ label: "Latest Commit", value: "2026-03-31", detail: null },
			{ label: "Duplication", value: "2.4%", detail: null },
		]);
		expect(viewModel.contributorRows).toEqual([
			{
				label: "Alan Currie",
				value: "18 commits · 6 (30d) · 12 (90d) · Glue · Human",
			},
		]);
	});
});
