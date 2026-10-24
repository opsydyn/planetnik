import type { ContributorPerExtensionStats } from "./ContributorPerExtensionStats.js"

export class CommitsPerExtension {
  extension: string
  commitsCount: number = 0
  committers: string[] = []
  filesCount: number = 0
  commitsCount30Days: number = 0
  committers30Days: string[] = []
  filesCount30Days: number = 0
  commitsCount90Days: number = 0
  committers90Days: string[] = []
  filesCount90Days: number = 0
  contributorPerExtensionStats: ContributorPerExtensionStats[] = []

  constructor(extension: string = "") {
    this.extension = extension
  }
}
