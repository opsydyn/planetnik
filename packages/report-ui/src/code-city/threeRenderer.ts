import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Raycaster,
  Scene as ThreeScene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { CodeCityLensVisual } from "./lens.js"
import type { CodeCityScene, CodeCitySceneEdge, CodeCitySceneNode } from "./sceneTypes.js"

export type CodeCityRendererStatus = "pending" | "ready" | "unavailable"

export type CodeCityRendererUnavailableReason = "webgl-context-unavailable" | "renderer-initialisation-failed"

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

export type CodeCityLensVisuals = Readonly<Record<string, CodeCityLensVisual>>

export type CodeCityRendererOptions = {
  readonly canvas: HTMLCanvasElement
  readonly scene: CodeCityScene
  readonly lensVisuals: CodeCityLensVisuals
  readonly selectedId: string | null
  readonly onSelect: (id: string) => void
  readonly onFocusComplete: () => void
  readonly onRendererUnavailable: (reason: CodeCityRendererUnavailableReason) => void
}

export type CodeCityRendererController = {
  readonly setLensVisuals: (lensVisuals: CodeCityLensVisuals) => void
  readonly setSelectedId: (id: string | null) => void
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
  readonly material: MeshStandardMaterial
}

type RouteRenderRecord = {
  readonly edge: CodeCitySceneEdge
  readonly material: MeshStandardMaterial
}

const FALLBACK_FILL = "#64748b"
const FALLBACK_ACCENT = "#cbd5e1"
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
  lensVisuals: CodeCityLensVisuals,
): NodeRenderRecord => {
  const visual = lensVisuals[node.id]
  const geometry = new BoxGeometry(
    Math.max(node.size.width, 0.01),
    Math.max(node.size.height, 0.01),
    Math.max(node.size.depth, 0.01),
  )
  const material = new MeshStandardMaterial({
    color: new Color(visual?.fill ?? FALLBACK_FILL),
    roughness: 0.82,
    metalness: 0.04,
    transparent: node.kind === "district",
    opacity: node.kind === "district" ? 0.58 : 1,
  })
  const mesh = new Mesh(geometry, material)
  mesh.position.set(node.center.x, nodePositionY(node, nodesById), node.center.z)
  mesh.userData.entityId = node.id
  mesh.name = node.label

  return { node, mesh, material }
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

const disposeSceneMeshes = (scene: ThreeScene) => {
  scene.traverse((child) => {
    if (!(child instanceof Mesh)) return
    child.geometry.dispose()
    if (Array.isArray(child.material)) {
      for (const material of child.material) material.dispose()
    } else {
      child.material.dispose()
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
    cleanupActions.push(() => disposeSceneMeshes(threeScene))
    threeScene.background = new Color("#0f172a")
    threeScene.add(new AmbientLight("#ffffff", 1.45))
    const directionalLight = new DirectionalLight("#ffffff", 2.1)
    directionalLight.position.set(12, 18, 10)
    threeScene.add(directionalLight)

    const nodesById = new Map(options.scene.nodes.map((node) => [node.id, node]))
    const nodeRecords = new Map<string, NodeRenderRecord>()
    const pickableMeshes: Mesh[] = []
    for (const node of options.scene.nodes) {
      const record = createNodeRecord(node, nodesById, options.lensVisuals)
      nodeRecords.set(node.id, record)
      pickableMeshes.push(record.mesh)
      threeScene.add(record.mesh)
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
    let selectedId = options.selectedId
    let preservedCameraState: CameraState | null = null
    const render = () => {
      if (!disposed) renderer.render(threeScene, camera)
    }

    const updateMaterials = () => {
      for (const [id, record] of nodeRecords) {
        const visual = lensVisuals[id]
        const selected = selectedId === id
        record.material.color.set(selected ? (visual?.accent ?? FALLBACK_ACCENT) : (visual?.fill ?? FALLBACK_FILL))
        record.material.emissive.set(selected ? "#172554" : "#000000")
        record.material.emissiveIntensity = selected ? 0.55 : 0
      }
      const routeSelectionId = resolveCodeCityRouteSelectionId(options.scene, selectedId)
      for (const record of routeRecords) {
        const selected =
          routeSelectionId !== null &&
          (record.edge.sourceId === routeSelectionId || record.edge.targetId === routeSelectionId)
        record.material.color.set(selected ? ROUTE_SELECTED_COLOR : ROUTE_COLOR)
        record.material.opacity = selected ? 0.78 : 0.34
      }
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
      setSelectedId(id) {
        selectedId = id
        updateMaterials()
      },
      focusEntity(id) {
        if (id === null) {
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
