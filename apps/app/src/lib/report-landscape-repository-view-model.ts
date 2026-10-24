import { formatReportDate } from "@planetnik/report-ui/utils/reportDates"
import { getHostedReportRepositoryContributorHref } from "./hosted-routes.js"
import type { RuntimeReportLandscapeRepository } from "./runtime-client.js"

type ReportLandscapeRepositoryCard = {
  readonly label: string
  readonly value: string
  readonly detail: string | null
}

type ReportLandscapeRepositoryLink = {
  readonly label: string
  readonly href: string
}

type ReportLandscapeRepositoryContributorRow = {
  readonly id: string
  readonly contributor: string
  readonly href: string
  readonly email: string
  readonly type: string
  readonly commitsCount: number
  readonly commits30d: number
  readonly commits90d: number
  readonly glueScore: string
  readonly structuralImpact: string
  readonly snackRisk: string
  readonly signal: string
  readonly firstCommitDate: string
  readonly latestCommitDate: string
}

export type ReportLandscapeRepositoryViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly cards: ReadonlyArray<ReportLandscapeRepositoryCard>
  readonly links: ReadonlyArray<ReportLandscapeRepositoryLink>
  readonly contributorRows: ReadonlyArray<ReportLandscapeRepositoryContributorRow>
}

function formatCount(value: number): string {
  return value.toLocaleString("en-GB")
}

export function buildReportLandscapeRepositoryViewModel(input: {
  readonly slug: string
  readonly repository: RuntimeReportLandscapeRepository
}): ReportLandscapeRepositoryViewModel {
  return {
    heading: input.repository.name,
    subtitle: "Repository drilldown within the current hosted landscape report.",
    cards: [
      {
        label: "Lines of Code",
        value: formatCount(input.repository.linesOfCode),
        detail: null,
      },
      {
        label: "Files",
        value: formatCount(input.repository.filesCount),
        detail: null,
      },
      {
        label: "Contributors",
        value: formatCount(input.repository.contributorsCount),
        detail: null,
      },
      {
        label: "Commits (30d)",
        value: formatCount(input.repository.commits30d),
        detail: null,
      },
      {
        label: "Commits (90d)",
        value: formatCount(input.repository.commits90d),
        detail: null,
      },
      {
        label: "Latest Commit",
        value: formatReportDate(input.repository.latestCommitDate),
        detail: null,
      },
      ...(input.repository.duplicationPercentage === null
        ? []
        : [
            {
              label: "Duplication",
              value: `${input.repository.duplicationPercentage.toFixed(1)}%`,
              detail: null,
            },
          ]),
    ],
    links: input.repository.links,
    contributorRows: input.repository.contributors.map((contributor) => ({
      id: contributor.email,
      contributor: contributor.displayName,
      href: getHostedReportRepositoryContributorHref(input.slug, input.repository.repoKey, contributor.email),
      email: contributor.email,
      type: contributor.type,
      commitsCount: contributor.commitsCount,
      commits30d: contributor.commits30d,
      commits90d: contributor.commits90d,
      glueScore: contributor.glueScore,
      structuralImpact: contributor.structuralImpact,
      snackRisk: contributor.snackRisk,
      signal: contributor.signal,
      firstCommitDate: formatReportDate(contributor.firstCommitDate),
      latestCommitDate: formatReportDate(contributor.latestCommitDate),
    })),
  }
}
