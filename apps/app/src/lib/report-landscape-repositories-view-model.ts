import type { RuntimeReportLandscapeRepositories } from "./runtime-client.js";
import { getHostedReportRepositoryHref } from "./hosted-routes.js";

export type ReportLandscapeRepositoriesCard = {
	readonly label: string;
	readonly value: string;
};

export type ReportLandscapeRepositoriesRow = {
	readonly repoKey: string;
	readonly name: string;
	readonly href: string;
	readonly description: string;
	readonly detail: string;
};

export type ReportLandscapeRepositoriesViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportLandscapeRepositoriesCard>;
	readonly topRepositories: ReadonlyArray<ReportLandscapeRepositoriesRow>;
};

function formatCount(value: number): string {
	return value.toLocaleString("en-GB");
}

export function buildReportLandscapeRepositoriesViewModel(input: {
	readonly slug: string;
	readonly reportName: string;
	readonly repositories: RuntimeReportLandscapeRepositories;
}): ReportLandscapeRepositoriesViewModel {
	return {
		heading: "Repositories",
		subtitle:
			"Portfolio view of repository size, recent activity, contributor spread, and tag coverage.",
		cards: [
			{
				label: "Repositories",
				value: formatCount(input.repositories.totalRepositories),
			},
			{
				label: "Active (30d)",
				value: formatCount(input.repositories.active30d),
			},
			{
				label: "Main LOC",
				value: formatCount(input.repositories.totalMainLoc),
			},
			{
				label: "Avg LOC per Repo",
				value: formatCount(input.repositories.averageMainLoc),
			},
		],
		topRepositories: input.repositories.repositories.slice(0, 12).map((repository) => ({
			repoKey: repository.repoKey,
			name: repository.name,
			href: getHostedReportRepositoryHref(input.slug, repository.repoKey),
			description: repository.description,
			detail: `${formatCount(repository.mainLinesOfCode)} LOC · ${formatCount(repository.commits30d)} commits (30d) · ${formatCount(repository.contributorsCount)} contributors`,
		})),
	};
}
