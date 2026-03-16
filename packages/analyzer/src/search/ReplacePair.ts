export class ReplacePair {
  replace: string
  with: string

  constructor(replace: string = "", withValue: string = "") {
    this.replace = replace
    this.with = withValue
  }

  replaceIn(text: string): string {
    if (!this.replace) return text
    try {
      const regex = new RegExp(this.replace)
      let result = text
      let match = result.match(regex)
      while (match) {
        result = result.replace(match[0], this.with)
        match = result.match(regex)
      }
      return result
    } catch {
      return text
    }
  }
}
