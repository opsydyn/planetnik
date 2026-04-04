import type { GridRow } from "@planetnik/report-ui/tables/ReportDataGrid.types";
import type { RuntimeReportComponents } from "./runtime-client.js";

export type ReportComponentsCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
	readonly accentColor?: string;
};

export type ReportComponentsViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly hasComponents: boolean;
	readonly cards: ReadonlyArray<ReportComponentsCard>;
	readonly componentCoverageData: ReadonlyArray<{
		readonly label: string;
		readonly value: number;
	}>;
	readonly componentCoverageColors: ReadonlyArray<string>;
	readonly treemapData: ReadonlyArray<{ readonly label: string; readonly value: number }>;
	readonly compBarData: ReadonlyArray<{ readonly label: string; readonly value: number }>;
	readonly busFactorData: ReadonlyArray<{
		readonly x: number;
		readonly y: number;
		readonly label: string;
	}>;
	readonly componentRows: ReadonlyArray<GridRow>;
};

function formatCount(value: number): string {
	return value.toLocaleString("en-GB");
}

export function buildReportComponentsViewModel(input: {
	readonly reportName: string;
	readonly components: RuntimeReportComponents;
}): ReportComponentsViewModel {
	const {
		totalComponents,
		singleOwnerComponents,
		lowBackupComponents,
		distributedComponents,
		unassignedFiles,
		topComponents,
		inventory,
	} = input.components;

	const twoContributors = lowBackupComponents - singleOwnerComponents;

	const coverageItems: Array<{ label: string; value: number }> = [];
	const coverageColors: Array<string> = [];
	if (singleOwnerComponents > 0) {
		coverageItems.push({ label: "Single owner", value: singleOwnerComponents });
		coverageColors.push("#ef4444");
	}
	if (twoContributors > 0) {
		coverageItems.push({ label: "Two contributors", value: twoContributors });
		coverageColors.push("#f59e0b");
	}
	if (distributedComponents > 0) {
		coverageItems.push({ label: "3+ contributors", value: distributedComponents });
		coverageColors.push("#22c55e");
	}
	if (unassignedFiles > 0) {
		coverageItems.push({ label: "Unassigned files", value: unassignedFiles });
		coverageColors.push("#94a3b8");
	}

	return {
		heading: input.reportName,
		subtitle:
			"Logical component coverage and bus-factor risk from the linked Planetnik dataset.",
		hasComponents: totalComponents > 0,
		cards: [
			{ label: "Components", value: formatCount(totalComponents), detail: null },
			{
				label: "Single Owner",
				value: formatCount(singleOwnerComponents),
				detail: null,
				accentColor: singleOwnerComponents > 0 ? "#dc2626" : undefined,
			},
			{
				label: "Low Backup",
				value: formatCount(lowBackupComponents),
				detail: null,
				accentColor: lowBackupComponents > 0 ? "#d97706" : undefined,
			},
			{
				label: "3+ Contributors",
				value: formatCount(distributedComponents),
				detail: null,
				accentColor: distributedComponents > 0 ? "#16a34a" : undefined,
			},
			{ label: "Unassigned Files", value: formatCount(unassignedFiles), detail: null },
		],
		componentCoverageData: coverageItems,
		componentCoverageColors: coverageColors,
		treemapData: inventory.map((c) => ({ label: c.name, value: c.linesOfCode })),
		compBarData: topComponents.map((c) => ({ label: c.name, value: c.linesOfCode })),
		busFactorData: inventory
			.filter((c) => c.contributors !== null && c.contributors > 0)
			.map((c) => ({
				x: c.linesOfCode,
				y: c.contributors as number,
				label: c.name,
			})),
		componentRows: inventory.map((c) => ({
			id: c.name,
			component: c.name,
			files: c.files,
			loc: c.linesOfCode,
			contributors: c.contributors,
			risk: c.risk,
		})),
	};
}
