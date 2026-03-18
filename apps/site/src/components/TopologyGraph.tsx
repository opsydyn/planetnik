import { RegistryProvider, Result, useAtom, useAtomValue } from "@effect-atom/atom-react"
import dagre from "@dagrejs/dagre"
import { Background, type Edge, type Node, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  type PeopleDep,
  currentEdgesAtom,
  selectedPeriodAtom,
  sortedEdgesAtom,
  topologyPeriodsAtom,
  topologyStatsAtom,
} from "../state/topologyGraphState"
import { getContributorHref } from "../lib/contributors"

interface TopologyGraphProps {
  periods: Record<string, PeopleDep[]>
}

const NODE_WIDTH = 180
const NODE_HEIGHT = 50

function layoutWithDagre(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120 })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return {
    nodes: nodes.map((node) => {
      const pos = g.node(node.id)
      return { ...node, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } }
    }),
    edges,
  }
}

function truncateEmail(email: string): string {
  const at = email.indexOf("@")
  if (at < 0) return email.length > 20 ? `${email.slice(0, 17)}...` : email
  const local = email.slice(0, at)
  return local.length > 18 ? `${local.slice(0, 15)}...` : local
}

function buildGraph(rawEdges: PeopleDep[]) {
  const connectionCounts = new Map<string, number>()
  for (const e of rawEdges) {
    connectionCounts.set(e.from, (connectionCounts.get(e.from) ?? 0) + e.count)
    connectionCounts.set(e.to, (connectionCounts.get(e.to) ?? 0) + e.count)
  }

  const maxConn = Math.max(...connectionCounts.values(), 1)

  const nodeIds = new Set<string>()
  for (const e of rawEdges) {
    nodeIds.add(e.from)
    nodeIds.add(e.to)
  }

  const nodes: Node[] = Array.from(nodeIds).map((id) => {
    const connections = connectionCounts.get(id) ?? 0
    const intensity = Math.min(connections / maxConn, 1)
    const r = Math.round(99 + (239 - 99) * intensity)
    const g = Math.round(102 + (68 - 102) * intensity)
    const b = Math.round(241 + (68 - 241) * intensity)

    return {
      id,
      data: { label: truncateEmail(id) },
      position: { x: 0, y: 0 },
      style: {
        background: `rgb(${r}, ${g}, ${b})`,
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
        fontWeight: 500,
        width: NODE_WIDTH,
        textAlign: "center" as const,
        cursor: "pointer",
      },
    }
  })

  const maxCount = Math.max(...rawEdges.map((e) => e.count), 1)
  const edgeList: Edge[] = rawEdges.map((e, i) => {
    const thickness = Math.max(1, Math.min(6, (e.count / maxCount) * 6))
    return {
      id: `e-${i}`,
      source: e.from,
      target: e.to,
      label: `${e.count}`,
      style: { strokeWidth: thickness, stroke: "#94a3b8" },
      labelStyle: { fontSize: 10, fill: "#64748b" },
      labelBgStyle: { fill: "#fff", fillOpacity: 0.8 },
    }
  })

  return layoutWithDagre(nodes, edgeList)
}

const pulseKeyframes = `
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
`

function SkeletonBlock({ width, height, style }: { width: string | number; height: string | number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width,
        height,
        background: "#e2e8f0",
        borderRadius: "6px",
        animation: "skeleton-pulse 1.8s ease-in-out infinite",
        ...style,
      }}
    />
  )
}

function GraphSkeleton() {
  // Fake node positions mimicking a dagre TB layout
  const skeletonNodes = [
    { x: 200, y: 40 },
    { x: 80, y: 180 },
    { x: 320, y: 180 },
    { x: 40, y: 320 },
    { x: 160, y: 320 },
    { x: 360, y: 320 },
  ]

  const skeletonEdges = [
    [0, 1], [0, 2], [1, 3], [1, 4], [2, 5],
  ]

  return (
    <div style={{ width: "100%", height: "600px", background: "#fafafa", borderRadius: "8px", border: "1px solid #e2e8f0", position: "relative", overflow: "hidden" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        {skeletonEdges.map(([from, to], i) => {
          const f = skeletonNodes[from]
          const t = skeletonNodes[to]
          return (
            <line
              key={i}
              x1={f.x + 90} y1={f.y + 25}
              x2={t.x + 90} y2={t.y + 25}
              stroke="#e2e8f0"
              strokeWidth={2}
              style={{ animation: "skeleton-pulse 1.8s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}
            />
          )
        })}
      </svg>
      {skeletonNodes.map((pos, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: pos.x,
            top: pos.y,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            background: "#e2e8f0",
            borderRadius: "8px",
            animation: "skeleton-pulse 1.8s ease-in-out infinite",
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  )
}

function TableSkeleton() {
  const rows = 5
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Contributor 1</th>
          <th style={thStyle}>Contributor 2</th>
          <th style={{ ...thStyle, textAlign: "right" }}>Shared Files</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            <td style={tdBase}><SkeletonBlock width={`${60 + (i % 3) * 20}%`} height={14} style={{ animationDelay: `${i * 0.1}s` }} /></td>
            <td style={tdBase}><SkeletonBlock width={`${50 + (i % 3) * 15}%`} height={14} style={{ animationDelay: `${i * 0.1 + 0.05}s` }} /></td>
            <td style={{ ...tdBase, textAlign: "right" }}><SkeletonBlock width={32} height={14} style={{ marginLeft: "auto", animationDelay: `${i * 0.1 + 0.1}s` }} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function CardsSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={cardStyle}>
          <SkeletonBlock width={80} height={28} style={{ animationDelay: `${i * 0.15}s` }} />
          <SkeletonBlock width={100} height={12} style={{ marginTop: "0.5rem", animationDelay: `${i * 0.15 + 0.05}s` }} />
        </div>
      ))}
    </div>
  )
}

export default function TopologyGraph({ periods }: TopologyGraphProps) {
  const periodKeys = Object.keys(periods)
  const initialValues = useMemo(
    () => [
      [topologyPeriodsAtom, periods],
      [selectedPeriodAtom, periodKeys[0] ?? "All Time"],
    ] as const,
    [periodKeys, periods],
  )

  return (
    <RegistryProvider initialValues={initialValues}>
      <TopologyGraphContent periodKeys={periodKeys} />
    </RegistryProvider>
  )
}

function TopologyGraphContent({ periodKeys }: { periodKeys: string[] }) {
  const [selectedPeriod, setSelectedPeriod] = useAtom(selectedPeriodAtom)
  const currentEdges = useAtomValue(currentEdgesAtom)
  const stats = useAtomValue(topologyStatsAtom)
  const sortedEdges = useAtomValue(sortedEdgesAtom)
  const [ready, setReady] = useState(false)
  const styleInjected = useRef(false)

  // Inject pulse animation keyframes once
  useEffect(() => {
    if (styleInjected.current) return
    styleInjected.current = true
    const style = document.createElement("style")
    style.textContent = pulseKeyframes
    document.head.appendChild(style)
  }, [])

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => buildGraph(currentEdges), [currentEdges])

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)

  useEffect(() => {
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges])

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => {
      instance.fitView()
      setReady(true)
    }, 50)
  }, [])

  const onNodeClick = useCallback((_event: unknown, node: Node) => {
    window.location.href = getContributorHref(node.id)
  }, [])

  const contentResult = useMemo(
    () => ready
      ? Result.success({
          stats,
          sortedEdges,
        })
      : Result.initial<{
          stats: typeof stats
          sortedEdges: typeof sortedEdges
        }>(),
    [ready, sortedEdges, stats],
  )

  return Result.builder(contentResult)
    .onInitial(() => (
      <div>
        <CardsSkeleton />
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Contributor Topology</h3>
            <SkeletonBlock width={100} height={32} />
          </div>
          <GraphSkeleton />
        </div>
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Strongest Connections</h3>
          <TableSkeleton />
        </div>
        {/* Hidden ReactFlow to trigger onInit */}
        <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onInit={onInit}
            fitView
            proOptions={{ hideAttribution: true }}
          />
        </div>
      </div>
    ))
    .onSuccess(({ stats, sortedEdges }) => (
      <div>
        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          <div style={cardStyle}>
            <div style={cardValueStyle}>{stats.contributorCount}</div>
            <div style={cardLabelStyle}>Contributors</div>
          </div>
          <div style={cardStyle}>
            <div style={cardValueStyle}>{stats.connectionCount.toLocaleString()}</div>
            <div style={cardLabelStyle}>Connections</div>
          </div>
          <div style={cardStyle}>
            <div style={{ ...cardValueStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {stats.mostConnected}
            </div>
            <div style={cardLabelStyle}>Most Connected ({stats.maxConnections})</div>
          </div>
        </div>

        {/* Graph section with period selector */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>Contributor Topology</h3>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={selectStyle}
            >
              {periodKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>
          <div style={{ width: "100%", height: "600px", background: "#fafafa", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onInit={onInit}
              fitView
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#e2e8f0" gap={20} />
            </ReactFlow>
          </div>
        </div>

        {/* Strongest connections table */}
        <div style={{ marginBottom: "2rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Strongest Connections</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Contributor 1</th>
                <th style={thStyle}>Contributor 2</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Shared Files</th>
              </tr>
            </thead>
            <tbody>
              {sortedEdges.map((e, i) => (
                <tr key={i}>
                  <td style={emailStyle}>
                    <a href={getContributorHref(e.from)} style={emailLinkStyle}>{e.from}</a>
                  </td>
                  <td style={emailStyle}>
                    <a href={getContributorHref(e.to)} style={emailLinkStyle}>{e.to}</a>
                  </td>
                  <td style={numStyle}>{e.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ))
    .render()
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "1.25rem",
}

const cardValueStyle: React.CSSProperties = {
  fontSize: "1.75rem",
  fontWeight: 700,
  color: "#6366f1",
  lineHeight: 1,
}

const cardLabelStyle: React.CSSProperties = {
  fontSize: "0.8rem",
  color: "#64748b",
  marginTop: "0.35rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
}

const selectStyle: React.CSSProperties = {
  padding: "0.4rem 0.75rem",
  fontSize: "0.85rem",
  border: "1px solid #e2e8f0",
  borderRadius: "6px",
  background: "#fff",
  color: "#1e293b",
  cursor: "pointer",
  outline: "none",
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  overflow: "hidden",
}

const thStyle: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  textAlign: "left",
  borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
  fontSize: "0.7rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#64748b",
}

const tdBase: React.CSSProperties = {
  padding: "0.5rem 0.75rem",
  borderBottom: "1px solid #e2e8f0",
  fontSize: "0.85rem",
}

const emailStyle: React.CSSProperties = {
  ...tdBase,
  fontFamily: '"SF Mono", "Fira Code", monospace',
  fontSize: "0.75rem",
  color: "#64748b",
  maxWidth: "min(300px, 40vw)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

const numStyle: React.CSSProperties = {
  ...tdBase,
  textAlign: "right",
  fontFamily: '"SF Mono", "Fira Code", monospace',
}

const emailLinkStyle: React.CSSProperties = {
  color: "#4f46e5",
  textDecoration: "none",
}
