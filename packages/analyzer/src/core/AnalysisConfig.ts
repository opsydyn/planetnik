import { Schema } from "@effect/schema"
import { Thresholds } from "./Thresholds.js"

const ThresholdsSchema = Schema.Struct({
  low: Schema.optionalWith(Schema.Number, { default: () => 200 }),
  medium: Schema.optionalWith(Schema.Number, { default: () => 500 }),
  high: Schema.optionalWith(Schema.Number, { default: () => 1000 }),
  veryHigh: Schema.optionalWith(Schema.Number, { default: () => 2000 }),
})

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
  fileSizeThresholds: Schema.optionalWith(ThresholdsSchema, {
    default: () => ({ low: 200, medium: 500, high: 1000, veryHigh: 2000 }),
  }),
  unitSizeThresholds: Schema.optionalWith(ThresholdsSchema, {
    default: () => ({ low: 10, medium: 20, high: 50, veryHigh: 100 }),
  }),
  conditionalComplexityThresholds: Schema.optionalWith(ThresholdsSchema, {
    default: () => ({ low: 5, medium: 10, high: 25, veryHigh: 50 }),
  }),
})

export type AnalysisConfigType = typeof AnalysisConfigSchema.Type

export const AnalysisConfig = {
  schema: AnalysisConfigSchema,

  make(input: Partial<AnalysisConfigType> = {}): AnalysisConfigType {
    return Schema.decodeUnknownSync(AnalysisConfigSchema)(input)
  },

  getFileSizeThresholds(config: AnalysisConfigType): Thresholds {
    const t = config.fileSizeThresholds
    return new Thresholds(t.low, t.medium, t.high, t.veryHigh)
  },

  getUnitSizeThresholds(config: AnalysisConfigType): Thresholds {
    const t = config.unitSizeThresholds
    return new Thresholds(t.low, t.medium, t.high, t.veryHigh)
  },

  getConditionalComplexityThresholds(config: AnalysisConfigType): Thresholds {
    const t = config.conditionalComplexityThresholds
    return new Thresholds(t.low, t.medium, t.high, t.veryHigh)
  },
}
