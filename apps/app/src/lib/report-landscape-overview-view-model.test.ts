import { describe, expect, test } from "bun:test";
import { buildReportLandscapeOverviewViewModel } from "./report-landscape-overview-view-model.js";

describe("report landscape overview view model", () => {
	test("builds the hosted landscape dashboard surface from the runtime summary", () => {
		const viewModel = buildReportLandscapeOverviewViewModel({
			slug: "alanpcurrie-landscape",
			overview: {
				title: "Landscape Overview",
				landscapeName: "alanpcurrie Landscape",
				repositoryCount: 40,
				contributorCount: 68,
				teamCount: 0,
				tagCount: 0,
				totals: {
					mainLinesOfCode: 100193,
					totalLinesOfCode: 106484,
					contributorCount30Days: 0,
					commits30d: 0,
					commits90d: 0,
				},
				languages: [
					{ extension: "*.js", linesOfCode: 76844, repositories: 29 },
					{ extension: "*.tsx", linesOfCode: 9986, repositories: 6 },
				],
				topRepositories: [
					{
						name: "laracasts__vue--exercises",
						repoKey: "alanpcurrie/laracasts__vue--exercises",
						mainLinesOfCode: 68397,
						contributors: 1,
						latestCommitDate: "2017-05-31",
					},
				],
			},
		});

		expect(viewModel.heading).toBe("alanpcurrie Landscape");
		expect(viewModel.subtitle).toBe(
			"Multi-repository landscape view across 40 repositories.",
		);
		expect(viewModel.cards[0]).toEqual({
			label: "Repositories",
			value: "40",
		});
		expect(viewModel.cards[4]).toEqual({
			label: "Commits (30d)",
			value: "0",
		});
		expect(viewModel.languageMix).toEqual([
			{ label: "*.js", value: 76844 },
			{ label: "*.tsx", value: 9986 },
		]);
		expect(viewModel.topRepositories[0]).toEqual({
			name: "laracasts__vue--exercises",
			href: "/reports/alanpcurrie-landscape/repositories/alanpcurrie$2Flaracasts__vue--exercises",
			mainLinesOfCode: "68,397",
			contributors: "1",
			latestCommitDate: "2017-05-31",
		});
		expect(viewModel.languageInventory[0]).toEqual({
			extension: "*.js",
			repositories: "29",
			linesOfCode: "76,844",
			percentage: "72.2%",
		});
	});
});
