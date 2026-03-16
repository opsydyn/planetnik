import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { ContributionTimeSlot } from "../contributors/ContributionTimeSlot.js"
import { Contributor } from "../contributors/Contributor.js"
import { LandscapeAnalysisResults, type RepositoryAnalysisResult } from "./LandscapeAnalysisResults.js"
import type { LandscapeConfiguration } from "./LandscapeConfiguration.js"

export class LandscapeAnalyzer {
  private config: LandscapeConfiguration
  private landscapeRoot: string

  constructor(config: LandscapeConfiguration, landscapeRoot: string) {
    this.config = config
    this.landscapeRoot = landscapeRoot
  }

  analyze(): LandscapeAnalysisResults {
    const results = new LandscapeAnalysisResults()
    results.metadata = this.config.metadata

    // Load each repository's analysis results
    for (const repo of this.config.repositories) {
      const repoResult = this.loadRepositoryResults(repo.analysisResultsPath, repo.name)
      if (!repoResult) continue

      // Apply filters
      if (this.config.repositoryThresholdLocMain > 0 && repoResult.mainLoc < this.config.repositoryThresholdLocMain)
        continue
      if (
        this.config.ignoreRepositoriesLastUpdatedBefore &&
        repoResult.latestCommitDate &&
        repoResult.latestCommitDate < this.config.ignoreRepositoriesLastUpdatedBefore
      )
        continue

      results.repositoryAnalysisResults.push(repoResult)
    }

    this.aggregateResults(results)
    return results
  }

  private loadRepositoryResults(resultPath: string, name: string): RepositoryAnalysisResult | null {
    const fullPath = resolve(this.landscapeRoot, this.config.analysisRoot, resultPath)
    if (!existsSync(fullPath)) return null

    try {
      const data = JSON.parse(readFileSync(fullPath, "utf-8"))
      return this.mapToRepositoryResult(data, name, resultPath)
    } catch {
      return null
    }
  }

  private mapToRepositoryResult(data: Record<string, unknown>, name: string, path: string): RepositoryAnalysisResult {
    const main = (data.mainAspectAnalysisResults as Record<string, unknown>) ?? {}
    const test = (data.testAspectAnalysisResults as Record<string, unknown>) ?? {}
    const generated = (data.generatedAspectAnalysisResults as Record<string, unknown>) ?? {}
    const buildDeploy = (data.buildAndDeployAspectAnalysisResults as Record<string, unknown>) ?? {}
    const other = (data.otherAspectAnalysisResults as Record<string, unknown>) ?? {}
    const metadata = (data.metadata as Record<string, unknown>) ?? {}
    const contributorsResults = (data.contributorsAnalysisResults as Record<string, unknown>) ?? {}
    const duplication = (data.duplicationAnalysisResults as Record<string, unknown>) ?? {}
    const filesHistory = (data.filesHistoryAnalysisResults as Record<string, unknown>) ?? {}

    const contributors: Contributor[] = []
    const rawContributors = (contributorsResults.contributors as Array<Record<string, unknown>>) ?? []
    for (const rc of rawContributors) {
      const c = new Contributor()
      c.email = (rc.email as string) ?? ""
      c.commitsCount = (rc.commitsCount as number) ?? 0
      c.firstCommitDate = (rc.firstCommitDate as string) ?? ""
      c.latestCommitDate = (rc.latestCommitDate as string) ?? ""
      c.commitsCount30Days = (rc.commitsCount30Days as number) ?? 0
      c.commitsCount90Days = (rc.commitsCount90Days as number) ?? 0
      c.commitsCount180Days = (rc.commitsCount180Days as number) ?? 0
      c.commitsCount365Days = (rc.commitsCount365Days as number) ?? 0
      c.isBot = (rc.isBot as boolean) ?? false
      contributors.push(c)
    }

    return {
      name: (metadata.name as string) || name,
      analysisResultsPath: path,
      metadata: {
        name: (metadata.name as string) ?? "",
        description: (metadata.description as string) ?? "",
        tooltip: (metadata.tooltip as string) ?? "",
        logoLink: (metadata.logoLink as string) ?? "",
        links: (metadata.links as Array<{ label: string; href: string }>) ?? [],
      },
      mainLoc: (main.linesOfCode as number) ?? 0,
      mainFilesCount: (main.filesCount as number) ?? 0,
      testLoc: (test.linesOfCode as number) ?? 0,
      testFilesCount: (test.filesCount as number) ?? 0,
      generatedLoc: (generated.linesOfCode as number) ?? 0,
      buildAndDeployLoc: (buildDeploy.linesOfCode as number) ?? 0,
      otherLoc: (other.linesOfCode as number) ?? 0,
      extensions:
        (data.extensions as string[]) ??
        ((main.linesOfCodePerExtension as Array<Record<string, unknown>>) ?? []).map(
          (e) => (e.extension as string) ?? "",
        ),
      linesOfCodePerExtension: ((main.linesOfCodePerExtension as Array<Record<string, unknown>>) ?? []).map((e) => ({
        extension: (e.extension as string) ?? "",
        linesOfCode: (e.linesOfCode as number) ?? 0,
      })),
      contributors,
      firstCommitDate: (filesHistory.firstDate as string) ?? "",
      latestCommitDate: (filesHistory.latestDate as string) ?? (contributorsResults.latestCommitDate as string) ?? "",
      duplicationPercentage: (duplication.overallDuplication as number) ?? 0,
    }
  }

  private aggregateResults(results: LandscapeAnalysisResults): void {
    for (const repo of results.repositoryAnalysisResults) {
      results.totalMainLoc += repo.mainLoc
      results.totalTestLoc += repo.testLoc
      results.totalGeneratedLoc += repo.generatedLoc
      results.totalBuildAndDeployLoc += repo.buildAndDeployLoc
      results.totalOtherLoc += repo.otherLoc
      results.totalMainFilesCount += repo.mainFilesCount

      // Extensions
      for (const ext of repo.linesOfCodePerExtension) {
        results.linesOfCodePerExtension.set(
          ext.extension,
          (results.linesOfCodePerExtension.get(ext.extension) ?? 0) + ext.linesOfCode,
        )
        results.repositoriesPerExtension.set(
          ext.extension,
          (results.repositoriesPerExtension.get(ext.extension) ?? 0) + 1,
        )
      }

      // Date range
      if (repo.firstCommitDate && (!results.firstCommitDate || repo.firstCommitDate < results.firstCommitDate)) {
        results.firstCommitDate = repo.firstCommitDate
      }
      if (repo.latestCommitDate && (!results.latestCommitDate || repo.latestCommitDate > results.latestCommitDate)) {
        results.latestCommitDate = repo.latestCommitDate
      }
    }

    // Aggregate contributors across repos
    results.allContributors = this.aggregateContributors(results.repositoryAnalysisResults)
  }

  private aggregateContributors(repos: RepositoryAnalysisResult[]): Contributor[] {
    const map = new Map<string, Contributor>()

    for (const repo of repos) {
      for (const c of repo.contributors) {
        const existing = map.get(c.email)
        if (existing) {
          existing.commitsCount += c.commitsCount
          existing.commitsCount30Days += c.commitsCount30Days
          existing.commitsCount90Days += c.commitsCount90Days
          existing.commitsCount180Days += c.commitsCount180Days
          existing.commitsCount365Days += c.commitsCount365Days
          if (c.firstCommitDate && (!existing.firstCommitDate || c.firstCommitDate < existing.firstCommitDate)) {
            existing.firstCommitDate = c.firstCommitDate
          }
          if (c.latestCommitDate && (!existing.latestCommitDate || c.latestCommitDate > existing.latestCommitDate)) {
            existing.latestCommitDate = c.latestCommitDate
          }
        } else {
          const merged = new Contributor()
          merged.email = c.email
          merged.commitsCount = c.commitsCount
          merged.commitsCount30Days = c.commitsCount30Days
          merged.commitsCount90Days = c.commitsCount90Days
          merged.commitsCount180Days = c.commitsCount180Days
          merged.commitsCount365Days = c.commitsCount365Days
          merged.firstCommitDate = c.firstCommitDate
          merged.latestCommitDate = c.latestCommitDate
          merged.isBot = c.isBot
          map.set(c.email, merged)
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.commitsCount - a.commitsCount)
  }
}
