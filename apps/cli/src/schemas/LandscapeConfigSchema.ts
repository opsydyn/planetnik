import { Schema } from "@effect/schema";

const IgnoreRuleSchema = Schema.Struct({
	org: Schema.optionalWith(Schema.String, { default: () => "" }),
	repo: Schema.optionalWith(Schema.String, { default: () => "" }),
});

const MetadataSchema = Schema.Struct({
	name: Schema.optionalWith(Schema.String, { default: () => "" }),
	description: Schema.optionalWith(Schema.String, { default: () => "" }),
});

const TeamSchema = Schema.Struct({
	name: Schema.String,
	description: Schema.optionalWith(Schema.String, { default: () => "" }),
	emailPatterns: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [],
	}),
});

const TeamsConfigSchema = Schema.Struct({
	teams: Schema.optionalWith(Schema.Array(TeamSchema), { default: () => [] }),
});

const RepositoryTagSchema = Schema.Struct({
	tag: Schema.String,
	patterns: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [],
	}),
	excludePatterns: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [],
	}),
	mainExtensions: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [],
	}),
	anyExtensions: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [],
	}),
	excludeExtensions: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [],
	}),
	pathPatterns: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [],
	}),
	excludePathPatterns: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [],
	}),
	imageLink: Schema.optionalWith(Schema.String, { default: () => "" }),
});

const TagGroupSchema = Schema.Struct({
	name: Schema.String,
	description: Schema.optionalWith(Schema.String, { default: () => "" }),
	color: Schema.optionalWith(Schema.String, { default: () => "" }),
	repositoryTags: Schema.optionalWith(Schema.Array(RepositoryTagSchema), {
		default: () => [],
	}),
});

const MergeExtensionSchema = Schema.Struct({
	primary: Schema.String,
	secondary: Schema.String,
});

const SecurityConfigSchema = Schema.Struct({
	enabled: Schema.optionalWith(Schema.Boolean, { default: () => true }),
	fetchAlerts: Schema.optionalWith(Schema.Boolean, { default: () => true }),
	fetchSBOM: Schema.optionalWith(Schema.Boolean, { default: () => false }),
	alertStates: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => ["open", "fixed"],
	}),
	alertSeverities: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => ["critical", "high", "medium", "low"],
	}),
});

/**
 * Schema for landscape-config.json — the landscape analysis configuration file.
 *
 * Combines GitHub discovery settings (orgs, token, API URLs) with
 * landscape analysis options (metadata, teams, tags, merge extensions).
 */
export const LandscapeConfigSchema = Schema.Struct({
	githubCloneUrl: Schema.optionalWith(Schema.String, {
		default: () => "https://github.com",
	}),
	githubApiUrl: Schema.optionalWith(Schema.String, {
		default: () => "https://api.github.com",
	}),
	githubToken: Schema.optional(Schema.String),
	githubOrgs: Schema.Array(Schema.String),
	reposUpdatedAfter: Schema.optionalWith(Schema.String, {
		default: () => "2020-01-01",
	}),
	ignore: Schema.optionalWith(Schema.Array(IgnoreRuleSchema), {
		default: () => [],
	}),
	metadata: Schema.optionalWith(MetadataSchema, {
		default: () => ({ name: "", description: "" }),
	}),
	teamsConfig: Schema.optionalWith(TeamsConfigSchema, {
		default: () => ({ teams: [] }),
	}),
	tagGroups: Schema.optionalWith(Schema.Array(TagGroupSchema), {
		default: () => [],
	}),
	mergeExtensions: Schema.optionalWith(Schema.Array(MergeExtensionSchema), {
		default: () => [],
	}),
	ignoreContributors: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [],
	}),
	ignoreExtensions: Schema.optionalWith(Schema.Array(Schema.String), {
		default: () => [],
	}),
	extensionThresholdLoc: Schema.optionalWith(Schema.Number, {
		default: () => 0,
	}),
	repositoryThresholdLocMain: Schema.optionalWith(Schema.Number, {
		default: () => 0,
	}),
	repositoryThresholdContributors: Schema.optionalWith(Schema.Number, {
		default: () => 1,
	}),
	contributorThresholdCommits: Schema.optionalWith(Schema.Number, {
		default: () => 1,
	}),
	commitsMaxYears: Schema.optionalWith(Schema.Number, { default: () => 10 }),
	security: Schema.optionalWith(SecurityConfigSchema, {
		default: () => ({
			enabled: true,
			fetchAlerts: true,
			fetchSBOM: false,
			alertStates: ["open", "fixed"],
			alertSeverities: ["critical", "high", "medium", "low"],
		}),
	}),
});

export type LandscapeConfigInput = typeof LandscapeConfigSchema.Type;
