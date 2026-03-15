import { Schema } from "@effect/schema"
import { MetricRangeControl } from "./MetricRangeControl.js"

const MetricsWithGoalSchema = Schema.Struct({
  goal: Schema.optionalWith(Schema.String, { default: () => "" }),
  description: Schema.optionalWith(Schema.String, { default: () => "" }),
  controls: Schema.optionalWith(Schema.Array(MetricRangeControl.schema), { default: () => [] }),
})

export type MetricsWithGoalType = typeof MetricsWithGoalSchema.Type

export const MetricsWithGoal = {
  schema: MetricsWithGoalSchema,

  make(input: Partial<MetricsWithGoalType>): MetricsWithGoalType {
    return Schema.decodeUnknownSync(MetricsWithGoalSchema)(input)
  },
}
