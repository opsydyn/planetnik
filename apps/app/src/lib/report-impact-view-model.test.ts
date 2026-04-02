import { describe, expect, test } from "bun:test";
import { buildReportImpactViewModel } from "./report-impact-view-model.js";

describe("report impact view model", () => {
	test("builds hosted impact summary cards and ranked sections", () => {
		const viewModel = buildReportImpactViewModel({
			reportName: "Effect TS",
			impact: {
				title: "Impact Report",
				timestamp: "2026-04-02T12:00:00.000Z",
				visibleActivity: {
					commits: 48,
					contributors: 6,
					changedFiles: 18,
					changedUnits: 11,
				},
				structuralImpact: {
					overallScore: 7.4,
					dominantDimension: "coordination_relief",
				},
				impactDimensions: [
					{ label: "Coordination relief", score: 7.4 },
					{ label: "Knowledge spread", score: 6.2 },
				],
				topOpportunities: [
					{
						name: "Runtime auth boundary",
						kind: "component",
						parent: "runtime",
						impactScore: 8.8,
						dominantDimension: "coordination_relief",
						suggestedAction:
							"Stabilize the boundary and reduce repeated coordination.",
					},
				],
				snackingCandidates: [
					{
						name: "Small refactors in report cards",
						kind: "file",
						visibleActivityScore: 6.4,
						structuralImpactScore: 2.1,
						reason: "Visible motion is outpacing structural leverage.",
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Effect TS");
		expect(viewModel.subtitle).toBe(
			"Visible activity versus structural impact from the linked Planetnik dataset.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "Visible Commits", value: "48", detail: null },
			{ label: "Changed Files", value: "18", detail: null },
			{ label: "Contributors", value: "6", detail: null },
			{ label: "Structural Impact", value: "7.4", detail: "coordination relief" },
			{ label: "Impact Opportunities", value: "1", detail: null },
			{ label: "Snacking Candidates", value: "1", detail: null },
		]);
		expect(viewModel.dimensionRows).toEqual([
			{ label: "Coordination relief", value: "7.4" },
			{ label: "Knowledge spread", value: "6.2" },
		]);
		expect(viewModel.opportunityRows).toEqual([
			{
				label: "Runtime auth boundary",
				value: "8.8 · coordination relief · Stabilize the boundary and reduce repeated coordination.",
			},
		]);
		expect(viewModel.snackingRows).toEqual([
			{
				label: "Small refactors in report cards",
				value: "activity 6.4 · impact 2.1 · Visible motion is outpacing structural leverage.",
			},
		]);
	});
});
