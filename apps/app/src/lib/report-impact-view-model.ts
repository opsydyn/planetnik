import type { GridRow } from "@planetnik/report-ui/tables/ReportDataGrid.types"
import type { RuntimeReportImpact } from "./runtime-client.js"

type ReportImpactCard = {
  readonly label: string
  readonly value: string
  readonly detail: string | null
  readonly accentColor?: string
}

type ReportImpactConceptCard = {
  readonly concept: string
  readonly dimension: string
  readonly evidenceCount: number
  readonly examples: ReadonlyArray<string>
}

type ReportImpactPlaybookItem = {
  readonly title: string
  readonly body: string
  readonly href: string
  readonly label: string
}

export type ReportImpactViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly cards: ReadonlyArray<ReportImpactCard>
  readonly dimensionChartData: ReadonlyArray<{ readonly label: string; readonly value: number }>
  readonly topOpportunityData: ReadonlyArray<{ readonly label: string; readonly value: number }>
  readonly snackingChartData: ReadonlyArray<{
    readonly label: string
    readonly value: number
    readonly detail: string
    readonly detailSecondary: string
  }>
  readonly conceptCards: ReadonlyArray<ReportImpactConceptCard>
  readonly playbookItems: ReadonlyArray<ReportImpactPlaybookItem>
  readonly opportunityRows: ReadonlyArray<GridRow>
  readonly snackingRows: ReadonlyArray<GridRow>
}

const DIMENSION_LABELS: Record<string, string> = {
  complexity_reduction: "Complexity reduction",
  boundary_shaping: "Boundary shaping",
  knowledge_spread: "Knowledge spread",
  coordination_relief: "Coordination relief",
  change_enablement: "Change enablement",
}

function normalizeDimension(value: string): string {
  return DIMENSION_LABELS[value] ?? value.replaceAll("_", " ").trim()
}

function truncateLabel(value: string, max = 34): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function buildReportImpactViewModel(input: {
  readonly reportName: string
  readonly impact: RuntimeReportImpact
  readonly opportunityHrefs?: ReadonlyArray<string | undefined>
  readonly snackingHrefs?: ReadonlyArray<string | undefined>
  readonly playbookHrefs?: {
    readonly hotspots: string
    readonly components: string
    readonly contributors: string
    readonly controls: string
  }
}): ReportImpactViewModel {
  const { impact } = input

  const dimensionChartData = impact.impactDimensions.map((d) => ({
    label: d.label,
    value: d.score,
  }))

  const topOpportunityData = impact.topOpportunities.slice(0, 12).map((item) => ({
    label: truncateLabel(item.name),
    value: item.impactScore,
  }))

  const snackingChartData = impact.snackingCandidates.slice(0, 8).map((item) => ({
    label: truncateLabel(item.name),
    value: item.delta,
    detail: `activity ${item.visibleActivityScore.toFixed(1)}`,
    detailSecondary: `impact ${item.structuralImpactScore.toFixed(1)}`,
  }))

  const conceptCards = impact.conceptMappings.map((mapping) => ({
    concept: mapping.concept,
    dimension: normalizeDimension(mapping.dimension),
    evidenceCount: mapping.evidenceCount,
    examples: mapping.examples,
  }))

  const playbookHrefs = input.playbookHrefs
  const playbookItems: ReportImpactPlaybookItem[] = playbookHrefs
    ? [
        {
          title: "Reduce complexity in hotspot cores",
          body: "Start where large units, duplication, and structural hotspot pressure overlap. Those are usually the fastest durable wins.",
          href: playbookHrefs.hotspots,
          label: "Open Hotspots",
        },
        {
          title: "Stabilize overloaded boundaries",
          body: "Use component and topology evidence together to tighten areas that pull too much coordination inside the repository.",
          href: playbookHrefs.components,
          label: "Open Components",
        },
        {
          title: "Spread knowledge in fragile areas",
          body: "Large components with thin backup coverage raise delivery and offboarding risk. Use people signals before the next major change lands there.",
          href: playbookHrefs.contributors,
          label: "Open Contributors",
        },
        {
          title: "Hold the line after improvement",
          body: "After a structural improvement, turn the insight into a control so the repository does not slide back into the same failure mode.",
          href: playbookHrefs.controls,
          label: "Open Goals & Controls",
        },
      ]
    : []

  const opportunityRows: GridRow[] = impact.topOpportunities.map((item, index) => ({
    id: `opp-${index}`,
    name: item.name,
    href: input.opportunityHrefs?.[index],
    kind: item.kind.charAt(0).toUpperCase() + item.kind.slice(1),
    parent: item.parent || "System-wide",
    impactScore: item.impactScore,
    visibleActivity: 0,
    structuralImpact: 0,
    dominantDimension: normalizeDimension(item.dominantDimension),
    complexityReduction: item.complexityReduction,
    boundaryShaping: item.boundaryShaping,
    knowledgeSpread: item.knowledgeSpread,
    coordinationRelief: item.coordinationRelief,
    changeEnablement: item.changeEnablement,
    suggestedAction: item.suggestedAction,
    reasons: item.reasons.join(" • "),
  }))

  const snackingRows: GridRow[] = impact.snackingCandidates.map((item, index) => ({
    id: `snack-${index}`,
    name: item.name,
    href: input.snackingHrefs?.[index],
    kind: item.kind.charAt(0).toUpperCase() + item.kind.slice(1),
    visibleActivity: item.visibleActivityScore,
    structuralImpact: item.structuralImpactScore,
    delta: item.delta,
    reason: item.reason,
  }))

  return {
    heading: input.reportName,
    subtitle: "Visible activity versus structural impact from the linked Planetnik dataset.",
    cards: [
      { label: "Visible Commits", value: impact.visibleActivity.commits.toLocaleString("en-GB"), detail: null },
      { label: "Changed Files", value: impact.visibleActivity.changedFiles.toLocaleString("en-GB"), detail: null },
      { label: "Contributors", value: impact.visibleActivity.contributors.toLocaleString("en-GB"), detail: null },
      {
        label: "Structural Impact",
        value: impact.structuralImpact.overallScore.toLocaleString("en-GB", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
        detail: normalizeDimension(impact.structuralImpact.dominantDimension),
        accentColor: "var(--chart-green)",
      },
      { label: "Impact Opportunities", value: impact.topOpportunities.length.toLocaleString("en-GB"), detail: null },
      {
        label: "Snacking Candidates",
        value: impact.snackingCandidates.length.toLocaleString("en-GB"),
        detail: null,
        accentColor: "var(--chart-orange)",
      },
    ],
    dimensionChartData,
    topOpportunityData,
    snackingChartData,
    conceptCards,
    playbookItems,
    opportunityRows,
    snackingRows,
  }
}
