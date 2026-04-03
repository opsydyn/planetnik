import { describe, expect, test } from "bun:test";
import { buildReportHotspotsViewModel } from "./report-hotspots-view-model.js";

describe("report hotspots view model", () => {
	test("builds hosted hotspot summary cards and ranked rows", () => {
		const viewModel = buildReportHotspotsViewModel({
			reportName: "Effect TS",
			hotspots: {
				totalHotspots: 3,
				severityCounts: {
					critical: 1,
					high: 1,
					medium: 1,
					low: 0,
				},
				kindCounts: {
					files: 1,
					units: 1,
					components: 1,
				},
				dominantCounts: {
					structuralRisk: 1,
					changePressure: 1,
					coordinationCost: 1,
					knowledgeRisk: 0,
				},
				topHotspots: [
					{
						name: "src/runtime/index.ts",
						score: 8.8,
						severity: "Critical",
						kind: "file",
						dominantDimension: "coordinationCost",
						suggestedAction: "Stabilize the runtime boundary.",
					},
				],
				rows: [
					{
						name: "src/runtime/index.ts",
						route: "/files/churn",
						kind: "file",
						parent: "runtime",
						score: 8.8,
						severity: "Critical",
						dominantDimension: "coordinationCost",
						size: 1100,
						commitsCount: 18,
						contributorsCount: 4,
						temporalLinks: 7,
						complexity: 12,
						structuralRisk: 6.1,
						changePressure: 7.4,
						coordinationCost: 8.8,
						knowledgeRisk: 4.2,
						suggestedAction: "Stabilize the runtime boundary.",
						reasons: ["High coordination cost", "Sustained change pressure"],
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Effect TS");
		expect(viewModel.subtitle).toBe(
			"Ranked structural hotspots from the linked Planetnik dataset.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "Hotspots", value: "3", detail: null },
			{ label: "Critical", value: "1", detail: null },
			{ label: "High", value: "1", detail: null },
			{ label: "Coordination-Led", value: "1", detail: null },
		]);
		expect(viewModel.sections).toEqual([
			{
				title: "Severity mix",
				rows: [
					{ label: "Critical", value: "1 hotspots" },
					{ label: "High", value: "1 hotspots" },
					{ label: "Medium", value: "1 hotspots" },
				],
			},
			{
				title: "Hotspots by kind",
				rows: [
					{ label: "Files", value: "1 hotspots" },
					{ label: "Units", value: "1 hotspots" },
					{ label: "Components", value: "1 hotspots" },
				],
			},
			{
				title: "Top hotspots",
				rows: [
					{
						label: "src/runtime/index.ts",
						value:
							"8.8 · Critical · coordination cost · Stabilize the runtime boundary.",
					},
				],
			},
			{
				title: "Hotspot queue",
				rows: [
					{
						label: "src/runtime/index.ts",
						value:
							"file · runtime · score 8.8 · Critical · 18 commits · 4 contributors",
					},
				],
			},
		]);
	});
});
