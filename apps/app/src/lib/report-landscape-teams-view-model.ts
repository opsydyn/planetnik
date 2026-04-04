import type { GridRow } from "@planetnik/report-ui/tables/ReportDataGrid.types";
import type { RuntimeReportLandscapeTeams } from "./runtime-client.js";

export type ReportLandscapeTeamsCard = {
	readonly label: string;
	readonly value: string;
};

export type ReportLandscapeTeamsViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportLandscapeTeamsCard>;
	readonly rows: ReadonlyArray<GridRow>;
};

function formatCount(value: number): string {
	return value.toLocaleString("en-GB");
}

export function buildReportLandscapeTeamsViewModel(input: {
	readonly teams: RuntimeReportLandscapeTeams;
}): ReportLandscapeTeamsViewModel {
	return {
		heading: "Teams",
		subtitle:
			"Team overlays for the landscape. This page is driven by teamsConfig in the landscape configuration.",
		cards: [
			{ label: "Teams", value: formatCount(input.teams.totalTeams) },
			{ label: "Mapped Members", value: formatCount(input.teams.totalMembers) },
			{
				label: "Team Repo Touches",
				value: formatCount(input.teams.totalRepositoryTouches),
			},
		],
		rows: input.teams.teams.map((team) => ({
			id: team.id,
			name: team.name,
			description: team.description || "—",
			commitsCount: team.commitsCount,
			commits30d: team.commits30d,
			memberCount: team.memberCount,
			repositoryCount: team.repositoryCount,
			latestCommitDate: team.latestCommitDate,
			members: team.members.join(" • ") || "—",
			repositories: team.repositories.join(" • ") || "—",
		})),
	};
}
