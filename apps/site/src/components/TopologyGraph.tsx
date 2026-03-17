import dagre from "@dagrejs/dagre"
import { Background, type Edge, type Node, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useCallback, useEffect, useMemo, useState } from "react"

interface PeopleDep {
  from: string
  to: string
  count: number
  files: string[]
}

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

function computeStats(edges: PeopleDep[]) {
  const contributorSet = new Set<string>()
  const connectionCounts = new Map<string, number>()
  for (const e of edges) {
    contributorSet.add(e.from)
    contributorSet.add(e.to)
    connectionCounts.set(e.from, (connectionCounts.get(e.from) ?? 0) + 1)
    connectionCounts.set(e.to, (connectionCounts.get(e.to) ?? 0) + 1)
  }

  let mostConnected = ""
  let maxConnections = 0
  for (const [email, count] of connectionCounts) {
    if (count > maxConnections) {
      mostConnected = email
      maxConnections = count
    }
  }

  return {
    contributorCount: contributorSet.size,
    connectionCount: edges.length,
    mostConnected: mostConnected.split("@")[0],
    maxConnections,
  }
}

export default function TopologyGraph({ periods }: TopologyGraphProps) {
  const periodKeys = Object.keys(periods)
  const [selectedPeriod, setSelectedPeriod] = useState(periodKeys[0] ?? "All Time")

  const currentEdges = periods[selectedPeriod] ?? []
  const stats = useMemo(() => computeStats(currentEdges), [currentEdges])
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => buildGraph(currentEdges), [currentEdges])

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges)

  useEffect(() => {
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges])

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 50)
  }, [])

  const sortedEdges = useMemo(
    () => [...currentEdges].sort((a, b) => b.count - a.count).slice(0, 30),
    [currentEdges],
  )

  return (
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
                <td style={emailStyle}>{e.from}</td>
                <td style={emailStyle}>{e.to}</td>
                <td style={numStyle}>{e.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
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
