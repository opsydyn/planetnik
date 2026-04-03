import type { RuntimeReportLandscapeRepository } from "./runtime-client.js";

export type ReportLandscapeRepositoryCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportLandscapeRepositoryRow = {
	readonly label: string;
	readonly value: string;
};

export type ReportLandscapeRepositoryViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportLandscapeRepositoryCard>;
	readonly contributorRows: ReadonlyArray<ReportLandscapeRepositoryRow>;
};

function formatCount(value: number): string {
	return value.toLocaleString("en-GB");
}

export function buildReportLandscapeRepositoryViewModel(input: {
	readonly reportName: string;
	readonly repository: RuntimeReportLandscapeRepository;
}): ReportLandscapeRepositoryViewModel {
	return {
		heading: input.repository.name,
		subtitle: "Repository drilldown within the current hosted landscape report.",
		cards: [
			{
				label: "Lines of Code",
				value: formatCount(input.repository.linesOfCode),
				detail: null,
			},
			{
				label: "Files",
				value: formatCount(input.repository.filesCount),
				detail: null,
			},
			{
				label: "Contributors",
				value: formatCount(input.repository.contributorsCount),
				detail: null,
			},
			{
				label: "Commits (30d)",
				value: formatCount(input.repository.commits30d),
				detail: null,
			},
			{
				label: "Commits (90d)",
				value: formatCount(input.repository.commits90d),
				detail: null,
			},
			{
				label: "Latest Commit",
				value: input.repository.latestCommitDate,
				detail: null,
			},
			...(input.repository.duplicationPercentage === null
				? []
				: [
						{
							label: "Duplication",
							value: `${input.repository.duplicationPercentage.toFixed(1)}%`,
							detail: null,
						},
					]),
		],
		contributorRows: input.repository.topContributors.map((contributor) => ({
			label: contributor.displayName,
			value: `${formatCount(contributor.commitsCount)} commits · ${formatCount(contributor.commits30d)} (30d) · ${formatCount(contributor.commits90d)} (90d) · ${contributor.signal} · ${contributor.type}`,
		})),
	};
}
