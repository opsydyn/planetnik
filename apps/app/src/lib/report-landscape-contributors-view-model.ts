import type { HorizontalBarItem } from "@planetnik/report-ui/charts/HorizontalBarChart"
import type { GridRow } from "@planetnik/report-ui/tables/ReportDataGrid.types"
import { formatReportDate } from "@planetnik/report-ui/utils/reportDates"
import { getHostedReportContributorRouteParam } from "./hosted-routes.js"
import type { RuntimeReportContributor } from "./runtime-client.js"

export type ReportLandscapeContributorsCard = {
  readonly label: string
  readonly value: string
}

export type ReportLandscapeContributorsViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly cards: ReadonlyArray<ReportLandscapeContributorsCard>
  readonly topContributorBars: ReadonlyArray<HorizontalBarItem>
  readonly rows: ReadonlyArray<GridRow>
}

function formatCount(value: number): string {
  return value.toLocaleString("en-GB")
}

export function buildReportLandscapeContributorsViewModel(input: {
  readonly slug: string
  readonly contributors: ReadonlyArray<RuntimeReportContributor>
}): ReportLandscapeContributorsViewModel {
  return {
    heading: "Contributors",
    subtitle:
      "Organisation-wide contributor footprint across repositories, recent activity, and cross-repository reach.",
    cards: [
      {
        label: "Contributors",
        value: formatCount(input.contributors.length),
      },
      {
        label: "Active (30d)",
        value: formatCount(input.contributors.filter((contributor) => contributor.commits30Days > 0).length),
      },
      {
        label: "Multi-Repo",
        value: formatCount(input.contributors.filter((contributor) => (contributor.repositoryCount ?? 0) > 1).length),
      },
      {
        label: "Bots",
        value: formatCount(input.contributors.filter((contributor) => contributor.isBot === true).length),
      },
    ],
    topContributorBars: input.contributors.slice(0, 12).map((contributor) => ({
      label: contributor.displayName,
      value: contributor.repositoryCount ?? 0,
      href: `/reports/${input.slug}/contributors/${getHostedReportContributorRouteParam(contributor.email)}`,
    })),
    rows: input.contributors.map((contributor) => ({
      id: contributor.email,
      displayName: contributor.displayName,
      href: `/reports/${input.slug}/contributors/${getHostedReportContributorRouteParam(contributor.email)}`,
      email: contributor.email,
      commitsCount: contributor.commitsAllTime,
      commits30d: contributor.commits30Days,
      commits90d: contributor.commits90Days,
      repositoryCount: contributor.repositoryCount ?? 0,
      latestCommitDate: formatReportDate(contributor.latestCommitDate),
      type: contributor.isBot === true ? "Bot" : "Human",
      repositories: contributor.repositories.map((repository) => repository.name).join(" • ") || "—",
    })),
  }
}
