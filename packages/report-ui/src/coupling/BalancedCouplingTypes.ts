export type CouplingDimensionId =
	| "staticCoupling"
	| "temporalCoupling"
	| "coordinationCoupling"
	| "knowledgeRisk";

export interface BalancedCouplingSnapshot {
	id: string;
	component: string;
	files: number;
	loc: number;
	contributors: number;
	incomingDependencies: number;
	outgoingDependencies: number;
	staticPartners: number;
	temporalPartners: number;
	contributorOverlap: number;
	hotspotPressure: number;
	staticCoupling: number;
	temporalCoupling: number;
	coordinationCoupling: number;
	knowledgeRisk: number;
	overallLoad: number;
	balanceScore: number;
	systemicRisk: number;
	riskTier: "Low" | "Medium" | "High" | "Critical";
	dominantDimension: CouplingDimensionId;
	explainability: string[];
}

export interface BalancedCouplingAggregate {
	totalComponents: number;
	averageLoad: number;
	averageBalance: number;
	averageRisk: number;
	maxRisk: number;
	overloadedComponents: number;
	knowledgeExposedComponents: number;
	topRiskComponent?: string | undefined;
	dimensionMix: Array<{
		id: CouplingDimensionId;
		label: string;
		value: number;
		color: string;
	}>;
	dominantDimensionBreakdown: Array<{
		label: string;
		value: number;
		detail: string;
		color: string;
	}>;
}

export interface BalancedCouplingModel {
	decompositionKey: string;
	snapshots: BalancedCouplingSnapshot[];
	aggregate: BalancedCouplingAggregate;
}
