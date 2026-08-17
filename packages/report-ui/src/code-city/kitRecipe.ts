import type { CodeCitySurfaceTreatment } from "./materials.js"
import type { CodeCitySceneNode } from "./sceneTypes.js"
import type { CodeCityLandmarkTier, CodeCityRoofStyle } from "./visualTokens.js"

export type CodeCityDetailLevel = "overview" | "district" | "building" | "dense"

export type CodeCityKitPrimitive =
  | { readonly kind: "base"; readonly width: number; readonly depth: number; readonly height: number }
  | { readonly kind: "roof"; readonly style: CodeCityRoofStyle }
  | { readonly kind: "floor_band"; readonly index: number }
  | { readonly kind: "window_row"; readonly index: number; readonly segments: number }
  | { readonly kind: "cupola"; readonly tier: "connected" }
  | { readonly kind: "dome"; readonly tier: CodeCityLandmarkTier }
  | { readonly kind: "tower"; readonly tier: CodeCityLandmarkTier }
  | { readonly kind: "bridge"; readonly direction: "north" | "east" | "south" | "west" }
  | { readonly kind: "buttress"; readonly side: "north" | "east" | "south" | "west" }
  | { readonly kind: "beacon"; readonly treatment: CodeCitySurfaceTreatment }

export type CodeCityKitRecipe = {
  readonly nodeId: string
  readonly detail: CodeCityDetailLevel
  readonly primitives: readonly CodeCityKitPrimitive[]
}

const CARDINAL_SIDES = ["north", "east", "south", "west"] as const

const isSelectedDistrict = (node: CodeCitySceneNode, selectedDistrictIds: readonly string[]): boolean =>
  selectedDistrictIds.includes(node.id) ||
  selectedDistrictIds.includes(node.districtKey) ||
  (node.parentId !== null && selectedDistrictIds.includes(node.parentId))

export function resolveCodeCityDetailLevel(
  node: CodeCitySceneNode,
  selectedId: string | null,
  selectedDistrictIds: readonly string[],
  denseDataMode: boolean,
): CodeCityDetailLevel {
  if (denseDataMode) return "dense"
  if (node.kind === "building" && node.id === selectedId) return "building"
  if (node.id === selectedId || isSelectedDistrict(node, selectedDistrictIds)) return "district"
  return "overview"
}

const landmarkPrimitives = (
  tier: CodeCityLandmarkTier,
  detail: CodeCityDetailLevel,
): readonly CodeCityKitPrimitive[] => {
  if (tier === "none" || (detail === "dense" && tier === "connected")) return []
  if (tier === "connected") return [{ kind: "cupola", tier }]
  return [
    { kind: "dome", tier },
    { kind: "tower", tier },
  ]
}

export function buildCodeCityKitRecipe(
  node: CodeCitySceneNode,
  detail: CodeCityDetailLevel,
  surfaceTreatment: CodeCitySurfaceTreatment,
): CodeCityKitRecipe {
  const primitives: CodeCityKitPrimitive[] = [
    {
      kind: "base",
      width: node.size.width,
      depth: node.size.depth,
      height: node.size.height,
    },
    {
      kind: "roof",
      style: node.visual.kind === "building" ? node.visual.roofStyle : "flat",
    },
  ]

  if (node.visual.kind === "building" && (detail === "district" || detail === "building")) {
    for (let index = 1; index <= node.visual.floorCount; index += 1) {
      primitives.push({ kind: "floor_band", index })
    }
    for (let index = 1; index <= node.visual.floorCount; index += 1) {
      primitives.push({ kind: "window_row", index, segments: node.visual.facadeSegments })
    }
  }

  if (node.visual.kind === "district") {
    primitives.push(...landmarkPrimitives(node.visual.landmarkTier, detail))
  }

  if (node.visual.kind === "building" && detail === "building") {
    for (const side of CARDINAL_SIDES) primitives.push({ kind: "buttress", side })
    primitives.push({ kind: "beacon", treatment: surfaceTreatment })
  }

  return { nodeId: node.id, detail, primitives }
}
