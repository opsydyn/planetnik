import type { RuntimeReportContributor } from "./runtime-client.js";

export type ReportContributorsCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportContributorsRow = {
	readonly contributor: string;
	readonly email: string;
	readonly status: string;
	readonly allTime: string;
	readonly commits30Days: string;
	readonly componentsTouched: string;
	readonly primaryComponent: string;
	readonly knowledgeSignal: string;
	readonly href: string;
};

export type ReportContributorsViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportContributorsCard>;
	readonly rows: ReadonlyArray<ReportContributorsRow>;
};

export function buildReportContributorsViewModel(input: {
	readonly slug: string;
	readonly reportName: string;
	readonly contributors: ReadonlyArray<RuntimeReportContributor>;
}): ReportContributorsViewModel {
	const totalCommits = input.contributors.reduce(
		(sum, contributor) => sum + contributor.commitsAllTime,
		0,
	);
	const topContributorShare =
		totalCommits > 0 && input.contributors[0]
			? (input.contributors[0].commitsAllTime / totalCommits) * 100
			: 0;
	const singleComponentSpecialists = input.contributors.filter(
		(contributor) => contributor.componentsTouched === 1,
	).length;
	const crossComponentContributors = input.contributors.filter(
		(contributor) =>
			contributor.componentsTouched !== null &&
			contributor.componentsTouched >= 3,
	).length;

	return {
		heading: input.reportName,
		subtitle:
			"Contributor activity and knowledge spread from the linked Planetnik dataset.",
		cards: [
			{
				label: "Contributors",
				value: input.contributors.length.toLocaleString("en-GB"),
				detail: `${totalCommits.toLocaleString("en-GB")} total commits`,
			},
			{
				label: "Top Contributor Share",
				value: `${topContributorShare.toFixed(1)}%`,
				detail: null,
			},
			{
				label: "Single-Component Specialists",
				value: singleComponentSpecialists.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "Cross-Component Contributors",
				value: crossComponentContributors.toLocaleString("en-GB"),
				detail: null,
			},
		],
		rows: input.contributors.map((contributor) => ({
			contributor: contributor.displayName,
			email: contributor.userName.trim().length > 0 ? contributor.email : "",
			status: contributor.status,
			allTime: contributor.commitsAllTime.toLocaleString("en-GB"),
			commits30Days: contributor.commits30Days.toLocaleString("en-GB"),
			componentsTouched:
				contributor.componentsTouched?.toLocaleString("en-GB") ?? "",
			primaryComponent: contributor.primaryComponent,
			knowledgeSignal: contributor.knowledgeSignal,
			href: `/reports/${input.slug}/contributors/${contributor.email}`,
		})),
	};
}
