import { normalizeTemporalCommit, type TemporalCommitValue } from "../temporal/temporalCommit.js"
import { map, minMax } from "../utils/arrayMath.js"
import { getContributorDisplayName } from "./contributors"

export interface ForceGraphNode {
  id: string
  label: string
  meta?: string
  size: number
  color: string
  href?: string
}

export interface ForceGraphEdge {
  id: string
  source: string
  target: string
  weight: number
  size: number
  color: string
  label: string
  meta?: string
}

export interface ForceGraphData {
  nodes: ForceGraphNode[]
  edges: ForceGraphEdge[]
}

export interface ContributorDependencyRow {
  from: string
  to: string
  count: number
  files: string[]
}

export interface TemporalDependencyRow {
  periodKey: string
  periodLabel: string
  periodDays: number
  file1: string
  file2: string
  sameCommits: number
  commitsFile1: number
  commitsFile2: number
  latestCommit: TemporalCommitValue
}

function interpolateChannel(start: number, end: number, intensity: number): number {
  return Math.round(start + (end - start) * intensity)
}

function interpolateColor(start: [number, number, number], end: [number, number, number], intensity: number): string {
  return `rgb(${interpolateChannel(start[0], end[0], intensity)}, ${interpolateChannel(start[1], end[1], intensity)}, ${interpolateChannel(start[2], end[2], intensity)})`
}

function interpolateAlpha(start: number, end: number, intensity: number): number {
  return Math.round((start + (end - start) * intensity) * 100) / 100
}

function rgba(red: number, green: number, blue: number, alpha: number): string {
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function scaleRange(value: number, min: number, max: number, outputMin: number, outputMax: number): number {
  if (max <= min) return (outputMin + outputMax) / 2
  const normalized = (value - min) / (max - min)
  return outputMin + normalized * (outputMax - outputMin)
}

function buildPairKey(left: string, right: string): string {
  return [left, right].sort((a, b) => a.localeCompare(b)).join("::")
}

function getContributorLabel(email: string): string {
  const label = getContributorDisplayName({ email })
  return label.length > 18 ? `${label.slice(0, 15)}...` : label
}

export function shortForceGraphPath(path: string): string {
  const parts = path.split("/")
  return parts.length > 2 ? `.../${parts.slice(-2).join("/")}` : path
}

export function buildContributorForceGraph(
  rows: ContributorDependencyRow[],
  options?: {
    getContributorHref?: (email: string) => string
  },
): ForceGraphData {
  const nodeWeights = new Map<string, number>()
  const aggregatedEdges = new Map<
    string,
    {
      source: string
      target: string
      weight: number
    }
  >()

  for (const row of rows) {
    if (!row.from || !row.to || row.count <= 0) continue

    nodeWeights.set(row.from, (nodeWeights.get(row.from) ?? 0) + row.count)
    nodeWeights.set(row.to, (nodeWeights.get(row.to) ?? 0) + row.count)

    const edgeKey = buildPairKey(row.from, row.to)
    const existingEdge = aggregatedEdges.get(edgeKey)
    if (existingEdge) {
      existingEdge.weight += row.count
    } else {
      aggregatedEdges.set(edgeKey, {
        source: row.from,
        target: row.to,
        weight: row.count,
      })
    }
  }

  const nodeStats = minMax(nodeWeights.values())
  const maxNodeWeight = Math.max(nodeStats.max, 1)
  const minNodeWeight = Math.min(nodeStats.min, maxNodeWeight)

  const edgeStats = minMax(map(aggregatedEdges.values(), (edge) => edge.weight))
  const maxEdgeWeight = Math.max(edgeStats.max, 1)
  const minEdgeWeight = Math.min(edgeStats.min, maxEdgeWeight)

  const nodes = [...nodeWeights.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([id, weight]) => {
      const intensity = maxNodeWeight <= 0 ? 0 : weight / maxNodeWeight
      const node: ForceGraphNode = {
        id,
        label: getContributorLabel(id),
        meta: id,
        size: Math.round(scaleRange(weight, minNodeWeight, maxNodeWeight, 9, 18) * 10) / 10,
        color: interpolateColor([165, 180, 252], [67, 56, 202], intensity),
      }
      if (options?.getContributorHref) {
        node.href = options.getContributorHref(id)
      }
      return node
    })

  const edges = [...aggregatedEdges.values()]
    .sort((left, right) => {
      if (left.weight !== right.weight) return right.weight - left.weight
      return buildPairKey(left.source, left.target).localeCompare(buildPairKey(right.source, right.target))
    })
    .map((edge) => {
      const intensity =
        maxEdgeWeight <= minEdgeWeight ? 0.65 : (edge.weight - minEdgeWeight) / (maxEdgeWeight - minEdgeWeight)

      return {
        id: buildPairKey(edge.source, edge.target),
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        size: Math.round(scaleRange(edge.weight, minEdgeWeight, maxEdgeWeight, 1, 6) * 10) / 10,
        color: rgba(79, 70, 229, interpolateAlpha(0.28, 0.64, intensity)),
        label: `${edge.weight} shared files`,
        meta: `${edge.source} ↔ ${edge.target}`,
      }
    })

  return { nodes, edges }
}

export function buildTemporalForceGraph(rows: TemporalDependencyRow[]): ForceGraphData {
  const nodeWeights = new Map<string, number>()
  const aggregatedEdges = new Map<
    string,
    {
      source: string
      target: string
      weight: number
      latestCommit: string
    }
  >()

  for (const row of rows) {
    if (!row.file1 || !row.file2 || row.sameCommits <= 0) continue

    nodeWeights.set(row.file1, (nodeWeights.get(row.file1) ?? 0) + row.sameCommits)
    nodeWeights.set(row.file2, (nodeWeights.get(row.file2) ?? 0) + row.sameCommits)

    const edgeKey = buildPairKey(row.file1, row.file2)
    const existingEdge = aggregatedEdges.get(edgeKey)
    const latestCommit = normalizeTemporalCommit(row.latestCommit)
    if (existingEdge) {
      existingEdge.weight += row.sameCommits
      if (latestCommit > existingEdge.latestCommit) {
        existingEdge.latestCommit = latestCommit
      }
    } else {
      aggregatedEdges.set(edgeKey, {
        source: row.file1,
        target: row.file2,
        weight: row.sameCommits,
        latestCommit,
      })
    }
  }

  const nodeStats = minMax(nodeWeights.values())
  const maxNodeWeight = Math.max(nodeStats.max, 1)
  const minNodeWeight = Math.min(nodeStats.min, maxNodeWeight)

  const edgeStats = minMax(map(aggregatedEdges.values(), (edge) => edge.weight))
  const maxEdgeWeight = Math.max(edgeStats.max, 1)
  const minEdgeWeight = Math.min(edgeStats.min, maxEdgeWeight)

  const nodes = [...nodeWeights.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([id, weight]) => {
      const intensity = maxNodeWeight <= 0 ? 0 : weight / maxNodeWeight
      return {
        id,
        label: shortForceGraphPath(id),
        meta: id,
        size: Math.round(scaleRange(weight, minNodeWeight, maxNodeWeight, 8, 16) * 10) / 10,
        color: interpolateColor([191, 219, 254], [124, 58, 237], intensity),
      }
    })

  const edges = [...aggregatedEdges.values()]
    .sort((left, right) => {
      if (left.weight !== right.weight) return right.weight - left.weight
      return buildPairKey(left.source, left.target).localeCompare(buildPairKey(right.source, right.target))
    })
    .map((edge) => {
      const intensity =
        maxEdgeWeight <= minEdgeWeight ? 0.65 : (edge.weight - minEdgeWeight) / (maxEdgeWeight - minEdgeWeight)

      return {
        id: buildPairKey(edge.source, edge.target),
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        size: Math.round(scaleRange(edge.weight, minEdgeWeight, maxEdgeWeight, 1, 5) * 10) / 10,
        color: rgba(88, 28, 135, interpolateAlpha(0.22, 0.54, intensity)),
        label: `${edge.weight} shared commits`,
        meta: `Latest commit ${edge.latestCommit || "—"}`,
      }
    })

  return { nodes, edges }
}
