import type { RuntimeDataset, RuntimeReport } from "./runtime-client.js"

export type DashboardDatasetLink =
  | {
      readonly kind: "existing-report"
      readonly dataset: RuntimeDataset
      readonly label: string
      readonly href: string
    }
  | {
      readonly kind: "create-report"
      readonly dataset: RuntimeDataset
      readonly label: string
      readonly datasetName: string
    }

function normalizePath(value: string | null): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  return trimmed.replace(/\/+$/, "")
}

export function buildDashboardDatasetLinks(
  datasets: ReadonlyArray<RuntimeDataset>,
  reports: ReadonlyArray<RuntimeReport>,
): ReadonlyArray<DashboardDatasetLink> {
  return datasets.map((dataset) => {
    const datasetRoot = normalizePath(dataset.dataDir)
    const existingReport = reports.find((report) => {
      const reportRoot = normalizePath(report.analysisRoot)
      return reportRoot !== null && reportRoot === datasetRoot
    })

    if (existingReport) {
      return {
        kind: "existing-report",
        dataset,
        label: dataset.title,
        href: `/reports/${existingReport.slug}/overview`,
      } satisfies DashboardDatasetLink
    }

    return {
      kind: "create-report",
      dataset,
      label: dataset.title,
      datasetName: dataset.name,
    } satisfies DashboardDatasetLink
  })
}
