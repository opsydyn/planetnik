import type { RuntimeReportCoupling } from "./runtime-client.js";

export type ReportCouplingCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportCouplingRow = {
	readonly label: string;
	readonly value: string;
};

export type ReportCouplingInventoryRow = {
	readonly component: string;
	readonly tier: string;
	readonly risk: string;
	readonly dominantDimension: string;
	readonly explainability: string;
};

export type ReportCouplingViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportCouplingCard>;
	readonly sections: ReadonlyArray<{
		readonly title: string;
		readonly rows: ReadonlyArray<ReportCouplingRow>;
	}>;
	readonly rows: ReadonlyArray<ReportCouplingInventoryRow>;
};

function formatCount(value: number): string {
	return value.toLocaleString("en-GB");
}

function formatScore(value: number): string {
	return value.toLocaleString("en-GB", {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
}

export function buildReportCouplingViewModel(input: {
	readonly reportName: string;
	readonly coupling: RuntimeReportCoupling;
}): ReportCouplingViewModel {
	return {
		heading: input.reportName,
		subtitle:
			"Balanced coupling summary from logical components, dependencies, temporal coupling, and hotspots.",
		cards: [
			{
				label: "Components",
				value: formatCount(input.coupling.aggregate.totalComponents),
				detail: null,
			},
			{
				label: "Overloaded",
				value: formatCount(input.coupling.aggregate.overloadedComponents),
				detail: null,
			},
			{
				label: "Knowledge Exposed",
				value: formatCount(input.coupling.aggregate.knowledgeExposedComponents),
				detail: null,
			},
			{
				label: "Average Risk",
				value: formatScore(input.coupling.aggregate.averageRisk),
				detail: input.coupling.temporalWindowLabel ?? "No temporal window",
			},
		],
		sections: [
			{
				title: "Average coupling mix",
				rows: input.coupling.dimensionMix.map((item) => ({
					label: item.label,
					value: formatScore(item.value),
				})),
			},
			{
				title: "Dominant dimension breakdown",
				rows: input.coupling.dominantBreakdown.map((item) => ({
					label: item.label,
					value: `${formatCount(item.value)} · ${item.detail}`,
				})),
			},
			{
				title: "Top risk components",
				rows: input.coupling.topRiskComponents.map((item) => ({
					label: item.component,
					value: `${formatScore(item.systemicRisk)} · ${item.riskTier} · ${item.dominantDimension} · ${item.explainability.join(" • ")}`,
				})),
			},
		],
		rows: input.coupling.inventory.map((item) => ({
			component: item.component,
			tier: item.riskTier,
			risk: formatScore(item.systemicRisk),
			dominantDimension: item.dominantDimension,
			explainability: item.explainability.join(" • "),
		})),
	};
}
