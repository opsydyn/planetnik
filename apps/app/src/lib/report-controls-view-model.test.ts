import { describe, expect, test } from "bun:test";
import { buildReportControlsViewModel } from "./report-controls-view-model.js";

describe("report controls view model", () => {
	test("builds hosted controls summary cards and inventory rows", () => {
		const viewModel = buildReportControlsViewModel({
			reportName: "Effect TS",
			controls: {
				totalControls: 3,
				statusCounts: {
					failed: 1,
					tolerant: 1,
					ok: 1,
					ignored: 0,
				},
				goals: [
					{
						goal: "Maintainability",
						total: 2,
						failed: 1,
						tolerant: 1,
						ok: 0,
						ignored: 0,
					},
					{
						goal: "Quality",
						total: 1,
						failed: 0,
						tolerant: 0,
						ok: 1,
						ignored: 0,
					},
				],
				controls: [
					{
						id: "Maintainability::LINES_OF_CODE_MAIN",
						goal: "Maintainability",
						metricId: "LINES_OF_CODE_MAIN",
						metricValue: 52000,
						desiredRangeText: "< 50000",
						status: "FAILED",
						description: "Keep main LOC below target",
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Effect TS");
		expect(viewModel.subtitle).toBe(
			"Goals, controls, and quality gate status from the linked Planetnik dataset.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "Controls", value: "3", detail: null },
			{ label: "Failed", value: "1", detail: null },
			{ label: "Tolerant", value: "1", detail: null },
			{ label: "OK", value: "1", detail: null },
		]);
		expect(viewModel.goals).toEqual([
			{
				label: "Maintainability",
				value: "2 controls",
				detail: "1 failed · 1 tolerant",
			},
			{
				label: "Quality",
				value: "1 controls",
				detail: "0 failed · 0 tolerant",
			},
		]);
		expect(viewModel.rows).toEqual([
			{
				goal: "Maintainability",
				metric: "LINES_OF_CODE_MAIN",
				value: "52,000",
				desiredRange: "< 50000",
				status: "FAILED",
				description: "Keep main LOC below target",
			},
		]);
	});
});
