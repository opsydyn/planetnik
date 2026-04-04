import type { RuntimeReportMetrics } from "./runtime-client.js";

export type ReportMetricsCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportMetricsGroup = {
	readonly label: string;
	readonly rows: ReadonlyArray<{
		readonly metric: string;
		readonly value: string;
	}>;
};

export type ReportMetricsChartItem = {
	readonly label: string;
	readonly value: number;
};

export type ReportMetricsViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportMetricsCard>;
	readonly locBreakdown: ReadonlyArray<ReportMetricsChartItem>;
	readonly mainLocByExtension: ReadonlyArray<ReportMetricsChartItem>;
	readonly groups: ReadonlyArray<ReportMetricsGroup>;
};

function formatMilliseconds(ms: number): string {
	if (ms >= 1000) {
		return `${(ms / 1000).toFixed(1)}s`;
	}

	return `${ms.toFixed(0)}ms`;
}

export function buildReportMetricsViewModel(input: {
	readonly reportName: string;
	readonly metrics: RuntimeReportMetrics;
}): ReportMetricsViewModel {
	return {
		heading: input.reportName,
		subtitle:
			"Metric inventory and headline report measures from the linked Planetnik dataset.",
		cards: [
			{
				label: "Main LOC",
				value: input.metrics.headlineMetrics.mainLinesOfCode.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "Test LOC",
				value: input.metrics.headlineMetrics.testLinesOfCode.toLocaleString("en-GB"),
				detail: `${input.metrics.headlineMetrics.testVsMainPercentage.toFixed(1)}% of main`,
			},
			{
				label: "Duplicated Lines",
				value: input.metrics.headlineMetrics.duplicatedLines.toLocaleString(
					"en-GB",
				),
				detail: null,
			},
			{
				label: "Analysis Time",
				value: formatMilliseconds(
					input.metrics.headlineMetrics.totalAnalysisTimeInMillis,
				),
				detail: `${input.metrics.totalMetrics.toLocaleString("en-GB")} metrics`,
			},
		],
		locBreakdown: input.metrics.locBreakdown,
		mainLocByExtension: input.metrics.mainLocByExtension,
		groups: input.metrics.groupSummaries.map((group) => ({
			label: group.label,
			rows: group.metrics.map((metric) => ({
				metric: metric.id,
				value: metric.value.toLocaleString("en-GB"),
			})),
		})),
	};
}
