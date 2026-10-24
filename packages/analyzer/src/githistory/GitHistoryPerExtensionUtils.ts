import { DateUtils } from "../filehistory/FileHistoryUtils.js"
import { CommitsPerExtension } from "./CommitsPerExtension.js"
import { ContributorPerExtensionStats } from "./ContributorPerExtensionStats.js"
import type { FileUpdate } from "./GitHistoryUtils.js"

export class GitHistoryPerExtensionUtils {
  private map = new Map<string, CommitsPerExtension>()
  private emails = new Map<string, string[]>()
  private emails30Days = new Map<string, string[]>()
  private emails90Days = new Map<string, string[]>()
  private paths = new Map<string, string[]>()
  private paths30Days = new Map<string, string[]>()
  private paths90Days = new Map<string, string[]>()
  private contributorStatsMap = new Map<string, Map<string, ContributorPerExtensionStats>>()

  getCommitsPerExtensions(fileUpdates: FileUpdate[]): CommitsPerExtension[] {
    for (const update of fileUpdates) {
      const extension = update.getExtension()
      const path = update.path
      const email = update.email
      const date = update.date
      const isLessThan30DaysAgo = DateUtils.isCommittedLessThanDaysAgo(date, 30)
      const isLessThan90DaysAgo = DateUtils.isCommittedLessThanDaysAgo(date, 90)

      const cpe = this.getOrCreateCommitsPerExtension(extension)

      this.updateTotalCounts(extension, path, email, cpe)

      if (isLessThan30DaysAgo) {
        this.update30DaysCounts(extension, path, email, cpe)
      }
      if (isLessThan90DaysAgo) {
        this.update90DaysCounts(extension, path, email, cpe)
      }

      if (!this.contributorStatsMap.has(extension)) {
        this.contributorStatsMap.set(extension, new Map())
      }
      const extStatsMap = this.contributorStatsMap.get(extension)!
      if (!extStatsMap.has(email)) {
        extStatsMap.set(email, new ContributorPerExtensionStats(email))
      }

      const contributorStats = extStatsMap.get(email)!
      contributorStats.fileUpdates++
      if (isLessThan30DaysAgo) {
        contributorStats.fileUpdates30Days++
      }
      if (isLessThan90DaysAgo) {
        contributorStats.fileUpdates90Days++
      }
    }

    for (const [extension, cpe] of this.map) {
      const extStatsMap = this.contributorStatsMap.get(extension)
      if (extStatsMap) {
        cpe.contributorPerExtensionStats = [...extStatsMap.values()]
      }
    }

    const list = [...this.map.values()]
    list.sort(
      (a, b) =>
        b.committers30Days.length - a.committers30Days.length ||
        b.committers90Days.length - a.committers90Days.length ||
        b.committers.length - a.committers.length,
    )
    return list
  }

  private updateTotalCounts(extension: string, path: string, email: string, cpe: CommitsPerExtension): void {
    cpe.commitsCount++
    GitHistoryPerExtensionUtils.addUnique(this.emails, extension, email)
    GitHistoryPerExtensionUtils.addUnique(this.paths, extension, path)
    cpe.committers = this.emails.get(extension) ?? []
    cpe.filesCount = (this.paths.get(extension) ?? []).length
  }

  private update30DaysCounts(extension: string, path: string, email: string, cpe: CommitsPerExtension): void {
    cpe.commitsCount30Days++
    GitHistoryPerExtensionUtils.addUnique(this.emails30Days, extension, email)
    GitHistoryPerExtensionUtils.addUnique(this.paths30Days, extension, path)
    cpe.committers30Days = this.emails30Days.get(extension) ?? []
    cpe.filesCount30Days = (this.paths30Days.get(extension) ?? []).length
  }

  private update90DaysCounts(extension: string, path: string, email: string, cpe: CommitsPerExtension): void {
    cpe.commitsCount90Days++
    GitHistoryPerExtensionUtils.addUnique(this.emails90Days, extension, email)
    GitHistoryPerExtensionUtils.addUnique(this.paths90Days, extension, path)
    cpe.committers90Days = this.emails90Days.get(extension) ?? []
    cpe.filesCount90Days = (this.paths90Days.get(extension) ?? []).length
  }

  private getOrCreateCommitsPerExtension(extension: string): CommitsPerExtension {
    let cpe = this.map.get(extension)
    if (!cpe) {
      cpe = new CommitsPerExtension(extension)
      this.map.set(extension, cpe)
    }
    return cpe
  }

  private static addUnique(map: Map<string, string[]>, key: string, value: string): void {
    let list = map.get(key)
    if (!list) {
      list = []
      map.set(key, list)
    }
    if (!list.includes(value)) {
      list.push(value)
    }
  }
}
