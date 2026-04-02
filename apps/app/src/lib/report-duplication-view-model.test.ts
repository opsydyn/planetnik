import { describe, expect, test } from "bun:test";
import { buildReportDuplicationViewModel } from "./report-duplication-view-model.js";

describe("report duplication view model", () => {
	test("builds hosted duplication summary cards and ranked lists", () => {
		const viewModel = buildReportDuplicationViewModel({
			reportName: "Effect TS",
			duplication: {
				duplicationPercentage: 1.8,
				duplicatedLines: 910,
				duplicateBlocksCount: 2,
				blockSizeDistribution: [
					{ label: "11-20 lines", value: 1, detail: "1 blocks" },
					{ label: "21-50 lines", value: 1, detail: "1 blocks" },
				],
				mostDuplicatedFiles: [
					{ label: "index.ts", value: 2 },
					{ label: "app.ts", value: 1 },
				],
				largestDuplicateBlocks: [
					{
						blockSize: 24,
						files: 2,
						locations: [
							"src/routes/reports/index.ts:10-33",
							"src/app.ts:40-63",
						],
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Effect TS");
		expect(viewModel.subtitle).toBe(
			"Duplicate block summary from the linked Planetnik dataset.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "Duplication", value: "1.8%", detail: null },
			{ label: "Duplicated Lines", value: "910", detail: null },
			{ label: "Duplicate Blocks", value: "2", detail: null },
		]);
		expect(viewModel.fileRows).toEqual([
			{ label: "index.ts", value: "2 duplicate blocks" },
			{ label: "app.ts", value: "1 duplicate blocks" },
		]);
		expect(viewModel.blockRows).toEqual([
			{
				label: "24 lines across 2 files",
				value:
					"src/routes/reports/index.ts:10-33 | src/app.ts:40-63",
			},
		]);
	});
});
