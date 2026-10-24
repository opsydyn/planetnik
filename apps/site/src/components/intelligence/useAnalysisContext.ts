import { useCopilotReadable } from "@copilotkit/react-core"

export interface AnalysisSummary {
  name: string
  description?: string
  filesCount: number
  linesOfCode: number
  duplication?: {
    percentage: number
    cleanedLinesOfCode: number
    duplicatedLinesOfCode: number
  }
}

export interface HotspotItem {
  name: string
  kind: string
  score: number
  severity: string
  dominantDimension: string
  suggestedAction?: string
  reasons: string[]
}

export interface ImpactSummary {
  overall_score: number
  dominant_dimension: string
  dimensions: Record<string, number>
  opportunities: Array<{
    name: string
    kind: string
    impact_score: number
    dominant_dimension: string
    suggested_action: string
  }>
}

export interface ContributorItem {
  email: string
  commitsAllTime: number
  commits30Days: number
  commits90Days: number
  firstCommit?: string
  lastCommit?: string
}

export interface ControlItem {
  goal: string
  metricId: string
  metricValue: number
  desiredRange: string
  status: string
}

export interface SecuritySummary {
  totalAlerts: number
  totalOpenAlerts: number
  reposWithAlerts: number
  totalRepos: number
  severityCounts: {
    critical: number
    high: number
    medium: number
    low: number
  }
  meanTimeToResolveDays: number | null
  supplyChainExposureScore: number
  sharedVulnerablePackages: Array<{
    name: string
    ecosystem: string
    severity: string
    affectedRepos: string[]
  }>
  repoHealth: Array<{
    repo: string
    openAlerts: number
    critical: number
    high: number
  }>
}

export interface AnalysisContextProps {
  analysisData: AnalysisSummary | null
  hotspotsData: HotspotItem[] | null
  impactData: ImpactSummary | null
  contributorsData: ContributorItem[] | null
  controlsData: ControlItem[] | null
  securityData: SecuritySummary | null
}

export function useAnalysisContext({
  analysisData,
  hotspotsData,
  impactData,
  contributorsData,
  controlsData,
  securityData,
}: AnalysisContextProps) {
  useCopilotReadable({
    description:
      "Project analysis summary: name, total lines of code, file count, and duplication statistics. Use this to answer general questions about the project size and health.",
    value: analysisData,
  })

  useCopilotReadable({
    description:
      "Top code hotspots ranked by structural risk. Each hotspot has a score, severity, dominant risk dimension (structuralRisk, changePressure, coordinationCost, knowledgeRisk), suggested action, and reasons. Use this to identify the riskiest areas of the codebase.",
    value: hotspotsData,
  })

  useCopilotReadable({
    description:
      "Structural impact analysis with overall score, dimension scores (complexity_reduction, boundary_shaping, knowledge_spread, coordination_relief, change_enablement), and top opportunities for high-leverage work. Use this to advise on where engineering effort has the most architectural value.",
    value: impactData,
  })

  useCopilotReadable({
    description:
      "Contributors list with commit counts across time windows (all-time, 30 days, 90 days) and first/last commit dates. Use this to understand team composition, activity patterns, and knowledge distribution.",
    value: contributorsData,
  })

  useCopilotReadable({
    description:
      "Quality goals and controls with metric values, desired ranges, and pass/fail status. Use this to assess whether the project is meeting its quality targets.",
    value: controlsData,
  })

  useCopilotReadable({
    description:
      "Dependency security summary from Dependabot: total and open vulnerability alerts, severity breakdown (critical/high/medium/low), repos with alerts, mean time to resolve, supply chain exposure score (0-1), shared vulnerable packages across repos, and per-repo alert counts. Use this to answer questions about dependency vulnerabilities, security posture, and supply chain risk.",
    value: securityData,
  })
}
