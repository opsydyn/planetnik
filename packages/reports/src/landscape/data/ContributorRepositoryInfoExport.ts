import type { ContributorRepositoryInfo } from "@planetnik/analyzer"

export class ContributorRepositoryInfoExport {
  name: string
  description: string
  firstCommitDate: string
  latestCommitDate: string
  commitsCount: number
  commits30Days: number
  commits90Days: number
  commits180Days: number
  commits365Days: number
  commitDates: string[]

  constructor(info: ContributorRepositoryInfo) {
    const metadata = info.repositoryAnalysisResult?.metadata
    this.name = metadata?.name ?? ""
    this.description = metadata?.description ?? ""
    this.firstCommitDate = info.firstCommitDate
    this.latestCommitDate = info.latestCommitDate
    this.commitsCount = info.commitsCount
    this.commits30Days = info.commits30Days
    this.commits90Days = info.commits90Days
    this.commits180Days = info.commits180Days
    this.commits365Days = info.commits365Days
    this.commitDates = [...info.commitDates]
  }
}
