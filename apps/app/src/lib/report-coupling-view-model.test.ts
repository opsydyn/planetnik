import { describe, expect, test } from "bun:test";
import { buildReportCouplingViewModel } from "./report-coupling-view-model.js";

describe("report coupling view model", () => {
	test("builds hosted coupling summary cards and sections", () => {
		const viewModel = buildReportCouplingViewModel({
			reportName: "web-app",
			coupling: {
				decompositionKey: "primary",
				temporalWindowLabel: "Quarter",
				aggregate: {
					totalComponents: 2,
					overloadedComponents: 1,
					knowledgeExposedComponents: 2,
					averageRisk: 6.8,
				},
				riskTierCounts: {
					critical: 1,
					high: 0,
					medium: 1,
					low: 0,
				},
				dimensionMix: [
					{ label: "Static", value: 5.2 },
					{ label: "Temporal", value: 4.0 },
				],
				dominantBreakdown: [
					{ label: "Knowledge", value: 1, detail: "1 components" },
				],
				topRiskComponents: [
					{
						component: "api",
						systemicRisk: 8.1,
						riskTier: "Critical",
						dominantDimension: "Knowledge",
						explainability: [
							"single-owner knowledge exposure",
							"High coordination cost",
						],
					},
				],
				inventory: [
					{
						component: "api",
						systemicRisk: 8.1,
						overallLoad: 7.2,
						balanceScore: 5.8,
						riskTier: "Critical",
						dominantDimension: "Knowledge",
						files: 1,
						linesOfCode: 250,
						contributors: 1,
						incomingDependencies: 5,
						outgoingDependencies: 0,
						temporalPartners: 1,
						contributorOverlap: 1,
						staticCoupling: 7.5,
						temporalCoupling: 4.0,
						coordinationCoupling: 6.1,
						knowledgeRisk: 9.2,
						explainability: [
							"single-owner knowledge exposure",
							"High coordination cost",
						],
					},
				],
			},
		});

		expect(viewModel.heading).toBe("web-app");
		expect(viewModel.subtitle).toBe(
			"Balanced coupling summary from logical components, dependencies, temporal coupling, and hotspots.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "Components", value: "2", detail: null },
			{ label: "Overloaded", value: "1", detail: null },
			{ label: "Knowledge Exposed", value: "2", detail: null },
			{ label: "Average Risk", value: "6.8", detail: "Quarter" },
		]);
		expect(viewModel.sections[0]).toEqual({
			title: "Average coupling mix",
			rows: [
				{ label: "Static", value: "5.2" },
				{ label: "Temporal", value: "4.0" },
			],
		});
		expect(viewModel.rows).toEqual([
			{
				component: "api",
				tier: "Critical",
				risk: "8.1",
				dominantDimension: "Knowledge",
				explainability:
					"single-owner knowledge exposure • High coordination cost",
			},
		]);
	});
});
