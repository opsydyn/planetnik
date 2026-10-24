import { describe, expect, test } from "bun:test"
import { UndirectedGraph } from "graphology"

const { evaluateEdgeStyle, evaluateNodeStyle, createForceGraphOptions } = await (async () => {
  // Sigma registers primitive declarations at import time. These two WebGL
  // enum values are needed for registration, not a renderer or graphics context.
  const original = Object.getOwnPropertyDescriptor(globalThis, "WebGL2RenderingContext")
  if (!original) {
    Object.defineProperty(globalThis, "WebGL2RenderingContext", {
      configurable: true,
      value: { UNSIGNED_BYTE: 5121, FLOAT: 5126 },
    })
  }
  try {
    const { evaluateEdgeStyle, evaluateNodeStyle } = await import("sigma/types")
    const { createForceGraphOptions } = await import("./forceGraphOptions.js")
    return { evaluateEdgeStyle, evaluateNodeStyle, createForceGraphOptions }
  } finally {
    if (!original) Reflect.deleteProperty(globalThis, "WebGL2RenderingContext")
  }
})()

const graphState = {
  isIdle: true,
  isPanning: false,
  isZooming: false,
  isDragging: false,
  hasHovered: false,
  hasHighlighted: false,
}

describe("force graph Sigma options", () => {
  test.each(["light", "dark"] as const)("resolves node labels and coordinates in %s mode", (theme) => {
    const options = createForceGraphOptions({ isLargeGraph: false, isDenseGraph: false, theme, text: "#64748b" })
    const graph = new UndirectedGraph()
    graph.addNode("source", { x: -12, y: 8, label: "Source module", size: 9, color: "#58A6FF" })
    const rendered = evaluateNodeStyle(
      options.styles.nodes,
      graph.getNodeAttributes("source"),
      {
        isHovered: false,
        isLabelHovered: false,
        isHidden: false,
        isHighlighted: false,
        isDragged: false,
      },
      graphState,
      graph,
    )

    expect(rendered.label).toBe("Source module")
    expect(rendered.x).toBe(-12)
    expect(rendered.y).toBe(8)
    expect(rendered.size).toBe(9)
  })

  test.each(["light", "dark"] as const)("resolves weighted edge thickness and labels in %s mode", (theme) => {
    const options = createForceGraphOptions({ isLargeGraph: false, isDenseGraph: false, theme, text: "#64748b" })
    const graph = new UndirectedGraph()
    graph.addNode("source")
    graph.addNode("target")
    graph.addEdgeWithKey("weighted", "source", "target", { size: 5.75, weight: 12, label: "12 dependencies" })
    const rendered = evaluateEdgeStyle(
      options.styles.edges,
      graph.getEdgeAttributes("weighted"),
      {
        isHovered: false,
        isLabelHovered: false,
        isHidden: false,
        isHighlighted: false,
        parallelIndex: 0,
        parallelCount: 1,
      },
      graphState,
      graph,
    )

    expect(rendered.size).toBe(5.75)
    expect(rendered.label).toBe("12 dependencies")
  })

  test.each([
    [false, false, 1.1, 0, true, 13],
    [true, false, 0.32, 12, false, 12],
    [true, true, 0.18, 14, false, 12],
  ] as const)(
    "keeps density controls for large=%s dense=%s",
    (isLargeGraph, isDenseGraph, density, threshold, edgeEvents, labelSize) => {
      const options = createForceGraphOptions({ isLargeGraph, isDenseGraph, theme: "light", text: "#1e293b" })
      expect(options.settings).toMatchObject({
        labelDensity: density,
        labelRenderedSizeThreshold: threshold,
        enableEdgeEvents: edgeEvents,
        minCameraRatio: 0.08,
        maxCameraRatio: 4,
      })
      expect(options.styles.nodes).toMatchObject({ labelSize })
    },
  )

  test.each([
    ["light", "#1e293b", "#ffffff", "rgba(0,0,0,0.2)"],
    ["dark", "#e2e8f0", "#1e293b", "rgba(0,0,0,0.6)"],
  ] as const)("keeps %s labels readable with hover backdrops", (theme, text, backdropColor, shadowColor) => {
    const options = createForceGraphOptions({ isLargeGraph: false, isDenseGraph: false, theme, text })
    expect(options.styles.nodes).toMatchObject({
      size: { attribute: "size" },
      color: { attribute: "color", defaultValue: "#58A6FF" },
      labelColor: text,
      backdropColor,
      backdropShadowColor: shadowColor,
    })
    expect(options.styles.edges).toMatchObject({ color: { attribute: "color" } })
    expect(options.styles.nodes.labelVisibility({}, { isHovered: true })).toBe("visible")
    expect(options.styles.nodes.labelVisibility({}, { isHovered: false })).toBe("auto")
    expect(options.styles.nodes.backdropVisibility({}, { isHovered: true })).toBe("visible")
    expect(options.styles.nodes.backdropVisibility({}, { isHovered: false })).toBe("hidden")
  })
})
