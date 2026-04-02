import type { RuntimeReportDependencies } from "./runtime-client.js";

export type ReportDependenciesCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportDependenciesSection = {
	readonly label: string;
	readonly detail: string;
	readonly incoming: ReadonlyArray<{
		readonly label: string;
		readonly value: string;
	}>;
	readonly outgoing: ReadonlyArray<{
		readonly label: string;
		readonly value: string;
	}>;
	readonly links: ReadonlyArray<{
		readonly label: string;
		readonly value: string;
	}>;
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
			incoming: section.incoming.map((entry) => ({
				label: entry.label,
				value: `${entry.value.toLocaleString("en-GB")} incoming refs`,
			})),
			outgoing: section.outgoing.map((entry) => ({
				label: entry.label,
				value: `${entry.value.toLocaleString("en-GB")} outgoing refs`,
			})),
			links: section.links.map((link) => ({
				label: `${link.fromComponent} → ${link.toComponent}`,
				value: `${link.count.toLocaleString("en-GB")} refs · ${link.evidenceCount.toLocaleString("en-GB")} evidence · ${link.locFrom.toLocaleString("en-GB")} loc from`,
			})),
		})),
	};
}
