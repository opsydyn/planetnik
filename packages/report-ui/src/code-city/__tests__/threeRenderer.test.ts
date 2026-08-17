import { describe, expect, test } from "bun:test"
import { InstancedMesh, Scene as ThreeScene } from "three"
import type { CodeCityLensVisual } from "../lens.js"
import type { CodeCityScene } from "../sceneTypes.js"
import type { CodeCitySelectionResult } from "../selection.js"
import { createCodeCityKitRenderer } from "../threeKit.js"
import {
  CODE_CITY_CAMERA_CONFIG,
  canCreateWebGLRenderer,
  resolveCodeCityHighlightedRouteIds,
  resolveCodeCityRouteSelectionId,
  resolveCodeCityVisibleLabelIds,
} from "../threeRenderer.js"

const districtVisual = {
  kind: "district" as const,
  parcelStyle: "civic" as const,
  landmarkTier: "none" as const,
  texturePattern: "gridded" as const,
}

const buildingVisual = {
  kind: "building" as const,
  materialFamily: "brick" as const,
  archetype: "block" as const,
  roofStyle: "flat" as const,
  texturePattern: "solid" as const,
  floorCount: 1,
  facadeSegments: 1,
  multiDistrict: false,
}

const multiDistrictScene = (): CodeCityScene => ({
  contractVersion: 1,
  nodes: [
    {
      id: "district:core",
      kind: "district",
      label: "Core",
      parentId: null,
      center: { x: 0, z: 0 },
      size: { width: 8, depth: 8, height: 0.5 },
      districtKey: "district:core",
      visual: districtVisual,
    },
    {
      id: "district:web",
      kind: "district",
      label: "Web",
      parentId: null,
      center: { x: 12, z: 0 },
      size: { width: 8, depth: 8, height: 0.5 },
      districtKey: "district:web",
      visual: districtVisual,
    },
    {
      id: "district:other",
      kind: "district",
      label: "Other",
      parentId: null,
      center: { x: 24, z: 0 },
      size: { width: 8, depth: 8, height: 0.5 },
      districtKey: "district:other",
      visual: districtVisual,
    },
    {
      id: "file:shared",
      kind: "building",
      label: "src/shared.ts",
      parentId: "district:core",
      center: { x: 0, z: 0 },
      size: { width: 2, depth: 2, height: 4 },
      districtKey: "district:core",
      visual: { ...buildingVisual, multiDistrict: true },
    },
    {
      id: "file:web",
      kind: "building",
      label: "src/web.ts",
      parentId: "district:web",
      center: { x: 12, z: 0 },
      size: { width: 2, depth: 2, height: 3 },
      districtKey: "district:web",
      visual: buildingVisual,
    },
    {
      id: "file:other",
      kind: "building",
      label: "src/other.ts",
      parentId: "district:other",
      center: { x: 24, z: 0 },
      size: { width: 2, depth: 2, height: 2 },
      districtKey: "district:other",
      visual: buildingVisual,
    },
  ],
  edges: [
    {
      id: "edge:core-web",
      sourceId: "district:core",
      targetId: "district:web",
      renderable: true,
      points: [],
      weight: 1,
    },
    {
      id: "edge:web-other",
      sourceId: "district:web",
      targetId: "district:other",
      renderable: true,
      points: [],
      weight: 1,
    },
    {
      id: "edge:unrelated",
      sourceId: "district:other",
      targetId: "district:missing",
      renderable: false,
      points: [],
      weight: 1,
    },
  ],
  bounds: { width: 32, depth: 8, height: 4 },
})

const multiDistrictSelection: CodeCitySelectionResult = {
  selection: { kind: "building", id: "file:shared" },
  districtIds: ["district:core", "district:web"],
  incidentEdgeIds: ["edge:core-web", "edge:web-other"],
  evidence: [],
}

const emptySelection: CodeCitySelectionResult = {
  selection: null,
  districtIds: [],
  incidentEdgeIds: [],
  evidence: [],
}

const healthVisual = (fill: string): CodeCityLensVisual => ({
  lens: "health",
  available: true,
  fill,
  accent: "#bfdbfe",
  label: "Health: 80 (low)",
  unavailableReason: null,
})

const lensVisuals = (scene: CodeCityScene, fill = "#166534") =>
  Object.fromEntries(scene.nodes.map((node) => [node.id, healthVisual(fill)]))

const renderedDetails = (kit: ReturnType<typeof createCodeCityKitRenderer>) => {
  if (kit === null) throw new Error("Expected a Code City kit renderer")
  return Object.fromEntries(
    kit.group.children.map((child) => [child.userData.entityId as string, child.userData.detail as string]),
  )
}

describe("canCreateWebGLRenderer", () => {
  test("rejects a missing WebGL context", () => {
    expect(canCreateWebGLRenderer(null)).toBe(false)
  })

  test("accepts a present WebGL context", () => {
    const context = {} as WebGLRenderingContext

    expect(canCreateWebGLRenderer(context)).toBe(true)
  })
})

describe("Code City camera configuration", () => {
  test("keeps the orthographic camera inside a constrained orbit", () => {
    expect(CODE_CITY_CAMERA_CONFIG.projection).toBe("orthographic")
    expect(CODE_CITY_CAMERA_CONFIG.enablePan).toBe(true)
    expect(CODE_CITY_CAMERA_CONFIG.enableZoom).toBe(true)
    expect(Number.isFinite(CODE_CITY_CAMERA_CONFIG.minPolarAngle)).toBe(true)
    expect(Number.isFinite(CODE_CITY_CAMERA_CONFIG.maxPolarAngle)).toBe(true)
    expect(CODE_CITY_CAMERA_CONFIG.maxPolarAngle).toBeLessThan(Math.PI)
    expect(CODE_CITY_CAMERA_CONFIG.minPolarAngle).toBeLessThan(CODE_CITY_CAMERA_CONFIG.maxPolarAngle)
    expect(Number.isFinite(CODE_CITY_CAMERA_CONFIG.minAzimuthAngle)).toBe(true)
    expect(Number.isFinite(CODE_CITY_CAMERA_CONFIG.maxAzimuthAngle)).toBe(true)
    expect(CODE_CITY_CAMERA_CONFIG.maxAzimuthAngle - CODE_CITY_CAMERA_CONFIG.minAzimuthAngle).toBeLessThan(Math.PI * 2)
  })
})

describe("resolveCodeCityRouteSelectionId", () => {
  test("reveals the parent district route when a building is selected", () => {
    const scene: CodeCityScene = {
      contractVersion: 1,
      nodes: [
        {
          id: "district:core",
          kind: "district",
          label: "Core",
          parentId: null,
          center: { x: 0, z: 0 },
          size: { width: 8, depth: 8, height: 0.5 },
          districtKey: "district:core",
          visual: districtVisual,
        },
        {
          id: "file:alpha",
          kind: "building",
          label: "src/alpha.ts",
          parentId: "district:core",
          center: { x: 0, z: 0 },
          size: { width: 2, depth: 2, height: 4 },
          districtKey: "district:core",
          visual: buildingVisual,
        },
      ],
      edges: [],
      bounds: { width: 8, depth: 8, height: 4 },
    }

    expect(resolveCodeCityRouteSelectionId(scene, "file:alpha")).toBe("district:core")
  })
})

describe("Code City renderer selection contracts", () => {
  test("highlights every incident route for a multi-affiliated building", () => {
    expect(resolveCodeCityHighlightedRouteIds(multiDistrictScene(), multiDistrictSelection)).toEqual([
      "edge:core-web",
      "edge:web-other",
    ])
  })

  test("shows overview district labels plus selected and nearby building labels", () => {
    expect(resolveCodeCityVisibleLabelIds(multiDistrictScene(), multiDistrictSelection)).toEqual([
      "district:core",
      "district:web",
      "district:other",
      "file:shared",
      "file:web",
    ])
  })
})

describe("Code City semantic kit renderer", () => {
  test("materialises every authored node at overview detail without changing its visual tokens", () => {
    const scene = multiDistrictScene()
    const authored = scene.nodes.map((node) => ({
      id: node.id,
      center: node.center,
      size: node.size,
      visual: node.visual,
    }))
    const kit = createCodeCityKitRenderer({ threeScene: new ThreeScene(), documentRef: null })

    kit?.update({
      scene,
      selectionResult: emptySelection,
      lensVisuals: lensVisuals(scene),
      detailTargetId: null,
      denseDataMode: false,
    })

    expect(renderedDetails(kit)).toEqual({
      "district:core": "overview",
      "district:web": "overview",
      "district:other": "overview",
      "file:shared": "overview",
      "file:web": "overview",
      "file:other": "overview",
    })
    expect(scene.nodes.every((node) => node.visual.kind === node.kind)).toBeTrue()
    expect(
      scene.nodes.map((node) => ({ id: node.id, center: node.center, size: node.size, visual: node.visual })),
    ).toEqual(authored)
    kit?.dispose()
  })

  test("raises only the explicit focus path to district or building detail", () => {
    const scene = multiDistrictScene()
    const kit = createCodeCityKitRenderer({ threeScene: new ThreeScene(), documentRef: null })

    kit?.update({
      scene,
      selectionResult: multiDistrictSelection,
      lensVisuals: lensVisuals(scene),
      detailTargetId: "file:shared",
      denseDataMode: false,
    })
    expect(renderedDetails(kit)).toEqual({
      "district:core": "district",
      "district:web": "district",
      "district:other": "overview",
      "file:shared": "building",
      "file:web": "district",
      "file:other": "overview",
    })
    const focusedBuilding = kit?.group.children.find((child) => child.userData.entityId === "file:shared")
    expect(focusedBuilding?.children.filter((child) => child instanceof InstancedMesh)).toHaveLength(2)

    kit?.update({
      scene,
      selectionResult: {
        ...multiDistrictSelection,
        selection: { kind: "district", id: "district:core" },
        districtIds: ["district:core"],
      },
      lensVisuals: lensVisuals(scene),
      detailTargetId: "district:core",
      denseDataMode: false,
    })
    expect(renderedDetails(kit)["district:core"]).toBe("district")
    expect(renderedDetails(kit)["file:shared"]).toBe("district")
    kit?.dispose()
  })

  test("uses dense recipes independently of focus and keeps geometry tokens stable across lenses", () => {
    const scene = multiDistrictScene()
    const geometryBefore = scene.nodes.map((node) => ({
      id: node.id,
      center: { ...node.center },
      size: { ...node.size },
      landmarkTier: node.visual.kind === "district" ? node.visual.landmarkTier : null,
    }))
    const kit = createCodeCityKitRenderer({ threeScene: new ThreeScene(), documentRef: null })
    const update = (fill: string) =>
      kit?.update({
        scene,
        selectionResult: multiDistrictSelection,
        lensVisuals: lensVisuals(scene, fill),
        detailTargetId: "file:shared",
        denseDataMode: true,
      })

    update("#166534")
    expect(Object.values(renderedDetails(kit))).toEqual(Array(scene.nodes.length).fill("dense"))
    update("#991b1b")
    expect(kit?.group.children).toHaveLength(scene.nodes.length)
    expect(
      scene.nodes.map((node) => ({
        id: node.id,
        center: node.center,
        size: node.size,
        landmarkTier: node.visual.kind === "district" ? node.visual.landmarkTier : null,
      })),
    ).toEqual(geometryBefore)
    kit?.dispose()
    kit?.dispose()
    expect(kit?.group.parent).toBeNull()
  })
})
