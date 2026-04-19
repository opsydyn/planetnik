import { SourceCodeCleanerUtils } from "../cleaners/SourceCodeCleanerUtils.js"

export class HaskellSourceCodeUtils {
  static cleanKeepEmptyLines(content: string): string {
    const normalized = SourceCodeCleanerUtils.normalizeLineEnds(content)
    let result = ""
    let index = 0
    let blockCommentDepth = 0

    while (index < normalized.length) {
      const current = normalized[index]!
      const next = normalized[index + 1] ?? ""

      if (blockCommentDepth > 0) {
        if (current === "{" && next === "-") {
          blockCommentDepth += 1
          index += 2
          continue
        }

        if (current === "-" && next === "}") {
          blockCommentDepth -= 1
          index += 2
          continue
        }

        if (current === "\n") {
          result += "\n"
        }

        index += 1
        continue
      }

      if (current === '"') {
        result += '""'
        index = HaskellSourceCodeUtils.findStringEnd(normalized, index + 1)
        continue
      }

      if (current === "{" && next === "-") {
        blockCommentDepth = 1
        index += 2
        continue
      }

      if (current === "-" && next === "-" && HaskellSourceCodeUtils.startsLineComment(normalized, index)) {
        index += 2
        while (index < normalized.length && normalized[index] !== "\n") {
          index += 1
        }
        continue
      }

      result += current
      index += 1
    }

    return result
  }

  static clean(content: string): string {
    return SourceCodeCleanerUtils.cleanEmptyLines(HaskellSourceCodeUtils.cleanKeepEmptyLines(content))
  }

  static stripLiteratePrefix(line: string): string {
    if (!line.startsWith(">")) {
      return line
    }

    return line[1] === " " ? line.slice(2) : line.slice(1)
  }

  static normalizeCodeLine(line: string): string {
    return HaskellSourceCodeUtils.stripLiteratePrefix(line).trim()
  }

  static getIndentationWidth(line: string): number {
    const codeLine = HaskellSourceCodeUtils.stripLiteratePrefix(line)
    const match = codeLine.match(/^\s*/)
    return match?.[0].length ?? 0
  }

  private static findStringEnd(content: string, from: number): number {
    let index = from
    let escapeNext = false

    while (index < content.length) {
      const current = content[index]!
      if (escapeNext) {
        escapeNext = false
        index += 1
        continue
      }

      if (current === "\\") {
        escapeNext = true
        index += 1
        continue
      }

      if (current === '"') {
        return index + 1
      }

      index += 1
    }

    return index
  }

  private static startsLineComment(content: string, index: number): boolean {
    const nextAfterComment = content[index + 2] ?? ""
    if (nextAfterComment.length === 0 || nextAfterComment === "\n") {
      return true
    }

    if (nextAfterComment === "|" || nextAfterComment === "^" || nextAfterComment === "-") {
      return true
    }

    return !/[!#$%&*+./<=>?@\\^|~:-]/.test(nextAfterComment)
  }
}
