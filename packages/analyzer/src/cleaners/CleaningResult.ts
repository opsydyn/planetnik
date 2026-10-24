export class CleaningResult {
  content: string
  endIndex: number

  constructor(content: string, endIndex: number) {
    this.content = content
    this.endIndex = endIndex
  }
}
