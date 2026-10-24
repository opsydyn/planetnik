import { Effect, Schema } from "effect"
import { SourceFileFilter } from "../core/SourceFileFilter.js"
import type { SourceFile } from "./SourceFile.js"

const NamedSourceCodeAspectSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.withDecodingDefaultType(Effect.sync(() => ""))),
  sourceFileFilters: Schema.Array(SourceFileFilter.schema).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
  files: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultType(Effect.sync(() => []))),
})

export class NamedSourceCodeAspect {
  readonly name: string
  sourceFileFilters: ReturnType<typeof SourceFileFilter.make>[]
  files: string[]
  sourceFiles: SourceFile[] = []
  filtering: string = ""

  constructor(
    name: string = "",
    sourceFileFilters: ReturnType<typeof SourceFileFilter.make>[] = [],
    files: string[] = [],
  ) {
    this.name = name
    this.sourceFileFilters = sourceFileFilters
    this.files = files
  }

  static schema = NamedSourceCodeAspectSchema

  static make(input: {
    name?: string
    sourceFileFilters?: ReturnType<typeof SourceFileFilter.make>[]
    files?: string[]
  }): NamedSourceCodeAspect {
    return new NamedSourceCodeAspect(input.name ?? "", input.sourceFileFilters ?? [], input.files ?? [])
  }

  getLinesOfCode(): number {
    return this.sourceFiles.reduce((sum, f) => sum + f.linesOfCode, 0)
  }

  remove(other: NamedSourceCodeAspect): void {
    const otherPaths = new Set(other.sourceFiles.map((f) => f.relativePath))
    this.sourceFiles = this.sourceFiles.filter((f) => !otherPaths.has(f.relativePath))
  }

  getFileSystemFriendlyName(prefix: string): string {
    const safe = this.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    return `${prefix}${safe}`
  }
}
