import { Schema } from "@effect/schema"

const RangeSchema = Schema.Struct({
  min: Schema.optionalWith(Schema.String, { default: () => "0" }),
  max: Schema.optionalWith(Schema.String, { default: () => "0" }),
  tolerance: Schema.optionalWith(Schema.String, { default: () => "0" }),
})

export type RangeType = typeof RangeSchema.Type

export const Range = {
  schema: RangeSchema,

  make(input: Partial<RangeType>): RangeType {
    return Schema.decodeUnknownSync(RangeSchema)(input)
  },

  isInRange(range: RangeType, value: number): boolean {
    const min = parseFloat(range.min)
    const max = parseFloat(range.max)
    return value >= min && value <= max
  },

  isInRangeWithTolerance(range: RangeType, value: number): boolean {
    const min = parseFloat(range.min) - parseFloat(range.tolerance)
    const max = parseFloat(range.max) + parseFloat(range.tolerance)
    return value >= min && value <= max
  },

  getTextDescription(range: RangeType): string {
    const tolerance = parseFloat(range.tolerance)
    const base = `[${range.min} - ${range.max}]`
    return tolerance > 0 ? `${base} ±${range.tolerance}` : base
  },
}
