import { Effect, Schema } from "effect"
import { MetricRangeControl } from "./MetricRangeControl.js"

const MetricsWithGoalSchema = Schema.Struct({
  goal: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  description: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  controls: Schema.Array(MetricRangeControl.schema).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
})

export type MetricsWithGoalType = typeof MetricsWithGoalSchema.Type

export const MetricsWithGoal = {
  schema: MetricsWithGoalSchema,

  make(input: Partial<MetricsWithGoalType>): MetricsWithGoalType {
    return Schema.decodeUnknownSync(MetricsWithGoalSchema)(input)
  },
}
