import type { DistributionItem } from "@planetnik/report-ui/charts/DistributionChart"
import type { GridRow } from "@planetnik/report-ui/tables/ReportDataGrid.types"
import type { RuntimeReportControls } from "./runtime-client.js"

type ReportControlsCard = {
  readonly label: string
  readonly value: string
  readonly detail: string | null
  readonly color?: string
}

export type ReportControlsViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly cards: ReadonlyArray<ReportControlsCard>
  readonly statusChartData: ReadonlyArray<{ readonly label: string; readonly value: number }>
  readonly statusChartColors: ReadonlyArray<string>
  readonly goalRows: ReadonlyArray<DistributionItem>
  readonly controlRows: ReadonlyArray<GridRow>
}

const STATUS_ORDER = new Map([
  ["FAILED", 0],
  ["TOLERANT", 1],
  ["OK", 2],
])

export function buildReportControlsViewModel(input: {
  readonly reportName: string
  readonly controls: RuntimeReportControls
}): ReportControlsViewModel {
  const { controls } = input

  const statusChartData: Array<{ label: string; value: number }> = []
  const statusChartColors: Array<string> = []
  if (controls.statusCounts.failed > 0) {
    statusChartData.push({ label: "Failed", value: controls.statusCounts.failed })
    statusChartColors.push("#ef4444")
  }
  if (controls.statusCounts.tolerant > 0) {
    statusChartData.push({ label: "Tolerant", value: controls.statusCounts.tolerant })
    statusChartColors.push("#f59e0b")
  }
  if (controls.statusCounts.ok > 0) {
    statusChartData.push({ label: "OK", value: controls.statusCounts.ok })
    statusChartColors.push("#22c55e")
  }
  if (controls.statusCounts.ignored > 0) {
    statusChartData.push({ label: "Ignored", value: controls.statusCounts.ignored })
    statusChartColors.push("#94a3b8")
  }

  const goalRows: DistributionItem[] = [...controls.goals]
    .sort((a, b) => {
      if (b.failed !== a.failed) return b.failed - a.failed
      if (b.tolerant !== a.tolerant) return b.tolerant - a.tolerant
      return b.total - a.total
    })
    .map((goal) => ({
      label: goal.goal,
      value: goal.total,
      detail: `${goal.failed} failed`,
      detailSecondary: `${goal.tolerant} tolerant`,
      color: goal.failed > 0 ? "#ef4444" : goal.tolerant > 0 ? "#f59e0b" : "#22c55e",
    }))

  const controlRows: GridRow[] = [...controls.controls]
    .sort((a, b) => {
      const rankA = STATUS_ORDER.get(a.status) ?? 99
      const rankB = STATUS_ORDER.get(b.status) ?? 99
      if (rankA !== rankB) return rankA - rankB
      return a.metricId.localeCompare(b.metricId)
    })
    .map((control) => ({
      id: control.id,
      goal: control.goal,
      metric: control.metricId,
      value: control.metricValue === null ? null : control.metricValue,
      desiredRange: control.desiredRangeText,
      status: control.status,
      description: control.description,
    }))

  return {
    heading: input.reportName,
    subtitle: "Goals, controls, and quality gate status from the linked Planetnik dataset.",
    cards: [
      { label: "Controls", value: controls.totalControls.toLocaleString("en-GB"), detail: null },
      { label: "Failed", value: controls.statusCounts.failed.toLocaleString("en-GB"), detail: null, color: "#dc2626" },
      {
        label: "Tolerant",
        value: controls.statusCounts.tolerant.toLocaleString("en-GB"),
        detail: null,
        color: "#d97706",
      },
      { label: "OK", value: controls.statusCounts.ok.toLocaleString("en-GB"), detail: null, color: "#16a34a" },
    ],
    statusChartData,
    statusChartColors,
    goalRows,
    controlRows,
  }
}
