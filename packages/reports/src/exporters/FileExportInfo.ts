import type { SourceFileType } from "@planetnik/analyzer"

export interface FileExportInfo {
  relativePath: string
  extension: string
  linesOfCode: number
  components: string[]
  concerns: string[]
}

export function fileExportInfoFromSourceFile(file: SourceFileType): FileExportInfo {
  return {
    relativePath: file.relativePath,
    extension: file.extension,
    linesOfCode: file.linesOfCode,
    components: file.logicalComponents.map((c) => c.name),
    concerns: file.concerns.map((c) => c.name),
  }
}
