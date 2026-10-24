import { Schema, SchemaRepresentation } from "effect"

// The canonical JSON codec turns undefined into null. HTTP object properties are
// instead omitted when undefined, so keep optionality without advertising null.
function normalizeOptionalProperties(
  representation: SchemaRepresentation.Representation,
): SchemaRepresentation.Representation {
  switch (representation._tag) {
    case "Objects":
      return {
        ...representation,
        propertySignatures: representation.propertySignatures.map((property) => {
          const type = property.type
          const propertyType =
            property.isOptional && type._tag === "Union"
              ? { ...type, types: type.types.filter((member) => member._tag !== "Undefined") }
              : type
          return { ...property, type: normalizeOptionalProperties(propertyType) }
        }),
        indexSignatures: representation.indexSignatures.map((signature) => ({
          ...signature,
          parameter: normalizeOptionalProperties(signature.parameter),
          type: normalizeOptionalProperties(signature.type),
        })),
      }
    case "Arrays":
      return {
        ...representation,
        elements: representation.elements.map((element) => ({
          ...element,
          type: normalizeOptionalProperties(element.type),
        })),
        rest: representation.rest.map(normalizeOptionalProperties),
      }
    case "Union":
      return { ...representation, types: representation.types.map(normalizeOptionalProperties) }
    case "Suspend":
      return { ...representation, thunk: normalizeOptionalProperties(representation.thunk) }
    case "Declaration":
      return { ...representation, typeParameters: representation.typeParameters.map(normalizeOptionalProperties) }
    case "TemplateLiteral":
      return { ...representation, parts: representation.parts.map(normalizeOptionalProperties) }
    default:
      return representation
  }
}

export function toOpenApiJsonSchema(schema: Schema.Constraint) {
  const representation = Schema.toRepresentation(Schema.toEncoded(schema))
  const document = SchemaRepresentation.toJsonSchemaDocument(
    {
      representation: normalizeOptionalProperties(representation.representation),
      references: Object.fromEntries(
        Object.entries(representation.references).map(([name, reference]) => [
          name,
          normalizeOptionalProperties(reference),
        ]),
      ),
    },
    { onExcessProperty: "error" },
  )
  return {
    ...document.schema,
    ...(Object.keys(document.definitions).length > 0 ? { $defs: document.definitions } : {}),
  }
}
