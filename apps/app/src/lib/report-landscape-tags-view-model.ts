import type { HorizontalBarItem } from "@planetnik/report-ui/charts/HorizontalBarChart";
import type { GridRow } from "@planetnik/report-ui/tables/ReportDataGrid.types";
import type { RuntimeReportLandscapeTags } from "./runtime-client.js";

export type ReportLandscapeTagsCard = {
	readonly label: string;
	readonly value: string;
};

export type ReportLandscapeTagsViewModel = {
	readonly heading: string;
	readonly subtitle: string;
	readonly cards: ReadonlyArray<ReportLandscapeTagsCard>;
	readonly topTagBars: ReadonlyArray<HorizontalBarItem>;
	readonly rows: ReadonlyArray<GridRow>;
	readonly untaggedRepositories: ReadonlyArray<string>;
};

function formatCount(value: number): string {
	return value.toLocaleString("en-GB");
}

export function buildReportLandscapeTagsViewModel(input: {
	readonly tags: RuntimeReportLandscapeTags;
}): ReportLandscapeTagsViewModel {
	return {
		heading: "Tags",
		subtitle: "Repository tags and grouping overlays across the landscape.",
		cards: [
			{ label: "Tag Groups", value: formatCount(input.tags.groupCount) },
			{ label: "Tags", value: formatCount(input.tags.tagCount) },
			{
				label: "Untagged Repos",
				value: formatCount(input.tags.untaggedRepositoryCount),
			},
		],
		topTagBars: input.tags.tags
			.slice()
			.sort(
				(left, right) =>
					right.repositoryCount - left.repositoryCount ||
					left.tag.localeCompare(right.tag),
			)
			.slice(0, 12)
			.map((tag) => ({
				label: tag.tag,
				value: tag.repositoryCount,
			})),
		rows: input.tags.tags.map((tag) => ({
			id: tag.id,
			group: tag.group,
			tag: tag.tag,
			repositoryCount: tag.repositoryCount,
			totalMainLinesOfCode: tag.totalMainLinesOfCode,
			repositories: tag.repositories.join(" • ") || "—",
		})),
		untaggedRepositories: input.tags.untaggedRepositories,
	};
}
