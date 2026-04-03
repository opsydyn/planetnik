import type { RuntimeReportCommits } from "./runtime-client.js";

export type ReportCommitsCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportCommitsRow = {
	readonly label: string;
	readonly value: string;
};

export type ReportCommitsSection = {
	readonly title: string;
	readonly rows: ReadonlyArray<ReportCommitsRow>;
};

export type ReportCommitsViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportCommitsCard>;
	readonly sections: ReadonlyArray<ReportCommitsSection>;
};

function formatCount(value: number): string {
	return value.toLocaleString("en-GB");
}

export function buildReportCommitsViewModel(input: {
	readonly reportName: string;
	readonly commits: RuntimeReportCommits;
}): ReportCommitsViewModel {
	return {
		heading: input.reportName,
		subtitle: "Commit activity and contributor cadence from the linked Planetnik dataset.",
		cards: [
			{
				label: "Total Commits",
				value: formatCount(input.commits.totalCommits),
				detail: null,
			},
			{
				label: "All-Time Contributors",
				value: formatCount(input.commits.totalContributors),
				detail: null,
			},
			{
				label: "Active (30d)",
				value: formatCount(input.commits.activeContributors.days30),
				detail: null,
			},
			{
				label: "Rookies",
				value: formatCount(input.commits.rookieCount),
				detail: null,
			},
		],
		sections: [
			{
				title: "Active contributors over time",
				rows: input.commits.activity.map((item) => ({
					label: item.label,
					value: item.detail,
				})),
			},
			{
				title: "Commits and contributors per year",
				rows: input.commits.timeline.map((item) => ({
					label: item.timeSlot,
					value: `${formatCount(item.commits)} commits · ${formatCount(item.contributors)} contributors`,
				})),
			},
			{
				title: "Commits by file extension",
				rows: input.commits.extensions.map((item) => ({
					label: `.${item.extension}`,
					value: `${formatCount(item.commitsCount)} commits · ${formatCount(item.committersCount)} committers · ${formatCount(item.filesCount)} files · ${formatCount(item.commitsCount30Days)} (30d) · ${formatCount(item.commitsCount90Days)} (90d)`,
				})),
			},
		],
	};
}
