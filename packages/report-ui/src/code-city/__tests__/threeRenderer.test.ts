import { describe, expect, test } from "bun:test"
import type { CodeCityScene } from "../sceneTypes.js"
import { CODE_CITY_CAMERA_CONFIG, canCreateWebGLRenderer, resolveCodeCityRouteSelectionId } from "../threeRenderer.js"

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
        },
        {
          id: "file:alpha",
          kind: "building",
          label: "src/alpha.ts",
          parentId: "district:core",
          center: { x: 0, z: 0 },
          size: { width: 2, depth: 2, height: 4 },
          districtKey: "district:core",
        },
      ],
      edges: [],
      bounds: { width: 8, depth: 8, height: 4 },
    }

    expect(resolveCodeCityRouteSelectionId(scene, "file:alpha")).toBe("district:core")
  })
})
