import { describe, expect, test } from "bun:test";
import { buildReportComponentsViewModel } from "./report-components-view-model.js";

describe("report components view model", () => {
	test("builds hosted component summary cards and rows", () => {
		const viewModel = buildReportComponentsViewModel({
			reportName: "web-app",
			components: {
				totalComponents: 2,
				singleOwnerComponents: 0,
				lowBackupComponents: 1,
				distributedComponents: 1,
				unassignedFiles: 1,
				topComponents: [
					{
						name: "runtime",
						files: 2,
						linesOfCode: 600,
						contributors: 2,
						risk: "Bus factor risk",
					},
					{
						name: "reports",
						files: 1,
						linesOfCode: 300,
						contributors: 3,
						risk: "",
					},
				],
				inventory: [
					{
						name: "runtime",
						files: 2,
						linesOfCode: 600,
						contributors: 2,
						risk: "Bus factor risk",
					},
					{
						name: "(unassigned)",
						files: 1,
						linesOfCode: 50,
						contributors: null,
						risk: "",
					},
				],
			},
		});

		expect(viewModel.heading).toBe("web-app");
		expect(viewModel.subtitle).toBe(
			"Logical component coverage and bus-factor risk from the linked Planetnik dataset.",
		);
		expect(viewModel.hasComponents).toBe(true);
		expect(viewModel.cards).toEqual([
			{ label: "Components", value: "2", detail: null },
			{ label: "Single Owner", value: "0", detail: null },
			{ label: "Low Backup", value: "1", detail: null },
			{ label: "3+ Contributors", value: "1", detail: null },
			{ label: "Unassigned Files", value: "1", detail: null },
		]);
		expect(viewModel.topComponents).toEqual([
			{
				label: "runtime",
				value: "600 LOC · 2 files · 2 contributors · Bus factor risk",
			},
			{
				label: "reports",
				value: "300 LOC · 1 files · 3 contributors",
			},
		]);
		expect(viewModel.rows).toEqual([
			{
				component: "runtime",
				files: "2",
				linesOfCode: "600",
				contributors: "2",
				risk: "Bus factor risk",
			},
			{
				component: "(unassigned)",
				files: "1",
				linesOfCode: "50",
				contributors: "N/A",
				risk: "",
			},
		]);
	});
});
