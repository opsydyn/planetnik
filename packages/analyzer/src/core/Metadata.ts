import { Schema } from "@effect/schema"
import { Link } from "./Link.js"

const MetadataSchema = Schema.Struct({
  name: Schema.optionalWith(Schema.String, { default: () => "" }),
  description: Schema.optionalWith(Schema.String, { default: () => "" }),
  tooltip: Schema.optionalWith(Schema.String, { default: () => "" }),
  logoLink: Schema.optionalWith(Schema.String, { default: () => "" }),
  links: Schema.optionalWith(Schema.Array(Link.schema), { default: () => [] }),
})

export type MetadataType = typeof MetadataSchema.Type

export const Metadata = {
  schema: MetadataSchema,

  make(input: Partial<MetadataType>): MetadataType {
    return Schema.decodeUnknownSync(MetadataSchema)(input)
  },
}
