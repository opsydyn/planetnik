export class CleanedContent {
  cleanedContent: string
  fileLineIndexes: number[]

  constructor(cleanedContent: string = "", fileLineIndexes: number[] = []) {
    this.cleanedContent = cleanedContent
    this.fileLineIndexes = fileLineIndexes
  }

  getCleanedLinesCount(): number {
    if (!this.cleanedContent) return 0
    return this.cleanedContent.split("\n").filter((l) => l.trim().length > 0).length
  }

  getLines(): string[] {
    if (!this.cleanedContent) return []
    return this.cleanedContent.split("\n")
  }
}
