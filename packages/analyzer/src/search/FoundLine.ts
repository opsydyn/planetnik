export class FoundLine {
  lineNumber: number
  line: string
  foundText: string

  constructor(lineNumber: number = 0, line: string = "", foundText: string = "") {
    this.lineNumber = lineNumber
    this.line = line
    this.foundText = foundText
  }

  toString(): string {
    return `Line ${this.lineNumber}: ${this.line.trim()}`
  }
}
