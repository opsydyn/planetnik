import type { ForceGraphEdge, ForceGraphNode } from "../../lib/forceGraph"
import ForceGraph from "../graphs/ForceGraph"

interface SharedPackage {
  name: string
  ecosystem: string
  severity: string
  affectedRepos: string[]
}

interface SharedPackagesGraphProps {
  packages: SharedPackage[]
  repoHrefMap: Record<string, string>
  helpText?: string
}

// Sigma renders via WebGL — CSS variables won't resolve. Use raw hex colors.
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#eab308",
  low: "#22c55e",
}

const SEVERITY_EDGE_COLORS: Record<string, string> = {
  critical: "rgba(239, 68, 68, 0.40)",
  high: "rgba(245, 158, 11, 0.30)",
  medium: "rgba(234, 179, 8, 0.22)",
  low: "rgba(34, 197, 94, 0.18)",
}

const SEVERITY_PRIORITY: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const REPO_NODE_COLOR = "#818cf8"
const MAX_PACKAGES = 40

export default function SharedPackagesGraph({ packages, repoHrefMap, helpText }: SharedPackagesGraphProps) {
  if (packages.length === 0) return null

  // Filter to the most impactful packages: prioritize by severity, then by repo count
  const ranked = packages
    .slice()
    .sort((a, b) => {
      const sevDiff = (SEVERITY_PRIORITY[b.severity] ?? 0) - (SEVERITY_PRIORITY[a.severity] ?? 0)
      if (sevDiff !== 0) return sevDiff
      return b.affectedRepos.length - a.affectedRepos.length
    })
    .slice(0, MAX_PACKAGES)

  const repoSet = new Set<string>()
  for (const pkg of ranked) {
    for (const repo of pkg.affectedRepos) {
      repoSet.add(repo)
    }
  }

  const nodes: ForceGraphNode[] = []
  const edges: ForceGraphEdge[] = []

  // Package nodes — small colored dots by severity
  for (const pkg of ranked) {
    const color = SEVERITY_COLORS[pkg.severity] ?? "#94a3b8"
    nodes.push({
      id: `pkg:${pkg.name}`,
      label: pkg.name,
      meta: `${pkg.ecosystem} • ${pkg.severity} • ${pkg.affectedRepos.length} repos`,
      size: Math.min(3 + pkg.affectedRepos.length * 0.3, 7),
      color,
    })
  }

  // Repo nodes — indigo, slightly larger
  for (const repo of repoSet) {
    const repoPackageCount = ranked.filter((p) => p.affectedRepos.includes(repo)).length
    nodes.push({
      id: `repo:${repo}`,
      label: repo,
      meta: `${repoPackageCount} shared vulnerable package${repoPackageCount !== 1 ? "s" : ""}`,
      size: Math.min(5 + Math.log2(repoPackageCount + 1) * 2, 12),
      color: REPO_NODE_COLOR,
      href: repoHrefMap[repo],
    })
  }

  // Edges: package → repo
  for (const pkg of ranked) {
    const color = SEVERITY_EDGE_COLORS[pkg.severity] ?? "rgba(148, 163, 184, 0.2)"
    for (const repo of pkg.affectedRepos) {
      edges.push({
        id: `${pkg.name}->${repo}`,
        source: `pkg:${pkg.name}`,
        target: `repo:${repo}`,
        weight: 1,
        size: 0.5,
        color,
        label: `${pkg.name} (${pkg.severity})`,
      })
    }
  }

  const omitted = packages.length - ranked.length
  const footer = omitted > 0
    ? `Top ${ranked.length} packages across ${repoSet.size} repos (${omitted} lower-severity omitted)`
    : `${ranked.length} packages shared across ${repoSet.size} repositories`

  return (
    <ForceGraph
      nodes={nodes}
      edges={edges}
      height={520}
      helpText={helpText}
      emptyMessage="No shared vulnerable packages found."
      footerNote={footer}
    />
  )
}
