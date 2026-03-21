import { ControlsContainer, SigmaContainer, useLoadGraph, useRegisterEvents, useSigma, ZoomControl } from "@react-sigma/core"
import { navigate } from "astro:transitions/client"
import { UndirectedGraph } from "graphology"
import { circular } from "graphology-layout"
import forceAtlas2 from "graphology-layout-forceatlas2"
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import type { ForceGraphEdge, ForceGraphNode } from "../../lib/forceGraph"
import "./ForceGraph.css"

const LARGE_GRAPH_NODE_THRESHOLD = 220
const LARGE_GRAPH_EDGE_THRESHOLD = 1200
const DENSE_GRAPH_EDGE_THRESHOLD = 2400

type SigmaNodeAttributes = {
  x: number
  y: number
  size: number
  label: string
  color: string
  meta?: string
  href?: string
}

type SigmaEdgeAttributes = {
  size: number
  color: string
  label: string
  weight: number
  meta?: string
}

interface ForceGraphClientProps {
  nodes: ForceGraphNode[]
  edges: ForceGraphEdge[]
  width: number
  height: number
  emptyMessage: string
  onNodeClick?: (node: ForceGraphNode) => void
  footerNote?: string
}

type HoverState = {
  title: string
  detail: string
}

type ForceGraphTheme = {
  theme: "light" | "dark"
  card: string
  border: string
  text: string
  textMuted: string
  surfaceSubtle: string
  surfaceMuted: string
  accent: string
  accentStrong: string
}

function getCssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function readForceGraphTheme(): ForceGraphTheme {
  if (typeof window === "undefined") {
    return {
      theme: "light",
      card: "#ffffff",
      border: "#e2e8f0",
      text: "#1e293b",
      textMuted: "#64748b",
      surfaceSubtle: "#f8fafc",
      surfaceMuted: "#f1f5f9",
      accent: "#6366f1",
      accentStrong: "#4338ca",
    }
  }

  return {
    theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
    card: getCssVar("--color-card", "#ffffff"),
    border: getCssVar("--color-border", "#e2e8f0"),
    text: getCssVar("--color-text", "#1e293b"),
    textMuted: getCssVar("--color-text-muted", "#64748b"),
    surfaceSubtle: getCssVar("--color-surface-subtle", "#f8fafc"),
    surfaceMuted: getCssVar("--color-surface-muted", "#f1f5f9"),
    accent: getCssVar("--color-accent", "#6366f1"),
    accentStrong: getCssVar("--color-accent-strong", "#4338ca"),
  }
}

function normalizeGraphPositions(graph: UndirectedGraph<SigmaNodeAttributes, SigmaEdgeAttributes>) {
  if (graph.order === 0) return

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  graph.forEachNode((node) => {
    const { x, y } = graph.getNodeAttributes(node)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  })

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const scale = 100 / Math.max(spanX, spanY)

  graph.updateEachNodeAttributes((_, attributes) => ({
    ...attributes,
    x: (attributes.x - centerX) * scale,
    y: (attributes.y - centerY) * scale,
  }))
}

function buildSigmaGraph(nodes: ForceGraphNode[], edges: ForceGraphEdge[]) {
  const graph = new UndirectedGraph<SigmaNodeAttributes, SigmaEdgeAttributes>()
  const isLargeGraph = nodes.length >= LARGE_GRAPH_NODE_THRESHOLD || edges.length >= LARGE_GRAPH_EDGE_THRESHOLD
  const isDenseGraph = edges.length >= DENSE_GRAPH_EDGE_THRESHOLD

  for (const node of nodes) {
    graph.addNode(node.id, {
      x: 0,
      y: 0,
      size: node.size,
      label: node.label,
      color: node.color,
      meta: node.meta,
      href: node.href,
    })
  }

  for (const edge of edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue
    if (graph.hasEdge(edge.id)) continue

    graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
      size: edge.size,
      color: edge.color,
      label: edge.label,
      weight: edge.weight,
      meta: edge.meta,
    })
  }

  if (graph.order === 1) {
    const onlyNode = graph.nodes()[0]
    if (onlyNode) {
      graph.mergeNodeAttributes(onlyNode, { x: 0, y: 0 })
    }
    return graph
  }

  if (graph.order > 1) {
    circular.assign(graph, { scale: Math.max(20, graph.order * 3.5) })
  }

  if (graph.order > 2 && graph.size > 0) {
    const settings = forceAtlas2.inferSettings(graph)
    forceAtlas2.assign(graph, {
      iterations: isLargeGraph ? 120 : Math.max(120, graph.order * 18),
      settings: {
        ...settings,
        barnesHutOptimize: isLargeGraph,
        gravity: isLargeGraph ? 0.14 : 0.08,
        strongGravityMode: isDenseGraph,
        scalingRatio: Math.max(settings.scalingRatio ?? 1, isLargeGraph ? 24 : 18),
        slowDown: Math.max(settings.slowDown ?? 1, isLargeGraph ? 10 : 4),
      },
    })
  }

  normalizeGraphPositions(graph)

  return graph
}

function ForceGraphScene({
  graph,
  onNodeClick,
  onHoverChange,
}: {
  graph: UndirectedGraph<SigmaNodeAttributes, SigmaEdgeAttributes>
  onNodeClick?: (node: ForceGraphNode) => void
  onHoverChange: (hovered: HoverState | null) => void
}) {
  const loadGraph = useLoadGraph<SigmaNodeAttributes, SigmaEdgeAttributes>()
  const registerEvents = useRegisterEvents<SigmaNodeAttributes, SigmaEdgeAttributes>()
  const sigma = useSigma<SigmaNodeAttributes, SigmaEdgeAttributes>()
  const resetViewport = useCallback(() => {
    let frameOne = 0
    let frameTwo = 0
    let frameThree = 0

    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        frameThree = window.requestAnimationFrame(() => {
          sigma.resize(true)
          sigma.refresh()
          void sigma.getCamera().animatedReset({ duration: 0 })
        })
      })
    })

    return () => {
      window.cancelAnimationFrame(frameOne)
      window.cancelAnimationFrame(frameTwo)
      window.cancelAnimationFrame(frameThree)
    }
  }, [sigma])

  useEffect(() => {
    loadGraph(graph, true)
    onHoverChange(null)
    return resetViewport()
  }, [graph, loadGraph, onHoverChange, resetViewport])

  useEffect(() => {
    const handlePageLoad = () => {
      resetViewport()
    }

    document.addEventListener("astro:page-load", handlePageLoad)
    window.addEventListener("pageshow", handlePageLoad)

    return () => {
      document.removeEventListener("astro:page-load", handlePageLoad)
      window.removeEventListener("pageshow", handlePageLoad)
    }
  }, [resetViewport])

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return

    const container = sigma.getContainer()
    let frame = 0
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        sigma.resize(true)
        sigma.refresh()
        void sigma.getCamera().animatedReset({ duration: 0 })
      })
    })

      observer.observe(container)

      return () => {
        window.cancelAnimationFrame(frame)
        observer.disconnect()
    }
  }, [sigma])

  useEffect(() => {
    registerEvents({
      enterNode: ({ node }) => {
        const attributes = graph.getNodeAttributes(node)
        onHoverChange({
          title: attributes.label,
          detail: attributes.meta ?? node,
        })
      },
      leaveNode: () => {
        onHoverChange(null)
      },
      enterEdge: ({ edge }) => {
        const attributes = graph.getEdgeAttributes(edge)
        onHoverChange({
          title: attributes.label,
          detail: attributes.meta ?? `${graph.source(edge)} ↔ ${graph.target(edge)}`,
        })
      },
      leaveEdge: () => {
        onHoverChange(null)
      },
      clickNode: ({ node }) => {
        const attributes = graph.getNodeAttributes(node)
        const selectedNode: ForceGraphNode = {
          id: node,
          label: attributes.label,
          meta: attributes.meta,
          size: attributes.size,
          color: attributes.color,
          href: attributes.href,
        }

        if (onNodeClick) {
          onNodeClick(selectedNode)
          return
        }

        if (selectedNode.href) {
          void navigate(selectedNode.href)
        }
      },
    })
  }, [graph, onHoverChange, onNodeClick, registerEvents])

  return (
    <ControlsContainer position="top-right" style={controlsStyle}>
      <ZoomControl />
    </ControlsContainer>
  )
}

export default function ForceGraphClient({
  nodes,
  edges,
  width: _width,
  height,
  emptyMessage,
  onNodeClick,
  footerNote,
}: ForceGraphClientProps) {
  const [hovered, setHovered] = useState<HoverState | null>(null)
  const [theme, setTheme] = useState<ForceGraphTheme>(readForceGraphTheme)
  const graph = useMemo(() => buildSigmaGraph(nodes, edges), [edges, nodes])
  const isLargeGraph = nodes.length >= LARGE_GRAPH_NODE_THRESHOLD || edges.length >= LARGE_GRAPH_EDGE_THRESHOLD
  const isDenseGraph = edges.length >= DENSE_GRAPH_EDGE_THRESHOLD
  const hasGraph = nodes.length > 1 && edges.length > 0
  const footerHeight = 54
  const graphHeight = Math.max(height - footerHeight, 220)

  useEffect(() => {
    const syncTheme = () => setTheme(readForceGraphTheme())

    window.addEventListener("planetnik:theme-change", syncTheme)
    document.addEventListener("astro:after-swap", syncTheme)
    syncTheme()

    return () => {
      window.removeEventListener("planetnik:theme-change", syncTheme)
      document.removeEventListener("astro:after-swap", syncTheme)
    }
  }, [])

  const summaryText = hovered
    ? hovered.title
    : `${nodes.length.toLocaleString()} nodes · ${edges.length.toLocaleString()} links`
  const detailText = hovered
    ? hovered.detail
    : footerNote ?? "Drag to pan, scroll to zoom, click nodes to drill into linked records."

  if (!hasGraph) {
    return (
      <div
        style={{
          height: `${height}px`,
          display: "grid",
          placeItems: "center",
          padding: "1rem",
          borderRadius: "14px",
          border: `1px dashed ${theme.border}`,
          background: theme.card,
          color: theme.textMuted,
          textAlign: "center",
        }}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        height: `${height}px`,
        display: "grid",
        gridTemplateRows: `${graphHeight}px auto`,
        gap: "0.75rem",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          minWidth: 0,
          height: `${graphHeight}px`,
          borderRadius: "16px",
          overflow: "hidden",
          border: `1px solid ${theme.border}`,
          background:
            theme.theme === "dark"
              ? `radial-gradient(circle at top left, rgba(129, 140, 248, 0.16), transparent 30%), radial-gradient(circle at top right, rgba(168, 85, 247, 0.14), transparent 26%), ${theme.surfaceSubtle}`
              : `radial-gradient(circle at top left, rgba(99, 102, 241, 0.12), transparent 30%), radial-gradient(circle at top right, rgba(168, 85, 247, 0.12), transparent 26%), ${theme.card}`,
        }}
      >
        <SigmaContainer
          className="force-graph-sigma"
          style={{ width: "100%", height: "100%" }}
          settings={{
            allowInvalidContainer: true,
            renderEdgeLabels: false,
            enableEdgeEvents: !isLargeGraph,
            stagePadding: 32,
            minCameraRatio: 0.08,
            maxCameraRatio: 4,
            labelDensity: isDenseGraph ? 0.18 : isLargeGraph ? 0.32 : 1.1,
            labelRenderedSizeThreshold: isDenseGraph ? 14 : isLargeGraph ? 12 : 0,
            labelFont: "var(--font-sans, Inter, system-ui, sans-serif)",
            labelSize: isLargeGraph ? 12 : 13,
            labelWeight: "600",
            labelColor: { color: theme.text },
            defaultEdgeColor: theme.theme === "dark" ? "rgba(167, 139, 250, 0.44)" : "rgba(67, 56, 202, 0.38)",
            defaultNodeColor: "#6366f1",
          }}
        >
          <ForceGraphScene graph={graph} onNodeClick={onNodeClick} onHoverChange={setHovered} />
        </SigmaContainer>
      </div>

      <div style={footerStyle}>
        <div style={{ minWidth: 0 }}>
          <div style={summaryStyle(theme)}>{summaryText}</div>
          <div style={detailStyle(theme)}>{detailText}</div>
        </div>
        <div style={hintStyle(theme)}>Force-directed</div>
      </div>
    </div>
  )
}

const controlsStyle: CSSProperties = {
  padding: "0.85rem",
  gap: "0.45rem",
}

const footerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  minWidth: 0,
}

const summaryStyle = (theme: ForceGraphTheme): CSSProperties => ({
  color: theme.text,
  fontSize: "0.92rem",
  fontWeight: 700,
  lineHeight: 1.25,
})

const detailStyle = (theme: ForceGraphTheme): CSSProperties => ({
  marginTop: "0.2rem",
  color: theme.textMuted,
  fontSize: "0.84rem",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
})

const hintStyle = (theme: ForceGraphTheme): CSSProperties => ({
  flexShrink: 0,
  padding: "0.36rem 0.7rem",
  borderRadius: "999px",
  background: theme.surfaceMuted,
  color: theme.accentStrong,
  fontSize: "0.78rem",
  fontWeight: 700,
})
