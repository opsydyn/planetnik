import { formatReportDate } from "@planetnik/report-ui/utils/reportDates"
import type { RuntimeReportContributorDetail } from "./runtime-client.js"

export type ReportContributorDetailCard = {
  readonly label: string
  readonly value: string
  readonly detail: string | null
}

export type ReportContributorDetailFact = {
  readonly label: string
  readonly value: string
}

export type ReportContributorDetailListItem = {
  readonly label: string
  readonly value: string
}

export type ReportContributorDetailViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly cards: ReadonlyArray<ReportContributorDetailCard>
  readonly facts: ReadonlyArray<ReportContributorDetailFact>
  readonly extensions: ReadonlyArray<ReportContributorDetailListItem>
  readonly components: ReadonlyArray<ReportContributorDetailListItem>
  readonly topFiles: ReadonlyArray<ReportContributorDetailListItem>
  readonly backHref: string
}

export function buildReportContributorDetailViewModel(input: {
  readonly slug: string
  readonly reportName: string
  readonly routeBase?: string
  readonly contributor: RuntimeReportContributorDetail
}): ReportContributorDetailViewModel {
  const { contributor } = input
  const routeBase = input.routeBase ?? `/reports/${input.slug}/contributors`

  return {
    heading: contributor.displayName,
    subtitle: "Contributor drilldown for the linked Planetnik report dataset.",
    cards: [
      {
        label: "All-Time Commits",
        value: contributor.commitsCount.toLocaleString("en-GB"),
        detail: null,
      },
      {
        label: "Active Days",
        value: contributor.activeDays.toLocaleString("en-GB"),
        detail: null,
      },
      {
        label: "Files Touched",
        value: contributor.filesCount.toLocaleString("en-GB"),
        detail: null,
      },
      {
        label: "Collaborators",
        value: contributor.collaboratorsCount.toLocaleString("en-GB"),
        detail: contributor.topCollaboratorDisplayName
          ? `Top collaborator: ${contributor.topCollaboratorDisplayName}`
          : null,
      },
    ],
    facts: [
      {
        label: "Email",
        value: contributor.email,
      },
      {
        label: "Status",
        value: contributor.status,
      },
      {
        label: "Commit Share",
        value: contributor.percentage,
      },
      {
        label: "30 / 90 / 180 / 365 Days",
        value: `${contributor.commitsCount30Days} / ${contributor.commitsCount90Days} / ${contributor.commitsCount180Days} / ${contributor.commitsCount365Days}`,
      },
      {
        label: "First Commit",
        value: formatReportDate(contributor.firstCommitDate),
      },
      {
        label: "Latest Commit",
        value: formatReportDate(contributor.latestCommitDate),
      },
    ],
    extensions: contributor.extensions.map((extension) => ({
      label: extension.extension ? `.${extension.extension}` : "No Extension",
      value: `${extension.commits.toLocaleString("en-GB")} commits across ${extension.files.toLocaleString("en-GB")} files`,
    })),
    components: contributor.logicalComponents.map((component) => ({
      label: component.name,
      value: `${component.linesOfCode.toLocaleString("en-GB")} loc across ${component.files.toLocaleString("en-GB")} files`,
    })),
    topFiles: contributor.topFiles.map((file) => ({
      label: file.relativePath,
      value: [`${file.commits.toLocaleString("en-GB")} commits`, ...file.logicalComponents, ...file.concerns].join(
        " · ",
      ),
    })),
    backHref: routeBase,
  }
}
