import { Effect, Schema } from "effect"
import { Link, type LinkType } from "./Link.js"

const MetadataSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  description: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  tooltip: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  logoLink: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  links: Schema.Array(Link.schema).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
})

export type MetadataType = {
  name: string
  description: string
  tooltip: string
  logoLink: string
  links: LinkType[]
}

export const Metadata = {
  schema: MetadataSchema,

  make(input: Partial<MetadataType>): MetadataType {
    const decoded = Schema.decodeUnknownSync(MetadataSchema)(input)
    return {
      name: decoded.name,
      description: decoded.description,
      tooltip: decoded.tooltip,
      logoLink: decoded.logoLink,
      links: [...decoded.links],
    }
  },
}
