import { Effect, Schema } from "effect"
import { Range } from "../core/Range.js"

const MetricRangeControlSchema = Schema.Struct({
  metric: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  description: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  desiredRange: Range.schema.pipe(Schema.withDecodingDefaultType(Effect.sync(() => Range.make({})))),
})

export type MetricRangeControlType = typeof MetricRangeControlSchema.Type

export const MetricRangeControl = {
  schema: MetricRangeControlSchema,

  make(input: Partial<MetricRangeControlType>): MetricRangeControlType {
    return Schema.decodeUnknownSync(MetricRangeControlSchema)(input)
  },
}
