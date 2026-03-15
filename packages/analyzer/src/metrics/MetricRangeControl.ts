import { Schema } from "@effect/schema"
import { Range } from "../core/Range.js"

const MetricRangeControlSchema = Schema.Struct({
  metric: Schema.optionalWith(Schema.String, { default: () => "" }),
  description: Schema.optionalWith(Schema.String, { default: () => "" }),
  desiredRange: Schema.optionalWith(Range.schema, { default: () => Range.make({}) }),
})

export type MetricRangeControlType = typeof MetricRangeControlSchema.Type

export const MetricRangeControl = {
  schema: MetricRangeControlSchema,

  make(input: Partial<MetricRangeControlType>): MetricRangeControlType {
    return Schema.decodeUnknownSync(MetricRangeControlSchema)(input)
  },
}
