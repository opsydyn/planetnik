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
  RepeatWrapping,
  SphereGeometry,
  type Texture,
  type Scene as ThreeScene,
  Vector3,
} from "three"
import { buildCodeCityKitRecipe, type CodeCityKitPrimitive, resolveCodeCityDetailLevel } from "./kitRecipe.js"
import type { CodeCityLensVisual } from "./lens.js"
import { resolveCodeCityMaterialSpec, resolveCodeCitySurfaceTreatment } from "./materials.js"
import type { CodeCityScene, CodeCitySceneNode } from "./sceneTypes.js"
import type { CodeCitySelectionResult } from "./selection.js"
import { type CodeCityTextureAtlas, createCodeCityTextureAtlas } from "./textureAtlas.js"
import type { CodeCityMaterialFamily, CodeCityTexturePattern } from "./visualTokens.js"

type CodeCityLensVisuals = Readonly<Record<string, CodeCityLensVisual>>

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
const SELECTION_EMISSIVE = "#38bdf8"
// Shared atlas tiles repeat once per two scene units and cap at 16 to keep
// pattern density deterministic without producing pathological sampling.
const TEXTURE_WORLD_UNITS = 2
const MAX_TEXTURE_REPEAT = 16
const CARDINAL_DIRECTIONS = ["north", "east", "south", "west"] as const

type BridgeDirection = (typeof CARDINAL_DIRECTIONS)[number]
type FloorBandPrimitive = Extract<CodeCityKitPrimitive, { readonly kind: "floor_band" }>
type WindowRowPrimitive = Extract<CodeCityKitPrimitive, { readonly kind: "window_row" }>

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

const clampTextureRepeat = (worldSize: number): number =>
  Math.max(1, Math.min(MAX_TEXTURE_REPEAT, Math.ceil(Math.max(worldSize, 0) / TEXTURE_WORLD_UNITS)))

const textureRepeatForNode = (node: CodeCitySceneNode): { readonly x: number; readonly y: number } => ({
  x: clampTextureRepeat(Math.max(node.size.width, node.size.depth)),
  y: clampTextureRepeat(Math.max(node.size.height, node.size.depth)),
})

const lensEmissiveIntensity = (treatment: ReturnType<typeof resolveCodeCitySurfaceTreatment>): number => {
  switch (treatment) {
    case "impact":
      return 0.14
    case "scaffold":
      return 0.1
    case "banner":
      return 0.07
    case "neutral":
    case "wear":
    case "machinery":
    case "unavailable":
      return 0
  }
}

const directionFromDelta = (deltaX: number, deltaZ: number): BridgeDirection | null => {
  if (deltaX === 0 && deltaZ === 0) return null
  if (Math.abs(deltaX) >= Math.abs(deltaZ)) return deltaX >= 0 ? "east" : "west"
  return deltaZ >= 0 ? "south" : "north"
}

const oppositeDirection = (direction: BridgeDirection): BridgeDirection => {
  switch (direction) {
    case "north":
      return "south"
    case "east":
      return "west"
    case "south":
      return "north"
    case "west":
      return "east"
  }
}

const bridgeDirectionsByNode = (scene: CodeCityScene): ReadonlyMap<string, readonly BridgeDirection[]> => {
  const nodesById = new Map(scene.nodes.map((node) => [node.id, node]))
  const directions = new Map<string, Set<BridgeDirection>>()
  const add = (nodeId: string, direction: BridgeDirection) => {
    const nodeDirections = directions.get(nodeId) ?? new Set<BridgeDirection>()
    nodeDirections.add(direction)
    directions.set(nodeId, nodeDirections)
  }

  for (const edge of scene.edges) {
    if (!edge.renderable) continue
    const source = nodesById.get(edge.sourceId)
    const target = nodesById.get(edge.targetId)
    if (source?.kind !== "district" || target?.kind !== "district") continue
    const direction = directionFromDelta(target.center.x - source.center.x, target.center.z - source.center.z)
    if (direction === null) continue
    add(source.id, direction)
    add(target.id, oppositeDirection(direction))
  }

  return new Map(
    [...directions.entries()].map(([nodeId, nodeDirections]) => [
      nodeId,
      CARDINAL_DIRECTIONS.filter((direction) => nodeDirections.has(direction)),
    ]),
  )
}

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

const facadeMatrices = (node: CodeCitySceneNode, rows: readonly WindowRowPrimitive[]): readonly Matrix4[] => {
  if (rows.length === 0) return []
  const matrices: Matrix4[] = []
  const rowCount = Math.max(...rows.map((row) => row.index))
  const rowHeight = node.size.height / (rowCount + 1)

  for (const row of rows) {
    const y = rowHeight * row.index
    const frontSegmentWidth = node.size.width / (row.segments + 1)
    const sideSegmentWidth = node.size.depth / (row.segments + 1)
    for (let segment = 1; segment <= row.segments; segment += 1) {
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

const floorBandMatrices = (node: CodeCitySceneNode, bands: readonly FloorBandPrimitive[]): readonly Matrix4[] => {
  if (bands.length === 0) return []
  const matrices: Matrix4[] = []
  const rowCount = Math.max(...bands.map((band) => band.index))
  for (const band of bands) {
    const y = (node.size.height / (rowCount + 1)) * band.index
    matrices.push(new Matrix4().makeScale(node.size.width * 1.02, 0.055, node.size.depth * 1.02).setPosition(0, y, 0))
  }
  return matrices
}

const addBridge = (
  parent: Group,
  node: CodeCitySceneNode,
  direction: BridgeDirection,
  geometry: BoxGeometry,
  material: MeshStandardMaterial,
): void => {
  const eastWest = direction === "east" || direction === "west"
  const outward = Math.max(0.4, Math.min(eastWest ? node.size.width * 0.16 : node.size.depth * 0.16, 1.4))
  const width = Math.max(0.16, Math.min(eastWest ? node.size.depth * 0.14 : node.size.width * 0.14, 0.8))
  const sign = direction === "east" || direction === "south" ? 1 : -1
  const bridge = addBox(
    parent,
    geometry,
    material,
    eastWest ? { x: outward, y: 0.12, z: width } : { x: width, y: 0.12, z: outward },
    eastWest
      ? { x: sign * (node.size.width / 2 + outward / 2), y: node.size.height + 0.14, z: 0 }
      : { x: 0, y: node.size.height + 0.14, z: sign * (node.size.depth / 2 + outward / 2) },
  )
  bridge.userData.primitiveKind = "bridge"
  bridge.userData.direction = direction
}

const createNodeGroup = (
  node: CodeCitySceneNode,
  nodesById: ReadonlyMap<string, CodeCitySceneNode>,
  detail: ReturnType<typeof resolveCodeCityDetailLevel>,
  visual: CodeCityLensVisual | undefined,
  geometries: SharedGeometries,
  selected: boolean,
  bridgeDirections: readonly BridgeDirection[],
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
      surfaceTreatment: "unavailable",
      nonColorCue: "Health has no overlay because the signal is unavailable.",
    },
  )
  const recipe = buildCodeCityKitRecipe(node, detail, treatment, bridgeDirections)
  const floorBands = recipe.primitives.filter(
    (primitive): primitive is FloorBandPrimitive => primitive.kind === "floor_band",
  )
  const windowRows = recipe.primitives.filter(
    (primitive): primitive is WindowRowPrimitive => primitive.kind === "window_row",
  )
  let floorBandsMaterialised = false
  let windowRowsMaterialised = false
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
        if (!floorBandsMaterialised) {
          addInstances(
            nodeGroup,
            geometries.block,
            accentMaterial,
            floorBandMatrices(node, floorBands),
            `${node.label} floor bands`,
          )
          floorBandsMaterialised = true
        }
        break
      case "window_row":
        if (!windowRowsMaterialised) {
          addInstances(
            nodeGroup,
            geometries.block,
            accentMaterial,
            facadeMatrices(node, windowRows),
            `${node.label} windows`,
          )
          windowRowsMaterialised = true
        }
        break
      case "bridge":
        addBridge(nodeGroup, node, primitive.direction, geometries.block, accentMaterial)
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
        const buttress = addBox(
          nodeGroup,
          geometries.block,
          accentMaterial,
          { x: width, y: height, z: width },
          positions[primitive.side],
        )
        buttress.userData.primitiveKind = "buttress"
        buttress.userData.side = primitive.side
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

  return nodeGroup
}

export function createCodeCityKitRenderer(options: CodeCityKitRendererOptions): CodeCityKitRenderer | null {
  const group = new Group()
  group.name = "Code City semantic building kit"
  let atlas: CodeCityTextureAtlas | null = null
  let geometries: SharedGeometries | null = null
  let disposed = false
  const materials = new Map<string, MeshStandardMaterial>()
  const ownedTextures = new Set<Texture>()

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
          surfaceTreatment: "unavailable",
          nonColorCue: "Health has no overlay because the signal is unavailable.",
        },
      )
      const color = role === "accent" ? spec.accentColor : spec.baseColor
      const lensCue = visual?.fill ?? FALLBACK_FILL
      const repeat = textureRepeatForNode(node)
      const key = [
        node.kind,
        family,
        pattern,
        treatment,
        role,
        selected ? "selected" : "normal",
        lensCue,
        `${repeat.x}x${repeat.y}`,
      ].join(":")
      const cached = materials.get(key)
      if (cached !== undefined) return cached

      const map = atlas?.get(pattern).clone() ?? null
      if (map !== null) {
        map.wrapS = RepeatWrapping
        map.wrapT = RepeatWrapping
        map.repeat.set(repeat.x, repeat.y)
        map.needsUpdate = true
        ownedTextures.add(map)
      }

      const emissiveColor = selected ? SELECTION_EMISSIVE : lensEmissiveIntensity(treatment) > 0 ? lensCue : "#000000"

      const material = new MeshStandardMaterial({
        color: new Color(color),
        map,
        roughness: treatment === "wear" ? Math.min(1, spec.roughness + 0.12) : spec.roughness,
        metalness: treatment === "machinery" ? Math.max(0.48, spec.metalness) : spec.metalness,
        transparent: node.kind === "district",
        opacity: node.kind === "district" ? 0.62 : treatment === "unavailable" ? 0.72 : 1,
        emissive: new Color(emissiveColor),
        emissiveIntensity: selected ? 0.28 : lensEmissiveIntensity(treatment),
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
        const bridgesByNode = bridgeDirectionsByNode(scene)
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
              bridgesByNode.get(node.id) ?? [],
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
        ownedTextures.forEach((texture) => {
          texture.dispose()
        })
        ownedTextures.clear()
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
    ownedTextures.forEach((texture) => {
      texture.dispose()
    })
    atlas?.dispose()
    return null
  }
}
