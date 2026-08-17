import type { CodeCityModel } from "@planetnik/common"

export type CodeCityAudienceId = "onboarding" | "architecture-review" | "stakeholder"

export type CodeCityAudienceMetricId =
  | "footprint"
  | "health"
  | "ownership"
  | "impact"
  | "change"
  | "complexity"
  | "coverage"

export type CodeCityAudiencePresentation = {
  readonly audience: CodeCityAudienceId
  readonly label: string
  readonly openingQuestion: string
  readonly orientation: string
  readonly firstAction: string
  readonly labelDensity: "generous" | "balanced" | "calm"
  readonly routeEmphasis: "quiet" | "selection" | "consequential"
  readonly inspectorMetricOrder: readonly CodeCityAudienceMetricId[]
  readonly coverageNote: string
}

const COMPLETE_COVERAGE_NOTE = "All available signals are represented."

const AUDIENCE_PRESENTATIONS = {
  onboarding: {
    label: "Onboarding",
    openingQuestion: "How is this repository organised?",
    orientation: "Districts are bounded contexts; buildings are canonical files.",
    firstAction: "Select a district",
    labelDensity: "generous",
    routeEmphasis: "quiet",
    inspectorMetricOrder: [
      "footprint",
      "ownership",
      "health",
      "impact",
      "change",
      "complexity",
      "coverage",
    ],
  },
  "architecture-review": {
    label: "Architecture Review",
    openingQuestion: "Where are the boundaries and pressures?",
    orientation: "Parcels show contexts; routes show resolved component relationships.",
    firstAction: "Inspect a hub or boundary crossing",
    labelDensity: "balanced",
    routeEmphasis: "selection",
    inspectorMetricOrder: [
      "impact",
      "health",
      "ownership",
      "change",
      "complexity",
      "footprint",
      "coverage",
    ],
  },
  stakeholder: {
    label: "Stakeholder",
    openingQuestion: "What deserves attention?",
    orientation: "The skyline summarises structure, pressure, and delivery impact.",
    firstAction: "Open the top concern",
    labelDensity: "calm",
    routeEmphasis: "consequential",
    inspectorMetricOrder: [
      "impact",
      "health",
      "change",
      "ownership",
      "footprint",
      "complexity",
      "coverage",
    ],
  },
} as const

export function resolveCodeCityAudience(value: string | null | undefined): CodeCityAudienceId {
  if (value === "architecture-review" || value === "stakeholder") return value
  return "onboarding"
}

export function getCodeCityAudiencePresentation(audience: CodeCityAudienceId): CodeCityAudiencePresentation {
  const presentation = AUDIENCE_PRESENTATIONS[audience]
  return {
    audience,
    ...presentation,
    inspectorMetricOrder: [...presentation.inspectorMetricOrder],
    coverageNote: COMPLETE_COVERAGE_NOTE,
  }
}

const coverageNoteFor = (model: CodeCityModel): string => {
  const missing = [...model.coverage.missingOptionalShards].sort()
  if (missing.length === 0) return COMPLETE_COVERAGE_NOTE
  return `Signals unavailable: ${missing.join(", ")}.`
}

export function buildCodeCityAudiencePresentation(
  model: CodeCityModel,
  audience: CodeCityAudienceId,
): CodeCityAudiencePresentation {
  return {
    ...getCodeCityAudiencePresentation(audience),
    coverageNote: coverageNoteFor(model),
  }
}
