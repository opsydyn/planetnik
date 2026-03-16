import type { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import type { FilePairChangedTogether } from "../results/FilesHistoryAnalysisResults.js"
import { DateUtils } from "./FileHistoryUtils.js"
import type { FileModificationHistory } from "./FileModificationHistory.js"

const PAIR_LIST_LIMIT = 1_000_000

export class FilePairsChangedTogetherEngine {
  private filePairsMap = new Map<string, FilePairChangedTogether>()
  private pairCount = 0
  private rangeInDays: number

  constructor(rangeInDays: number) {
    this.rangeInDays = rangeInDays
  }

  populate(aspect: NamedSourceCodeAspect, fileHistories: FileModificationHistory[]): void {
    const commitsIdMap = new Map<string, Set<FileModificationHistory>>()
    const aspectPaths = new Set(aspect.sourceFiles.map((f) => f.relativePath.toLowerCase()))

    for (const fileHistory of fileHistories) {
      if (!aspectPaths.has(fileHistory.path.toLowerCase())) continue

      for (const commit of fileHistory.commits) {
        if (this.pairCount >= PAIR_LIST_LIMIT) return
        if (this.rangeInDays > 0 && !DateUtils.isDateWithinRange(commit.date, this.rangeInDays)) continue

        const existing = commitsIdMap.get(commit.id)
        if (!existing) {
          const set = new Set<FileModificationHistory>()
          set.add(fileHistory)
          commitsIdMap.set(commit.id, set)
        } else if (!existing.has(fileHistory)) {
          for (const other of existing) {
            this.addFilePair(fileHistory, other, commit.id, commit.date)
          }
          existing.add(fileHistory)
        }
      }
    }
  }

  getFilePairsList(): FilePairChangedTogether[] {
    return Array.from(this.filePairsMap.values()).sort((a, b) => b.commits.length - a.commits.length)
  }

  private addFilePair(h1: FileModificationHistory, h2: FileModificationHistory, commitId: string, date: string): void {
    const p1 = h1.path.toLowerCase()
    const p2 = h2.path.toLowerCase()
    const key1 = `${p1}_${p2}`
    const key2 = `${p2}_${p1}`

    let pair = this.filePairsMap.get(key1) ?? this.filePairsMap.get(key2)

    if (!pair) {
      pair = {
        sourceFile1Path: h1.path,
        sourceFile2Path: h2.path,
        commitsCountFile1: h1.commits.length,
        commitsCountFile2: h2.commits.length,
        commits: [],
        latestCommit: "",
      }
      this.filePairsMap.set(key1, pair)
      this.pairCount++
    }

    pair.commits.push(commitId)
    if (!pair.latestCommit || date > pair.latestCommit) {
      pair.latestCommit = date
    }
  }
}
