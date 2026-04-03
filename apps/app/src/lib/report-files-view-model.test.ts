import { describe, expect, test } from "bun:test";
import { buildReportFilesViewModel } from "./report-files-view-model.js";

describe("report files view model", () => {
	test("builds hosted file size cards and sections", () => {
		const viewModel = buildReportFilesViewModel({
			reportName: "Effect TS",
			slug: "effect-ts",
			files: {
				view: "size",
				headline: {
					fileCount: 3,
					totalLinesOfCode: 1460,
				},
				sizeDistribution: [
					{ label: "1-50 LOC", value: 40, detail: "1 files" },
					{ label: "201-500 LOC", value: 320, detail: "1 files" },
					{ label: "1001+ LOC", value: 1100, detail: "1 files" },
				],
				largestFiles: [
					{ label: "index.ts", value: 1100 },
					{ label: "app.ts", value: 320 },
				],
				rows: [
					{
						relativePath: "src/index.ts",
						extension: "ts",
						linesOfCode: 1100,
						commitsCount: 18,
						contributorsCount: 4,
						firstDate: "2024-01-03",
						latestDate: "2026-03-31",
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Effect TS");
		expect(viewModel.subtitle).toBe(
			"Hosted file-level summary from the linked Planetnik dataset.",
		);
		expect(viewModel.activeView).toBe("size");
		expect(viewModel.cards).toEqual([
			{ label: "Files", value: "3", detail: null },
			{ label: "Total LOC", value: "1,460", detail: null },
		]);
		expect(viewModel.sections).toEqual([
			{
				title: "Size distribution",
				rows: [
					{ label: "1-50 LOC", value: "40 loc · 1 files" },
					{ label: "201-500 LOC", value: "320 loc · 1 files" },
					{ label: "1001+ LOC", value: "1,100 loc · 1 files" },
				],
			},
			{
				title: "Largest files",
				rows: [
					{ label: "index.ts", value: "1,100 loc" },
					{ label: "app.ts", value: "320 loc" },
				],
			},
			{
				title: "File inventory",
				rows: [
					{
						label: "src/index.ts",
						value: ".ts · 1,100 loc · 18 commits · 4 contributors",
					},
				],
			},
		]);
		expect(viewModel.viewLinks).toEqual([
			{ label: "Size", href: "/reports/effect-ts/files/size", active: true },
			{ label: "Age", href: "/reports/effect-ts/files/age", active: false },
			{ label: "Churn", href: "/reports/effect-ts/files/churn", active: false },
			{
				label: "Temporal",
				href: "/reports/effect-ts/files/temporal",
				active: false,
			},
		]);
	});
});
