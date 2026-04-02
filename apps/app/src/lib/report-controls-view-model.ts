import type { RuntimeReportControls } from "./runtime-client.js";

export type ReportControlsCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportControlsGoalRow = {
	readonly label: string;
	readonly value: string;
	readonly detail: string;
};

export type ReportControlsInventoryRow = {
	readonly goal: string;
	readonly metric: string;
	readonly value: string;
	readonly desiredRange: string;
	readonly status: string;
	readonly description: string;
};

export type ReportControlsViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportControlsCard>;
	readonly goals: ReadonlyArray<ReportControlsGoalRow>;
	readonly rows: ReadonlyArray<ReportControlsInventoryRow>;
};

export function buildReportControlsViewModel(input: {
	readonly reportName: string;
	readonly controls: RuntimeReportControls;
}): ReportControlsViewModel {
	return {
		heading: input.reportName,
		subtitle:
			"Goals, controls, and quality gate status from the linked Planetnik dataset.",
		cards: [
			{
				label: "Controls",
				value: input.controls.totalControls.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "Failed",
				value: input.controls.statusCounts.failed.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "Tolerant",
				value: input.controls.statusCounts.tolerant.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "OK",
				value: input.controls.statusCounts.ok.toLocaleString("en-GB"),
				detail: null,
			},
		],
		goals: input.controls.goals.map((goal) => ({
			label: goal.goal,
			value: `${goal.total.toLocaleString("en-GB")} controls`,
			detail: `${goal.failed.toLocaleString("en-GB")} failed · ${goal.tolerant.toLocaleString("en-GB")} tolerant`,
		})),
		rows: input.controls.controls.map((control) => ({
			goal: control.goal,
			metric: control.metricId,
			value:
				control.metricValue === null
					? "N/A"
					: control.metricValue.toLocaleString("en-GB"),
			desiredRange: control.desiredRangeText,
			status: control.status,
			description: control.description,
		})),
	};
}
