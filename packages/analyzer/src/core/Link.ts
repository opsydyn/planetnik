import { Effect, Schema } from "effect"

const LinkSchema = Schema.Struct({
  label: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  href: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
})

export type LinkType = typeof LinkSchema.Type

export const Link = {
  schema: LinkSchema,

  make(input: Partial<LinkType>): LinkType {
    return Schema.decodeUnknownSync(LinkSchema)(input)
  },
}
