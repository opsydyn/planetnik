import type { SourceFile } from "../aspects/SourceFile.js"

export class DuplicatedFileBlock {
  sourceFile: SourceFile | null = null
  sourceFileCleanedLinesOfCode: number = 0
  startLine: number = 0
  endLine: number = 0
  cleanedStartLine: number = 0
  cleanedEndLine: number = 0

  getBlockSize(): number {
    return this.cleanedEndLine - this.cleanedStartLine + 1
  }

  getPercentage(): number {
    if (this.sourceFileCleanedLinesOfCode === 0) return 0
    return (100.0 * this.getBlockSize()) / this.sourceFileCleanedLinesOfCode
  }
}
