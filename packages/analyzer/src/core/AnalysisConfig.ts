import { Schema } from "@effect/schema"

const AnalysisConfigSchema = Schema.Struct({
  skipDuplication: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  skipCorrelations: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  skipDependencies: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  saveSourceFiles: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  saveCodeFragments: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  maxFileSizeBytes: Schema.optionalWith(Schema.Number, { default: () => 1_000_000 }),
  maxLines: Schema.optionalWith(Schema.Number, { default: () => 10_000 }),
  maxLineLength: Schema.optionalWith(Schema.Number, { default: () => 1_000 }),
  maxTemporalDependenciesDepthDays: Schema.optionalWith(Schema.Number, { default: () => 180 }),
  locDuplicationThreshold: Schema.optionalWith(Schema.Number, { default: () => 10_000_000 }),
  minDuplicationBlockLoc: Schema.optionalWith(Schema.Number, { default: () => 6 }),
  maxTopListSize: Schema.optionalWith(Schema.Number, { default: () => 50 }),
  analyzeConcernOverlaps: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  customHtmlReportHeaderFragment: Schema.optionalWith(Schema.String, { default: () => "" }),
})

export type AnalysisConfigType = typeof AnalysisConfigSchema.Type

export const AnalysisConfig = {
  schema: AnalysisConfigSchema,

  make(input: Partial<AnalysisConfigType>): AnalysisConfigType {
    return Schema.decodeUnknownSync(AnalysisConfigSchema)(input)
  },
}
