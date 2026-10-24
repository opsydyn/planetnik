import { Effect, Schema } from "effect"

const IgnoreRuleSchema = Schema.Struct({
  org: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  repo: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
})

const MetadataSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  description: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
})

const TeamSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  emailPatterns: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
})

const TeamsConfigSchema = Schema.Struct({
  teams: Schema.Array(TeamSchema).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
})

const RepositoryTagSchema = Schema.Struct({
  tag: Schema.String,
  patterns: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  excludePatterns: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  mainExtensions: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  anyExtensions: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  excludeExtensions: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  pathPatterns: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  excludePathPatterns: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  imageLink: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
})

const TagGroupSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  color: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  repositoryTags: Schema.Array(RepositoryTagSchema).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
})

const MergeExtensionSchema = Schema.Struct({
  primary: Schema.String,
  secondary: Schema.String,
})

const SecurityConfigSchema = Schema.Struct({
  enabled: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => true))),
  fetchAlerts: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => true))),
  fetchSBOM: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => false))),
  alertStates: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => ["open", "fixed"]))),
  alertSeverities: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefaultType(Effect.sync(() => ["critical", "high", "medium", "low"])),
  ),
})

/**
 * Schema for landscape-config.json — the landscape analysis configuration file.
 *
 * Combines GitHub discovery settings (orgs, token, API URLs) with
 * landscape analysis options (metadata, teams, tags, merge extensions).
 */
export const LandscapeConfigSchema = Schema.Struct({
  githubCloneUrl: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => "https://github.com"))),
  githubApiUrl: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => "https://api.github.com"))),
  githubToken: Schema.optional(Schema.String),
  githubOrgs: Schema.Array(Schema.String),
  reposUpdatedAfter: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => "2020-01-01"))),
  ignore: Schema.Array(IgnoreRuleSchema).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  metadata: MetadataSchema.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ({ name: "", description: "" })))),
  teamsConfig: TeamsConfigSchema.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ({ teams: [] })))),
  tagGroups: Schema.Array(TagGroupSchema).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  mergeExtensions: Schema.Array(MergeExtensionSchema).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  ignoreContributors: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  ignoreExtensions: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  extensionThresholdLoc: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 0))),
  repositoryThresholdLocMain: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 0))),
  repositoryThresholdContributors: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 1))),
  contributorThresholdCommits: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 1))),
  commitsMaxYears: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 10))),
  security: SecurityConfigSchema.pipe(
    Schema.withDecodingDefaultType(
      Effect.sync(() => ({
        enabled: true,
        fetchAlerts: true,
        fetchSBOM: false,
        alertStates: ["open", "fixed"],
        alertSeverities: ["critical", "high", "medium", "low"],
      })),
    ),
  ),
  emitLegacyProjections: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => false))),
})
