import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Raycaster,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Scene as ThreeScene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { CodeCityAudiencePresentation } from "./audience.js"
import type { CodeCityLensVisual } from "./lens.js"
import type { CodeCityScene, CodeCitySceneEdge, CodeCitySceneNode } from "./sceneTypes.js"
import type { CodeCitySelectionResult } from "./selection.js"
import { createCodeCityKitRenderer } from "./threeKit.js"

export type CodeCityRendererStatus = "pending" | "ready" | "unavailable"

export type CodeCityRendererUnavailableReason = "webgl-context-unavailable" | "renderer-initialisation-failed"

export type CodeCityRendererPresentation = Pick<
  CodeCityAudiencePresentation,
  "routeEmphasis" | "labelDensity"
>

export const CODE_CITY_CAMERA_CONFIG = {
  projection: "orthographic",
  enablePan: true,
  enableZoom: true,
  minPolarAngle: Math.PI / 6,
  maxPolarAngle: Math.PI / 2.2,
  minAzimuthAngle: -Math.PI / 3,
  maxAzimuthAngle: Math.PI / 3,
} as const

export function canCreateWebGLRenderer(context: WebGLRenderingContext | null): boolean {
  return context !== null
}

export function resolveCodeCityRouteSelectionId(scene: CodeCityScene, selectedId: string | null): string | null {
  if (selectedId === null) return null
  const selectedNode = scene.nodes.find((node) => node.id === selectedId)
  return selectedNode?.kind === "building" ? selectedNode.parentId : selectedId
}

export function resolveCodeCityHighlightedRouteIds(
  scene: CodeCityScene,
  selectionResult: CodeCitySelectionResult,
  routeEmphasis: CodeCityRendererPresentation["routeEmphasis"] = "selection",
): readonly string[] {
  const incidentEdgeIds = new Set(selectionResult.incidentEdgeIds)
  const selectedEdges = scene.edges.filter((edge) => edge.renderable && incidentEdgeIds.has(edge.id))
  if (routeEmphasis !== "consequential") return selectedEdges.map((edge) => edge.id)

  const selectedEdgeIds = new Set(selectedEdges.map((edge) => edge.id))
  const ambientEdges = scene.edges
    .filter((edge) => edge.renderable && !selectedEdgeIds.has(edge.id))
    .sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id))
    .slice(0, 2)

  return [...selectedEdges, ...ambientEdges].map((edge) => edge.id)
}

export function resolveCodeCityVisibleLabelIds(
  scene: CodeCityScene,
  selectionResult: CodeCitySelectionResult,
  labelDensity: CodeCityRendererPresentation["labelDensity"] = "balanced",
): readonly string[] {
  if (labelDensity === "generous") return scene.nodes.map((node) => node.id)

  const selectedDistrictIds = new Set(selectionResult.districtIds)
  return scene.nodes
    .filter((node) => {
      if (node.kind === "district") return true
      if (selectionResult.selection === null) return false
      if (labelDensity === "calm") return node.id === selectionResult.selection.id
      return (
        node.id === selectionResult.selection.id || (node.parentId !== null && selectedDistrictIds.has(node.parentId))
      )
    })
    .map((node) => node.id)
}

export type CodeCityLensVisuals = Readonly<Record<string, CodeCityLensVisual>>

export type CodeCityRendererOptions = {
  readonly canvas: HTMLCanvasElement
  readonly scene: CodeCityScene
  readonly lensVisuals: CodeCityLensVisuals
  readonly selectionResult: CodeCitySelectionResult
  readonly presentation: CodeCityRendererPresentation
  readonly denseDataMode: boolean
  readonly onSelect: (id: string) => void
  readonly onFocusComplete: () => void
  readonly onRendererUnavailable: (reason: CodeCityRendererUnavailableReason) => void
}

export type CodeCityRendererController = {
  readonly setLensVisuals: (lensVisuals: CodeCityLensVisuals) => void
  readonly setSelectionResult: (selectionResult: CodeCitySelectionResult) => void
  readonly setPresentation: (presentation: CodeCityRendererPresentation) => void
  readonly focusEntity: (id: string | null) => void
  readonly dispose: () => void
}

type CameraState = {
  readonly position: Vector3
  readonly target: Vector3
  readonly zoom: number
}

type NodeRenderRecord = {
  readonly node: CodeCitySceneNode
  readonly mesh: Mesh<BoxGeometry, MeshStandardMaterial>
}

type RouteRenderRecord = {
  readonly edge: CodeCitySceneEdge
  readonly material: MeshStandardMaterial
}

type LabelRenderRecord = {
  readonly node: CodeCitySceneNode
  readonly sprite: Sprite
  readonly material: SpriteMaterial
  readonly texture: CanvasTexture
}

const FALLBACK_FILL = "#64748b"
const ROUTE_COLOR = "#64748b"
const ROUTE_SELECTED_COLOR = "#38bdf8"

const unavailable = (options: CodeCityRendererOptions, reason: CodeCityRendererUnavailableReason): null => {
  options.onRendererUnavailable(reason)
  return null
}

const sceneCentre = (scene: CodeCityScene): Vector3 => {
  if (scene.nodes.length === 0) return new Vector3(0, 0, 0)

  const minimumX = Math.min(...scene.nodes.map((node) => node.center.x - node.size.width / 2))
  const maximumX = Math.max(...scene.nodes.map((node) => node.center.x + node.size.width / 2))
  const minimumZ = Math.min(...scene.nodes.map((node) => node.center.z - node.size.depth / 2))
  const maximumZ = Math.max(...scene.nodes.map((node) => node.center.z + node.size.depth / 2))

  return new Vector3((minimumX + maximumX) / 2, scene.bounds.height / 4, (minimumZ + maximumZ) / 2)
}

const nodePositionY = (node: CodeCitySceneNode, nodesById: ReadonlyMap<string, CodeCitySceneNode>): number => {
  const parcelHeight = node.kind === "building" && node.parentId ? (nodesById.get(node.parentId)?.size.height ?? 0) : 0
  return parcelHeight + node.size.height / 2
}

const createNodeRecord = (
  node: CodeCitySceneNode,
  nodesById: ReadonlyMap<string, CodeCitySceneNode>,
): NodeRenderRecord => {
  const geometry = new BoxGeometry(
    Math.max(node.size.width, 0.01),
    Math.max(node.size.height, 0.01),
    Math.max(node.size.depth, 0.01),
  )
  const material = new MeshStandardMaterial({
    color: new Color(FALLBACK_FILL),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  material.colorWrite = false
  const mesh = new Mesh(geometry, material)
  mesh.position.set(node.center.x, nodePositionY(node, nodesById), node.center.z)
  mesh.userData.entityId = node.id
  mesh.name = node.label

  return { node, mesh }
}

const createLabelRecord = (
  node: CodeCitySceneNode,
  nodesById: ReadonlyMap<string, CodeCitySceneNode>,
): LabelRenderRecord | null => {
  if (typeof document === "undefined") return null
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 96
  const context = canvas.getContext("2d")
  if (!context) return null

  const text = node.label.length > 48 ? `${node.label.slice(0, 45)}…` : node.label
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = "rgba(15, 23, 42, 0.88)"
  context.fillRect(0, 8, canvas.width, 80)
  context.strokeStyle = node.kind === "district" ? "#7dd3fc" : "#cbd5e1"
  context.lineWidth = 3
  context.strokeRect(1.5, 9.5, canvas.width - 3, 77)
  context.fillStyle = "#f8fafc"
  context.font = node.kind === "district" ? "700 34px system-ui, sans-serif" : "600 28px system-ui, sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 32)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const sprite = new Sprite(material)
  const top = nodePositionY(node, nodesById) + node.size.height / 2
  sprite.position.set(node.center.x, top + (node.kind === "district" ? 1.1 : 0.8), node.center.z)
  sprite.scale.set(node.kind === "district" ? 6.4 : 5.6, node.kind === "district" ? 1.2 : 1, 1)
  sprite.renderOrder = 20
  sprite.name = `${node.label} label`
  sprite.visible = false

  return { node, sprite, material, texture }
}

const createRouteRecords = (edge: CodeCitySceneEdge, threeScene: ThreeScene): RouteRenderRecord[] => {
  if (!edge.renderable) return []

  const records: RouteRenderRecord[] = []
  for (let index = 1; index < edge.points.length; index += 1) {
    const start = edge.points[index - 1]
    const end = edge.points[index]
    if (!start || !end) continue

    const deltaX = end.x - start.x
    const deltaZ = end.z - start.z
    const length = Math.hypot(deltaX, deltaZ)
    if (length === 0) continue

    const geometry = new BoxGeometry(length, 0.04, 0.08)
    const material = new MeshStandardMaterial({
      color: ROUTE_COLOR,
      transparent: true,
      opacity: 0.34,
      roughness: 0.9,
      metalness: 0,
    })
    const strip = new Mesh(geometry, material)
    strip.position.set((start.x + end.x) / 2, Math.max(start.y, end.y) + 0.08, (start.z + end.z) / 2)
    strip.rotation.y = -Math.atan2(deltaZ, deltaX)
    threeScene.add(strip)
    records.push({ edge, material })
  }

  return records
}

const disposeSceneObjects = (scene: ThreeScene, labelRecords: readonly LabelRenderRecord[]) => {
  for (const record of labelRecords) record.texture.dispose()
  scene.traverse((child) => {
    if (child instanceof Mesh) child.geometry.dispose()
    if (child instanceof Mesh || child instanceof Sprite) {
      if (Array.isArray(child.material)) {
        for (const material of child.material) material.dispose()
      } else {
        child.material.dispose()
      }
    }
  })
  scene.clear()
}

export function createCodeCityRenderer(options: CodeCityRendererOptions): CodeCityRendererController | null {
  let context: WebGLRenderingContext | null = null
  try {
    context = options.canvas.getContext("webgl2", { alpha: false, antialias: true }) as WebGLRenderingContext | null
  } catch {
    return unavailable(options, "webgl-context-unavailable")
  }

  if (context === null || !canCreateWebGLRenderer(context)) {
    return unavailable(options, "webgl-context-unavailable")
  }

  let disposed = false
  const cleanupActions: Array<() => void> = []
  const cleanup = () => {
    if (disposed) return
    disposed = true
    for (const action of cleanupActions.reverse()) {
      try {
        action()
      } catch {
        // Cleanup is best-effort and must not mask the stable renderer failure reason.
      }
    }
  }

  try {
    const renderer = new WebGLRenderer({
      canvas: options.canvas,
      context,
      antialias: true,
      alpha: false,
    })
    cleanupActions.push(() => renderer.dispose())

    const threeScene = new ThreeScene()
    threeScene.background = new Color("#0f172a")
    threeScene.add(new AmbientLight("#ffffff", 1.45))
    const directionalLight = new DirectionalLight("#ffffff", 2.1)
    directionalLight.position.set(12, 18, 10)
    threeScene.add(directionalLight)

    const nodesById = new Map(options.scene.nodes.map((node) => [node.id, node]))
    const nodeRecords = new Map<string, NodeRenderRecord>()
    const labelRecords = new Map<string, LabelRenderRecord>()
    cleanupActions.push(() => disposeSceneObjects(threeScene, [...labelRecords.values()]))
    const kitRenderer = createCodeCityKitRenderer({
      threeScene,
      documentRef: typeof document === "undefined" ? null : document,
    })
    if (kitRenderer === null) throw new Error("Code City semantic kit initialisation failed")
    cleanupActions.push(() => kitRenderer.dispose())
    const pickableMeshes: Mesh[] = []
    for (const node of options.scene.nodes) {
      const record = createNodeRecord(node, nodesById)
      nodeRecords.set(node.id, record)
      pickableMeshes.push(record.mesh)
      threeScene.add(record.mesh)
      if (node.kind === "district") {
        const labelRecord = createLabelRecord(node, nodesById)
        if (labelRecord) {
          labelRecords.set(node.id, labelRecord)
          threeScene.add(labelRecord.sprite)
        }
      }
    }
    const routeRecords = options.scene.edges.flatMap((edge) => createRouteRecords(edge, threeScene))

    const centre = sceneCentre(options.scene)
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 10_000)
    const cameraDistance = Math.max(options.scene.bounds.width, options.scene.bounds.depth, 1) * 1.25
    camera.position.set(centre.x + cameraDistance, centre.y + cameraDistance, centre.z + cameraDistance)
    camera.lookAt(centre)

    const controls = new OrbitControls(camera, options.canvas)
    cleanupActions.push(() => controls.dispose())
    controls.target.copy(centre)
    controls.enableDamping = false
    controls.enablePan = CODE_CITY_CAMERA_CONFIG.enablePan
    controls.enableZoom = CODE_CITY_CAMERA_CONFIG.enableZoom
    controls.minPolarAngle = CODE_CITY_CAMERA_CONFIG.minPolarAngle
    controls.maxPolarAngle = CODE_CITY_CAMERA_CONFIG.maxPolarAngle
    controls.minAzimuthAngle = CODE_CITY_CAMERA_CONFIG.minAzimuthAngle
    controls.maxAzimuthAngle = CODE_CITY_CAMERA_CONFIG.maxAzimuthAngle
    controls.minZoom = 0.6
    controls.maxZoom = 4
    controls.update()

    let lensVisuals = options.lensVisuals
    let selectionResult = options.selectionResult
    let presentation = options.presentation
    let detailTargetId: string | null = null
    let preservedCameraState: CameraState | null = null
    const render = () => {
      if (!disposed) renderer.render(threeScene, camera)
    }

    const updateMaterials = () => {
      kitRenderer.update({
        scene: options.scene,
        selectionResult,
        lensVisuals,
        detailTargetId,
        denseDataMode: options.denseDataMode,
      })
      const highlightedRouteIds = new Set(
        resolveCodeCityHighlightedRouteIds(options.scene, selectionResult, presentation.routeEmphasis),
      )
      for (const record of routeRecords) {
        const selected = highlightedRouteIds.has(record.edge.id)
        record.material.color.set(selected ? ROUTE_SELECTED_COLOR : ROUTE_COLOR)
        record.material.opacity = selected ? 0.78 : 0.34
      }
      const visibleLabelIds = new Set(
        resolveCodeCityVisibleLabelIds(options.scene, selectionResult, presentation.labelDensity),
      )
      for (const id of visibleLabelIds) {
        if (labelRecords.has(id)) continue
        const node = nodesById.get(id)
        if (!node) continue
        const labelRecord = createLabelRecord(node, nodesById)
        if (!labelRecord) continue
        labelRecords.set(id, labelRecord)
        threeScene.add(labelRecord.sprite)
      }
      for (const [id, record] of labelRecords) record.sprite.visible = visibleLabelIds.has(id)
      render()
    }

    const resize = () => {
      if (disposed) return
      const width = Math.max(options.canvas.clientWidth, 1)
      const height = Math.max(options.canvas.clientHeight, 1)
      const aspect = width / height
      const viewSize = Math.max(options.scene.bounds.width, options.scene.bounds.depth, 1) * 1.45
      camera.left = (-viewSize * aspect) / 2
      camera.right = (viewSize * aspect) / 2
      camera.top = viewSize / 2
      camera.bottom = -viewSize / 2
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, 2))
      renderer.setSize(width, height, false)
      render()
    }

    const raycaster = new Raycaster()
    const pointer = new Vector2()
    let pointerStart: { readonly x: number; readonly y: number } | null = null
    const handlePointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY }
    }
    const handlePointerUp = (event: PointerEvent) => {
      if (!pointerStart) return
      const pointerTravel = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y)
      pointerStart = null
      if (pointerTravel > 4) return

      const bounds = options.canvas.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) return
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      const entityId = raycaster.intersectObjects(pickableMeshes, false)[0]?.object.userData.entityId
      if (typeof entityId === "string") options.onSelect(entityId)
    }

    options.canvas.addEventListener("pointerdown", handlePointerDown)
    cleanupActions.push(() => options.canvas.removeEventListener("pointerdown", handlePointerDown))
    options.canvas.addEventListener("pointerup", handlePointerUp)
    cleanupActions.push(() => options.canvas.removeEventListener("pointerup", handlePointerUp))
    controls.addEventListener("change", render)
    cleanupActions.push(() => controls.removeEventListener("change", render))

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize)
    if (observer) {
      cleanupActions.push(() => observer.disconnect())
      observer.observe(options.canvas)
    } else if (typeof window !== "undefined") {
      window.addEventListener("resize", resize)
      cleanupActions.push(() => window.removeEventListener("resize", resize))
    }

    updateMaterials()
    resize()

    return {
      setLensVisuals(nextLensVisuals) {
        lensVisuals = nextLensVisuals
        updateMaterials()
      },
      setSelectionResult(nextSelectionResult) {
        selectionResult = nextSelectionResult
        updateMaterials()
      },
      setPresentation(nextPresentation) {
        if (
          disposed ||
          (presentation.routeEmphasis === nextPresentation.routeEmphasis &&
            presentation.labelDensity === nextPresentation.labelDensity)
        ) {
          return
        }
        presentation = nextPresentation
        updateMaterials()
      },
      focusEntity(id) {
        if (id === null) {
          detailTargetId = null
          updateMaterials()
          if (!preservedCameraState) return
          camera.position.copy(preservedCameraState.position)
          camera.zoom = preservedCameraState.zoom
          controls.target.copy(preservedCameraState.target)
          camera.updateProjectionMatrix()
          controls.update()
          preservedCameraState = null
          render()
          options.onFocusComplete()
          return
        }

        const record = nodeRecords.get(id)
        if (!record) return
        detailTargetId = id
        updateMaterials()
        if (!preservedCameraState) {
          preservedCameraState = {
            position: camera.position.clone(),
            target: controls.target.clone(),
            zoom: camera.zoom,
          }
        }
        const nextTarget = record.mesh.position.clone()
        const cameraOffset = camera.position.clone().sub(controls.target)
        controls.target.copy(nextTarget)
        camera.position.copy(nextTarget).add(cameraOffset)
        camera.zoom = Math.min(controls.maxZoom, Math.max(camera.zoom, record.node.kind === "building" ? 2.4 : 1.55))
        camera.updateProjectionMatrix()
        controls.update()
        render()
        options.onFocusComplete()
      },
      dispose() {
        cleanup()
      },
    }
  } catch {
    cleanup()
    return unavailable(options, "renderer-initialisation-failed")
  }
}
