import type { FoundText } from "./FoundText.js"
import type { ReplacePair } from "./ReplacePair.js"

export interface CleanedFoundText {
  foundText: FoundText
  cleanedText: string
}

export class SearchResultCleaner {
  trim: boolean = true
  startCleaningPattern: string = ""
  endCleaningPattern: string = ""
  replacePairs: ReplacePair[] = []

  getCleanedTextList(foundTextList: FoundText[]): CleanedFoundText[] {
    return foundTextList.map((ft) => ({
      foundText: ft,
      cleanedText: this.clean(ft.text),
    }))
  }

  clean(text: string): string {
    let result = text
    result = this.removeStart(result)
    result = this.removeEnd(result)
    result = this.applyReplace(result)
    if (this.trim) result = result.trim()
    return result
  }

  private removeStart(target: string): string {
    if (!this.startCleaningPattern) return target
    try {
      const match = target.match(new RegExp(this.startCleaningPattern))
      if (match && target.startsWith(match[0])) {
        return target.substring(match[0].length)
      }
    } catch {
      // invalid regex
    }
    return target
  }

  private removeEnd(target: string): string {
    if (!this.endCleaningPattern) return target
    try {
      const matches = [...target.matchAll(new RegExp(this.endCleaningPattern, "g"))]
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1]!
        const matchText = lastMatch[0]
        if (target.endsWith(matchText)) {
          return target.substring(0, target.length - matchText.length)
        }
      }
    } catch {
      // invalid regex
    }
    return target
  }

  private applyReplace(target: string): string {
    let result = target
    for (const pair of this.replacePairs) {
      result = pair.replaceIn(result)
    }
    return result
  }
}
