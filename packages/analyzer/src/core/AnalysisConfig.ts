import { Effect, Schema } from "effect"
import { Thresholds } from "./Thresholds.js"

const ThresholdsSchema = Schema.Struct({
  low: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 200))),
  medium: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 500))),
  high: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 1000))),
  veryHigh: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 2000))),
})

const AnalysisConfigSchema = Schema.Struct({
  skipDuplication: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => false))),
  skipCorrelations: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => false))),
  skipDependencies: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => false))),
  saveSourceFiles: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => true))),
  saveCodeFragments: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => true))),
  maxFileSizeBytes: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 1_000_000))),
  maxLines: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 10_000))),
  maxLineLength: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 1_000))),
  maxTemporalDependenciesDepthDays: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 180))),
  locDuplicationThreshold: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 10_000_000))),
  minDuplicationBlockLoc: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 6))),
  maxTopListSize: Schema.Number.pipe(Schema.withDecodingDefaultType(Effect.sync(() => 50))),
  analyzeConcernOverlaps: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => false))),
  customHtmlReportHeaderFragment: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  fileSizeThresholds: ThresholdsSchema.pipe(
    Schema.withDecodingDefaultType(Effect.sync(() => ({ low: 200, medium: 500, high: 1000, veryHigh: 2000 }))),
  ),
  unitSizeThresholds: ThresholdsSchema.pipe(
    Schema.withDecodingDefaultType(Effect.sync(() => ({ low: 10, medium: 20, high: 50, veryHigh: 100 }))),
  ),
  conditionalComplexityThresholds: ThresholdsSchema.pipe(
    Schema.withDecodingDefaultType(Effect.sync(() => ({ low: 5, medium: 10, high: 25, veryHigh: 50 }))),
  ),
  fileAgeThresholds: ThresholdsSchema.pipe(
    Schema.withDecodingDefaultType(Effect.sync(() => ({ low: 30, medium: 90, high: 180, veryHigh: 365 }))),
  ),
  fileUpdateFrequencyThresholds: ThresholdsSchema.pipe(
    Schema.withDecodingDefaultType(Effect.sync(() => ({ low: 5, medium: 20, high: 50, veryHigh: 100 }))),
  ),
  fileContributorsCountThresholds: ThresholdsSchema.pipe(
    Schema.withDecodingDefaultType(Effect.sync(() => ({ low: 1, medium: 5, high: 10, veryHigh: 25 }))),
  ),
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

  getFileAgeThresholds(config: AnalysisConfigType): Thresholds {
    const t = config.fileAgeThresholds
    return new Thresholds(t.low, t.medium, t.high, t.veryHigh)
  },

  getFileUpdateFrequencyThresholds(config: AnalysisConfigType): Thresholds {
    const t = config.fileUpdateFrequencyThresholds
    return new Thresholds(t.low, t.medium, t.high, t.veryHigh)
  },

  getFileContributorsCountThresholds(config: AnalysisConfigType): Thresholds {
    const t = config.fileContributorsCountThresholds
    return new Thresholds(t.low, t.medium, t.high, t.veryHigh)
  },
}
