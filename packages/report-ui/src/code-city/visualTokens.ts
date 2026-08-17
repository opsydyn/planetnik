import type { CodeCityBuilding, CodeCityDistrict, CodeCityModel } from "@planetnik/common"

export type CodeCityMaterialFamily = "brick" | "ironstone" | "glazed_tile" | "plaster" | "paperwood" | "slate"

export type CodeCityParcelStyle = "civic" | "derived"
export type CodeCityBuildingArchetype = "block" | "tower" | "stepped" | "annex"
export type CodeCityRoofStyle = "flat" | "pitched" | "stepped" | "capped"
export type CodeCityLandmarkTier = "none" | "connected" | "hub" | "super_hub"
export type CodeCityTexturePattern = "solid" | "banded" | "checker" | "gridded"

export type CodeCityVisualContext = {
  readonly districtIncidentWeights: ReadonlyMap<string, number>
  readonly districtRanks: ReadonlyMap<string, number>
  readonly locHighCutoff: number
  readonly unitHighCutoff: number
}

export type CodeCityDistrictVisual = {
  readonly kind: "district"
  readonly parcelStyle: CodeCityParcelStyle
  readonly landmarkTier: CodeCityLandmarkTier
  readonly texturePattern: CodeCityTexturePattern
}

export type CodeCityBuildingVisual = {
  readonly kind: "building"
  readonly materialFamily: CodeCityMaterialFamily
  readonly archetype: CodeCityBuildingArchetype
  readonly roofStyle: CodeCityRoofStyle
  readonly texturePattern: CodeCityTexturePattern
  readonly floorCount: number
  readonly facadeSegments: number
  readonly multiDistrict: boolean
}

export type CodeCitySceneNodeVisual = CodeCityDistrictVisual | CodeCityBuildingVisual

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value))

const MINIMUM_PERCENTILE_COHORT = 3

const percentile75 = (values: readonly number[]): number => {
  // Zero is the canonical absence value for these aggregate metrics. A high
  // bucket is meaningful only once at least three positive measurements exist.
  const measured = values.filter((value) => value > 0)
  if (measured.length < MINIMUM_PERCENTILE_COHORT) return 0
  const sorted = measured.sort((left, right) => left - right)
  return sorted[Math.floor((sorted.length - 1) * 0.75)] ?? 0
}

const normaliseNonNegative = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0)

const extensionFamily = new Map<string, CodeCityMaterialFamily>([
  ["ts", "brick"],
  ["tsx", "brick"],
  ["js", "brick"],
  ["jsx", "brick"],
  ["rs", "ironstone"],
  ["json", "glazed_tile"],
  ["yaml", "glazed_tile"],
  ["yml", "glazed_tile"],
  ["toml", "glazed_tile"],
  ["css", "plaster"],
  ["scss", "plaster"],
  ["html", "plaster"],
  ["md", "paperwood"],
  ["mdx", "paperwood"],
  ["txt", "paperwood"],
])

export function resolveCodeCityMaterialFamily(extension: string): CodeCityMaterialFamily {
  return extensionFamily.get(extension.trim().toLowerCase().replace(/^\./, "")) ?? "slate"
}

export function buildCodeCityVisualContext(model: CodeCityModel): CodeCityVisualContext {
  const districtIds = new Set(model.districts.map((district) => district.id))
  const districtIncidentWeights = new Map([...districtIds].sort(compareText).map((districtId) => [districtId, 0]))

  for (const edge of model.edges) {
    const sourceId = edge.sourceDistrictId
    const targetId = edge.targetDistrictId
    const weight = normaliseNonNegative(edge.count)
    if (
      weight <= 0 ||
      sourceId === null ||
      targetId === null ||
      !districtIds.has(sourceId) ||
      !districtIds.has(targetId)
    ) {
      continue
    }

    districtIncidentWeights.set(sourceId, (districtIncidentWeights.get(sourceId) ?? 0) + weight)
    if (targetId !== sourceId) {
      districtIncidentWeights.set(targetId, (districtIncidentWeights.get(targetId) ?? 0) + weight)
    }
  }

  const districtRanks = new Map(
    [...districtIncidentWeights.entries()]
      .filter(([, weight]) => weight > 0)
      .sort(([leftId, leftWeight], [rightId, rightWeight]) => rightWeight - leftWeight || compareText(leftId, rightId))
      .map(([districtId], index) => [districtId, index]),
  )

  return {
    districtIncidentWeights,
    districtRanks,
    locHighCutoff: percentile75(
      model.buildings.map((building) => normaliseNonNegative(building.metrics.footprint.loc)),
    ),
    unitHighCutoff: percentile75(
      model.buildings.map((building) => normaliseNonNegative(building.metrics.complexity.unitCount)),
    ),
  }
}

export function resolveCodeCityDistrictVisual(
  district: CodeCityDistrict,
  context: CodeCityVisualContext,
): CodeCityDistrictVisual {
  const weight = context.districtIncidentWeights.get(district.id) ?? 0
  const rank = context.districtRanks.get(district.id)
  const landmarkTier: CodeCityLandmarkTier =
    weight <= 0 || rank === undefined ? "none" : rank === 0 ? "super_hub" : rank < 5 ? "hub" : "connected"
  const civic = district.kind === "component"

  return {
    kind: "district",
    parcelStyle: civic ? "civic" : "derived",
    landmarkTier,
    texturePattern: civic ? "gridded" : "solid",
  }
}

export function resolveCodeCityBuildingVisual(
  building: CodeCityBuilding,
  context: CodeCityVisualContext,
): CodeCityBuildingVisual {
  const loc = normaliseNonNegative(building.metrics.footprint.loc)
  const unitCount = normaliseNonNegative(building.metrics.complexity.unitCount)
  const testFile = building.sourceSets.includes("test")
  const archetype: CodeCityBuildingArchetype =
    loc > 0 && context.locHighCutoff > 0 && loc >= context.locHighCutoff
      ? "tower"
      : unitCount > 0 && context.unitHighCutoff > 0 && unitCount >= context.unitHighCutoff
        ? "stepped"
        : testFile
          ? "annex"
          : "block"

  return {
    kind: "building",
    materialFamily: resolveCodeCityMaterialFamily(building.extension),
    archetype,
    roofStyle:
      archetype === "tower"
        ? "capped"
        : archetype === "stepped"
          ? "stepped"
          : archetype === "annex"
            ? "pitched"
            : "flat",
    texturePattern: testFile ? "checker" : unitCount > 0 ? "banded" : "solid",
    floorCount: clamp(Math.ceil(Math.log2(loc + 1) / 2), 1, 6),
    facadeSegments: clamp(Math.ceil(Math.sqrt(unitCount)), 1, 4),
    multiDistrict: building.districtIds.length > 1,
  }
}
