import type { SourceFile } from "../aspects/SourceFile.js"
import type { SourceFileFilterType } from "../core/SourceFileFilter.js"

export class DependencyAnchor {
  static readonly MAX_REGEX_LINE_SEARCH_DEPTH = 1000

  anchor: string
  codeFragment: string = ""
  dependencyPatterns: string[] = []
  sourceFiles: SourceFile[] = []
  filters: SourceFileFilterType[] = []

  constructor(anchor: string = "") {
    this.anchor = anchor
  }

  isLinkedFrom(content: string): boolean {
    return this.getDependencyCodeFragment(content) !== null
  }

  getDependencyCodeFragment(content: string): string | null {
    const lines = content.split("\n")
    for (const line of lines) {
      if (this.matchesLine(line)) {
        return line
      }
    }
    return null
  }

  matchesLine(line: string): boolean {
    let normalized = line.replace(/\t/g, " ")
    if (normalized.length > DependencyAnchor.MAX_REGEX_LINE_SEARCH_DEPTH) {
      normalized = normalized.substring(0, DependencyAnchor.MAX_REGEX_LINE_SEARCH_DEPTH)
    }
    for (const pattern of this.dependencyPatterns) {
      try {
        if (new RegExp(`^(?:${pattern})$`).test(normalized)) {
          return true
        }
      } catch {
        // skip invalid regex
      }
    }
    return false
  }
}
