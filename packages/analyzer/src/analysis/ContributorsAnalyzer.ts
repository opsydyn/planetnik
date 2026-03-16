import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { ContributionTimeSlot } from "../contributors/ContributionTimeSlot.js"
import { Contributor } from "../contributors/Contributor.js"
import type { CodeConfiguration } from "../core/CodeConfiguration.js"
import { ComponentDependency } from "../dependencies/ComponentDependency.js"
import { DateUtils } from "../filehistory/FileHistoryUtils.js"
import type { AuthorCommit } from "../githistory/GitHistoryUtils.js"
import { GitHistoryUtils } from "../githistory/GitHistoryUtils.js"
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"
import type { ContributorsAnalysisResults } from "../results/ContributorsAnalysisResults.js"
import { AnalysisUtils } from "./AnalysisUtils.js"

const MAX_PEOPLE_DEPENDENCIES_SIZE = 10_000

export class ContributorsAnalyzer {
  private codeConfiguration: CodeConfiguration
  private results: CodeAnalysisResults
  private analysisResults: ContributorsAnalysisResults
  private configFilePath: string

  constructor(results: CodeAnalysisResults, configFilePath: string) {
    this.results = results
    this.codeConfiguration = results.codeConfiguration!
    this.analysisResults = results.contributorsAnalysisResults
    this.configFilePath = configFilePath
  }

  analyze(): void {
    const authorCommits = this.loadAuthorCommits()
    if (authorCommits.length === 0) return

    // Find date range
    let firstDate = ""
    let latestDate = ""
    for (const commit of authorCommits) {
      if (!firstDate || commit.date < firstDate) firstDate = commit.date
      if (!latestDate || commit.date > latestDate) latestDate = commit.date
    }
    this.analysisResults.latestCommitDate = latestDate
    this.analysisResults.commitsCount = authorCommits.length

    // Build contributors list
    this.analysisResults.contributors = this.buildContributors(authorCommits)

    // Time slot breakdowns
    this.analysisResults.contributorsPerYear = this.getContributorsPerTimeSlot(authorCommits, (c) =>
      DateUtils.getYear(c.date),
    )
    this.analysisResults.contributorsPerMonth = this.getContributorsPerTimeSlot(authorCommits, (c) =>
      DateUtils.getMonth(c.date),
    )
    this.analysisResults.contributorsPerWeek = this.getContributorsPerTimeSlot(authorCommits, (c) =>
      DateUtils.getWeekMonday(c.date),
    )
    this.analysisResults.contributorsPerDay = this.getContributorsPerTimeSlot(authorCommits, (c) => c.date)

    // People dependencies (who works on same files)
    const history = this.results.filesHistoryAnalysisResults.history
    if (history.length > 0) {
      this.analysisResults.peopleDependencies30Days = this.getPeopleDependencies(history, 30)
      this.analysisResults.peopleDependencies90Days = this.getPeopleDependencies(history, 90)
      this.analysisResults.peopleDependencies180Days = this.getPeopleDependencies(history, 180)
      this.analysisResults.peopleDependencies365Days = this.getPeopleDependencies(history, 365)
      this.analysisResults.peopleDependencies = this.analysisResults.peopleDependencies365Days
    }

    // Metrics
    this.results.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("NUMBER_OF_CONTRIBUTORS"))
      .setDescription("Number of contributors")
      .setValue(this.analysisResults.contributors.length)
  }

  private loadAuthorCommits(): AuthorCommit[] {
    const configDir = dirname(this.configFilePath)

    let historyFile: string | null = null
    if (this.codeConfiguration.fileHistoryPath) {
      const p = resolve(configDir, this.codeConfiguration.fileHistoryPath)
      if (existsSync(p)) historyFile = p
    }
    if (!historyFile) {
      const defaultPath = join(configDir, "..", GitHistoryUtils.GIT_HISTORY_FILE_NAME)
      if (existsSync(defaultPath)) historyFile = defaultPath
    }
    if (!historyFile) return []

    const lines = readFileSync(historyFile, "utf-8").split("\n")
    const updates = GitHistoryUtils.parseGitHistoryLines(lines)
    return GitHistoryUtils.getAuthorCommits(updates)
  }

  private buildContributors(authorCommits: AuthorCommit[]): Contributor[] {
    const map = new Map<string, Contributor>()
    const list: Contributor[] = []

    for (const commit of authorCommits) {
      const email = commit.email
      let contributor = map.get(email)
      if (!contributor) {
        contributor = new Contributor()
        contributor.email = email
        map.set(email, contributor)
        list.push(contributor)
      }

      contributor.commitsCount++

      if (!contributor.firstCommitDate || commit.date < contributor.firstCommitDate) {
        contributor.firstCommitDate = commit.date
      }
      if (!contributor.latestCommitDate || commit.date > contributor.latestCommitDate) {
        contributor.latestCommitDate = commit.date
      }

      // Per-period counts
      if (DateUtils.isCommittedBetween(commit.date, 0, 30)) contributor.commitsCount30Days++
      if (DateUtils.isCommittedBetween(commit.date, 0, 90)) contributor.commitsCount90Days++
      if (DateUtils.isCommittedBetween(commit.date, 0, 180)) contributor.commitsCount180Days++
      if (DateUtils.isCommittedBetween(commit.date, 0, 365)) contributor.commitsCount365Days++
    }

    list.sort((a, b) => b.commitsCount - a.commitsCount)
    return list
  }

  private getContributorsPerTimeSlot(
    authorCommits: AuthorCommit[],
    getSlot: (commit: AuthorCommit) => string,
  ): ContributionTimeSlot[] {
    const map = new Map<string, ContributionTimeSlot>()
    const peopleIds = new Map<string, Set<string>>()
    const list: ContributionTimeSlot[] = []

    for (const commit of authorCommits) {
      const slot = getSlot(commit)
      const email = commit.email

      let ids = peopleIds.get(slot)
      if (!ids) {
        ids = new Set()
        peopleIds.set(slot, ids)
      }
      ids.add(email)

      let ts = map.get(slot)
      if (!ts) {
        ts = new ContributionTimeSlot()
        ts.timeSlot = slot
        map.set(slot, ts)
        list.push(ts)
      }
      ts.commitsCount++
      ts.contributorsCount = ids.size
    }

    list.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
    return list
  }

  private getPeopleDependencies(
    history: { path: string; commits: { date: string; email: string }[] }[],
    daysAgo: number,
  ): ComponentDependency[] {
    // Build map: file path → set of contributor emails (within time window)
    const contributionMap = new Map<string, Set<string>>()

    for (const fileHistory of history) {
      for (const commit of fileHistory.commits) {
        if (!DateUtils.isCommittedBetween(commit.date, 0, daysAgo)) continue
        let emails = contributionMap.get(fileHistory.path)
        if (!emails) {
          emails = new Set()
          contributionMap.set(fileHistory.path, emails)
        }
        emails.add(commit.email)
      }
    }

    // Build people dependencies: for each file with multiple contributors,
    // create a dependency between each pair
    const dependencies: ComponentDependency[] = []
    const depMap = new Map<string, ComponentDependency>()

    for (const [path, emails] of contributionMap) {
      const emailList = Array.from(emails)
      for (let i = 0; i < emailList.length; i++) {
        for (let j = i + 1; j < emailList.length; j++) {
          if (dependencies.length >= MAX_PEOPLE_DEPENDENCIES_SIZE) break

          const e1 = emailList[i]
          const e2 = emailList[j]
          const key1 = `${e1}::${e2}`
          const key2 = `${e2}::${e1}`

          let dep = depMap.get(key1) ?? depMap.get(key2)
          if (!dep) {
            dep = new ComponentDependency(e1, e2)
            dep.count = 0
            depMap.set(key1, dep)
            dependencies.push(dep)
          }
          dep.count++
        }
      }
    }

    dependencies.sort((a, b) => b.count - a.count)
    return dependencies
  }
}
