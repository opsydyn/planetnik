import { Schema } from "@effect/schema"

const LinkSchema = Schema.Struct({
  label: Schema.optionalWith(Schema.String, { default: () => "" }),
  href: Schema.optionalWith(Schema.String, { default: () => "" }),
})

export type LinkType = typeof LinkSchema.Type

export const Link = {
  schema: LinkSchema,

  make(input: Partial<LinkType>): LinkType {
    return Schema.decodeUnknownSync(LinkSchema)(input)
  },
}
