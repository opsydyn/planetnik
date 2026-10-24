import type { Contributor } from "../contributors/Contributor.js"
import { ContributorRepositoryInfo } from "./ContributorRepositoryInfo.js"
import type { RepositoryAnalysisResult } from "./LandscapeAnalysisResults.js"

export class ContributorRepositories {
  contributor: Contributor
  repositories: ContributorRepositoryInfo[] = []
  members: ContributorRepositories[] = []

  constructor(contributor: Contributor) {
    this.contributor = contributor
  }

  addRepository(
    repoResult: RepositoryAnalysisResult,
    firstCommitDate: string,
    latestCommitDate: string,
    commitsCount: number,
    commits30Days: number,
    commits90Days: number,
    commits180Days: number,
    commits365Days: number,
    commitDates: string[],
  ): void {
    const existing = this.getRepositoryByName(repoResult.name)
    if (existing) {
      if (firstCommitDate < existing.firstCommitDate) existing.firstCommitDate = firstCommitDate
      if (latestCommitDate > existing.latestCommitDate) existing.latestCommitDate = latestCommitDate
      existing.commits30Days += commits30Days
      existing.commits90Days += commits90Days
      existing.commits180Days += commits180Days
      existing.commits365Days += commits365Days
      existing.commitsCount += commitsCount
      for (const date of commitDates) {
        if (!existing.commitDates.includes(date)) {
          existing.commitDates.push(date)
        }
      }
    } else {
      this.repositories.push(
        new ContributorRepositoryInfo(
          repoResult,
          firstCommitDate,
          latestCommitDate,
          commitsCount,
          commits30Days,
          commits90Days,
          commits180Days,
          commits365Days,
          commitDates,
        ),
      )
    }
  }

  private getRepositoryByName(name: string): ContributorRepositoryInfo | null {
    for (const repo of this.repositories) {
      if (repo.repositoryAnalysisResult?.name.toLowerCase() === name.toLowerCase()) {
        return repo
      }
    }
    return null
  }
}
