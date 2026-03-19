import { useEffect, useState, type ComponentType, type CSSProperties } from "react"
import type { ForceGraphEdge, ForceGraphNode } from "../../lib/forceGraph"
import ChartCard from "../charts/ChartCard"

interface ForceGraphProps {
  nodes: ForceGraphNode[]
  edges: ForceGraphEdge[]
  height?: number
  emptyMessage?: string
  helpText?: string
  onNodeClick?: (node: ForceGraphNode) => void
  footerNote?: string
}

interface ForceGraphClientProps extends Required<Pick<ForceGraphProps, "emptyMessage">> {
  nodes: ForceGraphNode[]
  edges: ForceGraphEdge[]
  width: number
  height: number
  onNodeClick?: (node: ForceGraphNode) => void
  footerNote?: string
}

type PlanetnikWindow = Window & {
  __planetnikRouteVersion?: number
}

function getRouteVersion(): number {
  if (typeof window === "undefined") return 0
  return (window as PlanetnikWindow).__planetnikRouteVersion ?? 0
}

export default function ForceGraph({
  nodes,
  edges,
  height = 540,
  emptyMessage = "Not enough graph data to render this view.",
  helpText,
  onNodeClick,
  footerNote,
}: ForceGraphProps) {
  const [ClientGraph, setClientGraph] = useState<ComponentType<ForceGraphClientProps> | null>(null)
  const [mountVersion, setMountVersion] = useState(getRouteVersion)

  useEffect(() => {
    let isActive = true

    void import("./ForceGraphClient").then((module) => {
      if (isActive) {
        setClientGraph(() => module.default)
      }
    })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    const syncRouteVersion = (event?: Event) => {
      const detailVersion =
        event instanceof CustomEvent && typeof event.detail?.version === "number"
          ? event.detail.version
          : null

      setMountVersion(detailVersion ?? getRouteVersion())
    }

    document.addEventListener("planetnik:route-version", syncRouteVersion as EventListener)
    window.addEventListener("pageshow", syncRouteVersion)
    syncRouteVersion()

    return () => {
      document.removeEventListener("planetnik:route-version", syncRouteVersion as EventListener)
      window.removeEventListener("pageshow", syncRouteVersion)
    }
  }, [])

  return (
    <ChartCard height={height} helpText={helpText}>
      {(width, cardHeight) =>
        ClientGraph ? (
          <ClientGraph
            key={mountVersion}
            nodes={nodes}
            edges={edges}
            width={width}
            height={cardHeight}
            emptyMessage={emptyMessage}
            onNodeClick={onNodeClick}
            footerNote={footerNote}
          />
        ) : (
          <ForceGraphPlaceholder height={cardHeight} />
        )
      }
    </ChartCard>
  )
}

function ForceGraphPlaceholder({ height }: { height: number }) {
  return (
    <div
      style={{
        height: `${height}px`,
        display: "grid",
        gridTemplateRows: "1fr auto",
        gap: "0.75rem",
      }}
    >
      <div style={placeholderFrameStyle}>
        <div style={placeholderGlowStyle} />
        {placeholderNodes.map((node, index) => (
          <span
            key={index}
            style={{
              ...placeholderNodeStyle,
              left: node.left,
              top: node.top,
              width: node.width,
              animationDelay: `${index * 0.08}s`,
            }}
          />
        ))}
      </div>
      <div style={placeholderFooterStyle}>
        <span style={{ ...placeholderLineStyle, width: "11rem" }} />
        <span style={{ ...placeholderLineStyle, width: "5rem" }} />
      </div>
      <style>{`
        @keyframes force-graph-skeleton-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

const placeholderFrameStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  background:
    "radial-gradient(circle at top left, rgba(99, 102, 241, 0.1), transparent 28%), radial-gradient(circle at top right, rgba(168, 85, 247, 0.1), transparent 24%), #fbfdff",
}

const placeholderGlowStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(110deg, rgba(248, 250, 252, 0) 18%, rgba(238, 242, 255, 0.9) 40%, rgba(248, 250, 252, 0) 62%)",
  backgroundSize: "200% 100%",
  animation: "planetnik-chart-skeleton 1.6s ease-in-out infinite",
}

const placeholderNodeStyle: CSSProperties = {
  position: "absolute",
  height: "1.6rem",
  borderRadius: "999px",
  background: "#e0e7ff",
  animation: "force-graph-skeleton-pulse 1.8s ease-in-out infinite",
}

const placeholderFooterStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "1rem",
}

const placeholderLineStyle: CSSProperties = {
  height: "0.85rem",
  borderRadius: "999px",
  background: "#e2e8f0",
}

const placeholderNodes = [
  { left: "10%", top: "20%", width: "5.6rem" },
  { left: "38%", top: "12%", width: "6.2rem" },
  { left: "70%", top: "24%", width: "5rem" },
  { left: "24%", top: "54%", width: "6rem" },
  { left: "55%", top: "62%", width: "5.4rem" },
  { left: "78%", top: "50%", width: "4.6rem" },
]
