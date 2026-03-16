export class SearchExpression {
  expression: string

  constructor(expression: string = "") {
    this.expression = expression
  }

  matches(content: string): boolean {
    try {
      return new RegExp(this.expression).test(content)
    } catch {
      return false
    }
  }

  getMatchedRegex(text: string): string | null {
    try {
      const match = text.match(new RegExp(this.expression))
      return match ? match[0] : null
    } catch {
      return null
    }
  }
}
