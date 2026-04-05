import type {
	BalancedCouplingAggregate,
	BalancedCouplingModel,
	BalancedCouplingSnapshot,
	CouplingDimensionId,
} from "@planetnik/report-ui/coupling/BalancedCouplingTypes";
import type { GridRow } from "@planetnik/report-ui/tables/ReportDataGrid.types";
import type { RuntimeReportCoupling } from "./runtime-client.js";

export type ReportCouplingCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
	readonly accentColor?: string;
};

export type ReportCouplingViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly temporalWindowLabel: string | null;
	readonly decompositionKey: string;
	readonly cards: ReadonlyArray<ReportCouplingCard>;
	readonly model: BalancedCouplingModel;
	readonly riskTierData: ReadonlyArray<{ readonly label: string; readonly value: number }>;
	readonly topRiskData: ReadonlyArray<{ readonly label: string; readonly value: number }>;
	readonly couplingRows: ReadonlyArray<GridRow>;
};

const DIMENSION_LABEL_TO_ID: Record<string, CouplingDimensionId> = {
	Static: "staticCoupling",
	Temporal: "temporalCoupling",
	Coordination: "coordinationCoupling",
	Knowledge: "knowledgeRisk",
};

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
	const { coupling } = input;

	// Map runtime inventory into BalancedCouplingSnapshots
	const snapshots: BalancedCouplingSnapshot[] = coupling.inventory.map((item) => ({
		id: item.component,
		component: item.component,
		files: item.files,
		loc: item.linesOfCode,
		contributors: item.contributors,
		incomingDependencies: item.incomingDependencies,
		outgoingDependencies: item.outgoingDependencies,
		staticPartners: item.staticPartners,
		temporalPartners: item.temporalPartners,
		contributorOverlap: item.contributorOverlap,
		hotspotPressure: item.hotspotPressure,
		staticCoupling: item.staticCoupling,
		temporalCoupling: item.temporalCoupling,
		coordinationCoupling: item.coordinationCoupling,
		knowledgeRisk: item.knowledgeRisk,
		overallLoad: item.overallLoad,
		balanceScore: item.balanceScore,
		systemicRisk: item.systemicRisk,
		riskTier: item.riskTier,
		dominantDimension: (DIMENSION_LABEL_TO_ID[item.dominantDimensionId] ??
			DIMENSION_LABEL_TO_ID[item.dominantDimension] ??
			"staticCoupling") as CouplingDimensionId,
		explainability: [...item.explainability],
	}));

	// Map aggregate
	const aggregate: BalancedCouplingAggregate = {
		totalComponents: coupling.aggregate.totalComponents,
		averageLoad: coupling.aggregate.averageLoad,
		averageBalance: coupling.aggregate.averageBalance,
		averageRisk: coupling.aggregate.averageRisk,
		maxRisk: coupling.aggregate.maxRisk,
		overloadedComponents: coupling.aggregate.overloadedComponents,
		knowledgeExposedComponents: coupling.aggregate.knowledgeExposedComponents,
		...(coupling.aggregate.topRiskComponent
			? { topRiskComponent: coupling.aggregate.topRiskComponent }
			: {}),
		dimensionMix: coupling.dimensionMix.map((item) => ({
			id: (item.id ?? "staticCoupling") as CouplingDimensionId,
			label: item.label,
			value: item.value,
			color: item.color,
		})),
		dominantDimensionBreakdown: coupling.dominantBreakdown.map((item) => ({
			label: item.label,
			value: item.value,
			detail: item.detail,
			color: item.color,
		})),
	};

	const model: BalancedCouplingModel = {
		decompositionKey: coupling.decompositionKey,
		snapshots,
		aggregate,
	};

	const { riskTierCounts } = coupling;
	const riskTierData = [
		...(riskTierCounts.critical > 0 ? [{ label: "Critical", value: riskTierCounts.critical }] : []),
		...(riskTierCounts.high > 0 ? [{ label: "High", value: riskTierCounts.high }] : []),
		...(riskTierCounts.medium > 0 ? [{ label: "Medium", value: riskTierCounts.medium }] : []),
		...(riskTierCounts.low > 0 ? [{ label: "Low", value: riskTierCounts.low }] : []),
	];

	const topRiskData = coupling.topRiskComponents.map((c) => ({
		label: c.component,
		value: c.systemicRisk,
	}));

	const couplingRows: GridRow[] = coupling.inventory.map((item) => ({
		id: item.component,
		component: item.component,
		riskTier: item.riskTier,
		systemicRisk: item.systemicRisk,
		overallLoad: item.overallLoad,
		balanceScore: item.balanceScore,
		dominantDimension: item.dominantDimension,
		files: item.files,
		loc: item.linesOfCode,
		contributors: item.contributors,
		incomingDependencies: item.incomingDependencies,
		outgoingDependencies: item.outgoingDependencies,
		temporalPartners: item.temporalPartners,
		contributorOverlap: item.contributorOverlap,
		staticCoupling: item.staticCoupling,
		temporalCoupling: item.temporalCoupling,
		coordinationCoupling: item.coordinationCoupling,
		knowledgeRisk: item.knowledgeRisk,
		explainability: item.explainability.join(" • "),
	}));

	return {
		heading: input.reportName,
		subtitle:
			"Balanced coupling summary from logical components, dependencies, temporal coupling, and hotspots.",
		temporalWindowLabel: coupling.temporalWindowLabel,
		decompositionKey: coupling.decompositionKey,
		cards: [
			{
				label: "Components",
				value: coupling.aggregate.totalComponents.toLocaleString(),
				detail: null,
			},
			{
				label: "Overloaded",
				value: coupling.aggregate.overloadedComponents.toLocaleString(),
				detail: null,
				accentColor: coupling.aggregate.overloadedComponents > 0 ? "#dc2626" : undefined,
			},
			{
				label: "Knowledge Exposed",
				value: coupling.aggregate.knowledgeExposedComponents.toLocaleString(),
				detail: null,
				accentColor: coupling.aggregate.knowledgeExposedComponents > 0 ? "#d97706" : undefined,
			},
			{
				label: "Average Risk",
				value: formatScore(coupling.aggregate.averageRisk),
				detail: coupling.temporalWindowLabel ?? "No temporal window",
			},
		],
		model,
		riskTierData,
		topRiskData,
		couplingRows,
	};
}
