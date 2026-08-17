import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  type Scene as ThreeScene,
  Vector3,
} from "three"
import { buildCodeCityKitRecipe, resolveCodeCityDetailLevel } from "./kitRecipe.js"
import type { CodeCityLensVisual } from "./lens.js"
import { resolveCodeCityMaterialSpec, resolveCodeCitySurfaceTreatment } from "./materials.js"
import type { CodeCityScene, CodeCitySceneNode } from "./sceneTypes.js"
import type { CodeCitySelectionResult } from "./selection.js"
import { type CodeCityTextureAtlas, createCodeCityTextureAtlas } from "./textureAtlas.js"
import type { CodeCityMaterialFamily, CodeCityTexturePattern } from "./visualTokens.js"

export type CodeCityLensVisuals = Readonly<Record<string, CodeCityLensVisual>>

export type CodeCityKitRenderer = {
  readonly update: (input: {
    readonly scene: CodeCityScene
    readonly selectionResult: CodeCitySelectionResult
    readonly lensVisuals: CodeCityLensVisuals
    readonly detailTargetId: string | null
    readonly denseDataMode: boolean
  }) => void
  readonly group: Group
  readonly dispose: () => void
}

export type CodeCityKitRendererOptions = {
  readonly threeScene: ThreeScene
  readonly documentRef: Document | null
}

type SharedGeometries = {
  readonly block: BoxGeometry
  readonly roof: ConeGeometry
  readonly dome: SphereGeometry
  readonly tower: CylinderGeometry
  readonly beacon: CylinderGeometry
}

const FALLBACK_FILL = "#64748b"
const FALLBACK_ACCENT = "#cbd5e1"

const createSharedGeometries = (): SharedGeometries => ({
  block: new BoxGeometry(1, 1, 1),
  roof: new ConeGeometry(0.5, 1, 4),
  dome: new SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  tower: new CylinderGeometry(0.32, 0.42, 1, 6),
  beacon: new CylinderGeometry(0.18, 0.24, 1, 6),
})

const clearRenderedNodes = (group: Group): void => {
  group.traverse((object) => {
    if (object instanceof InstancedMesh) object.dispose()
  })
  group.clear()
}

const familyAndPattern = (
  node: CodeCitySceneNode,
): { readonly family: CodeCityMaterialFamily; readonly pattern: CodeCityTexturePattern } =>
  node.visual.kind === "building"
    ? { family: node.visual.materialFamily, pattern: node.visual.texturePattern }
    : {
        family: node.visual.parcelStyle === "civic" ? "glazed_tile" : "slate",
        pattern: node.visual.texturePattern,
      }

const nodeBaseY = (node: CodeCitySceneNode, nodesById: ReadonlyMap<string, CodeCitySceneNode>): number =>
  node.kind === "building" && node.parentId !== null ? (nodesById.get(node.parentId)?.size.height ?? 0) : 0

const addBox = (
  parent: Group,
  geometry: BoxGeometry,
  material: MeshStandardMaterial,
  scale: { readonly x: number; readonly y: number; readonly z: number },
  position: { readonly x: number; readonly y: number; readonly z: number },
): Mesh => {
  const mesh = new Mesh(geometry, material)
  mesh.scale.set(Math.max(scale.x, 0.01), Math.max(scale.y, 0.01), Math.max(scale.z, 0.01))
  mesh.position.set(position.x, position.y, position.z)
  parent.add(mesh)
  return mesh
}

const addRoof = (
  parent: Group,
  node: CodeCitySceneNode,
  style: "flat" | "pitched" | "stepped" | "capped",
  geometries: SharedGeometries,
  material: MeshStandardMaterial,
): void => {
  const top = node.size.height
  const width = Math.max(node.size.width, 0.01)
  const depth = Math.max(node.size.depth, 0.01)

  if (style === "flat") {
    addBox(
      parent,
      geometries.block,
      material,
      { x: width * 1.02, y: 0.12, z: depth * 1.02 },
      { x: 0, y: top + 0.06, z: 0 },
    )
    return
  }

  if (style === "stepped") {
    addBox(
      parent,
      geometries.block,
      material,
      { x: width * 0.84, y: 0.24, z: depth * 0.84 },
      { x: 0, y: top + 0.12, z: 0 },
    )
    addBox(
      parent,
      geometries.block,
      material,
      { x: width * 0.58, y: 0.24, z: depth * 0.58 },
      { x: 0, y: top + 0.36, z: 0 },
    )
    return
  }

  const roof = new Mesh(geometries.roof, material)
  roof.scale.set(
    width * (style === "capped" ? 0.42 : 1.02),
    style === "capped" ? 0.9 : 1.3,
    depth * (style === "capped" ? 0.42 : 1.02),
  )
  roof.position.set(0, top + (style === "capped" ? 0.45 : 0.65), 0)
  roof.rotation.y = Math.PI / 4
  parent.add(roof)
}

const facadeMatrices = (node: CodeCitySceneNode, rows: number, segments: number): readonly Matrix4[] => {
  if (rows <= 0 || segments <= 0) return []
  const matrices: Matrix4[] = []
  const rowHeight = node.size.height / (rows + 1)
  const frontSegmentWidth = node.size.width / (segments + 1)
  const sideSegmentWidth = node.size.depth / (segments + 1)

  for (let row = 1; row <= rows; row += 1) {
    const y = rowHeight * row
    for (let segment = 1; segment <= segments; segment += 1) {
      const x = -node.size.width / 2 + frontSegmentWidth * segment
      matrices.push(
        composeMatrix(
          { x, y, z: node.size.depth / 2 + 0.015 },
          { x: Math.min(frontSegmentWidth * 0.48, 0.7), y: Math.min(rowHeight * 0.28, 0.42), z: 0.035 },
        ),
        composeMatrix(
          { x, y, z: -node.size.depth / 2 - 0.015 },
          { x: Math.min(frontSegmentWidth * 0.48, 0.7), y: Math.min(rowHeight * 0.28, 0.42), z: 0.035 },
        ),
      )

      const z = -node.size.depth / 2 + sideSegmentWidth * segment
      matrices.push(
        composeMatrix(
          { x: node.size.width / 2 + 0.015, y, z },
          { x: 0.035, y: Math.min(rowHeight * 0.28, 0.42), z: Math.min(sideSegmentWidth * 0.48, 0.7) },
        ),
        composeMatrix(
          { x: -node.size.width / 2 - 0.015, y, z },
          { x: 0.035, y: Math.min(rowHeight * 0.28, 0.42), z: Math.min(sideSegmentWidth * 0.48, 0.7) },
        ),
      )
    }
  }
  return matrices
}

const addInstances = (
  parent: Group,
  geometry: BoxGeometry,
  material: MeshStandardMaterial,
  matrices: readonly Matrix4[],
  name: string,
): void => {
  if (matrices.length === 0) return
  const instances = new InstancedMesh(geometry, material, matrices.length)
  matrices.forEach((matrix, index) => {
    instances.setMatrixAt(index, matrix)
  })
  instances.instanceMatrix.needsUpdate = true
  instances.name = name
  parent.add(instances)
}

const composeMatrix = (
  position: { readonly x: number; readonly y: number; readonly z: number },
  scale: { readonly x: number; readonly y: number; readonly z: number },
): Matrix4 =>
  new Matrix4().compose(
    new Vector3(position.x, position.y, position.z),
    new Quaternion(),
    new Vector3(scale.x, scale.y, scale.z),
  )

const floorBandMatrices = (node: CodeCitySceneNode, rows: number): readonly Matrix4[] => {
  const matrices: Matrix4[] = []
  for (let row = 1; row <= rows; row += 1) {
    const y = (node.size.height / (rows + 1)) * row
    matrices.push(new Matrix4().makeScale(node.size.width * 1.02, 0.055, node.size.depth * 1.02).setPosition(0, y, 0))
  }
  return matrices
}

const createNodeGroup = (
  node: CodeCitySceneNode,
  nodesById: ReadonlyMap<string, CodeCitySceneNode>,
  detail: ReturnType<typeof resolveCodeCityDetailLevel>,
  visual: CodeCityLensVisual | undefined,
  geometries: SharedGeometries,
  selected: boolean,
  materialFor: (
    node: CodeCitySceneNode,
    visual: CodeCityLensVisual | undefined,
    role: "base" | "accent",
    selected: boolean,
  ) => MeshStandardMaterial,
): Group => {
  const nodeGroup = new Group()
  nodeGroup.name = node.label
  nodeGroup.position.set(node.center.x, nodeBaseY(node, nodesById), node.center.z)
  nodeGroup.userData.entityId = node.id
  nodeGroup.userData.detail = detail

  const treatment = resolveCodeCitySurfaceTreatment(
    visual ?? {
      lens: "health",
      available: false,
      fill: FALLBACK_FILL,
      accent: FALLBACK_ACCENT,
      label: "Health unavailable",
      unavailableReason: "Health unavailable",
    },
  )
  const recipe = buildCodeCityKitRecipe(node, detail, treatment)
  const baseMaterial = materialFor(node, visual, "base", selected)
  const accentMaterial = materialFor(node, visual, "accent", selected)

  for (const primitive of recipe.primitives) {
    switch (primitive.kind) {
      case "base":
        addBox(
          nodeGroup,
          geometries.block,
          baseMaterial,
          { x: primitive.width, y: primitive.height, z: primitive.depth },
          { x: 0, y: primitive.height / 2, z: 0 },
        )
        break
      case "roof":
        addRoof(nodeGroup, node, primitive.style, geometries, accentMaterial)
        break
      case "floor_band":
      case "window_row":
      case "bridge":
        break
      case "cupola": {
        const cupola = new Mesh(geometries.dome, accentMaterial)
        cupola.scale.set(node.size.width * 0.2, Math.max(node.size.height * 0.35, 0.4), node.size.depth * 0.2)
        cupola.position.set(0, node.size.height + 0.04, 0)
        nodeGroup.add(cupola)
        break
      }
      case "dome": {
        const dome = new Mesh(geometries.dome, accentMaterial)
        const major = primitive.tier === "super_hub" ? 0.34 : 0.26
        dome.scale.set(node.size.width * major, Math.max(node.size.height * 0.55, 0.7), node.size.depth * major)
        dome.position.set(0, node.size.height + 0.04, 0)
        nodeGroup.add(dome)
        break
      }
      case "tower": {
        const tower = new Mesh(geometries.tower, accentMaterial)
        const towerHeight = Math.max(node.size.height * (primitive.tier === "super_hub" ? 1.5 : 1.15), 1.5)
        tower.scale.set(node.size.width * 0.18, towerHeight, node.size.depth * 0.18)
        tower.position.set(0, node.size.height + towerHeight / 2, 0)
        nodeGroup.add(tower)
        break
      }
      case "buttress": {
        const height = Math.max(node.size.height * 0.42, 0.3)
        const width = Math.max(Math.min(node.size.width, node.size.depth) * 0.11, 0.08)
        const positions = {
          north: { x: 0, y: height / 2, z: node.size.depth / 2 + width / 2 },
          east: { x: node.size.width / 2 + width / 2, y: height / 2, z: 0 },
          south: { x: 0, y: height / 2, z: -node.size.depth / 2 - width / 2 },
          west: { x: -node.size.width / 2 - width / 2, y: height / 2, z: 0 },
        } as const
        addBox(
          nodeGroup,
          geometries.block,
          accentMaterial,
          { x: width, y: height, z: width },
          positions[primitive.side],
        )
        break
      }
      case "beacon": {
        const beacon = new Mesh(geometries.beacon, accentMaterial)
        beacon.scale.set(0.7, Math.max(node.size.height * 0.16, 0.4), 0.7)
        beacon.position.set(0, node.size.height + 0.55, 0)
        beacon.userData.surfaceTreatment = primitive.treatment
        nodeGroup.add(beacon)
        break
      }
    }
  }

  if (node.visual.kind === "building" && (detail === "district" || detail === "building")) {
    addInstances(
      nodeGroup,
      geometries.block,
      accentMaterial,
      floorBandMatrices(node, node.visual.floorCount),
      `${node.label} floor bands`,
    )
    addInstances(
      nodeGroup,
      geometries.block,
      accentMaterial,
      facadeMatrices(node, node.visual.floorCount, node.visual.facadeSegments),
      `${node.label} windows`,
    )
  }

  return nodeGroup
}

export function createCodeCityKitRenderer(options: CodeCityKitRendererOptions): CodeCityKitRenderer | null {
  const group = new Group()
  group.name = "Code City semantic building kit"
  let atlas: CodeCityTextureAtlas | null = null
  let geometries: SharedGeometries | null = null
  let disposed = false
  const materials = new Map<string, MeshStandardMaterial>()

  try {
    atlas = options.documentRef === null ? null : createCodeCityTextureAtlas(options.documentRef)
    geometries = createSharedGeometries()
    options.threeScene.add(group)

    const materialFor = (
      node: CodeCitySceneNode,
      visual: CodeCityLensVisual | undefined,
      role: "base" | "accent",
      selected: boolean,
    ): MeshStandardMaterial => {
      const { family, pattern } = familyAndPattern(node)
      const spec = resolveCodeCityMaterialSpec(family, pattern)
      const treatment = resolveCodeCitySurfaceTreatment(
        visual ?? {
          lens: "health",
          available: false,
          fill: FALLBACK_FILL,
          accent: FALLBACK_ACCENT,
          label: "Health unavailable",
          unavailableReason: "Health unavailable",
        },
      )
      const color =
        selected || role === "accent" ? (visual?.accent ?? spec.accentColor) : (visual?.fill ?? spec.baseColor)
      const key = [family, pattern, treatment, role, selected ? "selected" : "normal", color].join(":")
      const cached = materials.get(key)
      if (cached !== undefined) return cached

      const material = new MeshStandardMaterial({
        color: new Color(color),
        map: atlas?.get(pattern) ?? null,
        roughness: treatment === "wear" ? Math.min(1, spec.roughness + 0.12) : spec.roughness,
        metalness: treatment === "machinery" ? Math.max(0.48, spec.metalness) : spec.metalness,
        transparent: node.kind === "district",
        opacity: node.kind === "district" ? 0.62 : treatment === "unavailable" ? 0.72 : 1,
        emissive: new Color(selected || treatment === "impact" || treatment === "scaffold" ? color : "#000000"),
        emissiveIntensity: selected ? 0.28 : treatment === "impact" ? 0.18 : treatment === "scaffold" ? 0.1 : 0,
      })
      material.userData.surfaceTreatment = treatment
      materials.set(key, material)
      return material
    }

    return {
      group,
      update({ scene, selectionResult, lensVisuals, detailTargetId, denseDataMode }) {
        if (disposed || geometries === null) return
        clearRenderedNodes(group)
        const nodesById = new Map(scene.nodes.map((node) => [node.id, node]))
        const selectedDistrictIds = detailTargetId === null ? [] : selectionResult.districtIds
        const selectedId = selectionResult.selection?.id ?? null
        for (const node of scene.nodes) {
          const detail = resolveCodeCityDetailLevel(node, detailTargetId, selectedDistrictIds, denseDataMode)
          group.add(
            createNodeGroup(
              node,
              nodesById,
              detail,
              lensVisuals[node.id],
              geometries,
              node.id === selectedId,
              materialFor,
            ),
          )
        }
      },
      dispose() {
        if (disposed) return
        disposed = true
        options.threeScene.remove(group)
        clearRenderedNodes(group)
        Object.values(geometries ?? {}).forEach((geometry) => {
          geometry.dispose()
        })
        geometries = null
        materials.forEach((material) => {
          material.dispose()
        })
        materials.clear()
        atlas?.dispose()
        atlas = null
      },
    }
  } catch {
    options.threeScene.remove(group)
    Object.values(geometries ?? {}).forEach((geometry) => {
      geometry.dispose()
    })
    materials.forEach((material) => {
      material.dispose()
    })
    atlas?.dispose()
    return null
  }
}
