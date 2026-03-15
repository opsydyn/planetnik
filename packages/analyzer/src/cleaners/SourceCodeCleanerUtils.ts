import { CleanedContent } from "./CleanedContent.js"

export class SourceCodeCleanerUtils {
  static normalizeLineEnds(content: string): string {
    return content
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\t/g, "    ")
      .replace(/\f/g, "")
      .replace(new RegExp("\\x08", "g"), "")
  }

  static cleanEmptyLines(content: string): string {
    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .join("\n")
  }

  static cleanEmptyLinesWithLineIndexes(content: string): CleanedContent {
    const lines = content.split("\n")
    const cleanedLines: string[] = []
    const indexes: number[] = []

    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.trim().length > 0) {
        cleanedLines.push(lines[i]!)
        indexes.push(i)
      }
    }

    return new CleanedContent(cleanedLines.join("\n"), indexes)
  }

  static trimLines(content: string): string {
    return content
      .split("\n")
      .map((line) => line.trim().replace(/\s+/g, " "))
      .join("\n")
  }

  static splitInLines(content: string): string[] {
    return content.split("\n")
  }

  static emptyLinesMatchingPattern(pattern: string, content: string): string {
    try {
      const re = new RegExp(pattern, "gm")
      return content.replace(re, "")
    } catch {
      return content
    }
  }
}
