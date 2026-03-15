import { Schema } from "@effect/schema"

const TagRuleSchema = Schema.Struct({
  tag: Schema.optionalWith(Schema.String, { default: () => "" }),
  color: Schema.optionalWith(Schema.String, { default: () => "" }),
  pathPatterns: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  excludePathPatterns: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
})

export type TagRuleType = typeof TagRuleSchema.Type

export const TagRule = {
  schema: TagRuleSchema,

  make(input: Partial<TagRuleType>): TagRuleType {
    return Schema.decodeUnknownSync(TagRuleSchema)(input)
  },
}
