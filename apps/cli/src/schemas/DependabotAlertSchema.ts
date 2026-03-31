import { Schema } from "@effect/schema"

export const DependabotAlertSeverity = Schema.Literal("critical", "high", "medium", "low")
export type DependabotAlertSeverity = typeof DependabotAlertSeverity.Type

export const DependabotAlertState = Schema.Literal("open", "fixed", "dismissed", "auto_dismissed")
export type DependabotAlertState = typeof DependabotAlertState.Type

const PackageSchema = Schema.Struct({
  ecosystem: Schema.String,
  name: Schema.String,
})

const DependencySchema = Schema.Struct({
  package: PackageSchema,
  manifest_path: Schema.optionalWith(Schema.String, { default: () => "" }),
  scope: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
})

const SecurityAdvisorySchema = Schema.Struct({
  ghsa_id: Schema.String,
  cve_id: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  summary: Schema.optionalWith(Schema.String, { default: () => "" }),
  severity: DependabotAlertSeverity,
  published_at: Schema.optionalWith(Schema.String, { default: () => "" }),
})

const PatchedVersionSchema = Schema.Struct({
  identifier: Schema.String,
})

const SecurityVulnerabilitySchema = Schema.Struct({
  severity: DependabotAlertSeverity,
  vulnerable_version_range: Schema.optionalWith(Schema.String, { default: () => "" }),
  first_patched_version: Schema.optionalWith(Schema.NullOr(PatchedVersionSchema), { default: () => null }),
})

export const DependabotAlertSchema = Schema.Struct({
  number: Schema.Int.pipe(Schema.positive()),
  state: DependabotAlertState,
  dependency: DependencySchema,
  security_advisory: SecurityAdvisorySchema,
  security_vulnerability: SecurityVulnerabilitySchema,
  created_at: Schema.String,
  updated_at: Schema.optionalWith(Schema.String, { default: () => "" }),
  fixed_at: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  auto_dismissed_at: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
})

export type DependabotAlertDecoded = typeof DependabotAlertSchema.Type
