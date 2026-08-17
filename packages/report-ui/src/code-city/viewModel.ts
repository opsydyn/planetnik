import type {
  CodeCityBuilding,
  CodeCityDistrict,
  CodeCityEvidenceRef,
  CodeCityModel,
  CodeCitySignals,
  CodeCityUnit,
} from "@planetnik/common"
import { resolveCodeCityEvidenceHref } from "./evidence.js"
import type { CodeCityLensId } from "./lens.js"
import { resolveCodeCityLens } from "./lens.js"
import { type CodeCitySelection, resolveCodeCitySelection } from "./selection.js"
import {
  buildCodeCityVisualContext,
  resolveCodeCityBuildingVisual,
  resolveCodeCityDistrictVisual,
  type CodeCityLandmarkTier,
} from "./visualTokens.js"

const UNAVAILABLE = "Unavailable"

export type CodeCityInspectorModel = {
  readonly title: string
  readonly path: string | null
  readonly districtLabel: string | null
  readonly sourceSets: readonly string[]
  readonly metrics: ReadonlyArray<{ readonly label: string; readonly value: string }>
  readonly visualFacts: ReadonlyArray<{ readonly label: string; readonly value: string }>
  readonly evidence: readonly { readonly label: string; readonly href: string }[]
  readonly units: readonly CodeCityInspectorUnitModel[]
}

export type CodeCityInspectorUnitModel = {
  readonly id: string
  readonly label: string
  readonly range: string
  readonly loc: string
  readonly complexity: string
  readonly evidence: readonly { readonly label: string; readonly href: string }[]
}

const formatCount = (count: number, singular: string): string => `${count} ${singular}${count === 1 ? "" : "s"}`

const formatHealth = (signals: CodeCitySignals): string => {
  const { score, severity, dominantDimension } = signals.health
  if (score === null || !Number.isFinite(score)) return UNAVAILABLE
  const details = [severity?.trim(), dominantDimension?.trim()].filter((value): value is string => Boolean(value))
  return details.length > 0 ? `${score} (${details.join("; ")})` : String(score)
}

const formatOwnership = (signals: CodeCitySignals): string =>
  signals.ownership.contributorCount > 0 ? formatCount(signals.ownership.contributorCount, "contributor") : UNAVAILABLE

const formatImpact = (signals: CodeCitySignals): string => {
  const { score, dimension } = signals.impact
  if (score === null || !Number.isFinite(score)) return UNAVAILABLE
  const detail = dimension?.trim()
  return detail ? `${score} (${detail})` : String(score)
}

const formatChange = (signals: CodeCitySignals): string => {
  const values = [
    signals.change.commits === null ? null : formatCount(signals.change.commits, "commit"),
    signals.change.temporalLinks === null ? null : formatCount(signals.change.temporalLinks, "temporal link"),
  ].filter((value): value is string => value !== null)
  return values.length > 0 ? values.join(", ") : UNAVAILABLE
}

const formatComplexity = (signals: CodeCitySignals): string =>
  signals.complexity.maxMcCabe === null || !Number.isFinite(signals.complexity.maxMcCabe)
    ? UNAVAILABLE
    : `McCabe ${signals.complexity.maxMcCabe}`

const formatCoverage = (model: CodeCityModel): string => {
  const missingCount = model.coverage.missingOptionalShards.length
  const diagnosticCount = model.coverage.diagnostics.length
  if (missingCount === 0 && diagnosticCount === 0) return "Complete"

  return [
    missingCount > 0 ? `${formatCount(missingCount, "optional shard")} unavailable` : null,
    diagnosticCount > 0 ? formatCount(diagnosticCount, "diagnostic") : null,
  ]
    .filter((value): value is string => value !== null)
    .join("; ")
}

const metricsFor = (model: CodeCityModel, signals: CodeCitySignals): CodeCityInspectorModel["metrics"] => [
  { label: "LOC", value: String(signals.footprint.loc) },
  { label: "Health", value: formatHealth(signals) },
  { label: "Ownership", value: formatOwnership(signals) },
  { label: "Impact", value: formatImpact(signals) },
  { label: "Change", value: formatChange(signals) },
  { label: "Complexity", value: formatComplexity(signals) },
  { label: "Coverage", value: formatCoverage(model) },
]

const districtForBuilding = (model: CodeCityModel, building: CodeCityBuilding): CodeCityDistrict | undefined =>
  model.districts.find((district) => district.id === building.primaryDistrictId)

const sourceSetsForDistrict = (model: CodeCityModel, district: CodeCityDistrict): string[] => {
  const buildingIds = new Set(district.buildingIds)
  return [
    ...new Set(
      model.buildings.filter((building) => buildingIds.has(building.id)).flatMap((building) => building.sourceSets),
    ),
  ].sort()
}

const evidenceLabel = (kind: string, id: string): string => `${kind.charAt(0).toUpperCase()}${kind.slice(1)}: ${id}`

const titleCase = (value: string): string =>
  value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ")

const landmarkLabel = (tier: CodeCityLandmarkTier): string =>
  tier === "super_hub"
    ? "Super hub"
    : tier === "none"
      ? "None"
      : titleCase(tier)

const visualFactsFor = (
  model: CodeCityModel,
  entity: CodeCityBuilding | CodeCityDistrict,
  lens: CodeCityLensId,
): CodeCityInspectorModel["visualFacts"] => {
  const context = buildCodeCityVisualContext(model)
  const lensVisual = resolveCodeCityLens(entity, lens)
  const lensFact = { label: "Active lens", value: lensVisual.nonColorCue }

  if ("relativePath" in entity) {
    const visual = resolveCodeCityBuildingVisual(entity, context)
    return [
      { label: "Material", value: titleCase(visual.materialFamily) },
      { label: "Archetype", value: titleCase(visual.archetype) },
      { label: "Roof", value: titleCase(visual.roofStyle) },
      { label: "Texture", value: titleCase(visual.texturePattern) },
      lensFact,
    ]
  }

  const visual = resolveCodeCityDistrictVisual(entity, context)
  return [
    { label: "Parcel", value: titleCase(visual.parcelStyle) },
    { label: "Landmark", value: landmarkLabel(visual.landmarkTier) },
    { label: "Texture", value: titleCase(visual.texturePattern) },
    lensFact,
  ]
}

const evidenceLinks = (
  references: readonly CodeCityEvidenceRef[],
  basePath: string,
): Array<{ readonly label: string; readonly href: string }> =>
  references.flatMap((reference) => {
    const href = resolveCodeCityEvidenceHref(basePath, reference.route)
    return href === null ? [] : [{ label: evidenceLabel(reference.kind, reference.id), href }]
  })

const unitsInLayoutOrder = (model: CodeCityModel, buildingId: string): CodeCityUnit[] => {
  const positions = new Map(model.layout.unitOrder.map((id, index) => [id, index]))
  return model.units
    .filter((unit) => unit.fileId === buildingId)
    .sort((left, right) => {
      const leftPosition = positions.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightPosition = positions.get(right.id) ?? Number.MAX_SAFE_INTEGER
      return leftPosition - rightPosition || compareText(left.id, right.id)
    })
}

const inspectorUnit = (unit: CodeCityUnit, basePath: string): CodeCityInspectorUnitModel => ({
  id: unit.id,
  label: unit.longName || unit.shortName || unit.id,
  range: `Lines ${unit.startLine}–${unit.endLine}`,
  loc: String(unit.linesOfCode),
  complexity: `McCabe ${unit.mcCabeIndex}`,
  evidence: evidenceLinks(unit.evidence, basePath),
})

export function buildCodeCityInspectorModel(
  model: CodeCityModel,
  selection: CodeCitySelection,
  basePath: string,
  lens: CodeCityLensId = "health",
): CodeCityInspectorModel | null {
  if (!selection) return null

  const entity =
    selection.kind === "building"
      ? model.buildings.find((building) => building.id === selection.id)
      : model.districts.find((district) => district.id === selection.id)
  if (!entity) return null

  const building = selection.kind === "building" ? (entity as CodeCityBuilding) : null
  const district = building ? districtForBuilding(model, building) : (entity as CodeCityDistrict)
  const selectionResult = resolveCodeCitySelection(model, selection)
  const evidence = evidenceLinks(selectionResult.evidence, basePath)

  return {
    title: building?.relativePath ?? district?.label ?? selection.id,
    path: building?.relativePath ?? district?.pathPrefix ?? null,
    districtLabel: district?.label ?? null,
    sourceSets: building ? building.sourceSets : district ? sourceSetsForDistrict(model, district) : [],
    metrics: metricsFor(model, entity.metrics),
    visualFacts: visualFactsFor(model, entity, lens),
    evidence,
    units: building ? unitsInLayoutOrder(model, building.id).map((unit) => inspectorUnit(unit, basePath)) : [],
  }
}

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)

const buildingsInLayoutOrder = (model: CodeCityModel): CodeCityBuilding[] => {
  const positions = new Map(model.layout.buildingOrder.map((id, index) => [id, index]))
  return [...model.buildings].sort((left, right) => {
    const leftPosition = positions.get(left.id) ?? Number.MAX_SAFE_INTEGER
    const rightPosition = positions.get(right.id) ?? Number.MAX_SAFE_INTEGER
    return leftPosition - rightPosition || compareText(left.id, right.id)
  })
}

const districtsInLayoutOrder = (model: CodeCityModel): CodeCityDistrict[] => {
  const positions = new Map(model.layout.districtOrder.map((id, index) => [id, index]))
  return [...model.districts].sort((left, right) => {
    const leftPosition = positions.get(left.id) ?? Number.MAX_SAFE_INTEGER
    const rightPosition = positions.get(right.id) ?? Number.MAX_SAFE_INTEGER
    return leftPosition - rightPosition || compareText(left.id, right.id)
  })
}

const firstEvidenceHref = (references: readonly CodeCityEvidenceRef[], basePath: string): string | null =>
  references
    .map((reference) => resolveCodeCityEvidenceHref(basePath, reference.route))
    .find((href): href is string => href !== null) ?? null

export type CodeCityFallbackRowModel = {
  readonly kind: "district" | "building"
  readonly id: string
  readonly entity: string
  readonly district: string
  readonly path: string
  readonly loc: string
  readonly health: string
  readonly impact: string
  readonly form: string
  readonly landmark: string
  readonly href: string | null
}

export function buildCodeCityFallbackRows(model: CodeCityModel, basePath: string): readonly CodeCityFallbackRowModel[] {
  const visualContext = buildCodeCityVisualContext(model)
  const districtVisuals = new Map(
    model.districts.map((district) => [district.id, resolveCodeCityDistrictVisual(district, visualContext)]),
  )
  const districtRows = districtsInLayoutOrder(model).map((district): CodeCityFallbackRowModel => {
    const selectionEvidence = resolveCodeCitySelection(model, {
      kind: "district",
      id: district.id,
    }).evidence
    return {
      kind: "district",
      id: district.id,
      entity: district.label,
      district: district.label,
      path: district.pathPrefix ?? (district.kind === "component" ? "Component district" : "Path district"),
      loc: String(district.metrics.footprint.loc),
      health: formatHealth(district.metrics),
      impact: formatImpact(district.metrics),
      form: `${titleCase(districtVisuals.get(district.id)?.parcelStyle ?? "derived")} parcel`,
      landmark: landmarkLabel(districtVisuals.get(district.id)?.landmarkTier ?? "none"),
      href: firstEvidenceHref(district.evidence, basePath) ?? firstEvidenceHref(selectionEvidence, basePath),
    }
  })
  const buildingRows = buildingsInLayoutOrder(model).map((building): CodeCityFallbackRowModel => {
    const visual = resolveCodeCityBuildingVisual(building, visualContext)
    return {
      kind: "building",
      id: building.id,
      entity: building.relativePath,
      district: districtForBuilding(model, building)?.label ?? UNAVAILABLE,
      path: building.relativePath,
      loc: String(building.metrics.footprint.loc),
      health: formatHealth(building.metrics),
      impact: formatImpact(building.metrics),
      form: `${titleCase(visual.archetype)} · ${visual.roofStyle} roof`,
      landmark: landmarkLabel(districtVisuals.get(building.primaryDistrictId)?.landmarkTier ?? "none"),
      href: firstEvidenceHref(building.evidence, basePath),
    }
  })

  return [...districtRows, ...buildingRows]
}
