import type { SourceFileType } from "@planetnik/analyzer"
import type { FileExportInfo } from "./FileExportInfo.js"
import { fileExportInfoFromSourceFile } from "./FileExportInfo.js"

export interface FilesExportInfo {
  timestamp: string
  srcRoot: string
  title: string
  totalFilesCount: number
  totalLinesOfCode: number
  files: FileExportInfo[]
}

export class FileListExporter {
  static exportFiles(
    sourceFiles: SourceFileType[],
    title: string,
    srcRoot: string,
    timestamp: string,
  ): FilesExportInfo {
    const files = sourceFiles.map(fileExportInfoFromSourceFile)
    return {
      timestamp,
      srcRoot,
      title,
      totalFilesCount: sourceFiles.length,
      totalLinesOfCode: sourceFiles.reduce((sum, f) => sum + f.linesOfCode, 0),
      files,
    }
  }
}
