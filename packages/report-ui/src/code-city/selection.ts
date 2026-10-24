import type { CodeCityEvidenceRef, CodeCityModel } from "@planetnik/common"

export type CodeCitySelection = { readonly kind: "district" | "building"; readonly id: string } | null

export type CodeCitySelectionResult = {
  readonly selection: CodeCitySelection
  readonly districtIds: readonly string[]
  readonly incidentEdgeIds: readonly string[]
  readonly evidence: readonly CodeCityEvidenceRef[]
}

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)

const evidenceKey = (evidence: CodeCityEvidenceRef): string => `${evidence.kind}:${evidence.id}:${evidence.route ?? ""}`

const emptyResult = (selection: CodeCitySelection): CodeCitySelectionResult => ({
  selection,
  districtIds: [],
  incidentEdgeIds: [],
  evidence: [],
})

export function resolveCodeCitySelection(model: CodeCityModel, selection: CodeCitySelection): CodeCitySelectionResult {
  if (!selection) return emptyResult(null)

  const selected =
    selection.kind === "district"
      ? model.districts.find((district) => district.id === selection.id)
      : model.buildings.find((building) => building.id === selection.id)
  if (!selected) return emptyResult(selection)

  const districtIds =
    selection.kind === "district"
      ? [selection.id]
      : [...model.buildings.find((building) => building.id === selection.id)!.districtIds]
  const selectedDistrictIds = new Set(districtIds)
  const incidentEdges = model.edges
    .filter(
      (edge) =>
        (edge.sourceDistrictId !== null && selectedDistrictIds.has(edge.sourceDistrictId)) ||
        (edge.targetDistrictId !== null && selectedDistrictIds.has(edge.targetDistrictId)),
    )
    .sort((left, right) => compareText(left.id, right.id))

  return {
    selection,
    districtIds,
    incidentEdgeIds: incidentEdges.map((edge) => edge.id),
    evidence: [...selected.evidence, ...incidentEdges.flatMap((edge) => edge.evidence)].sort((left, right) =>
      compareText(evidenceKey(left), evidenceKey(right)),
    ),
  }
}
