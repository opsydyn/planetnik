import type { CodeCityLensVisual } from "./lens.js"
import type { CodeCityMaterialFamily, CodeCityTexturePattern } from "./visualTokens.js"

export type CodeCitySurfaceTreatment =
  | "neutral"
  | "wear"
  | "impact"
  | "scaffold"
  | "banner"
  | "machinery"
  | "unavailable"

export type CodeCityMaterialSpec = {
  readonly family: CodeCityMaterialFamily
  readonly pattern: CodeCityTexturePattern
  readonly baseColor: string
  readonly accentColor: string
  readonly roughness: number
  readonly metalness: number
}

type MaterialPalette = Omit<CodeCityMaterialSpec, "family" | "pattern">

const MATERIAL_PALETTES: Readonly<Record<CodeCityMaterialFamily, MaterialPalette>> = {
  brick: {
    baseColor: "#8f2d1d",
    accentColor: "#ffd2c7",
    roughness: 0.86,
    metalness: 0.02,
  },
  ironstone: {
    baseColor: "#3a4a5b",
    accentColor: "#d1e3f5",
    roughness: 0.62,
    metalness: 0.28,
  },
  glazed_tile: {
    baseColor: "#0d6b6d",
    accentColor: "#d4ffff",
    roughness: 0.38,
    metalness: 0.18,
  },
  plaster: {
    baseColor: "#b8aa98",
    accentColor: "#2d241b",
    roughness: 0.92,
    metalness: 0,
  },
  paperwood: {
    baseColor: "#785023",
    accentColor: "#ffe4b3",
    roughness: 0.8,
    metalness: 0.04,
  },
  slate: {
    baseColor: "#3d5169",
    accentColor: "#deecff",
    roughness: 0.7,
    metalness: 0.15,
  },
}

export function resolveCodeCityMaterialSpec(
  family: CodeCityMaterialFamily,
  pattern: CodeCityTexturePattern,
): CodeCityMaterialSpec {
  return {
    family,
    pattern,
    ...MATERIAL_PALETTES[family],
  }
}

export function resolveCodeCitySurfaceTreatment(lens: CodeCityLensVisual): CodeCitySurfaceTreatment {
  if (!lens.available) return "unavailable"

  switch (lens.lens) {
    case "footprint":
      return "neutral"
    case "complexity":
      return "wear"
    case "health":
      return "impact"
    case "change_pressure":
      return "scaffold"
    case "ownership":
      return "banner"
    case "impact":
      return "machinery"
  }
}
