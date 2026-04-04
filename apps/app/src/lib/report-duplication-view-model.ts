import type { GridRow } from "@planetnik/report-ui/tables/ReportDataGrid.types";
import type { RuntimeReportDuplication } from "./runtime-client.js";

export type ReportDuplicationCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportDuplicationViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportDuplicationCard>;
	readonly blockSizeDistribution: ReadonlyArray<{ readonly label: string; readonly value: number; readonly detail: string }>;
	readonly mostDuplicatedFiles: ReadonlyArray<{ readonly label: string; readonly value: number }>;
	readonly blockGridRows: ReadonlyArray<GridRow>;
};

export function buildReportDuplicationViewModel(input: {
	readonly reportName: string;
	readonly duplication: RuntimeReportDuplication;
}): ReportDuplicationViewModel {
	const { duplication } = input;

	return {
		heading: input.reportName,
		subtitle: "Duplicate block summary from the linked Planetnik dataset.",
		cards: [
			{
				label: "Duplication",
				value: `${duplication.duplicationPercentage.toFixed(1)}%`,
				detail: null,
			},
			{
				label: "Duplicated Lines",
				value: duplication.duplicatedLines.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "Duplicate Blocks",
				value: duplication.duplicateBlocksCount.toLocaleString("en-GB"),
				detail: null,
			},
		],
		blockSizeDistribution: duplication.blockSizeDistribution,
		mostDuplicatedFiles: duplication.mostDuplicatedFiles,
		blockGridRows: duplication.largestDuplicateBlocks.map((block, index) => ({
			id: `dup-${index}-${block.blockSize}`,
			blockSize: block.blockSize,
			files: block.files,
			locations: block.locations.join("\n"),
		})),
	};
}
