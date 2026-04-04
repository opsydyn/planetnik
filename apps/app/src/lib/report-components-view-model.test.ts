import { describe, expect, test } from "bun:test";
import { buildReportComponentsViewModel } from "./report-components-view-model.js";

describe("report components view model", () => {
	test("builds chart-ready component data", () => {
		const viewModel = buildReportComponentsViewModel({
			reportName: "web-app",
			components: {
				totalComponents: 3,
				singleOwnerComponents: 1,
				lowBackupComponents: 2,
				distributedComponents: 1,
				unassignedFiles: 1,
				topComponents: [
					{ name: "runtime", files: 2, linesOfCode: 600, contributors: 2, risk: "Bus factor risk" },
					{ name: "reports", files: 1, linesOfCode: 300, contributors: 3, risk: "" },
				],
				inventory: [
					{ name: "runtime", files: 2, linesOfCode: 600, contributors: 2, risk: "Bus factor risk" },
					{ name: "reports", files: 1, linesOfCode: 300, contributors: 3, risk: "" },
					{ name: "(unassigned)", files: 1, linesOfCode: 50, contributors: null, risk: "" },
				],
			},
		});

		expect(viewModel.heading).toBe("web-app");
		expect(viewModel.hasComponents).toBe(true);

		expect(viewModel.cards).toEqual([
			{ label: "Components", value: "3", detail: null },
			{ label: "Single Owner", value: "1", detail: null, accentColor: "#dc2626" },
			{ label: "Low Backup", value: "2", detail: null, accentColor: "#d97706" },
			{ label: "3+ Contributors", value: "1", detail: null, accentColor: "#16a34a" },
			{ label: "Unassigned Files", value: "1", detail: null },
		]);

		// twoContributors = lowBackupComponents - singleOwnerComponents = 2 - 1 = 1
		expect(viewModel.componentCoverageData).toEqual([
			{ label: "Single owner", value: 1 },
			{ label: "Two contributors", value: 1 },
			{ label: "3+ contributors", value: 1 },
			{ label: "Unassigned files", value: 1 },
		]);
		expect(viewModel.componentCoverageColors).toEqual(["#ef4444", "#f59e0b", "#22c55e", "#94a3b8"]);

		expect(viewModel.treemapData).toEqual([
			{ label: "runtime", value: 600 },
			{ label: "reports", value: 300 },
			{ label: "(unassigned)", value: 50 },
		]);

		expect(viewModel.compBarData).toEqual([
			{ label: "runtime", value: 600 },
			{ label: "reports", value: 300 },
		]);

		expect(viewModel.busFactorData).toEqual([
			{ x: 600, y: 2, label: "runtime" },
			{ x: 300, y: 3, label: "reports" },
		]);

		expect(viewModel.componentRows).toEqual([
			{ id: "runtime", component: "runtime", files: 2, loc: 600, contributors: 2, risk: "Bus factor risk" },
			{ id: "reports", component: "reports", files: 1, loc: 300, contributors: 3, risk: "" },
			{ id: "(unassigned)", component: "(unassigned)", files: 1, loc: 50, contributors: null, risk: "" },
		]);
	});

	test("hasComponents is false when totalComponents is 0", () => {
		const viewModel = buildReportComponentsViewModel({
			reportName: "empty-repo",
			components: {
				totalComponents: 0,
				singleOwnerComponents: 0,
				lowBackupComponents: 0,
				distributedComponents: 0,
				unassignedFiles: 0,
				topComponents: [],
				inventory: [],
			},
		});
		expect(viewModel.hasComponents).toBe(false);
		expect(viewModel.componentCoverageData).toEqual([]);
	});
});
