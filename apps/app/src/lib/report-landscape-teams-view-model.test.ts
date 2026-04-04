import { describe, expect, test } from "bun:test";
import { buildReportLandscapeTeamsViewModel } from "./report-landscape-teams-view-model.js";

describe("report landscape teams view model", () => {
	test("builds cards and rows for the landscape teams inventory", () => {
		const viewModel = buildReportLandscapeTeamsViewModel({
			teams: {
				totalTeams: 2,
				totalMembers: 6,
				totalRepositoryTouches: 5,
				teams: [
					{
						id: "Platform",
						name: "Platform",
						description: "Shared platform capabilities.",
						commitsCount: 120,
						commits30d: 18,
						memberCount: 4,
						repositoryCount: 3,
						latestCommitDate: "2026-03-31",
						members: ["Alan", "Sam", "Nina", "Jay"],
						repositories: ["web-app", "api", "infra"],
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Teams");
		expect(viewModel.cards).toEqual([
			{ label: "Teams", value: "2" },
			{ label: "Mapped Members", value: "6" },
			{ label: "Team Repo Touches", value: "5" },
		]);
		expect(viewModel.rows).toEqual([
			{
				id: "Platform",
				name: "Platform",
				description: "Shared platform capabilities.",
				commitsCount: 120,
				commits30d: 18,
				memberCount: 4,
				repositoryCount: 3,
				latestCommitDate: "2026-03-31",
				members: "Alan • Sam • Nina • Jay",
				repositories: "web-app • api • infra",
			},
		]);
	});
});
