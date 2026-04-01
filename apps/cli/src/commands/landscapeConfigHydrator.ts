import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
	ContributorTag,
	type LandscapeConfiguration,
	Link,
	MergeExtension,
	Metadata,
	PeopleConfig,
	PersonConfig,
	RepositoryTag,
	TagGroup,
	TeamConfig,
	TeamsConfig,
} from "@planetnik/analyzer";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function toNumber(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toStringValue(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

export function hydrateLandscapeConfiguration(
	landscapeConfig: LandscapeConfiguration,
	rawConfig: unknown,
): LandscapeConfiguration {
	if (!isRecord(rawConfig)) {
		return landscapeConfig;
	}

	if (isRecord(rawConfig.metadata)) {
		landscapeConfig.metadata = Metadata.make(rawConfig.metadata);
	}

	landscapeConfig.repositoryReportsUrlPrefix = toStringValue(
		rawConfig.repositoryReportsUrlPrefix,
		landscapeConfig.repositoryReportsUrlPrefix,
	);
	landscapeConfig.parentUrl = toStringValue(
		rawConfig.parentUrl,
		landscapeConfig.parentUrl,
	);
	landscapeConfig.extensionThresholdLoc = toNumber(
		rawConfig.extensionThresholdLoc,
		landscapeConfig.extensionThresholdLoc,
	);
	landscapeConfig.repositoryThresholdLocMain = toNumber(
		rawConfig.repositoryThresholdLocMain,
		landscapeConfig.repositoryThresholdLocMain,
	);
	landscapeConfig.repositoryThresholdContributors = toNumber(
		rawConfig.repositoryThresholdContributors,
		landscapeConfig.repositoryThresholdContributors,
	);
	landscapeConfig.contributorThresholdCommits = toNumber(
		rawConfig.contributorThresholdCommits,
		landscapeConfig.contributorThresholdCommits,
	);
	landscapeConfig.ignoreRepositoriesLastUpdatedBefore = toStringValue(
		rawConfig.ignoreRepositoriesLastUpdatedBefore,
		landscapeConfig.ignoreRepositoriesLastUpdatedBefore,
	);
	landscapeConfig.commitsMaxYears = toNumber(
		rawConfig.commitsMaxYears,
		landscapeConfig.commitsMaxYears,
	);
	landscapeConfig.significantContributorMinCommitDaysPerYear = toNumber(
		rawConfig.significantContributorMinCommitDaysPerYear,
		landscapeConfig.significantContributorMinCommitDaysPerYear,
	);
	landscapeConfig.ignoreContributors = toStringArray(
		rawConfig.ignoreContributors,
	);
	landscapeConfig.ignoreExtensions = toStringArray(rawConfig.ignoreExtensions);

	if (Array.isArray(rawConfig.breadcrumbs)) {
		landscapeConfig.breadcrumbs = rawConfig.breadcrumbs
			.filter(isRecord)
			.map((link) =>
				Link.make({
					label: toStringValue(link.label, ""),
					href: toStringValue(link.href, ""),
				}),
			);
	}

	landscapeConfig.teamsConfig = hydrateTeamsConfig(rawConfig.teamsConfig);
	landscapeConfig.peopleConfig = hydratePeopleConfig(rawConfig.peopleConfig);
	landscapeConfig.contributorTags = hydrateContributorTags(
		rawConfig.contributorTags,
	);
	landscapeConfig.tagGroups = hydrateTagGroups(rawConfig.tagGroups);
	landscapeConfig.mergeExtensions = hydrateMergeExtensions(
		rawConfig.mergeExtensions,
	);

	return landscapeConfig;
}

export function saveLandscapeConfiguration(
	configPath: string,
	landscapeConfig: LandscapeConfiguration,
): void {
	mkdirSync(dirname(configPath), { recursive: true });
	writeFileSync(configPath, JSON.stringify(landscapeConfig, null, 2), "utf-8");
}

function hydrateTeamsConfig(value: unknown): TeamsConfig {
	const teamsConfig = new TeamsConfig();
	if (!isRecord(value) || !Array.isArray(value.teams)) {
		return teamsConfig;
	}

	teamsConfig.teams = value.teams.filter(isRecord).map((teamConfig) => {
		const team = new TeamConfig();
		team.name = toStringValue(teamConfig.name, "");
		team.description = toStringValue(teamConfig.description, "");
		team.emailPatterns = toStringArray(teamConfig.emailPatterns);
		return team;
	});

	return teamsConfig;
}

function hydratePeopleConfig(value: unknown): PeopleConfig {
	const peopleConfig = new PeopleConfig();
	if (!isRecord(value) || !Array.isArray(value.people)) {
		return peopleConfig;
	}

	peopleConfig.people = value.people.filter(isRecord).map((personConfig) => {
		const person = new PersonConfig();
		person.name = toStringValue(personConfig.name, "");
		person.link = toStringValue(personConfig.link, "");
		person.image = toStringValue(personConfig.image, "");
		person.emailPatterns = toStringArray(personConfig.emailPatterns);
		person.links = Array.isArray(personConfig.links)
			? personConfig.links.filter(isRecord).map((link) =>
					Link.make({
						label: toStringValue(link.label, ""),
						href: toStringValue(link.href, ""),
					}),
				)
			: [];
		return person;
	});

	return peopleConfig;
}

function hydrateContributorTags(value: unknown): ContributorTag[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter(isRecord).map((tagConfig) => {
		const tag = new ContributorTag();
		tag.name = toStringValue(tagConfig.name, "");
		tag.emailPatterns = toStringArray(tagConfig.emailPatterns);
		return tag;
	});
}

function hydrateTagGroups(value: unknown): TagGroup[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter(isRecord).map((groupConfig) => {
		const group = new TagGroup();
		group.name = toStringValue(groupConfig.name, "");
		group.description = toStringValue(groupConfig.description, "");
		group.color = toStringValue(groupConfig.color, "");
		group.repositoryTags = Array.isArray(groupConfig.repositoryTags)
			? groupConfig.repositoryTags.filter(isRecord).map((tagConfig) => {
					const tag = new RepositoryTag();
					tag.tag = toStringValue(tagConfig.tag, "");
					tag.patterns = toStringArray(tagConfig.patterns);
					tag.excludePatterns = toStringArray(tagConfig.excludePatterns);
					tag.mainExtensions = toStringArray(tagConfig.mainExtensions);
					tag.anyExtensions = toStringArray(tagConfig.anyExtensions);
					tag.excludeExtensions = toStringArray(tagConfig.excludeExtensions);
					tag.pathPatterns = toStringArray(tagConfig.pathPatterns);
					tag.excludePathPatterns = toStringArray(
						tagConfig.excludePathPatterns,
					);
					tag.imageLink = toStringValue(tagConfig.imageLink, "");
					tag.group = group;
					return tag;
				})
			: [];
		return group;
	});
}

function hydrateMergeExtensions(value: unknown): MergeExtension[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter(isRecord).map((mergeConfig) => {
		const merge = new MergeExtension();
		merge.primary = toStringValue(mergeConfig.primary, "");
		merge.secondary = toStringValue(mergeConfig.secondary, "");
		return merge;
	});
}
