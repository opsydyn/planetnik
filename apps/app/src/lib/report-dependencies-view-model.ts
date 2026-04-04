import type { DependencyLink } from "@planetnik/report-ui/charts/DependencyMatrix";
import type { GridRow } from "@planetnik/report-ui/tables/ReportDataGrid.types";
import type { RuntimeReportDependencies } from "./runtime-client.js";

export type ReportDependenciesCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportDependenciesSection = {
	readonly label: string;
	readonly detail: string;
	readonly matrixData: ReadonlyArray<DependencyLink>;
	readonly inDegreeData: ReadonlyArray<{ readonly label: string; readonly value: number }>;
	readonly outDegreeData: ReadonlyArray<{ readonly label: string; readonly value: number }>;
	readonly gridRows: ReadonlyArray<GridRow>;
};

export type ReportDependenciesViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportDependenciesCard>;
	readonly sections: ReadonlyArray<ReportDependenciesSection>;
};

export function buildReportDependenciesViewModel(input: {
	readonly reportName: string;
	readonly dependencies: RuntimeReportDependencies;
}): ReportDependenciesViewModel {
	return {
		heading: input.reportName,
		subtitle:
			"Static component dependency summary from the linked Planetnik dataset.",
		cards: [
			{
				label: "Decompositions",
				value: input.dependencies.sections.length.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "Component Links",
				value: input.dependencies.sections
					.reduce((sum, section) => sum + section.linksCount, 0)
					.toLocaleString("en-GB"),
				detail: null,
			},
		],
		sections: input.dependencies.sections.map((section) => ({
			label: section.decompositionKey,
			detail: `${section.linksCount.toLocaleString("en-GB")} component links`,
			matrixData: section.links.map((link) => ({
				from: link.fromComponent,
				to: link.toComponent,
				count: link.count,
			})),
			inDegreeData: section.incoming,
			outDegreeData: section.outgoing,
			gridRows: section.links.map((link) => ({
				id: `${section.decompositionKey}:${link.fromComponent}:${link.toComponent}`,
				fromComponent: link.fromComponent,
				toComponent: link.toComponent,
				count: link.count,
				evidenceCount: link.evidenceCount,
				locFrom: link.locFrom,
			})),
		})),
	};
}
