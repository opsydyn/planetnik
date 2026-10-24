import type { RuntimeReportUnitsView } from "./runtime-client.js"

type ReportUnitsCard = {
  readonly label: string
  readonly value: string
  readonly detail: string | null
}

type ReportUnitsRow = {
  readonly label: string
  readonly value: string
}

type ReportUnitsSection = {
  readonly title: string
  readonly rows: ReadonlyArray<ReportUnitsRow>
}

type ReportUnitsLink = {
  readonly label: string
  readonly href: string
  readonly active: boolean
}

export type ReportUnitsViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly activeView: RuntimeReportUnitsView["view"]
  readonly cards: ReadonlyArray<ReportUnitsCard>
  readonly sections: ReadonlyArray<ReportUnitsSection>
  readonly viewLinks: ReadonlyArray<ReportUnitsLink>
}

const unitViews = [
  { value: "size", label: "Size" },
  { value: "complexity", label: "Complexity" },
] as const

function formatCount(value: number): string {
  return value.toLocaleString("en-GB")
}

export function buildReportUnitsViewModel(input: {
  readonly reportName: string
  readonly slug: string
  readonly routeBase?: string
  readonly units: RuntimeReportUnitsView
}): ReportUnitsViewModel {
  const routeBase = input.routeBase ?? `/reports/${input.slug}/units`
  const viewLinks = unitViews.map((view) => ({
    label: view.label,
    href: `${routeBase}/${view.value}`,
    active: view.value === input.units.view,
  }))

  if (input.units.view === "size") {
    return {
      heading: input.reportName,
      subtitle: "Hosted unit-level summary from the linked Planetnik dataset.",
      activeView: input.units.view,
      cards: [
        {
          label: "Units",
          value: formatCount(input.units.headline.unitCount),
          detail: null,
        },
        {
          label: "Total LOC",
          value: formatCount(input.units.headline.totalLinesOfCode),
          detail: null,
        },
      ],
      sections: [
        {
          title: "Size risk",
          rows: input.units.sizeRisk.map((item) => ({
            label: item.label,
            value: `${formatCount(item.value)} units`,
          })),
        },
        {
          title: "Size distribution",
          rows: input.units.sizeDistribution.map((item) => ({
            label: item.label,
            value: `${formatCount(item.value)} loc · ${item.detail}`,
          })),
        },
        {
          title: "Unit inventory",
          rows: input.units.rows.map((row) => ({
            label: row.shortName,
            value: `${row.relativeFileName} · ${formatCount(row.linesOfCode)} loc · McCabe ${formatCount(row.mcCabeIndex)} · ${formatCount(row.numberOfParameters)} params`,
          })),
        },
      ],
      viewLinks,
    }
  }

  return {
    heading: input.reportName,
    subtitle: "Hosted unit-level summary from the linked Planetnik dataset.",
    activeView: input.units.view,
    cards: [
      {
        label: "Units",
        value: formatCount(input.units.headline.unitCount),
        detail: null,
      },
    ],
    sections: [
      {
        title: "Complexity risk",
        rows: input.units.complexityRisk.map((item) => ({
          label: item.label,
          value: `${formatCount(item.value)} units`,
        })),
      },
      {
        title: "Complexity distribution",
        rows: input.units.complexityDistribution.map((item) => ({
          label: item.label,
          value: `${formatCount(item.value)} units`,
        })),
      },
      {
        title: "Most complex units",
        rows: input.units.rows.map((row) => ({
          label: row.shortName,
          value: `${row.relativeFileName} · McCabe ${formatCount(row.mcCabeIndex)} · ${formatCount(row.linesOfCode)} loc`,
        })),
      },
    ],
    viewLinks,
  }
}
