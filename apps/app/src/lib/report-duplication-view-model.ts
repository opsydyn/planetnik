import type { RuntimeReportDuplication } from "./runtime-client.js";

export type ReportDuplicationCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportDuplicationListItem = {
	readonly label: string;
	readonly value: string;
};

export type ReportDuplicationViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportDuplicationCard>;
	readonly fileRows: ReadonlyArray<ReportDuplicationListItem>;
	readonly blockRows: ReadonlyArray<ReportDuplicationListItem>;
};

export function buildReportDuplicationViewModel(input: {
	readonly reportName: string;
	readonly duplication: RuntimeReportDuplication;
}): ReportDuplicationViewModel {
	return {
		heading: input.reportName,
		subtitle: "Duplicate block summary from the linked Planetnik dataset.",
		cards: [
			{
				label: "Duplication",
				value: `${input.duplication.duplicationPercentage.toFixed(1)}%`,
				detail: null,
			},
			{
				label: "Duplicated Lines",
				value: input.duplication.duplicatedLines.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "Duplicate Blocks",
				value: input.duplication.duplicateBlocksCount.toLocaleString("en-GB"),
				detail: null,
			},
		],
		fileRows: input.duplication.mostDuplicatedFiles.map((file) => ({
			label: file.label,
			value: `${file.value.toLocaleString("en-GB")} duplicate blocks`,
		})),
		blockRows: input.duplication.largestDuplicateBlocks.map((block) => ({
			label: `${block.blockSize.toLocaleString("en-GB")} lines across ${block.files.toLocaleString("en-GB")} files`,
			value: block.locations.join(" | "),
		})),
	};
}
