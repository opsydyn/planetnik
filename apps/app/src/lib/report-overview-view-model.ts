import type { RuntimeReportDetail } from "./runtime-client.js"

type ReportOverviewCard = {
  readonly label: string
  readonly value: string
  readonly detail: string | null
}

export type ReportOverviewViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly cards: ReadonlyArray<ReportOverviewCard>
  readonly highlights: ReadonlyArray<string>
}

export function buildReportOverviewViewModel(reportDetail: RuntimeReportDetail): ReportOverviewViewModel {
  const { report, context, artifact } = reportDetail
  const reportMode = context?.reportMode?.replaceAll("_", " ") ?? "unavailable"
  const heading =
    artifact?.kind === "landscape"
      ? artifact.landscapeName
      : artifact?.kind === "single_repository"
        ? artifact.projectName
        : report.name

  if (artifact?.kind === "single_repository") {
    return {
      heading,
      subtitle: "Connected single repository report backed by Planetnik analysis artifacts.",
      cards: [
        {
          label: "Files",
          value: artifact.filesCount.toLocaleString("en-GB"),
          detail: null,
        },
        {
          label: "Lines of Code",
          value: artifact.linesOfCode.toLocaleString("en-GB"),
          detail: null,
        },
        {
          label: "Duplication",
          value: `${artifact.duplicationPercentage.toFixed(1)}%`,
          detail: `${artifact.duplicatedLines.toLocaleString("en-GB")} duplicated lines`,
        },
        {
          label: "Primary Sections",
          value: String(context?.primaryNavigation.length ?? 0),
          detail: context && context.primaryNavigation.length > 0 ? context.primaryNavigation.join(", ") : null,
        },
      ],
      highlights: [
        `Report mode: ${reportMode}`,
        `Root route: ${context?.rootRoute ?? "unavailable"}`,
        `Source: ${context?.source ?? "unavailable"}`,
      ],
    }
  }

  if (artifact?.kind === "landscape") {
    return {
      heading,
      subtitle: "Connected landscape report backed by Planetnik analysis artifacts.",
      cards: [
        {
          label: "Repositories",
          value: artifact.repositoryCount.toLocaleString("en-GB"),
          detail: null,
        },
        {
          label: "Contributors",
          value: artifact.contributorCount.toLocaleString("en-GB"),
          detail: null,
        },
        {
          label: "Lines of Code",
          value: artifact.totalLinesOfCode.toLocaleString("en-GB"),
          detail: null,
        },
        {
          label: "Recent Activity",
          value: artifact.commits30d.toLocaleString("en-GB"),
          detail: `${artifact.commits90d.toLocaleString("en-GB")} commits in 90d`,
        },
      ],
      highlights: [
        `Report mode: ${reportMode}`,
        `Root route: ${context?.rootRoute ?? "unavailable"}`,
        `Source: ${context?.source ?? "unavailable"}`,
      ],
    }
  }

  return {
    heading,
    subtitle: "Report record exists, but no validated Planetnik artifact summary is available yet.",
    cards: [
      {
        label: "Status",
        value: report.status,
        detail: null,
      },
      {
        label: "Source",
        value: report.analysisRoot ? "Linked" : "Unlinked",
        detail: report.analysisRoot ? report.analysisRoot : "No validated dataset attached yet",
      },
    ],
    highlights: [
      `Report mode: ${reportMode}`,
      `Root route: ${context?.rootRoute ?? "unavailable"}`,
      `Source: ${context?.source ?? "unavailable"}`,
    ],
  }
}
