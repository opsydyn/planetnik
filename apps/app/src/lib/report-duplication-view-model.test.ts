import { describe, expect, test } from "bun:test";
import { buildReportDuplicationViewModel } from "./report-duplication-view-model.js";

const baseDuplication = {
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
};

describe("report duplication view model", () => {
	test("builds stat cards", () => {
		const viewModel = buildReportDuplicationViewModel({
			reportName: "Effect TS",
			duplication: baseDuplication,
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
	});

	test("passes blockSizeDistribution straight through for DistributionChart", () => {
		const viewModel = buildReportDuplicationViewModel({
			reportName: "Effect TS",
			duplication: baseDuplication,
		});

		expect(viewModel.blockSizeDistribution).toEqual([
			{ label: "11-20 lines", value: 1, detail: "1 blocks" },
			{ label: "21-50 lines", value: 1, detail: "1 blocks" },
		]);
	});

	test("passes mostDuplicatedFiles straight through for HorizontalBarChart", () => {
		const viewModel = buildReportDuplicationViewModel({
			reportName: "Effect TS",
			duplication: baseDuplication,
		});

		expect(viewModel.mostDuplicatedFiles).toEqual([
			{ label: "index.ts", value: 2 },
			{ label: "app.ts", value: 1 },
		]);
	});

	test("builds blockGridRows with joined locations", () => {
		const viewModel = buildReportDuplicationViewModel({
			reportName: "Effect TS",
			duplication: baseDuplication,
		});

		expect(viewModel.blockGridRows).toEqual([
			{
				id: "dup-0-24",
				blockSize: 24,
				files: 2,
				locations: "src/routes/reports/index.ts:10-33\nsrc/app.ts:40-63",
			},
		]);
	});
});
