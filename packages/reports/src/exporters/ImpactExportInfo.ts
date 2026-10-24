import type { CodeAnalysisResults, SourceFile } from "@planetnik/analyzer"

export type ImpactDimensionKey =
  | "complexity_reduction"
  | "boundary_shaping"
  | "knowledge_spread"
  | "coordination_relief"
  | "change_enablement"

export interface ImpactSourceHotspot {
  id: string
  kind: "file" | "unit" | "component"
  name: string
  parent: string
  route: string
  score: number
  severity: string
  size: number
  commitsCount: number
  contributorsCount: number
  temporalLinks: number
  complexity: number
  dimensions: {
    structuralRisk: number
    changePressure: number
    coordinationCost: number
    knowledgeRisk: number
  }
  dominantDimension: "structuralRisk" | "changePressure" | "coordinationCost" | "knowledgeRisk"
  suggestedAction: string
  reasons: string[]
}

export interface ImpactOpportunityExportInfo {
  id: string
  kind: "file" | "unit" | "component"
  name: string
  parent: string
  route: string
  impact_score: number
  visible_activity_score: number
  structural_impact_score: number
  dominant_dimension: ImpactDimensionKey
  dimensions: Record<ImpactDimensionKey, number>
  reasons: string[]
  suggested_action: string
}

export interface ImpactDimensionExportInfo {
  id: ImpactDimensionKey
  label: string
  score: number
  reasons: string[]
}

export interface ImpactConceptMappingExportInfo {
  concept: string
  dimension: ImpactDimensionKey
  evidence_count: number
  example_ids: string[]
}

export interface ImpactSnackingCandidateExportInfo {
  id: string
  kind: "file" | "unit" | "component"
  name: string
  route: string
  visible_activity_score: number
  structural_impact_score: number
  reason: string
}

export interface ImpactExportInfo {
  title: string
  timestamp: string
  visible_activity: {
    commits: number
    contributors: number
    changed_files: number
    changed_units: number
  }
  structural_impact: {
    summary: {
      overall_score: number
      dominant_dimension: ImpactDimensionKey
    }
    dimensions: Record<ImpactDimensionKey, number>
  }
  impact_dimensions: ImpactDimensionExportInfo[]
  impact_opportunities: ImpactOpportunityExportInfo[]
  concept_mappings: ImpactConceptMappingExportInfo[]
  snacking_candidates: ImpactSnackingCandidateExportInfo[]
}

const DIMENSIONS: ImpactDimensionKey[] = [
  "complexity_reduction",
  "boundary_shaping",
  "knowledge_spread",
  "coordination_relief",
  "change_enablement",
]

const DIMENSION_LABELS: Record<ImpactDimensionKey, string> = {
  complexity_reduction: "Complexity reduction",
  boundary_shaping: "Boundary shaping",
  knowledge_spread: "Knowledge spread",
  coordination_relief: "Coordination relief",
  change_enablement: "Change enablement",
}

const CONCEPT_MAP: Array<{ concept: string; dimension: ImpactDimensionKey }> = [
  {
    concept: "reducing system-wide complexity",
    dimension: "complexity_reduction",
  },
  { concept: "shaping boundaries", dimension: "boundary_shaping" },
  { concept: "spreading knowledge", dimension: "knowledge_spread" },
  { concept: "unblocking teams", dimension: "coordination_relief" },
  { concept: "making future change easier", dimension: "change_enablement" },
]

const IMPACT_SELECTION = {
  component: { threshold: 35, limit: 12 },
  file: { threshold: 35, limit: 40 },
  unit: { threshold: 45, limit: 60, perParent: 2 },
} as const

const SMALL_DATASET_BYPASS = {
  component: 12,
  file: 10,
} as const

const SNACKING_SELECTION = {
  visibleActivityThreshold: 55,
  structuralImpactCeiling: 20,
  deltaThreshold: 35,
  limit: 30,
  perUnitParent: 1,
} as const

export class ImpactExporter {
  static exportImpact(
    analysisResults: CodeAnalysisResults,
    hotspots: {
      fileHotspots: ImpactSourceHotspot[]
      unitHotspots: ImpactSourceHotspot[]
      componentHotspots: ImpactSourceHotspot[]
    },
    timestamp: string,
  ): ImpactExportInfo {
    const rawImpactOpportunities = [...hotspots.componentHotspots, ...hotspots.fileHotspots, ...hotspots.unitHotspots]
      .map((hotspot) => ImpactExporter.toImpactOpportunity(hotspot))
      .sort((left, right) => {
        if (left.impact_score !== right.impact_score) {
          return right.impact_score - left.impact_score
        }
        return left.id.localeCompare(right.id)
      })

    const impactOpportunities = ImpactExporter.selectImpactOpportunities(rawImpactOpportunities)

    const structuralDimensions = ImpactExporter.aggregateDimensions(impactOpportunities)
    const dominantDimension = ImpactExporter.getDominantDimension(structuralDimensions)

    const impactDimensions = DIMENSIONS.map((dimension) => {
      const strongest = [...impactOpportunities]
        .sort((left, right) => right.dimensions[dimension] - left.dimensions[dimension])
        .slice(0, 2)
      return {
        id: dimension,
        label: DIMENSION_LABELS[dimension],
        score: structuralDimensions[dimension],
        reasons:
          strongest.length > 0
            ? strongest.map(
                (opportunity) => `${opportunity.name} shows ${DIMENSION_LABELS[dimension].toLowerCase()} pressure`,
              )
            : [`No strong ${DIMENSION_LABELS[dimension].toLowerCase()} evidence is present yet.`],
      }
    })

    const conceptMappings = CONCEPT_MAP.map(({ concept, dimension }) => {
      const strongest = [...impactOpportunities]
        .filter((opportunity) => opportunity.dimensions[dimension] >= 20)
        .sort((left, right) => right.dimensions[dimension] - left.dimensions[dimension])
        .slice(0, 3)

      return {
        concept,
        dimension,
        evidence_count: strongest.length,
        example_ids: strongest.map((opportunity) => opportunity.id),
      }
    })

    const snackingCandidates = ImpactExporter.selectSnackingCandidates(rawImpactOpportunities)

    return {
      title: "Work on What Matters",
      timestamp,
      visible_activity: ImpactExporter.getVisibleActivity(analysisResults),
      structural_impact: {
        summary: {
          overall_score: ImpactExporter.roundScore(
            DIMENSIONS.reduce((sum, dimension) => sum + structuralDimensions[dimension], 0) / DIMENSIONS.length,
          ),
          dominant_dimension: dominantDimension,
        },
        dimensions: structuralDimensions,
      },
      impact_dimensions: impactDimensions,
      impact_opportunities: impactOpportunities,
      concept_mappings: conceptMappings,
      snacking_candidates: snackingCandidates,
    }
  }

  private static toImpactOpportunity(hotspot: ImpactSourceHotspot): ImpactOpportunityExportInfo {
    const dimensions = ImpactExporter.mapDimensions(hotspot)
    const impactScore = ImpactExporter.roundScore(
      dimensions.complexity_reduction * 0.22 +
        dimensions.boundary_shaping * 0.2 +
        dimensions.knowledge_spread * 0.2 +
        dimensions.coordination_relief * 0.18 +
        dimensions.change_enablement * 0.2,
    )

    return {
      id: hotspot.id,
      kind: hotspot.kind,
      name: hotspot.name,
      parent: hotspot.parent,
      route: hotspot.route,
      impact_score: impactScore,
      visible_activity_score: ImpactExporter.getVisibleActivityScore(hotspot),
      structural_impact_score: impactScore,
      dominant_dimension: ImpactExporter.getDominantDimension(dimensions),
      dimensions,
      reasons: hotspot.reasons.length > 0 ? hotspot.reasons : [ImpactExporter.getFallbackReason(hotspot)],
      suggested_action: hotspot.suggestedAction,
    }
  }

  private static mapDimensions(hotspot: ImpactSourceHotspot): Record<ImpactDimensionKey, number> {
    const boundarySignalBoost =
      hotspot.kind === "component" ? Math.min(hotspot.complexity * 5, 20) : Math.min(hotspot.temporalLinks * 4, 20)
    const coordinationPeopleBoost = Math.min(Math.max(hotspot.contributorsCount - 1, 0) * 4, 15)

    return {
      complexity_reduction: ImpactExporter.clamp(hotspot.dimensions.structuralRisk),
      boundary_shaping: ImpactExporter.clamp(hotspot.dimensions.coordinationCost * 0.7 + boundarySignalBoost),
      knowledge_spread: ImpactExporter.clamp(hotspot.dimensions.knowledgeRisk),
      coordination_relief: ImpactExporter.clamp(hotspot.dimensions.coordinationCost * 0.85 + coordinationPeopleBoost),
      change_enablement: ImpactExporter.clamp(
        hotspot.dimensions.changePressure * 0.7 +
          hotspot.dimensions.coordinationCost * 0.2 +
          hotspot.dimensions.knowledgeRisk * 0.1,
      ),
    }
  }

  private static getVisibleActivityScore(hotspot: ImpactSourceHotspot): number {
    return ImpactExporter.clamp(
      ImpactExporter.scaledScore(
        hotspot.commitsCount,
        hotspot.kind === "component" ? 60 : hotspot.kind === "file" ? 20 : 16,
        80,
      ) +
        ImpactExporter.scaledScore(
          Math.max(hotspot.contributorsCount - 1, 0),
          hotspot.kind === "component" ? 8 : 4,
          20,
        ),
    )
  }

  private static aggregateDimensions(opportunities: ImpactOpportunityExportInfo[]): Record<ImpactDimensionKey, number> {
    const seed = {
      complexity_reduction: 0,
      boundary_shaping: 0,
      knowledge_spread: 0,
      coordination_relief: 0,
      change_enablement: 0,
    }

    if (opportunities.length === 0) return seed

    const topOpportunities = opportunities.slice(0, Math.min(opportunities.length, 10))
    for (const opportunity of topOpportunities) {
      for (const dimension of DIMENSIONS) {
        seed[dimension] += opportunity.dimensions[dimension]
      }
    }

    for (const dimension of DIMENSIONS) {
      seed[dimension] = ImpactExporter.roundScore(seed[dimension] / topOpportunities.length)
    }

    return seed
  }

  private static selectImpactOpportunities(
    opportunities: ImpactOpportunityExportInfo[],
  ): ImpactOpportunityExportInfo[] {
    const selected = [
      ...ImpactExporter.selectKindOpportunities(
        opportunities,
        "component",
        IMPACT_SELECTION.component.threshold,
        IMPACT_SELECTION.component.limit,
      ),
      ...ImpactExporter.selectKindOpportunities(
        opportunities,
        "file",
        IMPACT_SELECTION.file.threshold,
        IMPACT_SELECTION.file.limit,
      ),
      ...ImpactExporter.selectUnitOpportunities(opportunities),
    ]

    return selected.sort((left, right) => {
      if (left.impact_score !== right.impact_score) {
        return right.impact_score - left.impact_score
      }
      return left.id.localeCompare(right.id)
    })
  }

  private static selectKindOpportunities(
    opportunities: ImpactOpportunityExportInfo[],
    kind: ImpactOpportunityExportInfo["kind"],
    threshold: number,
    limit: number,
  ): ImpactOpportunityExportInfo[] {
    const candidates = opportunities
      .filter((opportunity) => opportunity.kind === kind)
      .sort((left, right) => {
        if (left.impact_score !== right.impact_score) {
          return right.impact_score - left.impact_score
        }
        return left.id.localeCompare(right.id)
      })

    const smallDatasetBypass =
      kind === "component" ? SMALL_DATASET_BYPASS.component : kind === "file" ? SMALL_DATASET_BYPASS.file : 0

    if (smallDatasetBypass > 0 && candidates.length <= smallDatasetBypass) {
      return candidates.slice(0, limit)
    }

    const thresholdMatches = candidates.filter((opportunity) => opportunity.impact_score >= threshold)
    if (thresholdMatches.length > 0) {
      return thresholdMatches.slice(0, limit)
    }
    return candidates.slice(0, Math.min(candidates.length, limit, 1))
  }

  private static selectUnitOpportunities(opportunities: ImpactOpportunityExportInfo[]): ImpactOpportunityExportInfo[] {
    const candidates = opportunities
      .filter(
        (opportunity) => opportunity.kind === "unit" && opportunity.impact_score >= IMPACT_SELECTION.unit.threshold,
      )
      .sort((left, right) => {
        if (left.impact_score !== right.impact_score) {
          return right.impact_score - left.impact_score
        }
        return left.id.localeCompare(right.id)
      })

    const byParent = new Map<string, ImpactOpportunityExportInfo[]>()
    for (const opportunity of candidates) {
      const existing = byParent.get(opportunity.parent) ?? []
      if (existing.length < IMPACT_SELECTION.unit.perParent) {
        existing.push(opportunity)
        byParent.set(opportunity.parent, existing)
      }
    }

    const deduplicated = Array.from(byParent.values()).flat()
    if (deduplicated.length > 0) {
      return deduplicated.slice(0, IMPACT_SELECTION.unit.limit)
    }

    const fallback = opportunities
      .filter((opportunity) => opportunity.kind === "unit")
      .sort((left, right) => {
        if (left.impact_score !== right.impact_score) {
          return right.impact_score - left.impact_score
        }
        return left.id.localeCompare(right.id)
      })

    return fallback.slice(0, Math.min(fallback.length, IMPACT_SELECTION.unit.perParent))
  }

  private static selectSnackingCandidates(
    opportunities: ImpactOpportunityExportInfo[],
  ): ImpactSnackingCandidateExportInfo[] {
    const candidates = opportunities
      .filter(
        (opportunity) =>
          opportunity.visible_activity_score >= SNACKING_SELECTION.visibleActivityThreshold &&
          opportunity.structural_impact_score <= SNACKING_SELECTION.structuralImpactCeiling &&
          opportunity.visible_activity_score - opportunity.structural_impact_score >= SNACKING_SELECTION.deltaThreshold,
      )
      .sort((left, right) => {
        const leftDelta = left.visible_activity_score - left.structural_impact_score
        const rightDelta = right.visible_activity_score - right.structural_impact_score
        if (leftDelta !== rightDelta) return rightDelta - leftDelta
        if (left.visible_activity_score !== right.visible_activity_score) {
          return right.visible_activity_score - left.visible_activity_score
        }
        return left.id.localeCompare(right.id)
      })

    const selected: ImpactOpportunityExportInfo[] = []
    const unitParents = new Set<string>()

    for (const candidate of candidates) {
      if (candidate.kind === "unit") {
        if (unitParents.has(candidate.parent)) continue
        unitParents.add(candidate.parent)
      }
      selected.push(candidate)
      if (selected.length >= SNACKING_SELECTION.limit) break
    }

    return selected.map((opportunity) => ({
      id: opportunity.id,
      kind: opportunity.kind,
      name: opportunity.name,
      route: opportunity.route,
      visible_activity_score: opportunity.visible_activity_score,
      structural_impact_score: opportunity.structural_impact_score,
      reason: "high visible activity with comparatively weak structural leverage",
    }))
  }

  private static getVisibleActivity(analysisResults: CodeAnalysisResults) {
    const sourceFiles = ImpactExporter.getAllSourceFiles(analysisResults)
    const commitIds = new Set<string>()
    const contributors = new Set<string>()

    let changedFiles = 0

    for (const file of sourceFiles) {
      const commits = file.fileModificationHistory?.commits ?? []
      if (commits.length > 0) changedFiles += 1

      for (const [index, commit] of commits.entries()) {
        if (commit.email) contributors.add(commit.email)
        const commitId = commit.id || `${file.relativePath}:${commit.date}:${commit.email}:${index}`
        commitIds.add(commitId)
      }
    }

    const changedUnits = analysisResults.unitsAnalysisResults.allUnits.filter(
      (unit) => (unit.sourceFile?.fileModificationHistory?.commits.length ?? 0) > 0,
    ).length

    return {
      commits: commitIds.size,
      contributors: contributors.size || analysisResults.contributorsAnalysisResults.contributors.length,
      changed_files: changedFiles,
      changed_units: changedUnits,
    }
  }

  private static getFallbackReason(hotspot: ImpactSourceHotspot): string {
    if (hotspot.kind === "component") {
      return "component-level structural pressure is present even without one dominant hotspot trigger"
    }
    if (hotspot.kind === "unit") {
      return "unit-level change and complexity signals are meaningful enough to review"
    }
    return "file-level structural pressure is present even without one dominant hotspot trigger"
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

  private static getDominantDimension(scores: Record<ImpactDimensionKey, number>): ImpactDimensionKey {
    const entries = Object.entries(scores) as Array<[ImpactDimensionKey, number]>
    entries.sort((left, right) => right[1] - left[1])
    return entries[0]?.[0] ?? "complexity_reduction"
  }

  private static clamp(score: number): number {
    return ImpactExporter.roundScore(Math.min(Math.max(score, 0), 100))
  }

  private static scaledScore(value: number, threshold: number, weight: number): number {
    if (value <= 0 || threshold <= 0 || weight <= 0) return 0
    return Math.min(value / threshold, 1) * weight
  }

  private static roundScore(score: number): number {
    return Math.round(score * 10) / 10
  }
}
