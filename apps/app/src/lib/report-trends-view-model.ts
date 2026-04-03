import type { RuntimeReportTrends } from "./runtime-client.js";

export type ReportTrendsViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly statusLabel: string;
	readonly message: string;
	readonly hint: string;
};

export function buildReportTrendsViewModel(input: {
	readonly reportName: string;
	readonly trends: RuntimeReportTrends;
}): ReportTrendsViewModel {
	return {
		heading: input.reportName,
		subtitle: "Trend history is not yet exported by the linked Planetnik dataset.",
		statusLabel: input.trends.available ? "History available" : "Awaiting history",
		message: input.trends.message,
		hint: input.trends.hint,
	};
}
