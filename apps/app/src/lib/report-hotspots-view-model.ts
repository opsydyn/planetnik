import type { RuntimeReportHotspots } from "./runtime-client.js";

export type ReportHotspotsCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportHotspotsRow = {
	readonly label: string;
	readonly value: string;
};

export type ReportHotspotsSection = {
	readonly title: string;
	readonly rows: ReadonlyArray<ReportHotspotsRow>;
};

export type ReportHotspotsViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportHotspotsCard>;
	readonly sections: ReadonlyArray<ReportHotspotsSection>;
};

function formatCount(value: number): string {
	return value.toLocaleString("en-GB");
}

function formatDominantDimension(value: string): string {
	return value
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.toLowerCase();
}

export function buildReportHotspotsViewModel(input: {
	readonly reportName: string;
	readonly hotspots: RuntimeReportHotspots;
}): ReportHotspotsViewModel {
	return {
		heading: input.reportName,
		subtitle: "Ranked structural hotspots from the linked Planetnik dataset.",
		cards: [
			{
				label: "Hotspots",
				value: formatCount(input.hotspots.totalHotspots),
				detail: null,
			},
			{
				label: "Critical",
				value: formatCount(input.hotspots.severityCounts.critical),
				detail: null,
			},
			{
				label: "High",
				value: formatCount(input.hotspots.severityCounts.high),
				detail: null,
			},
			{
				label: "Coordination-Led",
				value: formatCount(input.hotspots.dominantCounts.coordinationCost),
				detail: null,
			},
		],
		sections: [
			{
				title: "Severity mix",
				rows: [
					{
						label: "Critical",
						value: `${formatCount(input.hotspots.severityCounts.critical)} hotspots`,
					},
					{
						label: "High",
						value: `${formatCount(input.hotspots.severityCounts.high)} hotspots`,
					},
					{
						label: "Medium",
						value: `${formatCount(input.hotspots.severityCounts.medium)} hotspots`,
					},
				].filter((row) => row.value !== "0 hotspots"),
			},
			{
				title: "Hotspots by kind",
				rows: [
					{
						label: "Files",
						value: `${formatCount(input.hotspots.kindCounts.files)} hotspots`,
					},
					{
						label: "Units",
						value: `${formatCount(input.hotspots.kindCounts.units)} hotspots`,
					},
					{
						label: "Components",
						value: `${formatCount(input.hotspots.kindCounts.components)} hotspots`,
					},
				].filter((row) => row.value !== "0 hotspots"),
			},
			{
				title: "Top hotspots",
				rows: input.hotspots.topHotspots.map((item) => ({
					label: item.name,
					value: `${item.score.toLocaleString("en-GB", {
						minimumFractionDigits: 1,
						maximumFractionDigits: 1,
					})} · ${item.severity} · ${formatDominantDimension(item.dominantDimension)} · ${item.suggestedAction}`,
				})),
			},
			{
				title: "Hotspot queue",
				rows: input.hotspots.rows.map((item) => ({
					label: item.name,
					value: `${item.kind} · ${item.parent || "—"} · score ${item.score.toLocaleString("en-GB", {
						minimumFractionDigits: 1,
						maximumFractionDigits: 1,
					})} · ${item.severity} · ${formatCount(item.commitsCount)} commits · ${formatCount(item.contributorsCount)} contributors`,
				})),
			},
		],
	};
}
