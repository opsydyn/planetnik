import { describe, expect, test } from "bun:test";
import { buildReportMetricsViewModel } from "./report-metrics-view-model.js";

describe("report metrics view model", () => {
	test("builds hosted metrics summary cards and grouped rows", () => {
		const viewModel = buildReportMetricsViewModel({
			reportName: "Effect TS",
			metrics: {
				totalMetrics: 6,
				headlineMetrics: {
					mainLinesOfCode: 52000,
					testLinesOfCode: 14000,
					duplicatedLines: 910,
					testVsMainPercentage: 26.9,
					totalAnalysisTimeInMillis: 1840,
				},
				locBreakdown: [
					{ label: "Main", value: 52000 },
					{ label: "Test", value: 14000 },
				],
				mainLocByExtension: [
					{ label: ".ts", value: 48000 },
					{ label: ".js", value: 4000 },
				],
				groupSummaries: [
					{
						groupId: "LINES_OF_CODE",
						label: "Lines of Code",
						metrics: [
							{ id: "LINES_OF_CODE_MAIN", value: 52000 },
							{ id: "LINES_OF_CODE_TEST", value: 14000 },
						],
					},
					{
						groupId: "DUPLICATION",
						label: "Duplication",
						metrics: [{ id: "DUPLICATION_NUMBER_OF_DUPLICATED_LINES", value: 910 }],
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Effect TS");
		expect(viewModel.subtitle).toBe(
			"Metric inventory and headline report measures from the linked Planetnik dataset.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "Main LOC", value: "52,000", detail: null },
			{ label: "Test LOC", value: "14,000", detail: "26.9% of main" },
			{ label: "Duplicated Lines", value: "910", detail: null },
			{ label: "Analysis Time", value: "1.8s", detail: "6 metrics" },
		]);
		expect(viewModel.locBreakdown).toEqual([
			{ label: "Main", value: 52000 },
			{ label: "Test", value: 14000 },
		]);
		expect(viewModel.mainLocByExtension).toEqual([
			{ label: ".ts", value: 48000 },
			{ label: ".js", value: 4000 },
		]);
		expect(viewModel.groups).toEqual([
			{
				label: "Lines of Code",
				rows: [
					{ metric: "LINES_OF_CODE_MAIN", value: "52,000" },
					{ metric: "LINES_OF_CODE_TEST", value: "14,000" },
				],
			},
			{
				label: "Duplication",
				rows: [
					{ metric: "DUPLICATION_NUMBER_OF_DUPLICATED_LINES", value: "910" },
				],
			},
		]);
	});
});
