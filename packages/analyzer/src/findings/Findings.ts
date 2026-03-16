export class Findings {
  summary: string = ""
  content: string = ""

  isEmpty(): boolean {
    return !this.content.trim()
  }
}
