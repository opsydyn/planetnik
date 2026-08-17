import { describe, expect, test } from "bun:test"
import { buildCodeCityKitRecipe, resolveCodeCityDetailLevel } from "../../index.js"
import type { CodeCitySceneNode } from "../sceneTypes.js"
import type { CodeCityBuildingArchetype, CodeCityLandmarkTier } from "../visualTokens.js"

const district = (tier: CodeCityLandmarkTier = "none"): CodeCitySceneNode => ({
  id: "district:core",
  kind: "district",
  label: "Core",
  parentId: null,
  center: { x: 12, z: -8 },
  size: { width: 20, depth: 16, height: 3 },
  districtKey: "district:core",
  visual: {
    kind: "district",
    parcelStyle: "civic",
    landmarkTier: tier,
    texturePattern: "gridded",
  },
})

const building = (archetype: CodeCityBuildingArchetype = "block"): CodeCitySceneNode => ({
  id: "file:core",
  kind: "building",
  label: "core.ts",
  parentId: "district:core",
  center: { x: 4, z: 6 },
  size: { width: 8, depth: 6, height: 12 },
  districtKey: "district:core",
  visual: {
    kind: "building",
    materialFamily: "brick",
    archetype,
    roofStyle:
      archetype === "tower"
        ? "capped"
        : archetype === "stepped"
          ? "stepped"
          : archetype === "annex"
            ? "pitched"
            : "flat",
    texturePattern: "banded",
    floorCount: 3,
    facadeSegments: 2,
    multiDistrict: false,
  },
})

describe("resolveCodeCityDetailLevel", () => {
  test("keeps the stable city at overview unless a selection asks for detail", () => {
    expect(resolveCodeCityDetailLevel(building(), null, [], false)).toBe("overview")
    expect(resolveCodeCityDetailLevel(building(), null, ["district:core"], false)).toBe("district")
    expect(resolveCodeCityDetailLevel(building(), "file:core", ["district:core"], false)).toBe("building")
    expect(resolveCodeCityDetailLevel(district(), "district:core", ["district:core"], false)).toBe("district")
  })

  test("uses dense detail as an explicit, selection-independent safety mode", () => {
    expect(resolveCodeCityDetailLevel(building(), "file:core", ["district:core"], true)).toBe("dense")
  })
})

describe("buildCodeCityKitRecipe", () => {
  test.each([
    ["block", "flat"],
    ["tower", "capped"],
    ["stepped", "stepped"],
    ["annex", "pitched"],
  ] as const)("maps the %s archetype to its %s roof without changing the footprint", (archetype, roofStyle) => {
    const node = building(archetype)
    const recipe = buildCodeCityKitRecipe(node, "overview", "neutral")

    expect(recipe).toEqual({
      nodeId: node.id,
      detail: "overview",
      primitives: [
        { kind: "base", width: node.size.width, depth: node.size.depth, height: node.size.height },
        { kind: "roof", style: roofStyle },
      ],
    })
    expect(node.center).toEqual({ x: 4, z: 6 })
    expect(node.size).toEqual({ width: 8, depth: 6, height: 12 })
  })

  test("adds bands and windows for a selected district building in stable order", () => {
    expect(buildCodeCityKitRecipe(building(), "district", "neutral").primitives).toEqual([
      { kind: "base", width: 8, depth: 6, height: 12 },
      { kind: "roof", style: "flat" },
      { kind: "floor_band", index: 1 },
      { kind: "floor_band", index: 2 },
      { kind: "floor_band", index: 3 },
      { kind: "window_row", index: 1, segments: 2 },
      { kind: "window_row", index: 2, segments: 2 },
      { kind: "window_row", index: 3, segments: 2 },
    ])
  })

  test("adds building-only supports and an explicit unavailable beacon after visual detail", () => {
    expect(buildCodeCityKitRecipe(building("stepped"), "building", "unavailable").primitives).toEqual([
      { kind: "base", width: 8, depth: 6, height: 12 },
      { kind: "roof", style: "stepped" },
      { kind: "floor_band", index: 1 },
      { kind: "floor_band", index: 2 },
      { kind: "floor_band", index: 3 },
      { kind: "window_row", index: 1, segments: 2 },
      { kind: "window_row", index: 2, segments: 2 },
      { kind: "window_row", index: 3, segments: 2 },
      { kind: "buttress", side: "north" },
      { kind: "buttress", side: "east" },
      { kind: "buttress", side: "south" },
      { kind: "buttress", side: "west" },
      { kind: "beacon", treatment: "unavailable" },
    ])
  })

  test.each([
    ["none", []],
    ["connected", [{ kind: "cupola", tier: "connected" }]],
    [
      "hub",
      [
        { kind: "dome", tier: "hub" },
        { kind: "tower", tier: "hub" },
      ],
    ],
    [
      "super_hub",
      [
        { kind: "dome", tier: "super_hub" },
        { kind: "tower", tier: "super_hub" },
      ],
    ],
  ] as const)("uses the %s landmark tier only as an authored district feature", (tier, landmarkPrimitives) => {
    expect(buildCodeCityKitRecipe(district(tier), "overview", "neutral").primitives).toEqual([
      { kind: "base", width: 20, depth: 16, height: 3 },
      { kind: "roof", style: "flat" },
      ...landmarkPrimitives,
    ])
  })

  test("keeps only major district landmarks in dense mode", () => {
    expect(buildCodeCityKitRecipe(district("connected"), "dense", "neutral").primitives).toEqual([
      { kind: "base", width: 20, depth: 16, height: 3 },
      { kind: "roof", style: "flat" },
    ])
    expect(buildCodeCityKitRecipe(district("hub"), "dense", "neutral").primitives).toEqual([
      { kind: "base", width: 20, depth: 16, height: 3 },
      { kind: "roof", style: "flat" },
      { kind: "dome", tier: "hub" },
      { kind: "tower", tier: "hub" },
    ])
  })

  test("remains serialisable and never fabricates route bridges", () => {
    const recipe = buildCodeCityKitRecipe(building("annex"), "building", "impact")

    expect(JSON.parse(JSON.stringify(recipe))).toEqual(recipe)
    expect(recipe.primitives.some((primitive) => primitive.kind === "bridge")).toBeFalse()
  })

  test("emits only route bridge directions supplied by the existing scene", () => {
    expect(buildCodeCityKitRecipe(district("hub"), "overview", "neutral", ["east", "south"]).primitives).toEqual([
      { kind: "base", width: 20, depth: 16, height: 3 },
      { kind: "roof", style: "flat" },
      { kind: "dome", tier: "hub" },
      { kind: "tower", tier: "hub" },
      { kind: "bridge", direction: "east" },
      { kind: "bridge", direction: "south" },
    ])
  })
})
