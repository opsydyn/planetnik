import {
  type Contributor,
  type FileEntry,
  getContributors,
  getControls,
  getFiles,
  getHotspots,
  getImpact,
  getSecurityData,
  getSummary,
} from "./data"

/**
 * Server-side CopilotKit actions that give Płanetnik direct access
 * to the full analysis dataset on disk.
 */
export function createAnalysisActions() {
  return [
    {
      name: "getSummary",
      description:
        "Get the project analysis summary including name, description, total lines of code, file count, and duplication statistics. Call this first to orient yourself about the project.",
      parameters: [],
      handler: async () => {
        const summary = getSummary()
        if (!summary) return JSON.stringify({ error: "No analysis data found" })
        return JSON.stringify(summary)
      },
    },
    {
      name: "queryHotspots",
      description:
        "Query structural hotspots — files, units, or components ranked by risk score. Each hotspot has dimensions (structuralRisk, changePressure, coordinationCost, knowledgeRisk), severity, suggested actions, and reasons. You can filter by kind, severity, minimum score, or name pattern. Returns up to `limit` results sorted by score descending.",
      parameters: [
        {
          name: "kind",
          type: "string" as const,
          description: "Filter by hotspot kind: 'file', 'unit', or 'component'. Omit for all kinds.",
          required: false,
        },
        {
          name: "severity",
          type: "string" as const,
          description: "Filter by severity: 'Critical', 'High', 'Medium', 'Low'. Omit for all severities.",
          required: false,
        },
        {
          name: "minScore",
          type: "number" as const,
          description: "Minimum risk score (0-100). Defaults to 0.",
          required: false,
        },
        {
          name: "namePattern",
          type: "string" as const,
          description:
            "Case-insensitive substring match on the hotspot name or parent. Use to find hotspots in a specific file, directory, or component.",
          required: false,
        },
        {
          name: "dimension",
          type: "string" as const,
          description:
            "Sort by a specific dimension score instead of overall score: 'structuralRisk', 'changePressure', 'coordinationCost', or 'knowledgeRisk'.",
          required: false,
        },
        {
          name: "limit",
          type: "number" as const,
          description: "Maximum number of results to return. Defaults to 25.",
          required: false,
        },
      ],
      handler: async (args: {
        kind?: string
        severity?: string
        minScore?: number
        namePattern?: string
        dimension?: string
        limit?: number
      }) => {
        let hotspots = getHotspots()
        const minScore = args.minScore ?? 0
        const limit = args.limit ?? 25

        if (args.kind) {
          hotspots = hotspots.filter((h) => h.kind === args.kind)
        }
        if (args.severity) {
          hotspots = hotspots.filter((h) => h.severity === args.severity)
        }
        if (minScore > 0) {
          hotspots = hotspots.filter((h) => h.score >= minScore)
        }
        if (args.namePattern) {
          const pattern = args.namePattern.toLowerCase()
          hotspots = hotspots.filter(
            (h) => h.name.toLowerCase().includes(pattern) || h.parent.toLowerCase().includes(pattern),
          )
        }

        if (args.dimension && args.dimension in (hotspots[0]?.dimensions ?? {})) {
          hotspots.sort((a, b) => (b.dimensions[args.dimension!] ?? 0) - (a.dimensions[args.dimension!] ?? 0))
        } else {
          hotspots.sort((a, b) => b.score - a.score)
        }

        const results = hotspots.slice(0, limit)
        return JSON.stringify({ total: hotspots.length, returned: results.length, hotspots: results })
      },
    },
    {
      name: "queryFiles",
      description:
        "Query source files with their metrics: lines of code, commit count, contributor count, age, and recency. Filter by path pattern, extension, size thresholds, or contributor. Returns up to `limit` results.",
      parameters: [
        {
          name: "pathPattern",
          type: "string" as const,
          description: "Case-insensitive substring match on the file path.",
          required: false,
        },
        {
          name: "extension",
          type: "string" as const,
          description: "Filter by file extension (e.g. 'ts', 'tsx', 'java').",
          required: false,
        },
        {
          name: "minLinesOfCode",
          type: "number" as const,
          description: "Minimum lines of code.",
          required: false,
        },
        {
          name: "minCommits",
          type: "number" as const,
          description: "Minimum number of commits (churn filter).",
          required: false,
        },
        {
          name: "contributor",
          type: "string" as const,
          description: "Case-insensitive substring match on contributor email. Returns files this person touched.",
          required: false,
        },
        {
          name: "sortBy",
          type: "string" as const,
          description:
            "Sort field: 'linesOfCode', 'commitsCount', 'contributorsCount', 'daysSinceLatestUpdate'. Defaults to 'linesOfCode'.",
          required: false,
        },
        {
          name: "limit",
          type: "number" as const,
          description: "Maximum number of results. Defaults to 25.",
          required: false,
        },
      ],
      handler: async (args: {
        pathPattern?: string
        extension?: string
        minLinesOfCode?: number
        minCommits?: number
        contributor?: string
        sortBy?: string
        limit?: number
      }) => {
        let files = getFiles()
        const limit = args.limit ?? 25

        if (args.pathPattern) {
          const pattern = args.pathPattern.toLowerCase()
          files = files.filter((f) => f.relativePath.toLowerCase().includes(pattern))
        }
        if (args.extension) {
          files = files.filter((f) => f.extension === args.extension)
        }
        if (args.minLinesOfCode && args.minLinesOfCode > 0) {
          files = files.filter((f) => f.linesOfCode >= args.minLinesOfCode!)
        }
        if (args.minCommits && args.minCommits > 0) {
          files = files.filter((f) => f.commitsCount >= args.minCommits!)
        }
        if (args.contributor) {
          const pattern = args.contributor.toLowerCase()
          files = files.filter((f) => f.contributors.some((c) => c.toLowerCase().includes(pattern)))
        }

        const sortField = (args.sortBy ?? "linesOfCode") as keyof FileEntry
        files.sort((a, b) => (Number(b[sortField]) || 0) - (Number(a[sortField]) || 0))

        const results = files.slice(0, limit)
        return JSON.stringify({ total: files.length, returned: results.length, files: results })
      },
    },
    {
      name: "queryContributors",
      description:
        "Query contributors with commit counts across time windows, first/last commit dates, and activity status. Filter by name or email pattern, activity level, or rookie status.",
      parameters: [
        {
          name: "namePattern",
          type: "string" as const,
          description: "Case-insensitive substring match on contributor email or user name.",
          required: false,
        },
        {
          name: "activeOnly",
          type: "boolean" as const,
          description: "If true, only return active contributors (committed in last 30 days).",
          required: false,
        },
        {
          name: "sortBy",
          type: "string" as const,
          description: "Sort field: 'commitsAllTime', 'commits30Days', 'commits90Days'. Defaults to 'commitsAllTime'.",
          required: false,
        },
        {
          name: "limit",
          type: "number" as const,
          description: "Maximum number of results. Defaults to 30.",
          required: false,
        },
      ],
      handler: async (args: { namePattern?: string; activeOnly?: boolean; sortBy?: string; limit?: number }) => {
        let contributors = getContributors()
        const limit = args.limit ?? 30

        if (args.namePattern) {
          const pattern = args.namePattern.toLowerCase()
          contributors = contributors.filter(
            (c) => c.email.toLowerCase().includes(pattern) || c.userName.toLowerCase().includes(pattern),
          )
        }
        if (args.activeOnly) {
          contributors = contributors.filter((c) => c.commits30Days > 0)
        }

        const sortField = (args.sortBy ?? "commitsAllTime") as keyof Contributor
        contributors.sort((a, b) => (Number(b[sortField]) || 0) - (Number(a[sortField]) || 0))

        const results = contributors.slice(0, limit)
        return JSON.stringify({ total: contributors.length, returned: results.length, contributors: results })
      },
    },
    {
      name: "getImpactAnalysis",
      description:
        "Get the structural impact analysis: overall score, dimension scores (complexity_reduction, boundary_shaping, knowledge_spread, coordination_relief, change_enablement), and top improvement opportunities ranked by impact score.",
      parameters: [
        {
          name: "topOpportunities",
          type: "number" as const,
          description: "Number of top opportunities to return. Defaults to 20.",
          required: false,
        },
      ],
      handler: async (args: { topOpportunities?: number }) => {
        const impact = getImpact()
        if (!impact) return JSON.stringify({ error: "No impact data found" })
        const top = args.topOpportunities ?? 20
        return JSON.stringify({
          overallScore: impact.overallScore,
          dominantDimension: impact.dominantDimension,
          dimensions: impact.dimensions,
          totalOpportunities: impact.opportunities.length,
          opportunities: impact.opportunities.slice(0, top),
        })
      },
    },
    {
      name: "getControls",
      description:
        "Get quality goals and controls with current metric values, desired ranges, and pass/fail status. Use this to check whether the project is meeting its quality targets.",
      parameters: [],
      handler: async () => {
        const controls = getControls()
        if (controls.length === 0) return JSON.stringify({ error: "No controls data found" })
        const failing = controls.filter((c) => c.status !== "OK")
        return JSON.stringify({
          total: controls.length,
          passing: controls.length - failing.length,
          failing: failing.length,
          controls,
        })
      },
    },
    {
      name: "querySecurityData",
      description:
        "Query dependency security data from Dependabot alerts. Returns vulnerability counts by severity, supply chain exposure score, shared vulnerable packages, and per-repo security health. Filter by severity, repo name, or focus on shared/supply-chain risks.",
      parameters: [
        {
          name: "severity",
          type: "string" as const,
          description: "Filter repos by minimum severity: 'critical', 'high', 'medium', 'low'. Omit for all.",
          required: false,
        },
        {
          name: "repoPattern",
          type: "string" as const,
          description: "Case-insensitive substring match on repository name.",
          required: false,
        },
        {
          name: "sharedOnly",
          type: "boolean" as const,
          description: "If true, return only shared vulnerable packages (supply chain risk focus).",
          required: false,
        },
        {
          name: "limit",
          type: "number" as const,
          description: "Maximum number of repos or packages to return. Defaults to 20.",
          required: false,
        },
      ],
      handler: async (args: { severity?: string; repoPattern?: string; sharedOnly?: boolean; limit?: number }) => {
        const data = getSecurityData()
        if (!data)
          return JSON.stringify({
            error: "No security data found. Ensure landscape analysis was run with security enabled.",
          })

        const limit = args.limit ?? 20

        if (args.sharedOnly) {
          let packages = data.sharedVulnerablePackages
          if (args.severity) {
            packages = packages.filter((p) => p.severity === args.severity)
          }
          return JSON.stringify({
            totalSharedPackages: data.sharedVulnerablePackages.length,
            returned: Math.min(packages.length, limit),
            packages: packages.slice(0, limit),
          })
        }

        const severityPriority: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
        let repos = data.repoHealth

        if (args.repoPattern) {
          const pattern = args.repoPattern.toLowerCase()
          repos = repos.filter((r) => r.repo.toLowerCase().includes(pattern))
        }
        if (args.severity) {
          const minPriority = severityPriority[args.severity] ?? 0
          repos = repos.filter((r) => {
            if (minPriority >= 4 && r.severityCounts.critical > 0) return true
            if (minPriority >= 3 && (r.severityCounts.critical > 0 || r.severityCounts.high > 0)) return true
            if (
              minPriority >= 2 &&
              (r.severityCounts.critical > 0 || r.severityCounts.high > 0 || r.severityCounts.medium > 0)
            )
              return true
            return r.openAlerts > 0
          })
        }

        repos.sort((a, b) => b.openAlerts - a.openAlerts)
        const results = repos.slice(0, limit)

        return JSON.stringify({
          summary: {
            totalAlerts: data.totalAlerts,
            totalOpenAlerts: data.totalOpenAlerts,
            reposWithAlerts: data.reposWithAlerts,
            totalRepos: data.totalRepos,
            severityCounts: data.severityCounts,
            meanTimeToResolveDays: data.meanTimeToResolveDays,
            supplyChainExposureScore: data.supplyChainExposureScore,
            sharedVulnerablePackagesCount: data.sharedVulnerablePackages.length,
          },
          totalMatchingRepos: repos.length,
          returned: results.length,
          repos: results,
        })
      },
    },
  ]
}
