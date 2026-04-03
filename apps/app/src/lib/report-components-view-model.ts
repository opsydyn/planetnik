import type { RuntimeReportComponents } from "./runtime-client.js";

export type ReportComponentsCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportComponentsRow = {
	readonly label: string;
	readonly value: string;
};

export type ReportComponentsInventoryRow = {
	readonly component: string;
	readonly files: string;
	readonly linesOfCode: string;
	readonly contributors: string;
	readonly risk: string;
};

export type ReportComponentsViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly hasComponents: boolean;
	readonly cards: ReadonlyArray<ReportComponentsCard>;
	readonly topComponents: ReadonlyArray<ReportComponentsRow>;
	readonly rows: ReadonlyArray<ReportComponentsInventoryRow>;
};

function formatCount(value: number): string {
	return value.toLocaleString("en-GB");
}

export function buildReportComponentsViewModel(input: {
	readonly reportName: string;
	readonly components: RuntimeReportComponents;
}): ReportComponentsViewModel {
	return {
		heading: input.reportName,
		subtitle:
			"Logical component coverage and bus-factor risk from the linked Planetnik dataset.",
		hasComponents: input.components.totalComponents > 0,
		cards: [
			{
				label: "Components",
				value: formatCount(input.components.totalComponents),
				detail: null,
			},
			{
				label: "Single Owner",
				value: formatCount(input.components.singleOwnerComponents),
				detail: null,
			},
			{
				label: "Low Backup",
				value: formatCount(input.components.lowBackupComponents),
				detail: null,
			},
			{
				label: "3+ Contributors",
				value: formatCount(input.components.distributedComponents),
				detail: null,
			},
			{
				label: "Unassigned Files",
				value: formatCount(input.components.unassignedFiles),
				detail: null,
			},
		],
		topComponents: input.components.topComponents.map((component) => ({
			label: component.name,
			value: `${formatCount(component.linesOfCode)} LOC · ${formatCount(component.files)} files · ${formatCount(component.contributors)} contributors${component.risk ? ` · ${component.risk}` : ""}`,
		})),
		rows: input.components.inventory.map((component) => ({
			component: component.name,
			files: formatCount(component.files),
			linesOfCode: formatCount(component.linesOfCode),
			contributors:
				component.contributors === null
					? "N/A"
					: formatCount(component.contributors),
			risk: component.risk,
		})),
	};
}
