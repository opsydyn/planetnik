import { describe, expect, test } from "bun:test"
import {
  resolveCodeCityMaterialSpec,
  resolveCodeCitySurfaceTreatment,
} from "../materials.js"
import { createCodeCityTextureAtlas } from "../textureAtlas.js"
import type { CodeCityLensId, CodeCityLensVisual } from "../lens.js"
import type { CodeCityMaterialFamily, CodeCityTexturePattern } from "../visualTokens.js"
import * as ReportUi from "../../index.js"

const families: readonly CodeCityMaterialFamily[] = [
  "brick",
  "ironstone",
  "glazed_tile",
  "plaster",
  "paperwood",
  "slate",
]

const patterns: readonly CodeCityTexturePattern[] = ["solid", "banded", "checker", "gridded"]

const lensVisual = (lens: CodeCityLensId, available = true): CodeCityLensVisual => ({
  lens,
  available,
  fill: "#64748b",
  accent: "#cbd5e1",
  label: lens,
  unavailableReason: available ? null : `${lens} unavailable`,
})

const relativeLuminance = (color: string): number => {
  const channels = color
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255) ?? []
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )

  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0)
}

const contrastRatio = (first: string, second: string): number => {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  const light = Math.max(firstLuminance, secondLuminance)
  const dark = Math.min(firstLuminance, secondLuminance)
  return (light + 0.05) / (dark + 0.05)
}

describe("resolveCodeCityMaterialSpec", () => {
  test("keeps every semantic family and pattern stable and visibly distinct", () => {
    for (const family of families) {
      const solid = resolveCodeCityMaterialSpec(family, "solid")

      expect(solid).toEqual(resolveCodeCityMaterialSpec(family, "solid"))
      expect(solid).toMatchObject({
        family,
        pattern: "solid",
        baseColor: expect.stringMatching(/^#[0-9a-f]{6}$/i),
        accentColor: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      })
      expect(solid.roughness).toBeGreaterThanOrEqual(0)
      expect(solid.roughness).toBeLessThanOrEqual(1)
      expect(solid.metalness).toBeGreaterThanOrEqual(0)
      expect(solid.metalness).toBeLessThanOrEqual(1)

      for (const pattern of patterns) {
        const spec = resolveCodeCityMaterialSpec(family, pattern)
        expect(spec.family).toBe(family)
        expect(spec.pattern).toBe(pattern)
        expect(contrastRatio(spec.baseColor, spec.accentColor)).toBeGreaterThan(1.2)
      }
    }
  })

  test("does not let an active lens alter a building material token", () => {
    const before = resolveCodeCityMaterialSpec("ironstone", "gridded")

    for (const lens of [
      "footprint",
      "complexity",
      "health",
      "change_pressure",
      "ownership",
      "impact",
    ] as const) {
      resolveCodeCitySurfaceTreatment(lensVisual(lens))
    }

    expect(resolveCodeCityMaterialSpec("ironstone", "gridded")).toEqual(before)
  })
})

describe("resolveCodeCitySurfaceTreatment", () => {
  test.each([
    ["footprint", "neutral"],
    ["complexity", "wear"],
    ["health", "impact"],
    ["change_pressure", "scaffold"],
    ["ownership", "banner"],
    ["impact", "machinery"],
  ] as const)("maps the %s lens to the %s surface treatment", (lens, treatment) => {
    expect(resolveCodeCitySurfaceTreatment(lensVisual(lens))).toBe(treatment)
  })

  test("keeps unavailable lens data neutral and explicit", () => {
    expect(resolveCodeCitySurfaceTreatment(lensVisual("health", false))).toBe("unavailable")
  })
})

describe("createCodeCityTextureAtlas", () => {
  test("returns null when the browser cannot create a 2d canvas", () => {
    const documentRef = {
      createElement: () => ({
        getContext: () => null,
      }),
    } as unknown as Document

    expect(createCodeCityTextureAtlas(documentRef)).toBeNull()
  })

  test("shares one generated texture per deterministic pattern", () => {
    const context = {
      fillStyle: "",
      fillRect: () => undefined,
    }
    const documentRef = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => context,
      }),
    } as unknown as Document
    const atlas = createCodeCityTextureAtlas(documentRef)

    expect(atlas).not.toBeNull()
    if (atlas === null) return

    expect(atlas.get("checker")).toBe(atlas.get("checker"))
    expect(atlas.get("checker")).not.toBe(atlas.get("banded"))
    expect(atlas.get("checker").colorSpace).toBe("srgb")

    atlas.dispose()
    atlas.dispose()
  })
})

describe("the server-safe Report UI entrypoint", () => {
  test("keeps the browser-only texture factory out of its runtime exports", () => {
    expect(ReportUi.resolveCodeCityMaterialSpec).toBe(resolveCodeCityMaterialSpec)
    expect("createCodeCityTextureAtlas" in ReportUi).toBeFalse()
  })
})
