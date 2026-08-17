import { describe, expect, test } from "bun:test"
import { InstancedMesh, Mesh, type MeshStandardMaterial, RepeatWrapping, Scene as ThreeScene } from "three"
import type { CodeCityLensVisual } from "../lens.js"
import { resolveCodeCityMaterialSpec } from "../materials.js"
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

const renderedNode = (kit: ReturnType<typeof createCodeCityKitRenderer>, id: string) => {
  if (kit === null) throw new Error("Expected a Code City kit renderer")
  const node = kit.group.children.find((child) => child.userData.entityId === id)
  if (node === undefined) throw new Error(`Expected rendered node ${id}`)
  return node
}

const baseMaterial = (kit: ReturnType<typeof createCodeCityKitRenderer>, id: string): MeshStandardMaterial => {
  const base = renderedNode(kit, id).children[0]
  if (!(base instanceof Mesh) || Array.isArray(base.material)) throw new Error(`Expected base mesh for ${id}`)
  return base.material as MeshStandardMaterial
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
    const facadeInstances = focusedBuilding?.children.filter((child) => child instanceof InstancedMesh) ?? []
    expect(facadeInstances.map((instances) => [instances.name, instances.count])).toEqual([
      ["src/shared.ts floor bands", 1],
      ["src/shared.ts windows", 4],
    ])

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

  test("keeps material-family colour stable while lens colour remains a restrained surface cue", () => {
    const scene = multiDistrictScene()
    const kit = createCodeCityKitRenderer({ threeScene: new ThreeScene(), documentRef: null })
    const update = (fill: string) =>
      kit?.update({
        scene,
        selectionResult: emptySelection,
        lensVisuals: lensVisuals(scene, fill),
        detailTargetId: null,
        denseDataMode: false,
      })

    update("#166534")
    const first = baseMaterial(kit, "file:shared")
    expect(`#${first.color.getHexString()}`).toBe(resolveCodeCityMaterialSpec("brick", "solid").baseColor)
    expect(`#${first.emissive.getHexString()}`).toBe("#166534")

    update("#991b1b")
    const second = baseMaterial(kit, "file:shared")
    expect(`#${second.color.getHexString()}`).toBe(resolveCodeCityMaterialSpec("brick", "solid").baseColor)
    expect(`#${second.emissive.getHexString()}`).toBe("#991b1b")
    kit?.dispose()
  })

  test("does not share translucent district materials with matching building surfaces", () => {
    const original = multiDistrictScene()
    const scene: CodeCityScene = {
      ...original,
      nodes: original.nodes.map((node) => {
        if (node.id === "district:other") {
          return {
            ...node,
            visual: { ...districtVisual, parcelStyle: "derived" as const, texturePattern: "solid" as const },
          }
        }
        if (node.id === "file:other") {
          return {
            ...node,
            size: { width: 8, depth: 8, height: 0.5 },
            visual: { ...buildingVisual, materialFamily: "slate" as const, texturePattern: "solid" as const },
          }
        }
        return node
      }),
    }
    const kit = createCodeCityKitRenderer({ threeScene: new ThreeScene(), documentRef: null })
    kit?.update({
      scene,
      selectionResult: emptySelection,
      lensVisuals: lensVisuals(scene),
      detailTargetId: null,
      denseDataMode: false,
    })

    const districtMaterial = baseMaterial(kit, "district:other")
    const buildingMaterial = baseMaterial(kit, "file:other")
    expect(districtMaterial).not.toBe(buildingMaterial)
    expect(districtMaterial.transparent).toBeTrue()
    expect(buildingMaterial.transparent).toBeFalse()
    kit?.dispose()
  })

  test("materialises recipe bridge primitives for existing renderable district routes", () => {
    const scene = multiDistrictScene()
    const kit = createCodeCityKitRenderer({ threeScene: new ThreeScene(), documentRef: null })
    kit?.update({
      scene,
      selectionResult: emptySelection,
      lensVisuals: lensVisuals(scene),
      detailTargetId: null,
      denseDataMode: false,
    })

    expect(
      renderedNode(kit, "district:core").children.some((child) => child.userData.primitiveKind === "bridge"),
    ).toBeTrue()
    expect(
      renderedNode(kit, "district:other").children.some((child) => child.userData.primitiveKind === "bridge"),
    ).toBeTrue()

    const unavailableRouteScene: CodeCityScene = {
      ...scene,
      edges: [{ ...scene.edges[0]!, renderable: false }],
    }
    kit?.update({
      scene: unavailableRouteScene,
      selectionResult: emptySelection,
      lensVisuals: lensVisuals(unavailableRouteScene),
      detailTargetId: null,
      denseDataMode: false,
    })
    expect(
      renderedNode(kit, "district:core").children.some((child) => child.userData.primitiveKind === "bridge"),
    ).toBeFalse()
    kit?.dispose()
  })

  test("repeats atlas patterns at a deterministic bounded world-unit scale", () => {
    const context = { fillStyle: "", fillRect: () => undefined }
    const documentRef = {
      createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    } as unknown as Document
    const scene = multiDistrictScene()
    const kit = createCodeCityKitRenderer({ threeScene: new ThreeScene(), documentRef })
    kit?.update({
      scene,
      selectionResult: emptySelection,
      lensVisuals: lensVisuals(scene),
      detailTargetId: null,
      denseDataMode: false,
    })

    const districtMap = baseMaterial(kit, "district:core").map
    const buildingMap = baseMaterial(kit, "file:shared").map
    expect([districtMap?.wrapS, districtMap?.wrapT, districtMap?.repeat.x, districtMap?.repeat.y]).toEqual([
      RepeatWrapping,
      RepeatWrapping,
      4,
      4,
    ])
    expect([buildingMap?.repeat.x, buildingMap?.repeat.y]).toEqual([1, 2])

    const oversizedScene: CodeCityScene = {
      ...scene,
      nodes: scene.nodes.map((node) =>
        node.id === "district:core" ? { ...node, size: { width: 100, depth: 100, height: 100 } } : node,
      ),
    }
    kit?.update({
      scene: oversizedScene,
      selectionResult: emptySelection,
      lensVisuals: lensVisuals(oversizedScene),
      detailTargetId: null,
      denseDataMode: false,
    })
    const boundedMap = baseMaterial(kit, "district:core").map
    expect([boundedMap?.repeat.x, boundedMap?.repeat.y]).toEqual([16, 16])
    kit?.dispose()
  })
})
