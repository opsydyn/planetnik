import type { FoundLine } from "./FoundLine.js"
import { FoundText } from "./FoundText.js"
import type { SearchRequest } from "./SearchRequest.js"

export interface SourceFileSearchData {
  filePath: string
  linesWithSearchedContent: FoundLine[]
}

export class SearchResult {
  totalNumberOfFiles: number = 0
  totalLinesCount: number = 0
  foundFiles: Map<string, SourceFileSearchData> = new Map()
  foundLinesCount: number = 0
  maxLines: number = 0
  maxNumberOfFoundInstances: number = 0
  searchRequest: SearchRequest

  constructor(searchRequest: SearchRequest) {
    this.searchRequest = searchRequest
  }

  getFoundTextList(): FoundText[] {
    const map = new Map<string, FoundText>()

    for (const data of this.foundFiles.values()) {
      for (const line of data.linesWithSearchedContent) {
        const key = line.foundText
        const existing = map.get(key)
        if (existing) {
          existing.count++
        } else {
          map.set(key, new FoundText(key, 1))
        }
      }
    }

    return Array.from(map.values())
  }

  getMaxCountPerText(): number {
    let max = 0
    for (const ft of this.getFoundTextList()) {
      max = Math.max(max, ft.count)
    }
    return max
  }

  getTotalNumberOfMatchingLines(): number {
    let count = 0
    for (const ft of this.getFoundTextList()) {
      count += ft.count
    }
    return count
  }
}
