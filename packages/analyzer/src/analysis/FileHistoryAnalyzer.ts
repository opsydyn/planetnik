import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import type { SourceFile } from "../aspects/SourceFile.js"
import { AnalysisConfig } from "../core/AnalysisConfig.js"
import type { CodeConfiguration } from "../core/CodeConfiguration.js"
import { DateUtils, FileHistoryUtils } from "../filehistory/FileHistoryUtils.js"
import { FileModificationHistory } from "../filehistory/FileModificationHistory.js"
import { FilePairsChangedTogetherEngine } from "../filehistory/FilePairsChangedTogether.js"
import type { CommitInfo } from "../githistory/CommitInfo.js"
import { GitHistoryUtils } from "../githistory/GitHistoryUtils.js"
import type { RiskDistributionStats } from "../metrics/RiskDistributionStats.js"
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"
import type { FilesHistoryAnalysisResults } from "../results/FilesHistoryAnalysisResults.js"
import { AnalysisUtils } from "./AnalysisUtils.js"

export class FileHistoryAnalyzer {
  private codeConfiguration: CodeConfiguration
  private analysisResults: FilesHistoryAnalysisResults
  private results: CodeAnalysisResults
  private configFilePath: string

  constructor(results: CodeAnalysisResults, configFilePath: string) {
    this.results = results
    this.codeConfiguration = results.codeConfiguration!
    this.analysisResults = results.filesHistoryAnalysisResults
    this.configFilePath = configFilePath
  }

  analyze(): void {
    const historyFile = this.getHistoryFilePath()
    if (!historyFile || !existsSync(historyFile)) return

    const lines = readFileSync(historyFile, "utf-8").split("\n")
    const updates = GitHistoryUtils.parseGitHistoryLines(lines)
    const fileHistoriesMap = GitHistoryUtils.getFileHistories(updates)

    const history = this.buildHistory(fileHistoriesMap)
    this.analysisResults.history = history

    if (history.length === 0) return

    this.summarize(history)
    this.enrichFilesWithAge(history)
    this.analyzeFilesAge()

    const maxDays = this.codeConfiguration.analysis.maxTemporalDependenciesDepthDays
    if (maxDays > 180) {
      this.analyzeFilesChangedTogether(history, maxDays)
    }
    if (maxDays >= 30) {
      this.analyzeFilesChangedTogether30Days(history)
    }
    if (maxDays >= 90) {
      this.analyzeFilesChangedTogether90Days(history)
    }
    if (maxDays >= 180) {
      this.analyzeFilesChangedTogether180Days(history)
    }
  }

  private getHistoryFilePath(): string | null {
    const configDir = dirname(this.configFilePath)

    if (this.codeConfiguration.fileHistoryPath) {
      const p = resolve(configDir, this.codeConfiguration.fileHistoryPath)
      if (existsSync(p)) return p
    }

    // Default path: _sokrates/../git-history.txt relative to config
    const defaultPath = join(configDir, "..", GitHistoryUtils.GIT_HISTORY_FILE_NAME)
    if (existsSync(defaultPath)) return defaultPath

    return null
  }

  private buildHistory(fileHistoriesMap: Map<string, CommitInfo[]>): FileModificationHistory[] {
    const result: FileModificationHistory[] = []
    for (const [path, commits] of fileHistoriesMap) {
      const fmh = new FileModificationHistory(path)
      for (const commit of commits) {
        fmh.commits.push(commit)
        fmh.dates.push(commit.date)
      }
      result.push(fmh)
    }
    return result
  }

  private summarize(history: FileModificationHistory[]): void {
    const uniqueDates = this.getUniqueDates(history)
    if (uniqueDates.length < 2) return

    const firstDateString = uniqueDates[0]
    const latestDateString = uniqueDates[uniqueDates.length - 1]

    const firstDate = FileHistoryUtils.getDateFromString(firstDateString)
    const latestDate = FileHistoryUtils.getDateFromString(latestDateString)
    if (!firstDate || !latestDate) return

    const daysBetween = FileHistoryUtils.daysBetween(firstDate, latestDate)
    const today = DateUtils.getAnalysisDateAsDate()
    const totalAge = FileHistoryUtils.daysBetween(firstDate, today)
    const weeks = Math.floor(daysBetween / 7)
    const estimatedWorkingDays = weeks * 5
    const activeDays = uniqueDates.length

    this.analysisResults.firstDate = firstDateString
    this.analysisResults.latestDate = latestDateString
    this.analysisResults.ageInDays = totalAge
    this.analysisResults.daysBetweenFirstAndLastDate = daysBetween
    this.analysisResults.weeksBetweenFirstAndLastDate = weeks
    this.analysisResults.estimatedWorkingDays = estimatedWorkingDays
    this.analysisResults.activeDays = activeDays

    const metricsList = this.results.metricsList
    metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("FILE_CHANGE_HISTORY_TOTAL_AGE_DAYS"))
      .setDescription("The age of the repository in days")
      .setValue(totalAge)

    metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("FILE_CHANGE_HISTORY_ACTIVE_DAYS"))
      .setDescription("The number of days with at least one file change")
      .setValue(activeDays)

    metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("FILE_CHANGE_HISTORY_WEEKS"))
      .setDescription("The number of weeks")
      .setValue(weeks)

    metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("FILE_CHANGE_HISTORY_ESTIMATED_WORKING_DAYS"))
      .setDescription("The number of estimated working days in the period")
      .setValue(estimatedWorkingDays)
  }

  private enrichFilesWithAge(history: FileModificationHistory[]): void {
    const historyByPath = new Map<string, FileModificationHistory>()
    for (const h of history) {
      historyByPath.set(h.path.toLowerCase(), h)
    }

    for (const sourceFile of this.codeConfiguration.main.sourceFiles) {
      const match = historyByPath.get(sourceFile.relativePath.toLowerCase())
      if (match) {
        ;(sourceFile as SourceFile).fileModificationHistory = match
      }
    }
  }

  private analyzeFilesAge(): void {
    const allFiles = this.codeConfiguration.main.sourceFiles as SourceFile[]
    const analysis = this.codeConfiguration.analysis

    const fileAgeThresholds = AnalysisConfig.getFileAgeThresholds(analysis)
    const fileUpdateFrequencyThresholds = AnalysisConfig.getFileUpdateFrequencyThresholds(analysis)
    const fileContributorCountThresholds = AnalysisConfig.getFileContributorsCountThresholds(analysis)

    // Count files without history
    for (const f of allFiles) {
      if (!f.fileModificationHistory) {
        this.analysisResults.filesWithoutCommitHistoryCount++
        this.analysisResults.filesWithoutCommitHistoryLinesOfCode += f.linesOfCode
      }
    }

    // Age distributions (freshness = last modified, age = first modified)
    const freshnessDistribution = fileAgeThresholds.toRiskDistribution("freshness")
    const ageDistribution = fileAgeThresholds.toRiskDistribution("age")
    const changeDistribution = fileUpdateFrequencyThresholds.toRiskDistribution("changes")
    const contributorsDistribution = fileContributorCountThresholds.toRiskDistribution("contributors")

    for (const f of allFiles) {
      if (!f.fileModificationHistory) continue
      const loc = f.linesOfCode

      freshnessDistribution.update(f.fileModificationHistory.daysSinceLatestUpdate(), loc)
      ageDistribution.update(f.fileModificationHistory.daysSinceFirstUpdate(), loc)
      changeDistribution.update(f.fileModificationHistory.dates.length, loc)
      contributorsDistribution.update(f.fileModificationHistory.countContributors(), loc)
    }

    this.analysisResults.freshnesssRiskDistribution = freshnessDistribution
    this.analysisResults.ageRiskDistribution = ageDistribution
    this.analysisResults.changeDistribution = changeDistribution
    this.analysisResults.contributorsCountDistribution = contributorsDistribution

    // Per-extension distributions
    this.analysisResults.ageRiskDistributionPerExtension = this.getDistributionPerExtension(
      allFiles,
      fileAgeThresholds,
      (f) => f.fileModificationHistory!.daysSinceFirstUpdate(),
    )
    this.analysisResults.freshnesssRiskDistributionPerExtension = this.getDistributionPerExtension(
      allFiles,
      fileAgeThresholds,
      (f) => f.fileModificationHistory!.daysSinceLatestUpdate(),
    )

    // Top lists
    const maxTopListSize = analysis.maxTopListSize
    this.addOldestFiles(allFiles, maxTopListSize)
    this.addYoungestFiles(allFiles, maxTopListSize)
    this.addMostRecentlyChangedFiles(allFiles, maxTopListSize)
    this.addMostPreviouslyChangedFiles(allFiles, maxTopListSize)
    this.addMostChangedFiles(allFiles, maxTopListSize)
    this.addFilesWithMostContributors(allFiles, maxTopListSize)
    this.addFilesWithLeastContributors(allFiles, maxTopListSize)

    // Add age metrics
    this.addAgeMetrics(ageDistribution)
  }

  private getDistributionPerExtension(
    files: SourceFile[],
    thresholds: { toRiskDistribution(key?: string): RiskDistributionStats },
    getValue: (f: SourceFile) => number,
  ): RiskDistributionStats[] {
    const map = new Map<string, RiskDistributionStats>()
    const result: RiskDistributionStats[] = []

    for (const f of files) {
      if (!f.fileModificationHistory) continue
      let dist = map.get(f.extension)
      if (!dist) {
        dist = thresholds.toRiskDistribution(f.extension)
        dist.key = f.extension
        map.set(f.extension, dist)
        result.push(dist)
      }
      dist.update(getValue(f), f.linesOfCode)
    }

    return result
  }

  private analyzeFilesChangedTogether(history: FileModificationHistory[], maxDays: number): void {
    const engine = new FilePairsChangedTogetherEngine(maxDays)
    engine.populate(this.codeConfiguration.main, history)
    this.analysisResults.filePairsChangedTogether = engine.getFilePairsList()
  }

  private analyzeFilesChangedTogether30Days(history: FileModificationHistory[]): void {
    const engine = new FilePairsChangedTogetherEngine(30)
    engine.populate(this.codeConfiguration.main, history)
    this.analysisResults.filePairsChangedTogether30Days = engine.getFilePairsList()
  }

  private analyzeFilesChangedTogether90Days(history: FileModificationHistory[]): void {
    const engine = new FilePairsChangedTogetherEngine(90)
    engine.populate(this.codeConfiguration.main, history)
    this.analysisResults.filePairsChangedTogether90Days = engine.getFilePairsList()
  }

  private analyzeFilesChangedTogether180Days(history: FileModificationHistory[]): void {
    const engine = new FilePairsChangedTogetherEngine(180)
    engine.populate(this.codeConfiguration.main, history)
    this.analysisResults.filePairsChangedTogether180Days = engine.getFilePairsList()
  }

  private addAgeMetrics(distribution: RiskDistributionStats): void {
    const m = this.results.metricsList
    m.addMetric()
      .setId(AnalysisUtils.getMetricId("FILE_AGE_NEGLIGIBLE_RISK_COUNT"))
      .setDescription(`Number of files ${distribution.negligibleRiskLabel} days old`)
      .setValue(distribution.negligibleRiskCount)
    m.addMetric()
      .setId(AnalysisUtils.getMetricId("FILE_AGE_LOW_RISK_COUNT"))
      .setDescription(`Number of files ${distribution.lowRiskLabel} days old`)
      .setValue(distribution.lowRiskCount)
    m.addMetric()
      .setId(AnalysisUtils.getMetricId("FILE_AGE_MEDIUM_RISK_COUNT"))
      .setDescription(`Number of files ${distribution.mediumRiskLabel} days old`)
      .setValue(distribution.mediumRiskCount)
    m.addMetric()
      .setId(AnalysisUtils.getMetricId("FILE_AGE_HIGH_RISK_COUNT"))
      .setDescription(`Number of files ${distribution.highRiskLabel} days old`)
      .setValue(distribution.highRiskCount)
    m.addMetric()
      .setId(AnalysisUtils.getMetricId("FILE_AGE_VERY_HIGH_RISK_COUNT"))
      .setDescription(`Number of files ${distribution.veryHighRiskLabel} days old`)
      .setValue(distribution.veryHighRiskCount)
  }

  private getUniqueDates(history: FileModificationHistory[]): string[] {
    const dateSet = new Set<string>()
    for (const h of history) {
      for (const date of h.dates) {
        if (date.length >= 10) {
          dateSet.add(date.substring(0, 10))
        }
      }
    }
    return Array.from(dateSet).sort()
  }

  private addOldestFiles(files: SourceFile[], maxSize: number): void {
    const sorted = [...files]
      .filter((f) => f.fileModificationHistory)
      .sort((a, b) => {
        const diff =
          b.fileModificationHistory!.daysSinceFirstUpdate() - a.fileModificationHistory!.daysSinceFirstUpdate()
        return diff !== 0 ? diff : b.linesOfCode - a.linesOfCode
      })
    this.analysisResults.oldestFiles = sorted.slice(0, maxSize)
  }

  private addYoungestFiles(files: SourceFile[], maxSize: number): void {
    const sorted = [...files]
      .filter((f) => f.fileModificationHistory)
      .sort((a, b) => {
        const diff =
          a.fileModificationHistory!.daysSinceFirstUpdate() - b.fileModificationHistory!.daysSinceFirstUpdate()
        return diff !== 0 ? diff : b.linesOfCode - a.linesOfCode
      })
    this.analysisResults.youngestFiles = sorted.slice(0, maxSize)
  }

  private addMostRecentlyChangedFiles(files: SourceFile[], maxSize: number): void {
    const sorted = [...files]
      .filter((f) => f.fileModificationHistory)
      .sort((a, b) => {
        const diff =
          a.fileModificationHistory!.daysSinceLatestUpdate() - b.fileModificationHistory!.daysSinceLatestUpdate()
        return diff !== 0 ? diff : b.linesOfCode - a.linesOfCode
      })
    this.analysisResults.mostRecentlyChangedFiles = sorted.slice(0, maxSize)
  }

  private addMostPreviouslyChangedFiles(files: SourceFile[], maxSize: number): void {
    const sorted = [...files]
      .filter((f) => f.fileModificationHistory)
      .sort((a, b) => {
        const diff =
          b.fileModificationHistory!.daysSinceLatestUpdate() - a.fileModificationHistory!.daysSinceLatestUpdate()
        return diff !== 0 ? diff : b.linesOfCode - a.linesOfCode
      })
    this.analysisResults.mostPreviouslyChangedFiles = sorted.slice(0, maxSize)
  }

  private addMostChangedFiles(files: SourceFile[], maxSize: number): void {
    const sorted = [...files]
      .filter((f) => f.fileModificationHistory)
      .sort((a, b) => {
        const diff = b.fileModificationHistory!.dates.length - a.fileModificationHistory!.dates.length
        return diff !== 0 ? diff : b.linesOfCode - a.linesOfCode
      })
    this.analysisResults.mostChangedFiles = sorted.slice(0, maxSize)
  }

  private addFilesWithMostContributors(files: SourceFile[], maxSize: number): void {
    const sorted = [...files]
      .filter((f) => f.fileModificationHistory)
      .sort((a, b) => {
        const diff = b.fileModificationHistory!.countContributors() - a.fileModificationHistory!.countContributors()
        return diff !== 0 ? diff : b.fileModificationHistory!.dates.length - a.fileModificationHistory!.dates.length
      })
    this.analysisResults.filesWithMostContributors = sorted.slice(0, maxSize)
  }

  private addFilesWithLeastContributors(files: SourceFile[], maxSize: number): void {
    const sorted = [...files]
      .filter((f) => f.fileModificationHistory)
      .sort((a, b) => {
        const diff = a.fileModificationHistory!.countContributors() - b.fileModificationHistory!.countContributors()
        return diff !== 0 ? diff : b.linesOfCode - a.linesOfCode
      })
    this.analysisResults.filesWithLeastContributors = sorted.slice(0, maxSize)
  }
}
