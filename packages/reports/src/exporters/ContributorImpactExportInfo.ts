import type { CodeAnalysisResults, ComponentDependency, SourceFile } from "@planetnik/analyzer"
import { Contributor } from "@planetnik/analyzer"
import type { ImpactDimensionKey, ImpactSourceHotspot } from "./ImpactExportInfo.js"

export interface ContributorImpactTopComponentExportInfo {
  name: string
  files: number
  commits: number
}

export interface ContributorImpactContributorExportInfo {
  email: string
  display_name: string
  glue_score: number
  snacking_score: number
  structural_impact_score: number
  visible_activity_score: number
  collaborator_count: number
  shared_files_count: number
  commits_count: number
  files_touched: number
  components_touched: number
  dominant_dimension: ImpactDimensionKey
  dimensions: Record<ImpactDimensionKey, number>
  top_components: ContributorImpactTopComponentExportInfo[]
  top_routes: string[]
  reasons: string[]
  is_glue: boolean
  is_snacking: boolean
}

export interface ContributorImpactPeriodExportInfo {
  period_key: "all_time" | "30d" | "90d" | "180d" | "365d"
  period_label: string
  contributors: ContributorImpactContributorExportInfo[]
}

export interface ContributorImpactExportInfo {
  title: string
  timestamp: string
  periods: ContributorImpactPeriodExportInfo[]
}

const DIMENSIONS: ImpactDimensionKey[] = [
  "complexity_reduction",
  "boundary_shaping",
  "knowledge_spread",
  "coordination_relief",
  "change_enablement",
]

const PERIODS: Array<{
  key: ContributorImpactPeriodExportInfo["period_key"]
  label: string
  days: number | null
  getDependencies: (results: CodeAnalysisResults) => ComponentDependency[]
}> = [
  {
    key: "all_time",
    label: "All Time",
    days: null,
    getDependencies: (results) => results.contributorsAnalysisResults.peopleDependenciesAllTime,
  },
  {
    key: "30d",
    label: "Past 30 Days",
    days: 30,
    getDependencies: (results) => results.contributorsAnalysisResults.peopleDependencies30Days,
  },
  {
    key: "90d",
    label: "Past 3 Months",
    days: 90,
    getDependencies: (results) => results.contributorsAnalysisResults.peopleDependencies90Days,
  },
  {
    key: "180d",
    label: "Past 6 Months",
    days: 180,
    getDependencies: (results) => results.contributorsAnalysisResults.peopleDependencies180Days,
  },
  {
    key: "365d",
    label: "Past 12 Months",
    days: 365,
    getDependencies: (results) => results.contributorsAnalysisResults.peopleDependencies365Days,
  },
]

interface ContributorPeriodState {
  contributor: Contributor
  commitIds: Set<string>
  files: Set<string>
  components: Map<string, { files: Set<string>; commitIds: Set<string> }>
  collaborators: Map<string, number>
}

export class ContributorImpactExporter {
  static exportContributorImpact(
    analysisResults: CodeAnalysisResults,
    hotspots: {
      fileHotspots: ImpactSourceHotspot[]
      unitHotspots: ImpactSourceHotspot[]
      componentHotspots: ImpactSourceHotspot[]
    },
    timestamp: string,
  ): ContributorImpactExportInfo {
    const sourceFiles = ContributorImpactExporter.getAllSourceFiles(analysisResults)
    const contributorMap = new Map(
      analysisResults.contributorsAnalysisResults.contributors.map((contributor) => [contributor.email, contributor]),
    )
    const fileHotspots = new Map(
      hotspots.fileHotspots
        .filter((hotspot) => hotspot.kind === "file")
        .map((hotspot) => [hotspot.name, hotspot] as const),
    )
    const componentHotspots = new Map(
      hotspots.componentHotspots
        .filter((hotspot) => hotspot.kind === "component")
        .map((hotspot) => [hotspot.name, hotspot] as const),
    )

    return {
      title: "Contributor Impact",
      timestamp,
      periods: PERIODS.map((period) =>
        ContributorImpactExporter.buildPeriodExport(
          analysisResults,
          sourceFiles,
          contributorMap,
          fileHotspots,
          componentHotspots,
          timestamp,
          period,
        ),
      ),
    }
  }

  private static buildPeriodExport(
    analysisResults: CodeAnalysisResults,
    sourceFiles: SourceFile[],
    contributorMap: Map<string, Contributor>,
    fileHotspots: Map<string, ImpactSourceHotspot>,
    componentHotspots: Map<string, ImpactSourceHotspot>,
    timestamp: string,
    period: (typeof PERIODS)[number],
  ): ContributorImpactPeriodExportInfo {
    const stateByEmail = new Map<string, ContributorPeriodState>()

    const ensureState = (email: string): ContributorPeriodState => {
      const existing = stateByEmail.get(email)
      if (existing) return existing

      const contributor = contributorMap.get(email) ?? new Contributor(email)
      const created: ContributorPeriodState = {
        contributor,
        commitIds: new Set<string>(),
        files: new Set<string>(),
        components: new Map<string, { files: Set<string>; commitIds: Set<string> }>(),
        collaborators: new Map<string, number>(),
      }
      stateByEmail.set(email, created)
      return created
    }

    for (const contributor of contributorMap.values()) {
      ensureState(contributor.email)
    }

    for (const file of sourceFiles) {
      const commits = file.fileModificationHistory?.commits ?? []
      for (const [index, commit] of commits.entries()) {
        if (!commit.email || !ContributorImpactExporter.isCommitInPeriod(commit.date, period.days, timestamp)) {
          continue
        }

        const state = ensureState(commit.email)
        const commitId = ContributorImpactExporter.getCommitId(
          commit.id,
          commit.date,
          file.relativePath,
          commit.email,
          index,
        )
        state.commitIds.add(commitId)
        state.files.add(file.relativePath)

        for (const component of file.logicalComponents) {
          const componentState = state.components.get(component.name) ?? {
            files: new Set<string>(),
            commitIds: new Set<string>(),
          }
          componentState.files.add(file.relativePath)
          componentState.commitIds.add(commitId)
          state.components.set(component.name, componentState)
        }
      }
    }

    for (const dependency of period.getDependencies(analysisResults)) {
      const fromState = ensureState(dependency.fromComponent)
      const toState = ensureState(dependency.toComponent)
      fromState.collaborators.set(
        dependency.toComponent,
        (fromState.collaborators.get(dependency.toComponent) ?? 0) + dependency.count,
      )
      toState.collaborators.set(
        dependency.fromComponent,
        (toState.collaborators.get(dependency.fromComponent) ?? 0) + dependency.count,
      )
    }

    const contributors = Array.from(stateByEmail.values())
      .map((state) => ContributorImpactExporter.toContributorExport(state, fileHotspots, componentHotspots))
      .filter(
        (contributor) =>
          contributor.commits_count > 0 || contributor.collaborator_count > 0 || contributor.shared_files_count > 0,
      )
      .sort((left, right) => {
        const leftPriority = Math.max(left.glue_score, left.snacking_score, left.structural_impact_score)
        const rightPriority = Math.max(right.glue_score, right.snacking_score, right.structural_impact_score)
        if (leftPriority !== rightPriority) return rightPriority - leftPriority
        return left.email.localeCompare(right.email)
      })

    return {
      period_key: period.key,
      period_label: period.label,
      contributors,
    }
  }

  private static toContributorExport(
    state: ContributorPeriodState,
    fileHotspots: Map<string, ImpactSourceHotspot>,
    componentHotspots: Map<string, ImpactSourceHotspot>,
  ): ContributorImpactContributorExportInfo {
    const collaboratorCount = state.collaborators.size
    const sharedFilesCount = Array.from(state.collaborators.values()).reduce((sum, count) => sum + count, 0)
    const filesTouched = state.files.size
    const componentsTouched = state.components.size
    const commitsCount = state.commitIds.size

    const dimensionTotals = ContributorImpactExporter.emptyDimensions()
    let weightedSignalCount = 0

    for (const filePath of state.files) {
      const hotspot = fileHotspots.get(filePath)
      if (!hotspot) continue
      ContributorImpactExporter.addDimensions(
        dimensionTotals,
        ContributorImpactExporter.mapHotspotDimensions(hotspot),
        1,
      )
      weightedSignalCount += 1
    }

    for (const componentName of state.components.keys()) {
      const hotspot = componentHotspots.get(componentName)
      if (!hotspot) continue
      ContributorImpactExporter.addDimensions(
        dimensionTotals,
        ContributorImpactExporter.mapHotspotDimensions(hotspot),
        0.7,
      )
      weightedSignalCount += 0.7
    }

    const dimensions =
      weightedSignalCount > 0
        ? ContributorImpactExporter.normalizeDimensions(dimensionTotals, weightedSignalCount)
        : ContributorImpactExporter.emptyDimensions()

    dimensions.boundary_shaping = ContributorImpactExporter.clamp(
      dimensions.boundary_shaping + ContributorImpactExporter.scaledScore(Math.max(componentsTouched - 1, 0), 3, 20),
    )
    dimensions.knowledge_spread = ContributorImpactExporter.clamp(
      dimensions.knowledge_spread +
        ContributorImpactExporter.scaledScore(componentsTouched, 4, 15) +
        ContributorImpactExporter.scaledScore(collaboratorCount, 6, 15),
    )
    dimensions.coordination_relief = ContributorImpactExporter.clamp(
      dimensions.coordination_relief +
        ContributorImpactExporter.scaledScore(collaboratorCount, 6, 25) +
        ContributorImpactExporter.scaledScore(sharedFilesCount, 15, 20),
    )
    dimensions.change_enablement = ContributorImpactExporter.clamp(
      dimensions.change_enablement +
        ContributorImpactExporter.scaledScore(filesTouched, 6, 20) +
        ContributorImpactExporter.scaledScore(commitsCount, 18, 15),
    )

    const structuralImpactScore = ContributorImpactExporter.roundScore(
      dimensions.complexity_reduction * 0.22 +
        dimensions.boundary_shaping * 0.2 +
        dimensions.knowledge_spread * 0.2 +
        dimensions.coordination_relief * 0.18 +
        dimensions.change_enablement * 0.2,
    )

    const visibleActivityScore = ContributorImpactExporter.clamp(
      ContributorImpactExporter.scaledScore(commitsCount, 12, 70) +
        ContributorImpactExporter.scaledScore(filesTouched, 6, 30),
    )

    const topologyScore = ContributorImpactExporter.clamp(
      ContributorImpactExporter.scaledScore(collaboratorCount, 2, 45) +
        ContributorImpactExporter.scaledScore(sharedFilesCount, 5, 55),
    )

    const glueScore = ContributorImpactExporter.clamp(
      topologyScore * 0.5 +
        ContributorImpactExporter.scaledScore(componentsTouched, 3, 100) * 0.2 +
        dimensions.coordination_relief * 0.15 +
        dimensions.knowledge_spread * 0.15,
    )

    const lowBreadthPenalty = componentsTouched <= 1 ? 20 : componentsTouched === 2 ? 8 : 0
    const lowCollaboratorPenalty = collaboratorCount === 0 ? 20 : collaboratorCount === 1 ? 8 : 0
    const snackingScore = ContributorImpactExporter.clamp(
      Math.max(visibleActivityScore - structuralImpactScore, 0) + lowBreadthPenalty + lowCollaboratorPenalty,
    )

    const dominantDimension = ContributorImpactExporter.getDominantDimension(dimensions)
    const topComponents = Array.from(state.components.entries())
      .map(([name, info]) => ({
        name,
        files: info.files.size,
        commits: info.commitIds.size,
      }))
      .sort((left, right) => {
        if (left.files !== right.files) return right.files - left.files
        if (left.commits !== right.commits) return right.commits - left.commits
        return left.name.localeCompare(right.name)
      })
      .slice(0, 3)

    return {
      email: state.contributor.email,
      display_name: state.contributor.userName || ContributorImpactExporter.getDisplayName(state.contributor.email),
      glue_score: glueScore,
      snacking_score: snackingScore,
      structural_impact_score: structuralImpactScore,
      visible_activity_score: visibleActivityScore,
      collaborator_count: collaboratorCount,
      shared_files_count: sharedFilesCount,
      commits_count: commitsCount,
      files_touched: filesTouched,
      components_touched: componentsTouched,
      dominant_dimension: dominantDimension,
      dimensions,
      top_components: topComponents,
      top_routes: ContributorImpactExporter.getTopRoutes(state.contributor.email, dominantDimension),
      reasons: ContributorImpactExporter.getReasons({
        collaboratorCount,
        sharedFilesCount,
        componentsTouched,
        visibleActivityScore,
        structuralImpactScore,
        glueScore,
        snackingScore,
      }),
      is_glue: glueScore >= 60,
      is_snacking: snackingScore >= 60 && visibleActivityScore > structuralImpactScore,
    }
  }

  private static getReasons(input: {
    collaboratorCount: number
    sharedFilesCount: number
    componentsTouched: number
    visibleActivityScore: number
    structuralImpactScore: number
    glueScore: number
    snackingScore: number
  }): string[] {
    const reasons: string[] = []

    if (input.glueScore >= 60) {
      reasons.push(`connects with ${input.collaboratorCount} collaborators across shared-file work`)
      reasons.push(`spans ${input.componentsTouched} logical components`)
      reasons.push(`carries ${input.sharedFilesCount} shared-file coordination links`)
    }

    if (input.snackingScore >= 60) {
      reasons.push("visible activity outpaces structural leverage in the current period")
      if (input.componentsTouched <= 1) {
        reasons.push("work is concentrated in a narrow area of the system")
      }
      if (input.collaboratorCount === 0) {
        reasons.push("recent changes show little cross-contributor leverage")
      }
    }

    if (reasons.length === 0) {
      if (input.structuralImpactScore >= input.visibleActivityScore) {
        reasons.push("activity lands in structurally important areas")
      } else {
        reasons.push("recent work is visible, but structural leverage is mixed")
      }
    }

    return reasons.slice(0, 3)
  }

  private static getTopRoutes(email: string, dominantDimension: ImpactDimensionKey): string[] {
    const routes = new Set<string>([`/contributors/${encodeURIComponent(email)}`, "/topology"])

    switch (dominantDimension) {
      case "complexity_reduction":
        routes.add("/units/complexity")
        break
      case "boundary_shaping":
        routes.add("/dependencies")
        break
      case "knowledge_spread":
        routes.add("/components")
        break
      case "coordination_relief":
        routes.add("/topology")
        break
      case "change_enablement":
        routes.add("/hotspots")
        break
    }

    return Array.from(routes)
  }

  private static mapHotspotDimensions(hotspot: ImpactSourceHotspot): Record<ImpactDimensionKey, number> {
    const boundarySignalBoost =
      hotspot.kind === "component" ? Math.min(hotspot.complexity * 5, 20) : Math.min(hotspot.temporalLinks * 4, 20)
    const coordinationPeopleBoost = Math.min(Math.max(hotspot.contributorsCount - 1, 0) * 4, 15)

    return {
      complexity_reduction: ContributorImpactExporter.clamp(hotspot.dimensions.structuralRisk),
      boundary_shaping: ContributorImpactExporter.clamp(
        hotspot.dimensions.coordinationCost * 0.7 + boundarySignalBoost,
      ),
      knowledge_spread: ContributorImpactExporter.clamp(hotspot.dimensions.knowledgeRisk),
      coordination_relief: ContributorImpactExporter.clamp(
        hotspot.dimensions.coordinationCost * 0.85 + coordinationPeopleBoost,
      ),
      change_enablement: ContributorImpactExporter.clamp(
        hotspot.dimensions.changePressure * 0.7 +
          hotspot.dimensions.coordinationCost * 0.2 +
          hotspot.dimensions.knowledgeRisk * 0.1,
      ),
    }
  }

  private static getDisplayName(email: string): string {
    return email.includes("@") ? (email.split("@")[0] ?? email) : email
  }

  private static getCommitId(commitId: string, date: string, filePath: string, email: string, index: number): string {
    return commitId || `${filePath}:${date}:${email}:${index}`
  }

  private static isCommitInPeriod(date: string, days: number | null, nowIso: string): boolean {
    if (days === null) return true
    if (!date || date.length < 10) return false

    const now = new Date(nowIso)
    now.setUTCDate(now.getUTCDate() - days)
    const thresholdDate = now.toISOString().substring(0, 10)
    return date >= thresholdDate
  }

  private static getAllSourceFiles(analysisResults: CodeAnalysisResults): SourceFile[] {
    const config = analysisResults.codeConfiguration
    if (!config) return []

    const files = [
      ...config.main.sourceFiles,
      ...config.test.sourceFiles,
      ...config.generated.sourceFiles,
      ...config.buildAndDeployment.sourceFiles,
      ...config.other.sourceFiles,
    ] as SourceFile[]

    const unique = new Map<string, SourceFile>()
    for (const file of files) {
      unique.set(file.relativePath, file)
    }
    return Array.from(unique.values())
  }

  private static emptyDimensions(): Record<ImpactDimensionKey, number> {
    return {
      complexity_reduction: 0,
      boundary_shaping: 0,
      knowledge_spread: 0,
      coordination_relief: 0,
      change_enablement: 0,
    }
  }

  private static addDimensions(
    totals: Record<ImpactDimensionKey, number>,
    addition: Record<ImpactDimensionKey, number>,
    weight: number,
  ): void {
    for (const dimension of DIMENSIONS) {
      totals[dimension] += addition[dimension] * weight
    }
  }

  private static normalizeDimensions(
    totals: Record<ImpactDimensionKey, number>,
    divisor: number,
  ): Record<ImpactDimensionKey, number> {
    const normalized = ContributorImpactExporter.emptyDimensions()
    for (const dimension of DIMENSIONS) {
      normalized[dimension] = ContributorImpactExporter.roundScore(totals[dimension] / divisor)
    }
    return normalized
  }

  private static getDominantDimension(scores: Record<ImpactDimensionKey, number>): ImpactDimensionKey {
    const entries = Object.entries(scores) as Array<[ImpactDimensionKey, number]>
    entries.sort((left, right) => right[1] - left[1])
    return entries[0]?.[0] ?? "complexity_reduction"
  }

  private static clamp(score: number): number {
    return ContributorImpactExporter.roundScore(Math.min(Math.max(score, 0), 100))
  }

  private static scaledScore(value: number, threshold: number, weight: number): number {
    if (value <= 0 || threshold <= 0 || weight <= 0) return 0
    return Math.min(value / threshold, 1) * weight
  }

  private static roundScore(score: number): number {
    return Math.round(score * 10) / 10
  }
}
