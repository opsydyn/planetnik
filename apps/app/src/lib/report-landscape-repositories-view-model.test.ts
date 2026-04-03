import { describe, expect, test } from "bun:test";
import { buildReportLandscapeRepositoriesViewModel } from "./report-landscape-repositories-view-model.js";

describe("report landscape repositories view model", () => {
	test("builds hosted landscape repository discovery cards and rows", () => {
		const viewModel = buildReportLandscapeRepositoriesViewModel({
			slug: "platform-landscape",
			reportName: "Platform Landscape",
			repositories: {
				totalRepositories: 2,
				active30d: 1,
				totalMainLoc: 27650,
				averageMainLoc: 13825,
				repositories: [
					{
						repoKey: "acme__web-app",
						name: "web-app",
						description: "Customer-facing application.",
						mainLinesOfCode: 18450,
						mainFilesCount: 128,
						commits30d: 12,
						commits90d: 34,
						contributorsCount: 4,
						contributors30d: 2,
						latestCommitDate: "2026-03-31",
						tags: ["Web"],
					},
					{
						repoKey: "acme__api",
						name: "api",
						description: "Public API.",
						mainLinesOfCode: 9200,
						mainFilesCount: 76,
						commits30d: 0,
						commits90d: 11,
						contributorsCount: 3,
						contributors30d: 0,
						latestCommitDate: "2026-03-18",
						tags: ["Backend"],
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Repositories");
		expect(viewModel.cards).toEqual([
			{ label: "Repositories", value: "2" },
			{ label: "Active (30d)", value: "1" },
			{ label: "Main LOC", value: "27,650" },
			{ label: "Avg LOC per Repo", value: "13,825" },
		]);
		expect(viewModel.topRepositories[0]).toEqual({
			repoKey: "acme__web-app",
			name: "web-app",
			href: "/reports/platform-landscape/repositories/acme__web-app",
			description: "Customer-facing application.",
			detail: "18,450 LOC · 12 commits (30d) · 4 contributors",
		});
	});

	test("encodes repository route params so slash-delimited repo keys remain one segment", () => {
		const viewModel = buildReportLandscapeRepositoriesViewModel({
			slug: "alanpcurrie-landscape",
			reportName: "alanpcurrie Landscape",
			repositories: {
				totalRepositories: 1,
				active30d: 0,
				totalMainLoc: 1112,
				averageMainLoc: 1112,
				repositories: [
					{
						repoKey: "alanpcurrie/fullstack-graphql",
						name: "fullstack-graphql",
						description: "Fullstack GraphQL project.",
						mainLinesOfCode: 1112,
						mainFilesCount: 42,
						commits30d: 0,
						commits90d: 3,
						contributorsCount: 1,
						contributors30d: 0,
						latestCommitDate: "2026-03-15",
						tags: [],
					},
				],
			},
		});

		expect(viewModel.topRepositories[0]?.href).toBe(
			"/reports/alanpcurrie-landscape/repositories/alanpcurrie$2Ffullstack-graphql",
		);
	});
});
