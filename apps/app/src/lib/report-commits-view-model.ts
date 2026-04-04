import type { LineSeries } from "@planetnik/report-ui/charts/LineChart";
import type { RuntimeReportCommits } from "./runtime-client.js";

export type ReportCommitsCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportCommitsActivityItem = {
	readonly label: string;
	readonly value: number;
	readonly detail: string;
};

export type ReportCommitsExtensionRow = {
	readonly extension: string;
	readonly commitsCount: string;
	readonly committersCount: string;
	readonly filesCount: string;
	readonly commitsCount30Days: string;
	readonly commitsCount90Days: string;
};

export type ReportCommitsViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportCommitsCard>;
	readonly timelineSeries: ReadonlyArray<LineSeries>;
	readonly activityData: ReadonlyArray<ReportCommitsActivityItem>;
	readonly extensionBarData: ReadonlyArray<{ readonly label: string; readonly value: number }>;
	readonly extensionRows: ReadonlyArray<ReportCommitsExtensionRow>;
};

function formatCount(value: number): string {
	return value.toLocaleString("en-GB");
}

export function buildReportCommitsViewModel(input: {
	readonly reportName: string;
	readonly commits: RuntimeReportCommits;
}): ReportCommitsViewModel {
	const { commits } = input;

	const cards: ReportCommitsCard[] = [
		{ label: "Total Commits", value: formatCount(commits.totalCommits), detail: null },
		{ label: "All-Time Contributors", value: formatCount(commits.totalContributors), detail: null },
		{ label: "Active (30d)", value: formatCount(commits.activeContributors.days30), detail: null },
		{ label: "Active (90d)", value: formatCount(commits.activeContributors.days90), detail: null },
		{ label: "Active (1yr)", value: formatCount(commits.activeContributors.days365), detail: null },
		{ label: "Rookies", value: formatCount(commits.rookieCount), detail: null },
	];

	if (commits.repoAgeDays !== null) {
		cards.push({ label: "Repo Age (Days)", value: formatCount(commits.repoAgeDays), detail: null });
	}
	if (commits.activeDays !== null) {
		cards.push({ label: "Active Days", value: formatCount(commits.activeDays), detail: null });
	}

	const sortedTimeline = [...commits.timeline].sort((a, b) =>
		a.timeSlot.localeCompare(b.timeSlot),
	);

	const commitsByYear = sortedTimeline.map((entry) => ({
		label: entry.timeSlot,
		value: entry.commits,
	}));
	const contributorsByYear = sortedTimeline.map((entry) => ({
		label: entry.timeSlot,
		value: entry.contributors,
	}));

	const timelineSeries: LineSeries[] = [
		...(commitsByYear.length > 0
			? [{ name: "Commits", data: commitsByYear, color: "#3b82f6" }]
			: []),
		...(contributorsByYear.length > 0
			? [{ name: "Contributors", data: contributorsByYear, color: "#22c55e" }]
			: []),
	];

	const activityData: ReportCommitsActivityItem[] = commits.activity.map((item) => ({
		label: item.label,
		value: item.value,
		detail: item.detail,
	}));

	const extensionBarData = [...commits.extensions]
		.sort((a, b) => b.commitsCount - a.commitsCount)
		.slice(0, 15)
		.map((entry) => ({ label: `.${entry.extension}`, value: entry.commitsCount }));

	const extensionRows: ReportCommitsExtensionRow[] = [...commits.extensions]
		.sort((a, b) => b.commitsCount - a.commitsCount)
		.map((entry) => ({
			extension: entry.extension,
			commitsCount: formatCount(entry.commitsCount),
			committersCount: formatCount(entry.committersCount),
			filesCount: formatCount(entry.filesCount),
			commitsCount30Days: entry.commitsCount30Days > 0 ? formatCount(entry.commitsCount30Days) : "—",
			commitsCount90Days: entry.commitsCount90Days > 0 ? formatCount(entry.commitsCount90Days) : "—",
		}));

	return {
		heading: input.reportName,
		subtitle: "Commit activity and contributor cadence from the linked Planetnik dataset.",
		cards,
		timelineSeries,
		activityData,
		extensionBarData,
		extensionRows,
	};
}
