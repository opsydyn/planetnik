import type { RuntimeReportDetail } from "./runtime-client.js"

type ReportDetailFact = {
  readonly label: string
  readonly value: string
}

export type ReportDetailViewModel = {
  readonly linkDescription: string
  readonly contextTitle: string
  readonly contextFacts: ReadonlyArray<ReportDetailFact>
  readonly contextFallback: string | null
  readonly artifactTitle: string
  readonly artifactFacts: ReadonlyArray<ReportDetailFact>
  readonly artifactFallback: string | null
  readonly navigationItems: ReadonlyArray<string>
}

export function shouldRedirectReportDetail(reportDetail: RuntimeReportDetail | null): reportDetail is null {
  return reportDetail === null
}

export function buildReportDetailViewModel(reportDetail: RuntimeReportDetail): ReportDetailViewModel {
  const { context, artifact } = reportDetail

  const linkDescription = context
    ? `This report is linked to a ${context.reportMode.replaceAll("_", " ")} dataset.`
    : "This report exists, but no report_context.json summary could be read from the linked data directory."

  const contextFacts = context
    ? [
        {
          label: "Mode",
          value: context.reportMode.replaceAll("_", " "),
        },
        {
          label: "Root route",
          value: context.rootRoute,
        },
        {
          label: "Data version",
          value: String(context.dataVersion),
        },
        {
          label: "Source",
          value: context.source,
        },
      ]
    : []

  const artifactTitle =
    artifact?.kind === "landscape"
      ? artifact.landscapeName
      : artifact?.kind === "single_repository"
        ? artifact.projectName
        : "No artifact summary"

  const artifactFacts =
    artifact?.kind === "single_repository"
      ? [
          {
            label: "Files",
            value: artifact.filesCount.toLocaleString("en-GB"),
          },
          {
            label: "Lines of code",
            value: artifact.linesOfCode.toLocaleString("en-GB"),
          },
          {
            label: "Duplicated lines",
            value: artifact.duplicatedLines.toLocaleString("en-GB"),
          },
          {
            label: "Duplication",
            value: `${artifact.duplicationPercentage.toFixed(1)}%`,
          },
        ]
      : artifact?.kind === "landscape"
        ? [
            {
              label: "Repositories",
              value: artifact.repositoryCount.toLocaleString("en-GB"),
            },
            {
              label: "Contributors",
              value: artifact.contributorCount.toLocaleString("en-GB"),
            },
            {
              label: "Total lines of code",
              value: artifact.totalLinesOfCode.toLocaleString("en-GB"),
            },
            {
              label: "Recent commits",
              value: `30d: ${artifact.commits30d.toLocaleString("en-GB")} · 90d: ${artifact.commits90d.toLocaleString("en-GB")}`,
            },
          ]
        : []

  return {
    linkDescription,
    contextTitle: context?.title ?? "No report context",
    contextFacts,
    contextFallback: context
      ? null
      : "The report row is valid, but the runtime could not load a usable context summary from the linked dataset.",
    artifactTitle,
    artifactFacts,
    artifactFallback:
      artifactFacts.length > 0
        ? null
        : "The dataset link is valid, but the runtime could not read a supported summary artifact from the report data directory.",
    navigationItems: context?.primaryNavigation ?? [],
  }
}
