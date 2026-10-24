import type { GridRow } from "@planetnik/report-ui/tables/ReportDataGrid.types"
import type { RuntimeReportHotspots } from "./runtime-client.js"

type ReportHotspotsCard = {
  readonly label: string
  readonly value: string
  readonly detail: string | null
  readonly accentColor?: string
}

export type ReportHotspotsViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly cards: ReadonlyArray<ReportHotspotsCard>
  readonly severityData: ReadonlyArray<{ readonly label: string; readonly value: number; readonly color?: string }>
  readonly severityColors: ReadonlyArray<string>
  readonly kindData: ReadonlyArray<{ readonly label: string; readonly value: number; readonly detail: string }>
  readonly dominantDimensionData: ReadonlyArray<{
    readonly label: string
    readonly value: number
    readonly detail: string
  }>
  readonly topHotspotData: ReadonlyArray<{ readonly label: string; readonly value: number }>
  readonly hotspotRows: ReadonlyArray<GridRow>
}

const DIMENSION_LABELS: Record<string, string> = {
  structuralRisk: "Structural Risk",
  changePressure: "Change Pressure",
  coordinationCost: "Coordination Cost",
  knowledgeRisk: "Knowledge Risk",
}

function normalizeDimension(value: string): string {
  return DIMENSION_LABELS[value] ?? value.replace(/([a-z])([A-Z])/g, "$1 $2")
}

export function buildReportHotspotsViewModel(input: {
  readonly reportName: string
  readonly hotspots: RuntimeReportHotspots
  readonly hotspotHrefs?: ReadonlyArray<string | undefined>
}): ReportHotspotsViewModel {
  const { hotspots } = input

  const severityData: Array<{ label: string; value: number }> = []
  const severityColors: Array<string> = []
  if (hotspots.severityCounts.critical > 0) {
    severityData.push({ label: "Critical", value: hotspots.severityCounts.critical })
    severityColors.push("#dc2626")
  }
  if (hotspots.severityCounts.high > 0) {
    severityData.push({ label: "High", value: hotspots.severityCounts.high })
    severityColors.push("#ea580c")
  }
  if (hotspots.severityCounts.medium > 0) {
    severityData.push({ label: "Medium", value: hotspots.severityCounts.medium })
    severityColors.push("#d97706")
  }
  if (hotspots.severityCounts.low > 0) {
    severityData.push({ label: "Low", value: hotspots.severityCounts.low })
    severityColors.push("#16a34a")
  }

  const kindData: Array<{ label: string; value: number; detail: string }> = []
  if (hotspots.kindCounts.files > 0)
    kindData.push({ label: "Files", value: hotspots.kindCounts.files, detail: `${hotspots.kindCounts.files} hotspots` })
  if (hotspots.kindCounts.units > 0)
    kindData.push({ label: "Units", value: hotspots.kindCounts.units, detail: `${hotspots.kindCounts.units} hotspots` })
  if (hotspots.kindCounts.components > 0)
    kindData.push({
      label: "Components",
      value: hotspots.kindCounts.components,
      detail: `${hotspots.kindCounts.components} hotspots`,
    })

  const dominantDimensionData: Array<{ label: string; value: number; detail: string }> = []
  for (const [key, label] of [
    ["structuralRisk", "Structural Risk"],
    ["changePressure", "Change Pressure"],
    ["coordinationCost", "Coordination Cost"],
    ["knowledgeRisk", "Knowledge Risk"],
  ] as const) {
    const count = hotspots.dominantCounts[key]
    if (count > 0) dominantDimensionData.push({ label, value: count, detail: `${count} hotspots` })
  }

  const topHotspotData = hotspots.topHotspots.map((item) => ({
    label: item.name.length > 56 ? `...${item.name.slice(-53)}` : item.name,
    value: item.score,
  }))

  const hotspotRows: GridRow[] = hotspots.rows.map((item, index) => ({
    id: `hotspot-${index}`,
    name: item.name,
    href: input.hotspotHrefs?.[index],
    kind: item.kind.charAt(0).toUpperCase() + item.kind.slice(1),
    parent: item.parent || "—",
    score: item.score,
    severity: item.severity,
    dominantDimension: normalizeDimension(item.dominantDimension),
    size: item.size,
    commits: item.commitsCount,
    contributors: item.contributorsCount,
    temporalLinks: item.temporalLinks,
    complexity: item.complexity,
    structuralRisk: item.structuralRisk,
    changePressure: item.changePressure,
    coordinationCost: item.coordinationCost,
    knowledgeRisk: item.knowledgeRisk,
    suggestedAction: item.suggestedAction,
    reasons: item.reasons.join(" • "),
  }))

  return {
    heading: input.reportName,
    subtitle: "Ranked structural hotspots from the linked Planetnik dataset.",
    cards: [
      { label: "Hotspots", value: hotspots.totalHotspots.toLocaleString("en-GB"), detail: null },
      {
        label: "Critical",
        value: hotspots.severityCounts.critical.toLocaleString("en-GB"),
        detail: null,
        accentColor: "#dc2626",
      },
      {
        label: "High",
        value: hotspots.severityCounts.high.toLocaleString("en-GB"),
        detail: null,
        accentColor: "#ea580c",
      },
      { label: "Knowledge-Led", value: hotspots.dominantCounts.knowledgeRisk.toLocaleString("en-GB"), detail: null },
      {
        label: "Coordination-Led",
        value: hotspots.dominantCounts.coordinationCost.toLocaleString("en-GB"),
        detail: null,
      },
    ],
    severityData,
    severityColors,
    kindData,
    dominantDimensionData,
    topHotspotData,
    hotspotRows,
  }
}
