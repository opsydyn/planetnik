import type { DatasetAvailability, DatasetDescriptor, DatasetMode } from "@planetnik/common"

export type ExploreAudience = "onboarding" | "architecture-review" | "stakeholder"
export type ExploreView = "overview" | "code-city" | "landing"
export type DatasetReportView = Exclude<ExploreView, "landing"> | "trends"

export function formatExploreMetric(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—"
  if (value < 1_000) return Math.round(value).toLocaleString("en-GB")
  if (value < 1_000_000) return `${trimDecimal(value / 1_000)}k`
  return `${trimDecimal(value / 1_000_000)}m`
}

function trimDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/u, "")
}

export function getDatasetModeLabel(mode: DatasetMode): string {
  return mode === "landscape" ? "Landscape" : "Repository"
}

export function getDatasetStatusLabel(availability: DatasetAvailability): string {
  return availability[0].toUpperCase() + availability.slice(1)
}

export function getDatasetInitials(title: string, id: string): string {
  const source = title.trim() || id.trim()
  const words = source.split(/[^a-z0-9]+/iu).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return (words[0] ?? "??").slice(0, 2).toUpperCase()
}

export function getDatasetSearchText(dataset: DatasetDescriptor): string {
  return [
    dataset.title,
    dataset.description,
    dataset.id,
    dataset.slug,
    dataset.mode.replaceAll("_", " "),
    dataset.provenance.sourceUrl,
    dataset.provenance.sourceRef,
    dataset.provenance.license,
    ...dataset.tags,
    ...dataset.languages.flatMap((language) => [language.key, language.label]),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase()
}

export function getDatasetRecommendedView(dataset: DatasetDescriptor, audience: ExploreAudience): ExploreView {
  const supportsOverview = hasDatasetReportView(dataset, "overview")
  const supportsCodeCity = hasDatasetReportView(dataset, "code-city")

  if (audience === "architecture-review" && supportsCodeCity) {
    return "code-city"
  }
  if (supportsOverview) return "overview"
  return "landing"
}

function hasDatasetReportView(dataset: DatasetDescriptor, view: DatasetReportView): boolean {
  if (dataset.availability !== "ready" && dataset.availability !== "partial") return false
  if (!dataset.snapshot) return false
  if (view === "trends") return dataset.mode === "single_repository"
  if (view === "overview") {
    return (
      dataset.capabilities.includes("overview") ||
      dataset.capabilities.includes("summary") ||
      dataset.capabilities.includes("analysis")
    )
  }
  return (
    dataset.mode === "single_repository" &&
    (dataset.capabilities.includes("code-city") || dataset.capabilities.includes("filesMain"))
  )
}

export function getDatasetViewPath(dataset: DatasetDescriptor, view: DatasetReportView): string | null {
  return hasDatasetReportView(dataset, view) ? `/datasets/${dataset.slug}/${view}` : null
}
