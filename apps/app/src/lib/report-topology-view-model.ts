import type { RuntimeReportTopology } from "./runtime-client.js"

type ReportTopologyCard = {
  readonly label: string
  readonly value: string
  readonly detail: string | null
}

type ReportTopologyListItem = {
  readonly label: string
  readonly value: string
}

export type ReportTopologyViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly cards: ReadonlyArray<ReportTopologyCard>
  readonly strongestConnections: ReadonlyArray<ReportTopologyListItem>
  readonly glueContributors: ReadonlyArray<ReportTopologyListItem>
  readonly snackingContributors: ReadonlyArray<ReportTopologyListItem>
}

function normalizeDimension(value: string): string {
  return value.replaceAll("_", " ")
}

function contributorLabel(input: { readonly email: string; readonly displayName: string }) {
  return input.displayName.trim().length > 0 ? input.displayName : input.email
}

export function buildReportTopologyViewModel(input: {
  readonly slug: string
  readonly reportName: string
  readonly topology: RuntimeReportTopology
}): ReportTopologyViewModel {
  return {
    heading: input.reportName,
    subtitle: "Contributor topology summary from shared file modifications in the linked Planetnik dataset.",
    cards: [
      {
        label: "Available Periods",
        value: input.topology.availablePeriods.length.toLocaleString("en-GB"),
        detail: input.topology.availablePeriods.join(", "),
      },
      {
        label: "Strongest Links",
        value: input.topology.strongestConnections.length.toLocaleString("en-GB"),
        detail: null,
      },
      {
        label: "Glue Signals",
        value: input.topology.topGlueContributors.length.toLocaleString("en-GB"),
        detail: null,
      },
      {
        label: "Snacking Signals",
        value: input.topology.topSnackingContributors.length.toLocaleString("en-GB"),
        detail: null,
      },
    ],
    strongestConnections: input.topology.strongestConnections.map((connection) => ({
      label: `${contributorLabel({
        email: connection.from,
        displayName: connection.fromDisplayName,
      })} ↔ ${contributorLabel({
        email: connection.to,
        displayName: connection.toDisplayName,
      })}`,
      value: `${connection.periodLabel} · ${connection.sharedCommits.toLocaleString("en-GB")} shared commits across ${connection.filesCount.toLocaleString("en-GB")} files`,
    })),
    glueContributors: input.topology.topGlueContributors.map((contributor) => ({
      label: contributorLabel(contributor),
      value: `Glue ${contributor.glueScore.toFixed(1)} · ${normalizeDimension(contributor.dominantDimension)}`,
    })),
    snackingContributors: input.topology.topSnackingContributors.map((contributor) => ({
      label: contributorLabel(contributor),
      value: `Snacking ${contributor.snackingScore.toFixed(1)} · ${normalizeDimension(contributor.dominantDimension)}`,
    })),
  }
}
