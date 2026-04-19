import type { DonutItem } from "@planetnik/report-ui/charts/DonutChart"
import type { HorizontalBarItem } from "@planetnik/report-ui/charts/HorizontalBarChart"
import { formatReportDate } from "@planetnik/report-ui/utils/reportDates"
import { getHostedReportRepositoryHref } from "./hosted-routes.js"
import type { RuntimeReportLandscapeOverview } from "./runtime-client.js"

export type ReportLandscapeOverviewCard = {
  readonly label: string
  readonly value: string
}

export type ReportLandscapeOverviewViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly cards: ReadonlyArray<ReportLandscapeOverviewCard>
  readonly languageMix: ReadonlyArray<DonutItem>
  readonly largestLanguages: ReadonlyArray<HorizontalBarItem>
  readonly topRepositories: ReadonlyArray<{
    readonly name: string
    readonly href: string
    readonly mainLinesOfCode: string
    readonly contributors: string
    readonly latestCommitDate: string
  }>
  readonly languageInventory: ReadonlyArray<{
    readonly extension: string
    readonly repositories: string
    readonly linesOfCode: string
    readonly percentage: string
  }>
  readonly mutedNote: string
}

function formatCount(value: number): string {
  return value.toLocaleString("en-GB")
}

export function buildReportLandscapeOverviewViewModel(input: {
  readonly slug: string
  readonly overview: RuntimeReportLandscapeOverview
}): ReportLandscapeOverviewViewModel {
  const totalLinesOfCode = Math.max(input.overview.totals.totalLinesOfCode, 1)

  return {
    heading: input.overview.landscapeName,
    subtitle: `Multi-repository landscape view across ${formatCount(input.overview.repositoryCount)} repositories.`,
    cards: [
      { label: "Repositories", value: formatCount(input.overview.repositoryCount) },
      { label: "Contributors", value: formatCount(input.overview.contributorCount) },
      { label: "Total LOC", value: formatCount(input.overview.totals.totalLinesOfCode) },
      { label: "Main LOC", value: formatCount(input.overview.totals.mainLinesOfCode) },
      { label: "Commits (30d)", value: formatCount(input.overview.totals.commits30d) },
      {
        label: "Active Contributors (30d)",
        value: formatCount(input.overview.totals.contributorCount30Days),
      },
      { label: "Teams", value: formatCount(input.overview.teamCount) },
      { label: "Tags", value: formatCount(input.overview.tagCount) },
    ],
    languageMix: input.overview.languages.map((language) => ({
      label: language.extension,
      value: language.linesOfCode,
    })),
    largestLanguages: input.overview.languages.map((language) => ({
      label: language.extension,
      value: language.linesOfCode,
    })),
    topRepositories: input.overview.topRepositories.map((repository) => ({
      name: repository.name,
      href: getHostedReportRepositoryHref(input.slug, repository.repoKey),
      mainLinesOfCode: formatCount(repository.mainLinesOfCode),
      contributors: formatCount(repository.contributors),
      latestCommitDate: formatReportDate(repository.latestCommitDate),
    })),
    languageInventory: input.overview.languages.map((language) => ({
      extension: language.extension,
      repositories: formatCount(language.repositories),
      linesOfCode: formatCount(language.linesOfCode),
      percentage: `${((language.linesOfCode / totalLinesOfCode) * 100).toFixed(1)}%`,
    })),
    mutedNote:
      "This landscape mode is portfolio-oriented. Use repositories, contributors, teams, topology, and tags to move from repo-local analysis to organization-level structure.",
  }
}
