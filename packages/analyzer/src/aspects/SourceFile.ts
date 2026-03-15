import type { NamedSourceCodeAspect } from "./NamedSourceCodeAspect.js"

export interface SourceFileType {
  relativePath: string
  extension: string
  linesOfCode: number
  content: string
  lines: string[]
  cleanedLines: string[]
  cleanedLinesForDuplication: string[]
  unitsCount: number
  unitsMcCabeIndexSum: number
  linesOfCodeInUnits: number
  logicalComponents: NamedSourceCodeAspect[]
  concerns: NamedSourceCodeAspect[]
}

export class SourceFile implements SourceFileType {
  relativePath: string
  extension: string
  linesOfCode: number = 0
  content: string = ""
  lines: string[] = []
  cleanedLines: string[] = []
  cleanedLinesForDuplication: string[] = []
  unitsCount: number = 0
  unitsMcCabeIndexSum: number = 0
  linesOfCodeInUnits: number = 0
  logicalComponents: NamedSourceCodeAspect[] = []
  concerns: NamedSourceCodeAspect[] = []

  constructor(relativePath: string, content: string = "") {
    this.relativePath = relativePath
    this.extension = SourceFile.getExtension(relativePath)
    if (content) {
      this.content = content
      this.lines = content.split("\n")
    }
  }

  static getExtension(path: string): string {
    const lastDot = path.lastIndexOf(".")
    if (lastDot < 0) return ""
    return path.substring(lastDot + 1).toLowerCase()
  }

  setLinesOfCodeFromCleanedLines(): void {
    this.linesOfCode = this.cleanedLines.length
  }

  isInLogicalComponent(name: string): boolean {
    return this.logicalComponents.some((c) => c.name === name)
  }

  getLongLinesCount(threshold: number): number {
    return this.lines.filter((line) => line.length > threshold).length
  }
}
