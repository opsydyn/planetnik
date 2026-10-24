const MAX_TEXT_LENGTH = 1000

const compiledPatterns = new Map<string, RegExp>()

function getPattern(pattern: string): RegExp | null {
  const cached = compiledPatterns.get(pattern)
  if (cached) return cached
  try {
    const compiled = new RegExp(pattern)
    compiledPatterns.set(pattern, compiled)
    return compiled
  } catch {
    return null
  }
}

export class RegexUtils {
  static matchesEntirely(pattern: string, text: string): boolean {
    const re = getPattern(`^(?:${pattern})$`)
    if (!re) return false
    try {
      return re.test(text)
    } catch {
      return false
    }
  }

  static matchesAnyPattern(text: string, patterns: readonly string[]): boolean {
    return patterns.some((p) => RegexUtils.matchesEntirely(p, text))
  }

  static doesNotMatchAnyPattern(text: string, patterns: readonly string[]): boolean {
    return !RegexUtils.matchesAnyPattern(text, patterns)
  }

  static getMatchedRegex(text: string, pattern: string): string {
    try {
      const re = new RegExp(pattern)
      const match = text.match(re)
      if (!match) return ""
      const result = match[0]!
      return result.length > MAX_TEXT_LENGTH ? result.slice(0, MAX_TEXT_LENGTH) : result
    } catch {
      return ""
    }
  }

  static getMatchedRegexesNoLimits(text: string, pattern: string): string[] {
    try {
      const re = new RegExp(pattern, "g")
      const matches = text.matchAll(re)
      return Array.from(matches, (m) => m[0]!)
    } catch {
      return []
    }
  }

  static getLastMatchedRegex(text: string, pattern: string): string {
    const matches = RegexUtils.getMatchedRegexesNoLimits(text, pattern)
    return matches.length > 0 ? matches[matches.length - 1]! : ""
  }

  static reset(): void {
    compiledPatterns.clear()
  }
}
