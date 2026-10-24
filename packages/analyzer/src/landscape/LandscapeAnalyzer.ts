import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { Contributor } from "../contributors/Contributor.js"
import { ComponentDependency } from "../dependencies/ComponentDependency.js"
import { FileModificationHistory } from "../filehistory/FileModificationHistory.js"
import { ContributorConnectionUtils } from "./ContributorConnectionUtils.js"
import { LandscapeAnalysisResults, type RepositoryAnalysisResult } from "./LandscapeAnalysisResults.js"
import type { LandscapeConfiguration } from "./LandscapeConfiguration.js"

const TOPOLOGY_PERIODS = [
  { key: "30d", fileName: "people_dependencies_30d.json", days: 30 },
  { key: "90d", fileName: "people_dependencies_90d.json", days: 90 },
  { key: "180d", fileName: "people_dependencies_180d.json", days: 180 },
  { key: "365d", fileName: "people_dependencies_365d.json", days: 365 },
  { key: "all_time", fileName: "people_dependencies.json", days: 36500 },
] as const

type TopologyPeriodKey = (typeof TOPOLOGY_PERIODS)[number]["key"]

interface LoadedRepositoryResults {
  repoResult: RepositoryAnalysisResult
  peopleDependencies: Record<TopologyPeriodKey, ComponentDependency[]>
}

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
    const peopleDependencies = this.createEmptyPeopleDependencyRecord()

    // Load each repository's analysis results
    for (const repo of this.config.repositories) {
      const loadedRepository = this.loadRepositoryResults(repo.analysisResultsPath, repo.name)
      if (!loadedRepository) continue
      const { repoResult } = loadedRepository

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
      for (const period of TOPOLOGY_PERIODS) {
        this.mergeDependencies(peopleDependencies[period.key], loadedRepository.peopleDependencies[period.key])
      }
    }

    this.aggregateResults(results, peopleDependencies)
    return results
  }

  private loadRepositoryResults(resultPath: string, name: string): LoadedRepositoryResults | null {
    const fullPath = resolve(this.landscapeRoot, this.config.analysisRoot, resultPath)
    if (!existsSync(fullPath)) return null

    try {
      const data = JSON.parse(readFileSync(fullPath, "utf-8"))
      const repoResult = this.mapToRepositoryResult(data, name, resultPath)
      return {
        repoResult,
        peopleDependencies: this.loadPeopleDependencies(fullPath, data, repoResult.name),
      }
    } catch {
      return null
    }
  }

  private mapToRepositoryResult(data: Record<string, unknown>, name: string, path: string): RepositoryAnalysisResult {
    const dataDir = dirname(resolve(this.landscapeRoot, this.config.analysisRoot, path))
    const filesMain = this.readFilesExport(dataDir, "files_main.json")
    const filesTest = this.readFilesExport(dataDir, "files_test.json")

    const main = (data.mainAspectAnalysisResults as Record<string, unknown>) ?? {}
    const test = (data.testAspectAnalysisResults as Record<string, unknown>) ?? {}
    const generated = (data.generatedAspectAnalysisResults as Record<string, unknown>) ?? {}
    const buildDeploy = (data.buildAndDeployAspectAnalysisResults as Record<string, unknown>) ?? {}
    const other = (data.otherAspectAnalysisResults as Record<string, unknown>) ?? {}
    const metadata = (data.metadata as Record<string, unknown>) ?? {}
    const contributorsResults = (data.contributorsAnalysisResults as Record<string, unknown>) ?? {}
    const duplication = (data.duplicationAnalysisResults as Record<string, unknown>) ?? {}
    const filesHistory = (data.filesHistoryAnalysisResults as Record<string, unknown>) ?? {}

    const contributors =
      this.readContributorsExport(dataDir) ??
      this.mapContributors((contributorsResults.contributors as Array<Record<string, unknown>>) ?? [])
    const mainLinesPerExtension =
      this.readLinesOfCodePerExtension(main) ?? this.getLinesOfCodePerExtensionFromFiles(filesMain?.files ?? [])
    const extensions = Array.isArray(data.extensions)
      ? data.extensions.filter(
          (extension): extension is string => typeof extension === "string" && extension.length > 0,
        )
      : []
    const derivedExtensions =
      extensions.length > 0 ? extensions : mainLinesPerExtension.map((entry) => entry.extension).filter(Boolean)
    const firstCommitDate =
      (filesHistory.firstDate as string) ??
      filesMain?.firstDate ??
      contributors.reduce((oldest, contributor) => {
        if (!contributor.firstCommitDate) return oldest
        if (!oldest || contributor.firstCommitDate < oldest) return contributor.firstCommitDate
        return oldest
      }, "")
    const latestCommitDate =
      (filesHistory.latestDate as string) ??
      filesMain?.latestDate ??
      (contributorsResults.latestCommitDate as string) ??
      contributors.reduce((latest, contributor) => {
        if (!contributor.latestCommitDate) return latest
        if (!latest || contributor.latestCommitDate > latest) return contributor.latestCommitDate
        return latest
      }, "")

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
      mainLoc: (main.linesOfCode as number) ?? filesMain?.totalLinesOfCode ?? (data.linesOfCode as number) ?? 0,
      mainFilesCount: (main.filesCount as number) ?? filesMain?.totalFilesCount ?? (data.filesCount as number) ?? 0,
      testLoc: (test.linesOfCode as number) ?? filesTest?.totalLinesOfCode ?? 0,
      testFilesCount: (test.filesCount as number) ?? filesTest?.totalFilesCount ?? 0,
      generatedLoc: (generated.linesOfCode as number) ?? 0,
      buildAndDeployLoc: (buildDeploy.linesOfCode as number) ?? 0,
      otherLoc: (other.linesOfCode as number) ?? 0,
      extensions: derivedExtensions,
      linesOfCodePerExtension: mainLinesPerExtension,
      contributors,
      firstCommitDate,
      latestCommitDate,
      duplicationPercentage:
        (duplication.overallDuplication as number) ??
        ((data.duplication as Record<string, unknown>)?.percentage as number) ??
        0,
    }
  }

  private mapToRepositoryHistory(data: Record<string, unknown>, repositoryName: string) {
    const filesHistory = (data.filesHistoryAnalysisResults as Record<string, unknown>) ?? {}
    const rawHistory = (filesHistory.history as Array<Record<string, unknown>>) ?? []

    return rawHistory.flatMap((entry) => {
      const relativePath = (entry.path as string) ?? ""
      if (!relativePath) return []

      const history = new FileModificationHistory(`${repositoryName}/${relativePath}`)
      history.dates = ((entry.dates as string[]) ?? []).slice()
      history.commits = ((entry.commits as Array<Record<string, unknown>>) ?? [])
        .map((commit) => ({
          id: (commit.id as string) ?? "",
          date: (commit.date as string) ?? "",
          email: (commit.email as string) ?? "",
        }))
        .filter((commit) => commit.date && commit.email)

      if (history.dates.length === 0) {
        history.dates = history.commits.map((commit) => commit.date)
      }

      return history.commits.length > 0 ? [history] : []
    })
  }

  private aggregateResults(
    results: LandscapeAnalysisResults,
    peopleDependencies: Record<TopologyPeriodKey, ComponentDependency[]>,
  ): void {
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
    results.peopleDependencies30Days = peopleDependencies["30d"]
    results.peopleDependencies90Days = peopleDependencies["90d"]
    results.peopleDependencies180Days = peopleDependencies["180d"]
    results.peopleDependencies365Days = peopleDependencies["365d"]
    results.peopleDependenciesAllTime = peopleDependencies.all_time
    results.peopleDependencies = results.peopleDependenciesAllTime
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
          if (!existing.userName && c.userName) {
            existing.userName = c.userName
          }
          if (c.firstCommitDate && (!existing.firstCommitDate || c.firstCommitDate < existing.firstCommitDate)) {
            existing.firstCommitDate = c.firstCommitDate
          }
          if (c.latestCommitDate && (!existing.latestCommitDate || c.latestCommitDate > existing.latestCommitDate)) {
            existing.latestCommitDate = c.latestCommitDate
          }
        } else {
          const merged = new Contributor()
          merged.email = c.email
          merged.userName = c.userName
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

  private createEmptyPeopleDependencyRecord(): Record<TopologyPeriodKey, ComponentDependency[]> {
    return {
      "30d": [],
      "90d": [],
      "180d": [],
      "365d": [],
      all_time: [],
    }
  }

  private loadPeopleDependencies(
    summaryPath: string,
    data: Record<string, unknown>,
    repositoryName: string,
  ): Record<TopologyPeriodKey, ComponentDependency[]> {
    const dataDir = dirname(summaryPath)
    const loaded = this.createEmptyPeopleDependencyRecord()
    let foundExportedDependencies = false

    for (const period of TOPOLOGY_PERIODS) {
      const filePath = resolve(dataDir, period.fileName)
      if (!existsSync(filePath)) continue
      try {
        const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as Array<Record<string, unknown>>
        loaded[period.key] = parsed.flatMap((entry) => this.toDependency(entry, repositoryName))
        foundExportedDependencies = true
      } catch {
        loaded[period.key] = []
      }
    }

    if (foundExportedDependencies) {
      return loaded
    }

    const history = this.mapToRepositoryHistory(data, repositoryName)
    if (history.length === 0) {
      return loaded
    }

    return {
      "30d": ContributorConnectionUtils.getPeopleDependencies(history, 30),
      "90d": ContributorConnectionUtils.getPeopleDependencies(history, 90),
      "180d": ContributorConnectionUtils.getPeopleDependencies(history, 180),
      "365d": ContributorConnectionUtils.getPeopleDependencies(history, 365),
      all_time: ContributorConnectionUtils.getPeopleDependencies(history, 36500),
    }
  }

  private mergeDependencies(target: ComponentDependency[], incoming: ComponentDependency[]): void {
    const merged = new Map<string, ComponentDependency>()

    for (const dependency of [...target, ...incoming]) {
      const key = [dependency.fromComponent, dependency.toComponent]
        .sort((left, right) => left.localeCompare(right))
        .join("::")
      const existing = merged.get(key)
      if (existing) {
        const files = new Set([...(existing.data ?? []), ...(dependency.data ?? [])])
        existing.data = Array.from(files).sort()
        existing.count = existing.data.length
        continue
      }

      const normalized = [dependency.fromComponent, dependency.toComponent].sort((left, right) =>
        left.localeCompare(right),
      )
      const created = new ComponentDependency(
        normalized[0] ?? dependency.fromComponent,
        normalized[1] ?? dependency.toComponent,
      )
      created.data = Array.from(new Set(dependency.data ?? [])).sort()
      created.count = created.data.length > 0 ? created.data.length : dependency.count
      merged.set(key, created)
    }

    target.splice(0, target.length, ...Array.from(merged.values()).sort((left, right) => right.count - left.count))
  }

  private toDependency(entry: Record<string, unknown>, repositoryName: string) {
    const from = typeof entry.from === "string" ? entry.from : ""
    const to = typeof entry.to === "string" ? entry.to : ""
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) {
      return []
    }

    const dependency = new ComponentDependency(from, to)
    const files = Array.isArray(entry.files)
      ? entry.files
          .filter((file): file is string => typeof file === "string" && file.length > 0)
          .map((file) => this.namespaceRepositoryFilePath(repositoryName, file))
      : []
    dependency.data = Array.from(new Set(files)).sort()
    dependency.count = dependency.data.length > 0 ? dependency.data.length : ((entry.count as number) ?? 0)
    return [dependency]
  }

  private readFilesExport(
    dataDir: string,
    fileName: string,
  ): {
    totalFilesCount: number
    totalLinesOfCode: number
    files: Array<{
      extension?: string
      firstDate?: string
      latestDate?: string
      linesOfCode?: number
    }>
    firstDate: string
    latestDate: string
  } | null {
    const filePath = resolve(dataDir, fileName)
    if (!existsSync(filePath)) return null

    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as {
        totalFilesCount?: number
        totalLinesOfCode?: number
        files?: Array<{
          extension?: string
          firstDate?: string
          latestDate?: string
          linesOfCode?: number
        }>
      }
      const files = Array.isArray(parsed.files) ? parsed.files : []
      const firstDate =
        files
          .map((file) => file.firstDate)
          .filter((date): date is string => typeof date === "string" && date.length > 0)
          .sort()[0] ?? ""
      const latestDate =
        files
          .map((file) => file.latestDate)
          .filter((date): date is string => typeof date === "string" && date.length > 0)
          .sort()
          .at(-1) ?? ""

      return {
        totalFilesCount: typeof parsed.totalFilesCount === "number" ? parsed.totalFilesCount : files.length,
        totalLinesOfCode:
          typeof parsed.totalLinesOfCode === "number"
            ? parsed.totalLinesOfCode
            : files.reduce((sum, file) => sum + (typeof file.linesOfCode === "number" ? file.linesOfCode : 0), 0),
        files,
        firstDate,
        latestDate,
      }
    } catch {
      return null
    }
  }

  private readContributorsExport(dataDir: string): Contributor[] | null {
    const jsonPath = resolve(dataDir, "contributors.json")
    if (!existsSync(jsonPath)) {
      return null
    }

    try {
      const parsed = JSON.parse(readFileSync(jsonPath, "utf-8")) as {
        contributors?: Array<Record<string, unknown>>
      }
      if (!Array.isArray(parsed.contributors)) {
        return null
      }

      return this.mapContributors(parsed.contributors)
    } catch {
      return null
    }
  }

  private mapContributors(rawContributors: Array<Record<string, unknown>>): Contributor[] {
    const contributors: Contributor[] = []

    for (const rawContributor of rawContributors) {
      const contributor = new Contributor()
      contributor.email = (rawContributor.email as string) ?? ""
      contributor.userName = (rawContributor.userName as string) ?? ""
      contributor.commitsCount = (rawContributor.commitsCount as number) ?? 0
      contributor.firstCommitDate = (rawContributor.firstCommitDate as string) ?? ""
      contributor.latestCommitDate = (rawContributor.latestCommitDate as string) ?? ""
      contributor.commitsCount30Days = (rawContributor.commitsCount30Days as number) ?? 0
      contributor.commitsCount90Days = (rawContributor.commitsCount90Days as number) ?? 0
      contributor.commitsCount180Days = (rawContributor.commitsCount180Days as number) ?? 0
      contributor.commitsCount365Days = (rawContributor.commitsCount365Days as number) ?? 0
      contributor.isBot = (rawContributor.isBot as boolean) ?? false
      if (contributor.email) {
        contributors.push(contributor)
      }
    }

    return contributors
  }

  private readLinesOfCodePerExtension(
    main: Record<string, unknown>,
  ): Array<{ extension: string; linesOfCode: number }> | null {
    const rawEntries = main.linesOfCodePerExtension as Array<Record<string, unknown>> | undefined
    if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
      return null
    }

    return rawEntries
      .map((entry) => ({
        extension:
          typeof entry.extension === "string"
            ? entry.extension
            : typeof entry.name === "string"
              ? entry.name.replace(/^[.]/, "")
              : "",
        linesOfCode:
          typeof entry.linesOfCode === "number" ? entry.linesOfCode : typeof entry.value === "number" ? entry.value : 0,
      }))
      .filter((entry) => entry.extension.length > 0)
  }

  private getLinesOfCodePerExtensionFromFiles(
    files: Array<{ extension?: string; linesOfCode?: number }>,
  ): Array<{ extension: string; linesOfCode: number }> {
    const totals = new Map<string, number>()

    for (const file of files) {
      if (!file.extension) continue
      totals.set(
        file.extension,
        (totals.get(file.extension) ?? 0) + (typeof file.linesOfCode === "number" ? file.linesOfCode : 0),
      )
    }

    return Array.from(totals.entries())
      .map(([extension, linesOfCode]) => ({ extension, linesOfCode }))
      .sort((left, right) => right.linesOfCode - left.linesOfCode)
  }

  private namespaceRepositoryFilePath(repositoryName: string, filePath: string): string {
    return filePath.startsWith(`${repositoryName}/`) ? filePath : `${repositoryName}/${filePath}`
  }
}
