import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { LandscapeAnalysisResults, RepositoryAnalysisResult, TagGroup, TeamsConfig } from "@planetnik/analyzer"
import {
  Contributor,
  ContributorConnectionUtils,
  ContributorRepositories as ContributorRepositoriesModel,
} from "@planetnik/analyzer"
import { ENTITY_ID_POLICY, repositoryEntityId } from "../../exporters/EntityIdentity.js"
import { createSnapshotExportContext, type SnapshotExportContext } from "../../exporters/SnapshotContext.js"
import type { TagMap } from "../utils/TagMap.js"
import { ContributorExport } from "./ContributorExport.js"
import { getLandscapeRepoKey } from "./getLandscapeRepoKey.js"
import { RepositoryExport } from "./RepositoryExport.js"

const TOPOLOGY_PERIODS = [
  {
    key: "all_time",
    label: "All Time",
    dependencyKey: "peopleDependenciesAllTime",
    contributorCommitsKey: "commitsCount",
    repositoryCommitsKey: "commitsCount",
  },
  {
    key: "30d",
    label: "Past 30 Days",
    dependencyKey: "peopleDependencies30Days",
    contributorCommitsKey: "commitsCount30Days",
    repositoryCommitsKey: "commits30Days",
  },
  {
    key: "90d",
    label: "Past 3 Months",
    dependencyKey: "peopleDependencies90Days",
    contributorCommitsKey: "commitsCount90Days",
    repositoryCommitsKey: "commits90Days",
  },
  {
    key: "180d",
    label: "Past 6 Months",
    dependencyKey: "peopleDependencies180Days",
    contributorCommitsKey: "commitsCount180Days",
    repositoryCommitsKey: "commits180Days",
  },
  {
    key: "365d",
    label: "Past 12 Months",
    dependencyKey: "peopleDependencies365Days",
    contributorCommitsKey: "commitsCount365Days",
    repositoryCommitsKey: "commits365Days",
  },
] as const

type TopologyPeriodDefinition = (typeof TOPOLOGY_PERIODS)[number]

// ADR-0018: canonical JSON is the default; compatibility projections are opt-in.
export interface LandscapeDataExportOptions {
  /** Emit legacy landscape TXT projections alongside the canonical JSON shards. */
  readonly emitCompatibilityProjections?: boolean
}

export class LandscapeDataExport {
  static readonly REPOSITORIES_DATA_FILE_NAME = "repositories.txt"
  static readonly REPOSITORIES_DATA_JSON_FILE_NAME = "repositories.json"
  static readonly LANDSCAPE_REPOSITORIES_DATA_JSON_FILE_NAME = "landscape_repositories.json"
  static readonly LANDSCAPE_CONTRIBUTORS_DATA_JSON_FILE_NAME = "landscape_contributors.json"
  static readonly LANDSCAPE_TEAMS_DATA_JSON_FILE_NAME = "landscape_teams.json"
  static readonly LANDSCAPE_TOPOLOGY_DATA_JSON_FILE_NAME = "landscape_topology.json"
  static readonly LANDSCAPE_TAGS_DATA_JSON_FILE_NAME = "landscape_tags.json"
  static readonly LANDSCAPE_TAG_MATRIX_DATA_JSON_FILE_NAME = "landscape_tag_matrix.json"
  static readonly LANDSCAPE_OVERVIEW_DATA_JSON_FILE_NAME = "landscape_overview.json"
  static readonly REPORT_CONTEXT_DATA_JSON_FILE_NAME = "report_context.json"
  static readonly LANDSCAPE_ANALYSIS_RESULTS_DATA_JSON_FILE_NAME = "landscapeAnalysisResults.json"
  private static readonly CANONICAL_SHARD_CANDIDATES = [
    ["analysis", LandscapeDataExport.LANDSCAPE_ANALYSIS_RESULTS_DATA_JSON_FILE_NAME],
    ["overview", LandscapeDataExport.LANDSCAPE_OVERVIEW_DATA_JSON_FILE_NAME],
    ["repositories", LandscapeDataExport.LANDSCAPE_REPOSITORIES_DATA_JSON_FILE_NAME],
    ["contributors", LandscapeDataExport.LANDSCAPE_CONTRIBUTORS_DATA_JSON_FILE_NAME],
    ["teams", LandscapeDataExport.LANDSCAPE_TEAMS_DATA_JSON_FILE_NAME],
    ["topology", LandscapeDataExport.LANDSCAPE_TOPOLOGY_DATA_JSON_FILE_NAME],
    ["tags", LandscapeDataExport.LANDSCAPE_TAGS_DATA_JSON_FILE_NAME],
    ["tagMatrix", LandscapeDataExport.LANDSCAPE_TAG_MATRIX_DATA_JSON_FILE_NAME],
  ] as const
  private static readonly COMPATIBILITY_PROJECTION_CANDIDATES = [
    ["repositories", LandscapeDataExport.REPOSITORIES_DATA_FILE_NAME],
    ["contributors", "contributors.txt"],
    ["teams", "teams.txt"],
  ] as const

  private analysisResults: LandscapeAnalysisResults
  private dataFolder: string
  private emitCompatibilityProjections: boolean
  private snapshotContext: SnapshotExportContext | null = null
  private snapshotSource: "analyzeLandscape" | "updateLandscape" | null = null

  constructor(analysisResults: LandscapeAnalysisResults, folder: string, options: LandscapeDataExportOptions = {}) {
    this.analysisResults = analysisResults
    this.emitCompatibilityProjections = options.emitCompatibilityProjections === true

    this.dataFolder = join(folder, "data")
    if (!existsSync(this.dataFolder)) {
      mkdirSync(this.dataFolder, { recursive: true })
    }
  }

  exportCoreContracts(source: "analyzeLandscape" | "updateLandscape"): void {
    this.snapshotContext = createSnapshotExportContext()
    this.snapshotSource = source
    this.exportAnalysisResults()
    this.exportOverview()
    this.exportReportContext()
  }

  exportPeopleContracts(teamsConfig: TeamsConfig): void {
    const contributors = this.buildContributorRepositories()
    this.exportContributors(contributors)
    this.exportTeams(this.buildTeamRepositories(contributors, teamsConfig), teamsConfig)
    this.exportTopology(contributors)
    this.exportReportContext()
  }

  exportRepositories(tagMap: TagMap): void {
    this.exportRepositoriesJson(tagMap)

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
    this.exportReportContext()
  }

  exportTagContracts(tagMap: TagMap, tagGroups: TagGroup[]): void {
    const summarizeRepository = (repository: RepositoryAnalysisResult) => ({
      id: repositoryEntityId(getLandscapeRepoKey(repository.analysisResultsPath)),
      name: repository.name,
      repoKey: getLandscapeRepoKey(repository.analysisResultsPath),
      analysisResultsPath: repository.analysisResultsPath,
      mainLinesOfCode: repository.mainLoc,
      contributors: repository.contributors.length,
      latestCommitDate: repository.latestCommitDate,
    })

    const groups = tagGroups.map((group) => {
      const tags = group.repositoryTags.map((tag) => {
        const repositories = (tagMap.getTagStats(tag.getKey())?.repositoryAnalysisResults ?? [])
          .slice()
          .sort((left, right) => right.mainLoc - left.mainLoc)
          .map(summarizeRepository)

        return {
          key: tag.getKey(),
          name: tag.tag,
          imageLink: tag.imageLink,
          repositoryCount: repositories.length,
          totalMainLinesOfCode: repositories.reduce((sum, repository) => sum + repository.mainLinesOfCode, 0),
          repositories,
        }
      })

      return {
        name: group.name,
        description: group.description,
        color: group.color,
        tagCount: tags.length,
        repositoryCount: tags.reduce((sum, tag) => sum + tag.repositoryCount, 0),
        tags,
      }
    })

    const untaggedRepositories = (tagMap.getTagStats("")?.repositoryAnalysisResults ?? [])
      .slice()
      .sort((left, right) => right.mainLoc - left.mainLoc)
      .map(summarizeRepository)

    writeFileSync(
      join(this.dataFolder, LandscapeDataExport.LANDSCAPE_TAGS_DATA_JSON_FILE_NAME),
      JSON.stringify(
        {
          title: "Repository Tags",
          groupCount: groups.length,
          tagCount: groups.reduce((sum, group) => sum + group.tagCount, 0),
          untaggedRepositoryCount: untaggedRepositories.length,
          groups,
          untaggedRepositories,
        },
        null,
        2,
      ),
      "utf-8",
    )

    writeFileSync(
      join(this.dataFolder, LandscapeDataExport.LANDSCAPE_TAG_MATRIX_DATA_JSON_FILE_NAME),
      JSON.stringify(
        {
          title: "Repository Tag Matrix",
          repositoryCount: this.analysisResults.repositoryAnalysisResults.length,
          repositories: this.analysisResults.repositoryAnalysisResults.map((repository) => ({
            id: repositoryEntityId(getLandscapeRepoKey(repository.analysisResultsPath)),
            name: repository.name,
            repoKey: getLandscapeRepoKey(repository.analysisResultsPath),
            analysisResultsPath: repository.analysisResultsPath,
            mainLinesOfCode: repository.mainLoc,
            tags: tagMap.getRepositoryTags(repository).map((tag) => ({
              key: tag.getKey(),
              group: tag.group?.name ?? "",
              name: tag.tag,
            })),
            isUntagged: tagMap.getRepositoryTags(repository).length === 0,
          })),
        },
        null,
        2,
      ),
      "utf-8",
    )
    this.exportReportContext()
  }

  private exportRepositoriesJson(tagMap: TagMap): void {
    const repositoryExports = this.analysisResults.repositoryAnalysisResults.map((r) => new RepositoryExport(r))
    writeFileSync(
      join(this.dataFolder, LandscapeDataExport.REPOSITORIES_DATA_JSON_FILE_NAME),
      JSON.stringify(repositoryExports, null, 2),
      "utf-8",
    )
    writeFileSync(
      join(this.dataFolder, LandscapeDataExport.LANDSCAPE_REPOSITORIES_DATA_JSON_FILE_NAME),
      JSON.stringify(
        {
          title: "Repositories",
          repositoryCount: repositoryExports.length,
          repositories: repositoryExports.map((repository, index) =>
            this.toLandscapeRepositoryRecord(
              repository,
              this.analysisResults.repositoryAnalysisResults[index]!,
              tagMap,
            ),
          ),
        },
        null,
        2,
      ),
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
      const mainLang = extensions[0]?.extension.toUpperCase() ?? "-"
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

    this.writeCompatibilityProjection(fileName, lines.join("\n"))
  }

  exportContributors(contributors: ContributorRepositoriesModel[]): void {
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

    this.writeCompatibilityProjection("contributors.txt", lines.join("\n"))
    writeFileSync(join(this.dataFolder, "contributors.json"), JSON.stringify(contributorsExport, null, 2), "utf-8")
    writeFileSync(
      join(this.dataFolder, LandscapeDataExport.LANDSCAPE_CONTRIBUTORS_DATA_JSON_FILE_NAME),
      JSON.stringify(
        {
          title: "Contributors",
          contributorCount: contributorsExport.length,
          contributors: contributorsExport.map((entry) => this.toLandscapeContributorRecord(entry)),
        },
        null,
        2,
      ),
      "utf-8",
    )
  }

  exportTeams(teams: ContributorRepositoriesModel[], teamsConfig: TeamsConfig): void {
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

    this.writeCompatibilityProjection("teams.txt", lines.join("\n"))
    writeFileSync(join(this.dataFolder, "teams.json"), JSON.stringify(teamsExport, null, 2), "utf-8")
    writeFileSync(
      join(this.dataFolder, LandscapeDataExport.LANDSCAPE_TEAMS_DATA_JSON_FILE_NAME),
      JSON.stringify(
        {
          title: "Teams",
          teamCount: teamsExport.length,
          teams: teamsExport.map((entry) => this.toLandscapeTeamRecord(entry, teamsConfig)),
        },
        null,
        2,
      ),
      "utf-8",
    )
  }

  exportTopology(contributors: ContributorRepositoriesModel[]): void {
    const periods = TOPOLOGY_PERIODS.map((period) => this.buildTopologyPeriod(period, contributors))
    const periodsByKey = Object.fromEntries(periods.map((period) => [period.periodKey, period]))

    writeFileSync(
      join(this.dataFolder, LandscapeDataExport.LANDSCAPE_TOPOLOGY_DATA_JSON_FILE_NAME),
      JSON.stringify(
        {
          title: "Landscape Team Topology",
          contributorCount: contributors.length,
          periods,
          periodsByKey,
        },
        null,
        2,
      ),
      "utf-8",
    )
  }

  exportAnalysisResults(): void {
    writeFileSync(
      join(this.dataFolder, LandscapeDataExport.LANDSCAPE_ANALYSIS_RESULTS_DATA_JSON_FILE_NAME),
      JSON.stringify(
        this.analysisResults,
        (_key, value) => (value instanceof Map ? Object.fromEntries(value) : value),
        2,
      ),
      "utf-8",
    )
  }

  private exportReportContext(): void {
    if (!this.snapshotContext || !this.snapshotSource) return

    const canonicalShards = Object.fromEntries(
      LandscapeDataExport.CANONICAL_SHARD_CANDIDATES.filter(([, fileName]) =>
        existsSync(join(this.dataFolder, fileName)),
      ),
    )
    const compatibilityProjections = this.emitCompatibilityProjections
      ? Object.fromEntries(
          LandscapeDataExport.COMPATIBILITY_PROJECTION_CANDIDATES.filter(([, fileName]) =>
            existsSync(join(this.dataFolder, fileName)),
          ),
        )
      : {}
    writeFileSync(
      join(this.dataFolder, LandscapeDataExport.REPORT_CONTEXT_DATA_JSON_FILE_NAME),
      JSON.stringify(
        {
          mode: "landscape",
          reportMode: "landscape",
          title: this.analysisResults.metadata.name || "Landscape",
          rootRoute: "/landscape",
          dataVersion: 2,
          source: this.snapshotSource,
          hasLandscape: true,
          hasSingleRepositoryAnalysis: false,
          primaryNavigation: ["overview", "repositories", "contributors", "teams", "topology", "tags", "statistics"],
          snapshotId: this.snapshotContext.snapshotId,
          generatedAt: this.snapshotContext.generatedAt,
          capabilities: Object.keys(canonicalShards),
          canonicalShards,
          compatibilityProjections,
          entityIdPolicy: ENTITY_ID_POLICY,
        },
        null,
        2,
      ),
      "utf-8",
    )
  }

  private writeCompatibilityProjection(fileName: string, contents: string): void {
    if (!this.emitCompatibilityProjections) return
    writeFileSync(join(this.dataFolder, fileName), contents, "utf-8")
  }

  private exportOverview(): void {
    const languages = Array.from(this.analysisResults.linesOfCodePerExtension.entries())
      .map(([extension, linesOfCode]) => ({
        extension,
        linesOfCode,
        repositories: this.analysisResults.repositoriesPerExtension.get(extension) ?? 0,
      }))
      .sort((left, right) => right.linesOfCode - left.linesOfCode)

    const topRepositories = this.analysisResults.repositoryAnalysisResults
      .slice()
      .sort((left, right) => right.mainLoc - left.mainLoc)
      .slice(0, 10)
      .map((repo) => ({
        id: repositoryEntityId(getLandscapeRepoKey(repo.analysisResultsPath)),
        name: repo.name,
        repoKey: getLandscapeRepoKey(repo.analysisResultsPath),
        mainLinesOfCode: repo.mainLoc,
        contributors: repo.contributors.length,
        latestCommitDate: repo.latestCommitDate,
        analysisResultsPath: repo.analysisResultsPath,
      }))

    const activeContributors30d = this.analysisResults.allContributors.filter(
      (contributor) => contributor.commitsCount30Days > 0,
    )
    const activeContributors90d = this.analysisResults.allContributors.filter(
      (contributor) => contributor.commitsCount90Days > 0,
    )
    const activeContributors180d = this.analysisResults.allContributors.filter(
      (contributor) => contributor.commitsCount180Days > 0,
    )
    const activeContributors365d = this.analysisResults.allContributors.filter(
      (contributor) => contributor.commitsCount365Days > 0,
    )
    const activeRepositories30d = this.analysisResults.repositoryAnalysisResults.filter((repository) =>
      repository.contributors.some((contributor) => contributor.commitsCount30Days > 0),
    )
    const activeRepositories90d = this.analysisResults.repositoryAnalysisResults.filter((repository) =>
      repository.contributors.some((contributor) => contributor.commitsCount90Days > 0),
    )

    writeFileSync(
      join(this.dataFolder, LandscapeDataExport.LANDSCAPE_OVERVIEW_DATA_JSON_FILE_NAME),
      JSON.stringify(
        {
          title: "Landscape Overview",
          landscapeName: this.analysisResults.metadata.name || "Landscape",
          repositoryCount: this.analysisResults.getRepositoryCount(),
          contributorCount: this.analysisResults.allContributors.length,
          totals: {
            mainLinesOfCode: this.analysisResults.totalMainLoc,
            testLinesOfCode: this.analysisResults.totalTestLoc,
            generatedLinesOfCode: this.analysisResults.totalGeneratedLoc,
            buildAndDeployLinesOfCode: this.analysisResults.totalBuildAndDeployLoc,
            otherLinesOfCode: this.analysisResults.totalOtherLoc,
            totalLinesOfCode: this.analysisResults.getTotalLoc(),
            mainFilesCount: this.analysisResults.totalMainFilesCount,
            contributorCount30Days: activeContributors30d.length,
            contributorCount90Days: activeContributors90d.length,
            contributorCount180Days: activeContributors180d.length,
            contributorCount365Days: activeContributors365d.length,
            repositoryCount30Days: activeRepositories30d.length,
            repositoryCount90Days: activeRepositories90d.length,
            commits30d: activeContributors30d.reduce((sum, contributor) => sum + contributor.commitsCount30Days, 0),
            commits90d: activeContributors90d.reduce((sum, contributor) => sum + contributor.commitsCount90Days, 0),
          },
          firstCommitDate: this.analysisResults.firstCommitDate,
          latestCommitDate: this.analysisResults.latestCommitDate,
          languages,
          topRepositories,
        },
        null,
        2,
      ),
      "utf-8",
    )
  }

  private buildTopologyPeriod(period: TopologyPeriodDefinition, contributors: ContributorRepositoriesModel[]) {
    const dependencies = [...this.analysisResults[period.dependencyKey]]
    const activeContributors = contributors.filter(
      (contributor) => contributor.contributor[period.contributorCommitsKey] > 0,
    )
    const contributorConnections = ContributorConnectionUtils.getContributorConnections(
      dependencies,
      activeContributors.map((contributor) => contributor.contributor),
      (contributor) => contributor[period.contributorCommitsKey],
    )
    const connectionCountMap = new Map(contributorConnections.map((connection) => [connection.email, connection.count]))
    const sharedFilesCountMap = new Map<string, number>()

    for (const dependency of dependencies) {
      sharedFilesCountMap.set(
        dependency.fromComponent,
        (sharedFilesCountMap.get(dependency.fromComponent) ?? 0) + dependency.count,
      )
      sharedFilesCountMap.set(
        dependency.toComponent,
        (sharedFilesCountMap.get(dependency.toComponent) ?? 0) + dependency.count,
      )
    }

    const contributorsExport = activeContributors
      .map((contributorRepositories) => {
        const repositories = contributorRepositories.repositories
          .filter((repository) => repository[period.repositoryCommitsKey] > 0)
          .sort((left, right) => right[period.repositoryCommitsKey] - left[period.repositoryCommitsKey])
          .map((repository) => ({
            name: repository.repositoryAnalysisResult?.name ?? "",
            commitsCount: repository[period.repositoryCommitsKey],
          }))

        return {
          email: contributorRepositories.contributor.email,
          displayName: contributorRepositories.contributor.userName || contributorRepositories.contributor.email,
          isBot: contributorRepositories.contributor.isBot,
          commitsCount: contributorRepositories.contributor[period.contributorCommitsKey],
          repositoryCount: repositories.length,
          repositories,
          connectionCount: connectionCountMap.get(contributorRepositories.contributor.email) ?? 0,
          sharedFilesCount: sharedFilesCountMap.get(contributorRepositories.contributor.email) ?? 0,
        }
      })
      .sort((left, right) => {
        if (left.connectionCount !== right.connectionCount) return right.connectionCount - left.connectionCount
        if (left.commitsCount !== right.commitsCount) return right.commitsCount - left.commitsCount
        return left.email.localeCompare(right.email)
      })

    const topologyConnections = dependencies.map((dependency) => ({
      from: dependency.fromComponent,
      to: dependency.toComponent,
      sharedFilesCount: dependency.count,
      sharedFiles: [...dependency.data].sort(),
    }))

    const connectionStats = contributorsExport.map((contributor) => ({
      email: contributor.email,
      repositoriesCount: contributor.repositoryCount,
      connectionsCount: contributor.connectionCount,
    }))
    const mostConnectedContributor = contributorsExport[0] ?? null

    return {
      periodKey: period.key,
      periodLabel: period.label,
      contributorCount: contributorsExport.length,
      connectionCount: topologyConnections.length,
      cIndex: ContributorConnectionUtils.getCIndex(connectionStats),
      cMedian: ContributorConnectionUtils.getCMedian(connectionStats),
      cMean: ContributorConnectionUtils.getCMean(connectionStats),
      mostConnectedContributor: mostConnectedContributor
        ? {
            email: mostConnectedContributor.email,
            displayName: mostConnectedContributor.displayName,
            connectionCount: mostConnectedContributor.connectionCount,
          }
        : null,
      contributors: contributorsExport,
      strongestConnections: topologyConnections.slice(0, 25),
      connections: topologyConnections,
    }
  }

  private toLandscapeRepositoryRecord(
    repository: RepositoryExport,
    source: RepositoryAnalysisResult,
    tagMap: TagMap,
  ): Record<string, unknown> {
    const tags = tagMap.getRepositoryTags(source).map((tag) => ({
      key: tag.getKey(),
      group: tag.group?.name ?? "",
      name: tag.tag,
    }))

    return {
      ...repository,
      repoKey: getLandscapeRepoKey(repository.analysisResultsPath),
      name: repository.metadata.name,
      description: repository.metadata.description,
      commits30d: repository.commitsCount30Days,
      commits90d: repository.commitsCount90Days,
      contributorsCount: repository.contributors.length,
      contributors30d: repository.contributors30Days.length,
      contributors90d: repository.contributors90Days.length,
      contributorEmails: repository.contributors,
      contributorEmails30d: repository.contributors30Days,
      contributorEmails90d: repository.contributors90Days,
      tags,
    }
  }

  private toLandscapeContributorRecord(entry: ContributorExport): Record<string, unknown> {
    const displayName = entry.contributor.userName || entry.contributor.email

    return {
      id: entry.id,
      email: entry.contributor.email,
      displayName,
      name: displayName,
      commitsCount: entry.contributor.commitsCount,
      commitsCount30Days: entry.contributor.commitsCount30Days,
      commitsCount90Days: entry.contributor.commitsCount90Days,
      commitsCount180Days: entry.contributor.commitsCount180Days,
      commitsCount365Days: entry.contributor.commitsCount365Days,
      commits30d: entry.contributor.commitsCount30Days,
      commits90d: entry.contributor.commitsCount90Days,
      commits180d: entry.contributor.commitsCount180Days,
      commits365d: entry.contributor.commitsCount365Days,
      firstCommitDate: entry.contributor.firstCommitDate,
      latestCommitDate: entry.contributor.latestCommitDate,
      isBot: entry.contributor.isBot,
      repositoryCount: entry.repositories.length,
      repositories: entry.repositories,
    }
  }

  private toLandscapeTeamRecord(entry: ContributorExport, teamsConfig: TeamsConfig): Record<string, unknown> {
    return {
      name: entry.contributor.email,
      description: teamsConfig.teams.find((team) => team.name === entry.contributor.email)?.description ?? "",
      commitsCount: entry.contributor.commitsCount,
      commitsCount30Days: entry.contributor.commitsCount30Days,
      commitsCount90Days: entry.contributor.commitsCount90Days,
      commitsCount180Days: entry.contributor.commitsCount180Days,
      commitsCount365Days: entry.contributor.commitsCount365Days,
      commits30d: entry.contributor.commitsCount30Days,
      commits90d: entry.contributor.commitsCount90Days,
      commits180d: entry.contributor.commitsCount180Days,
      commits365d: entry.contributor.commitsCount365Days,
      firstCommitDate: entry.contributor.firstCommitDate,
      latestCommitDate: entry.contributor.latestCommitDate,
      repositoryCount: entry.repositories.length,
      memberCount: entry.members.length,
      members: entry.members,
      repositories: entry.repositories,
    }
  }

  private buildContributorRepositories(): ContributorRepositoriesModel[] {
    const aggregateContributors = new Map(
      this.analysisResults.allContributors.map((contributor) => [contributor.email, contributor]),
    )
    const contributorMap = new Map<string, ContributorRepositoriesModel>()

    for (const repository of this.analysisResults.repositoryAnalysisResults) {
      for (const contributor of repository.contributors) {
        let entry = contributorMap.get(contributor.email)
        if (!entry) {
          entry = new ContributorRepositoriesModel(
            this.cloneContributor(aggregateContributors.get(contributor.email) ?? contributor),
          )
          contributorMap.set(contributor.email, entry)
        }

        entry.addRepository(
          repository,
          contributor.firstCommitDate,
          contributor.latestCommitDate,
          contributor.commitsCount,
          contributor.commitsCount30Days,
          contributor.commitsCount90Days,
          contributor.commitsCount180Days,
          contributor.commitsCount365Days,
          [],
        )
      }
    }

    return Array.from(contributorMap.values()).sort(
      (left, right) => right.contributor.commitsCount - left.contributor.commitsCount,
    )
  }

  private buildTeamRepositories(
    contributors: ContributorRepositoriesModel[],
    teamsConfig: TeamsConfig,
  ): ContributorRepositoriesModel[] {
    const teamMap = new Map<string, ContributorRepositoriesModel>()

    for (const contributor of contributors) {
      const teamName = teamsConfig.getTeam(contributor.contributor.email)
      if (!teamName) continue

      let teamEntry = teamMap.get(teamName)
      if (!teamEntry) {
        teamEntry = new ContributorRepositoriesModel(this.createTeamContributor(teamName))
        teamMap.set(teamName, teamEntry)
      }

      if (!teamEntry.members.some((member) => member.contributor.email === contributor.contributor.email)) {
        teamEntry.members.push(contributor)
        teamEntry.contributor.commitsCount += contributor.contributor.commitsCount
        teamEntry.contributor.commitsCount30Days += contributor.contributor.commitsCount30Days
        teamEntry.contributor.commitsCount90Days += contributor.contributor.commitsCount90Days
        teamEntry.contributor.commitsCount180Days += contributor.contributor.commitsCount180Days
        teamEntry.contributor.commitsCount365Days += contributor.contributor.commitsCount365Days
        if (
          contributor.contributor.firstCommitDate &&
          (!teamEntry.contributor.firstCommitDate ||
            contributor.contributor.firstCommitDate < teamEntry.contributor.firstCommitDate)
        ) {
          teamEntry.contributor.firstCommitDate = contributor.contributor.firstCommitDate
        }
        if (
          contributor.contributor.latestCommitDate &&
          (!teamEntry.contributor.latestCommitDate ||
            contributor.contributor.latestCommitDate > teamEntry.contributor.latestCommitDate)
        ) {
          teamEntry.contributor.latestCommitDate = contributor.contributor.latestCommitDate
        }
      }

      for (const repository of contributor.repositories) {
        if (!repository.repositoryAnalysisResult) continue
        teamEntry.addRepository(
          repository.repositoryAnalysisResult,
          repository.firstCommitDate,
          repository.latestCommitDate,
          repository.commitsCount,
          repository.commits30Days,
          repository.commits90Days,
          repository.commits180Days,
          repository.commits365Days,
          repository.commitDates,
        )
      }
    }

    return Array.from(teamMap.values()).sort(
      (left, right) => right.contributor.commitsCount - left.contributor.commitsCount,
    )
  }

  private cloneContributor(source: Contributor): Contributor {
    const contributor = new Contributor()
    contributor.email = source.email
    contributor.commitsCount = source.commitsCount
    contributor.commitsCount30Days = source.commitsCount30Days
    contributor.commitsCount90Days = source.commitsCount90Days
    contributor.commitsCount180Days = source.commitsCount180Days
    contributor.commitsCount365Days = source.commitsCount365Days
    contributor.firstCommitDate = source.firstCommitDate
    contributor.latestCommitDate = source.latestCommitDate
    contributor.isBot = source.isBot
    return contributor
  }

  private createTeamContributor(teamName: string): Contributor {
    const contributor = new Contributor()
    contributor.email = teamName
    return contributor
  }
}
