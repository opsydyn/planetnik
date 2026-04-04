import { describe, expect, test } from "bun:test";
import { buildReportControlsViewModel } from "./report-controls-view-model.js";

describe("report controls view model", () => {
	test("builds stat cards with colors", () => {
		const viewModel = buildReportControlsViewModel({
			reportName: "Effect TS",
			controls: {
				totalControls: 3,
				statusCounts: { failed: 1, tolerant: 1, ok: 1, ignored: 0 },
				goals: [],
				controls: [],
			},
		});

		expect(viewModel.heading).toBe("Effect TS");
		expect(viewModel.cards).toEqual([
			{ label: "Controls", value: "3", detail: null },
			{ label: "Failed", value: "1", detail: null, color: "#dc2626" },
			{ label: "Tolerant", value: "1", detail: null, color: "#d97706" },
			{ label: "OK", value: "1", detail: null, color: "#16a34a" },
		]);
	});

	test("builds statusChartData and colors for present statuses only", () => {
		const viewModel = buildReportControlsViewModel({
			reportName: "Effect TS",
			controls: {
				totalControls: 2,
				statusCounts: { failed: 1, tolerant: 0, ok: 1, ignored: 0 },
				goals: [],
				controls: [],
			},
		});

		expect(viewModel.statusChartData).toEqual([
			{ label: "Failed", value: 1 },
			{ label: "OK", value: 1 },
		]);
		expect(viewModel.statusChartColors).toEqual(["#ef4444", "#22c55e"]);
	});

	test("builds goalRows sorted by failures then tolerant then total", () => {
		const viewModel = buildReportControlsViewModel({
			reportName: "Effect TS",
			controls: {
				totalControls: 3,
				statusCounts: { failed: 1, tolerant: 1, ok: 1, ignored: 0 },
				goals: [
					{ goal: "Quality", total: 1, failed: 0, tolerant: 0, ok: 1, ignored: 0 },
					{ goal: "Maintainability", total: 2, failed: 1, tolerant: 1, ok: 0, ignored: 0 },
				],
				controls: [],
			},
		});

		expect(viewModel.goalRows).toEqual([
			{ label: "Maintainability", value: 2, detail: "1 failed", detailSecondary: "1 tolerant", color: "#ef4444" },
			{ label: "Quality", value: 1, detail: "0 failed", detailSecondary: "0 tolerant", color: "#22c55e" },
		]);
	});

	test("builds controlRows sorted by status rank then metric id", () => {
		const viewModel = buildReportControlsViewModel({
			reportName: "Effect TS",
			controls: {
				totalControls: 2,
				statusCounts: { failed: 1, tolerant: 0, ok: 1, ignored: 0 },
				goals: [],
				controls: [
					{
						id: "Goal::LINES_OK",
						goal: "Goal",
						metricId: "LINES_OK",
						metricValue: 10000,
						desiredRangeText: "< 50000",
						status: "OK",
						description: "Passed",
					},
					{
						id: "Goal::LINES_LOC",
						goal: "Goal",
						metricId: "LINES_LOC",
						metricValue: 52000,
						desiredRangeText: "< 50000",
						status: "FAILED",
						description: "Exceeded limit",
					},
				],
			},
		});

		expect(viewModel.controlRows[0]).toMatchObject({ status: "FAILED" });
		expect(viewModel.controlRows[1]).toMatchObject({ status: "OK" });
	});
});
