import type { RuntimeReportImpact } from "./runtime-client.js";

export type ReportImpactCard = {
	readonly label: string;
	readonly value: string;
	readonly detail: string | null;
};

export type ReportImpactRow = {
	readonly label: string;
	readonly value: string;
};

export type ReportImpactViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportImpactCard>;
	readonly dimensionRows: ReadonlyArray<ReportImpactRow>;
	readonly opportunityRows: ReadonlyArray<ReportImpactRow>;
	readonly snackingRows: ReadonlyArray<ReportImpactRow>;
};

function normalizeDimension(value: string): string {
	return value.replaceAll("_", " ").trim();
}

export function buildReportImpactViewModel(input: {
	readonly reportName: string;
	readonly impact: RuntimeReportImpact;
}): ReportImpactViewModel {
	return {
		heading: input.reportName,
		subtitle:
			"Visible activity versus structural impact from the linked Planetnik dataset.",
		cards: [
			{
				label: "Visible Commits",
				value: input.impact.visibleActivity.commits.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "Changed Files",
				value: input.impact.visibleActivity.changedFiles.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "Contributors",
				value: input.impact.visibleActivity.contributors.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "Structural Impact",
				value: input.impact.structuralImpact.overallScore.toLocaleString("en-GB", {
					minimumFractionDigits: 1,
					maximumFractionDigits: 1,
				}),
				detail: normalizeDimension(
					input.impact.structuralImpact.dominantDimension,
				),
			},
			{
				label: "Impact Opportunities",
				value: input.impact.topOpportunities.length.toLocaleString("en-GB"),
				detail: null,
			},
			{
				label: "Snacking Candidates",
				value: input.impact.snackingCandidates.length.toLocaleString("en-GB"),
				detail: null,
			},
		],
		dimensionRows: input.impact.impactDimensions.map((dimension) => ({
			label: dimension.label,
			value: dimension.score.toLocaleString("en-GB", {
				minimumFractionDigits: 1,
				maximumFractionDigits: 1,
			}),
		})),
		opportunityRows: input.impact.topOpportunities.map((opportunity) => ({
			label: opportunity.name,
			value: `${opportunity.impactScore.toLocaleString("en-GB", {
				minimumFractionDigits: 1,
				maximumFractionDigits: 1,
			})} · ${normalizeDimension(opportunity.dominantDimension)} · ${opportunity.suggestedAction}`,
		})),
		snackingRows: input.impact.snackingCandidates.map((candidate) => ({
			label: candidate.name,
			value: `activity ${candidate.visibleActivityScore.toLocaleString("en-GB", {
				minimumFractionDigits: 1,
				maximumFractionDigits: 1,
			})} · impact ${candidate.structuralImpactScore.toLocaleString("en-GB", {
				minimumFractionDigits: 1,
				maximumFractionDigits: 1,
			})} · ${candidate.reason}`,
		})),
	};
}
