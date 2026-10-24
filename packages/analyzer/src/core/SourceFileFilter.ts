import { Effect, Schema } from "effect"

const SourceFileFilterSchema = Schema.Struct({
  pathPattern: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  contentPattern: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  exception: Schema.Boolean.pipe(Schema.withDecodingDefaultType(Effect.sync(() => false))),
  note: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
})

export type SourceFileFilterType = typeof SourceFileFilterSchema.Type

export const SourceFileFilter = {
  schema: SourceFileFilterSchema,

  make(input: Partial<SourceFileFilterType>): SourceFileFilterType {
    return Schema.decodeUnknownSync(SourceFileFilterSchema)(input)
  },

  pathMatches(filter: SourceFileFilterType, path: string): boolean {
    if (!filter.pathPattern) return true
    try {
      // Normalize path separators for cross-platform
      const normalizedPath = path.replace(/\\/g, "/")
      return new RegExp(`^(?:${filter.pathPattern})$`).test(normalizedPath)
    } catch {
      return false
    }
  },

  contentMatches(filter: SourceFileFilterType, lines: readonly string[]): boolean {
    if (!filter.contentPattern) return true
    try {
      const re = new RegExp(filter.contentPattern)
      return lines.some((line) => re.test(line))
    } catch {
      return false
    }
  },

  matches(filter: SourceFileFilterType, path: string, lines: readonly string[]): boolean {
    const pathMatch = SourceFileFilter.pathMatches(filter, path)
    const contentMatch = SourceFileFilter.contentMatches(filter, lines)
    return pathMatch && contentMatch
  },
}
