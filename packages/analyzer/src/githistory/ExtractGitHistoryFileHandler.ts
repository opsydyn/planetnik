export class ExtractGitHistoryFileHandler {
  extractSubHistory(originalLines: string[], prefix: string): string[] {
    const lines: string[] = []

    for (const line of originalLines) {
      const elements = line.split(" ")
      if (elements.length >= 4) {
        const path = elements[3]
        if (path?.startsWith(prefix)) {
          const stripped = path.substring(prefix.length).replace(/^\//, "")
          elements[3] = stripped
          lines.push(elements.join(" "))
        }
      }
    }

    return lines
  }
}
