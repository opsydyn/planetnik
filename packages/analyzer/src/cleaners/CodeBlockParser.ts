import { CleaningResult } from "./CleaningResult.js"

export class CodeBlockParser {
  startMarker: string = '"'
  endMarker: string = '"'
  escapeMarker: string = "\\"
  removeWhenCleaning: boolean = true

  constructor(
    startMarker: string = '"',
    endMarker: string = '"',
    escapeMarker: string = "\\",
    removeWhenCleaning: boolean = true,
  ) {
    this.startMarker = startMarker
    this.endMarker = endMarker
    this.escapeMarker = escapeMarker
    this.removeWhenCleaning = removeWhenCleaning
  }

  getStringStartIndex(content: string, fromIndex: number): number {
    return content.indexOf(this.startMarker, fromIndex)
  }

  getStringEndIndex(content: string, fromIndex: number): number {
    let endIndex = content.indexOf(this.endMarker, fromIndex)
    if (this.escapeMarker) {
      const escapedEndMarker = this.escapeMarker + this.endMarker
      const escapedEscapeMarker = this.escapeMarker + this.escapeMarker
      const ignoreEscapedEscapeMarker = escapedEndMarker === escapedEscapeMarker

      let index1 = content.indexOf(escapedEndMarker, fromIndex)
      let index2 = ignoreEscapedEscapeMarker ? -1 : content.indexOf(escapedEscapeMarker, fromIndex)

      while (true) {
        while (index2 >= 0 && index1 >= 0 && index1 <= endIndex && index2 <= index1) {
          index1 = content.indexOf(escapedEndMarker, index2 + escapedEscapeMarker.length * 2)
          index2 = ignoreEscapedEscapeMarker
            ? -1
            : content.indexOf(escapedEscapeMarker, index2 + escapedEscapeMarker.length * 2)
        }

        if (endIndex > 0 && index1 >= 0 && index1 <= endIndex) {
          const continueFrom = index1 + escapedEndMarker.length
          endIndex = content.indexOf(this.endMarker, continueFrom)
          index1 = content.indexOf(escapedEndMarker, continueFrom)
          index2 = ignoreEscapedEscapeMarker ? -1 : content.indexOf(escapedEscapeMarker, continueFrom)
        } else {
          break
        }
      }
    }
    return endIndex
  }

  cleanOrSkip(content: string, startIndex: number): CleaningResult {
    const endIndex = this.getStringEndIndex(content, startIndex + 1)

    if (endIndex === -1) {
      return new CleaningResult(content.substring(0, startIndex), startIndex)
    }

    if (this.removeWhenCleaning) {
      const contentBefore = content.substring(0, startIndex)
      const contentAfter = content.substring(endIndex + this.endMarker.length)
      const contentInMiddle = content.substring(startIndex, endIndex)
      const newlineCount = (contentInMiddle.match(/\n/g) || []).length
      let replacement = "\n".repeat(newlineCount)
      if (this.endMarker === "\n") replacement += "\n"
      return new CleaningResult(contentBefore + replacement + contentAfter, (contentBefore + replacement).length)
    }

    return new CleaningResult(content, endIndex + this.endMarker.length)
  }
}
