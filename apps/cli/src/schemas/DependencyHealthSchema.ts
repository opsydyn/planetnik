import { Schema } from "@effect/schema"

const SeverityCountsSchema = Schema.Struct({
  critical: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  high: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  medium: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  low: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})

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
})

export type RepositoryDependencyHealth = typeof RepositoryDependencyHealthSchema.Type

const SharedVulnerablePackageSchema = Schema.Struct({
  ecosystem: Schema.String,
  name: Schema.String,
  severity: Schema.String,
  affectedRepos: Schema.Array(Schema.String),
})

const VulnerabilityEnrichmentSummarySchema = Schema.Struct({
  enrichedAt: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null,
  }),
  latestAlertOpenedAt: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null,
  }),
  latestAdvisoryPublishedAt: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null,
  }),
  uniqueCveCount: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  epssCoverageCount: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  knownExploitedCount: Schema.optionalWith(Schema.Number, {
    default: () => 0,
  }),
  epssAvailable: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  kevAvailable: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

const TopActionableVulnerabilitySchema = Schema.Struct({
  repo: Schema.String,
  package: Schema.String,
  ecosystem: Schema.String,
  manifestPath: Schema.String,
  advisoryId: Schema.String,
  cveId: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null,
  }),
  ghsaId: Schema.String,
  severity: Schema.String,
  summary: Schema.String,
  state: Schema.String,
  openedAt: Schema.String,
  publishedAt: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null,
  }),
  ageDays: Schema.Number,
  sharedRepoCount: Schema.Number,
  vulnerableVersionRange: Schema.String,
  firstPatchedVersion: Schema.optionalWith(Schema.NullOr(Schema.String), {
    default: () => null,
  }),
  recommendedAction: Schema.String,
  epssScore: Schema.optionalWith(Schema.NullOr(Schema.Number), {
    default: () => null,
  }),
  epssPercentile: Schema.optionalWith(Schema.NullOr(Schema.Number), {
    default: () => null,
  }),
  knownExploited: Schema.Boolean,
  priorityScore: Schema.Number,
})

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
  sharedVulnerablePackages: Schema.optionalWith(Schema.Array(SharedVulnerablePackageSchema), { default: () => [] }),
  repoHealth: Schema.Array(RepositoryDependencyHealthSchema),
  enrichmentSummary: Schema.optionalWith(VulnerabilityEnrichmentSummarySchema, {
    default: () => ({
      enrichedAt: null,
      latestAlertOpenedAt: null,
      latestAdvisoryPublishedAt: null,
      uniqueCveCount: 0,
      epssCoverageCount: 0,
      knownExploitedCount: 0,
      epssAvailable: false,
      kevAvailable: false,
    }),
  }),
  topActionableVulnerabilities: Schema.optionalWith(Schema.Array(TopActionableVulnerabilitySchema), {
    default: () => [],
  }),
})

export type LandscapeDependencyHealth = typeof LandscapeDependencyHealthSchema.Type
