import { Schema } from "@effect/schema";

const SeverityCountsSchema = Schema.Struct({
	critical: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	high: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	medium: Schema.optionalWith(Schema.Number, { default: () => 0 }),
	low: Schema.optionalWith(Schema.Number, { default: () => 0 }),
});

export const RepositoryDependencyHealthSchema = Schema.Struct({
	owner: Schema.String,
	repo: Schema.String,
	totalAlerts: Schema.Number,
	openAlerts: Schema.Number,
	fixedAlerts: Schema.Number,
	severityCounts: SeverityCountsSchema,
	meanTimeToResolveDays: Schema.optionalWith(Schema.NullOr(Schema.Number), {
		default: () => null,
	}),
	oldestOpenAlertDays: Schema.optionalWith(Schema.NullOr(Schema.Number), {
		default: () => null,
	}),
});

export type RepositoryDependencyHealth =
	typeof RepositoryDependencyHealthSchema.Type;

const SharedVulnerablePackageSchema = Schema.Struct({
	ecosystem: Schema.String,
	name: Schema.String,
	severity: Schema.String,
	affectedRepos: Schema.Array(Schema.String),
});

export const LandscapeDependencyHealthSchema = Schema.Struct({
	totalRepos: Schema.Number,
	reposWithAlerts: Schema.Number,
	totalAlerts: Schema.Number,
	totalOpenAlerts: Schema.Number,
	severityCounts: SeverityCountsSchema,
	meanTimeToResolveDays: Schema.optionalWith(Schema.NullOr(Schema.Number), {
		default: () => null,
	}),
	supplyChainExposureScore: Schema.Number,
	sharedVulnerablePackages: Schema.optionalWith(
		Schema.Array(SharedVulnerablePackageSchema),
		{ default: () => [] },
	),
	repoHealth: Schema.Array(RepositoryDependencyHealthSchema),
});

export type LandscapeDependencyHealth =
	typeof LandscapeDependencyHealthSchema.Type;
