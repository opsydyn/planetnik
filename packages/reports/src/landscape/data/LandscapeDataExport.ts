import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type {
  ContributorRepositories,
  LandscapeAnalysisResults,
  RepositoryAnalysisResult,
  TeamsConfig,
} from "@planetnik/analyzer"
import type { TagMap } from "../utils/TagMap.js"
import { ContributorExport } from "./ContributorExport.js"
import { RepositoryExport } from "./RepositoryExport.js"

export class LandscapeDataExport {
  static readonly REPOSITORIES_DATA_FILE_NAME = "repositories.txt"
  static readonly REPOSITORIES_DATA_JSON_FILE_NAME = "repositories.json"

  private analysisResults: LandscapeAnalysisResults
  private dataFolder: string

  constructor(analysisResults: LandscapeAnalysisResults, folder: string) {
    this.analysisResults = analysisResults
    this.reportsFolder = folder

    this.dataFolder = join(folder, "data")
    if (!existsSync(this.dataFolder)) {
      mkdirSync(this.dataFolder, { recursive: true })
    }
  }

  exportRepositories(tagMap: TagMap): void {
    this.exportRepositoriesJson()

    this.exportRepositoriesTxt(
      this.analysisResults.repositoryAnalysisResults,
      LandscapeDataExport.REPOSITORIES_DATA_FILE_NAME,
    )
    for (const key of tagMap.keySet()) {
      const tagStats = tagMap.getTagStats(key)
      if (tagStats) {
        this.exportRepositoriesTxt(
          tagStats.repositoryAnalysisResults,
          LandscapeDataExport.getTagRepositoriesFileName(key),
        )
      }
    }
  }

  private exportRepositoriesJson(): void {
    const repositoryExports = this.analysisResults.repositoryAnalysisResults.map((r) => new RepositoryExport(r))
    writeFileSync(
      join(this.dataFolder, LandscapeDataExport.REPOSITORIES_DATA_JSON_FILE_NAME),
      JSON.stringify(repositoryExports, null, 2),
      "utf-8",
    )
  }

  static getTagRepositoriesFileName(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_")
    return `tag_${safeKey}_repositories.txt`
  }

  private exportRepositoriesTxt(repositories: RepositoryAnalysisResult[], fileName: string): void {
    const lines: string[] = [
      "Repository\tMain language\tLOC (main)\tLOC (test)\tLOC (other)\tContributors\tLatest commit",
    ]

    for (const repo of repositories) {
      const extensions = repo.linesOfCodePerExtension
      const mainLang = extensions.length > 0 ? extensions[0].extension.toUpperCase() : "-"
      const otherLoc = repo.generatedLoc + repo.buildAndDeployLoc + repo.otherLoc

      lines.push(
        [
          repo.name,
          mainLang,
          repo.mainLoc,
          repo.testLoc,
          otherLoc,
          repo.contributors.length,
          repo.latestCommitDate,
        ].join("\t"),
      )
    }

    writeFileSync(join(this.dataFolder, fileName), lines.join("\n"), "utf-8")
  }

  exportContributors(contributors: ContributorRepositories[]): void {
    const lines: string[] = [
      "Contributor\t# commits (all time)\t# commits (30 days)\t# commits (90 days)\t# commits (180 days)\t# commits (365 days)\tFirst commit\tLatest commit\tRepositories",
    ]

    const contributorsExport: ContributorExport[] = []

    for (const cr of contributors) {
      const c = cr.contributor
      contributorsExport.push(new ContributorExport(cr))

      const repos = cr.repositories
        .filter((r) => r.repositoryAnalysisResult)
        .map((r) => r.repositoryAnalysisResult!.name)
        .join(", ")

      lines.push(
        [
          c.email,
          c.commitsCount,
          c.commitsCount30Days,
          c.commitsCount90Days,
          c.commitsCount180Days,
          c.commitsCount365Days,
          c.firstCommitDate,
          c.latestCommitDate,
          repos,
        ].join("\t"),
      )
    }

    writeFileSync(join(this.dataFolder, "contributors.txt"), lines.join("\n"), "utf-8")
    writeFileSync(join(this.dataFolder, "contributors.json"), JSON.stringify(contributorsExport, null, 2), "utf-8")
  }

  exportTeams(teams: ContributorRepositories[], _teamsConfig: TeamsConfig): void {
    const lines: string[] = [
      "Team\t# commits (all time)\t# commits (30 days)\t# commits (90 days)\t# commits (180 days)\t# commits (365 days)\tFirst commit\tLatest commit\tRepositories",
    ]

    const teamsExport: ContributorExport[] = []

    for (const cr of teams) {
      const c = cr.contributor
      teamsExport.push(new ContributorExport(cr))

      const repos = cr.repositories
        .filter((r) => r.repositoryAnalysisResult)
        .map((r) => r.repositoryAnalysisResult!.name)
        .join(", ")

      lines.push(
        [
          c.email,
          c.commitsCount,
          c.commitsCount30Days,
          c.commitsCount90Days,
          c.commitsCount180Days,
          c.commitsCount365Days,
          c.firstCommitDate,
          c.latestCommitDate,
          repos,
        ].join("\t"),
      )
    }

    writeFileSync(join(this.dataFolder, "teams.txt"), lines.join("\n"), "utf-8")
    writeFileSync(join(this.dataFolder, "teams.json"), JSON.stringify(teamsExport, null, 2), "utf-8")
  }

  exportAnalysisResults(): void {
    writeFileSync(
      join(this.dataFolder, "landscapeAnalysisResults.json"),
      JSON.stringify(this.analysisResults, null, 2),
      "utf-8",
    )
  }
}
