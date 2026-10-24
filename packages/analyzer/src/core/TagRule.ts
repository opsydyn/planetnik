import { Effect, Schema } from "effect"

const TagRuleSchema = Schema.Struct({
  tag: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  color: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  pathPatterns: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  excludePathPatterns: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
})

export type TagRuleType = typeof TagRuleSchema.Type

export const TagRule = {
  schema: TagRuleSchema,

  make(input: Partial<TagRuleType>): TagRuleType {
    return Schema.decodeUnknownSync(TagRuleSchema)(input)
  },
}
