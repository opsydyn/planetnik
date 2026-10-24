import { Effect, Schema } from "effect"

const DependabotAlertSeverity = Schema.Literals(["critical", "high", "medium", "low"])

const DependabotAlertState = Schema.Literals(["open", "fixed", "dismissed", "auto_dismissed"])

const PackageSchema = Schema.Struct({
  ecosystem: Schema.String,
  name: Schema.String,
})

const DependencySchema = Schema.Struct({
  package: PackageSchema,
  manifest_path: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  scope: Schema.NullOr(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
})

const SecurityAdvisorySchema = Schema.Struct({
  ghsa_id: Schema.String,
  cve_id: Schema.NullOr(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
  summary: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  severity: DependabotAlertSeverity,
  published_at: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
})

const PatchedVersionSchema = Schema.Struct({
  identifier: Schema.String,
})

const SecurityVulnerabilitySchema = Schema.Struct({
  severity: DependabotAlertSeverity,
  vulnerable_version_range: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  first_patched_version: Schema.NullOr(PatchedVersionSchema).pipe(
    Schema.withDecodingDefaultType(Effect.sync(() => null)),
  ),
})

export const DependabotAlertSchema = Schema.Struct({
  number: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  state: DependabotAlertState,
  dependency: DependencySchema,
  security_advisory: SecurityAdvisorySchema,
  security_vulnerability: SecurityVulnerabilitySchema,
  created_at: Schema.String,
  updated_at: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  fixed_at: Schema.NullOr(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
  auto_dismissed_at: Schema.NullOr(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => null))),
})
