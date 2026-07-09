import { maxOf } from "../arrayMath"

type CouplingDimensionId = "staticCoupling" | "temporalCoupling" | "coordinationCoupling" | "knowledgeRisk"

export interface BalancedCouplingInputFile {
  relativePath: string
  linesOfCode: number
  components: string[]
  contributors?: string[]
}

export interface BalancedCouplingInputDependency {
  decompositionKey: string
  fromComponent: string
  toComponent: string
  count: number
}

export interface BalancedCouplingInputTemporalDependency {
  file1: string
  file2: string
  sameCommits: number
}

export interface BalancedCouplingInputHotspot {
  kind: "file" | "unit" | "component"
  name: string
  parent: string
  score: number
  dimensions: {
    structuralRisk: number
    changePressure: number
    coordinationCost: number
    knowledgeRisk: number
  }
  reasons: string[]
}

export interface BalancedCouplingSnapshot {
  id: string
  component: string
  files: number
  loc: number
  contributors: number
  incomingDependencies: number
  outgoingDependencies: number
  staticPartners: number
  temporalPartners: number
  contributorOverlap: number
  hotspotPressure: number
  staticCoupling: number
  temporalCoupling: number
  coordinationCoupling: number
  knowledgeRisk: number
  overallLoad: number
  balanceScore: number
  systemicRisk: number
  riskTier: "Low" | "Medium" | "High" | "Critical"
  dominantDimension: CouplingDimensionId
  explainability: string[]
}

export interface BalancedCouplingAggregate {
  totalComponents: number
  averageLoad: number
  averageBalance: number
  averageRisk: number
  maxRisk: number
  overloadedComponents: number
  knowledgeExposedComponents: number
  topRiskComponent?: string
  dimensionMix: Array<{
    id: CouplingDimensionId
    label: string
    value: number
    color: string
  }>
  dominantDimensionBreakdown: Array<{
    label: string
    value: number
    detail: string
    color: string
  }>
}

export interface BalancedCouplingModel {
  decompositionKey: string
  snapshots: BalancedCouplingSnapshot[]
  aggregate: BalancedCouplingAggregate
}

interface BuildBalancedCouplingModelInput {
  decompositionKey: string
  files: BalancedCouplingInputFile[]
  dependencies: BalancedCouplingInputDependency[]
  temporalDependencies: BalancedCouplingInputTemporalDependency[]
  hotspots: BalancedCouplingInputHotspot[]
}

const DIMENSION_LABELS: Record<CouplingDimensionId, string> = {
  staticCoupling: "Static",
  temporalCoupling: "Temporal",
  coordinationCoupling: "Coordination",
  knowledgeRisk: "Knowledge",
}

const DIMENSION_COLORS: Record<CouplingDimensionId, string> = {
  staticCoupling: "#58A6FF",
  temporalCoupling: "#8b5cf6",
  coordinationCoupling: "#06b6d4",
  knowledgeRisk: "#ef4444",
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function clamp(value: number, min = 0, max = 10): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeToTen(value: number, max: number): number {
  if (max <= 0) return 0
  return round1((value / max) * 10)
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = average(values)
  const variance = average(values.map((value) => (value - mean) ** 2))
  return Math.sqrt(variance)
}

function getRiskTier(score: number): BalancedCouplingSnapshot["riskTier"] {
  if (score >= 7.5) return "Critical"
  if (score >= 5.5) return "High"
  if (score >= 3.5) return "Medium"
  return "Low"
}

function getDominantDimension(scores: Record<CouplingDimensionId, number>): CouplingDimensionId {
  return (
    (Object.entries(scores) as Array<[CouplingDimensionId, number]>).sort(
      (left, right) => right[1] - left[1],
    )[0]?.[0] ?? "staticCoupling"
  )
}

function getHeuristicKnowledgeRisk(contributors: number): number {
  if (contributors <= 1) return 10
  if (contributors === 2) return 7.5
  if (contributors === 3) return 5
  if (contributors === 4) return 3.5
  return 2
}

function buildExplainability(snapshot: {
  incomingDependencies: number
  outgoingDependencies: number
  temporalPartners: number
  contributorOverlap: number
  contributors: number
  hotspot: BalancedCouplingInputHotspot | undefined
  dominantDimension: CouplingDimensionId
}): string[] {
  const reasons = new Set<string>()

  for (const reason of snapshot.hotspot?.reasons ?? []) {
    reasons.add(reason)
  }

  const dependencyCentrality = snapshot.incomingDependencies + snapshot.outgoingDependencies
  if (dependencyCentrality >= 4) {
    reasons.add(`dependency centrality across ${dependencyCentrality} component edges`)
  }

  if (snapshot.temporalPartners >= 3) {
    reasons.add(`co-change pressure with ${snapshot.temporalPartners} partner components`)
  }

  if (snapshot.contributorOverlap >= 3) {
    reasons.add(`shared contributor traffic across ${snapshot.contributorOverlap} cross-component overlaps`)
  }

  if (snapshot.contributors <= 1) {
    reasons.add("single-owner knowledge exposure")
  } else if (snapshot.contributors === 2) {
    reasons.add("thin backup coverage")
  }

  if (reasons.size === 0) {
    reasons.add(`dominant ${DIMENSION_LABELS[snapshot.dominantDimension].toLowerCase()} pressure`)
  }

  return [...reasons].slice(0, 4)
}

export function buildBalancedCouplingModel({
  decompositionKey,
  files,
  dependencies,
  temporalDependencies,
  hotspots,
}: BuildBalancedCouplingModelInput): BalancedCouplingModel {
  const componentStats = new Map<
    string,
    {
      files: number
      loc: number
      contributors: Set<string>
      paths: Set<string>
    }
  >()

  for (const file of files) {
    for (const component of file.components) {
      const current = componentStats.get(component) ?? {
        files: 0,
        loc: 0,
        contributors: new Set<string>(),
        paths: new Set<string>(),
      }

      current.files += 1
      current.loc += file.linesOfCode
      current.paths.add(file.relativePath)
      for (const contributor of file.contributors ?? []) {
        current.contributors.add(contributor)
      }
      componentStats.set(component, current)
    }
  }

  const hotspotMap = new Map(
    hotspots
      .filter((entry) => entry.kind === "component" && entry.parent === decompositionKey)
      .map((entry) => [entry.name, entry] as const),
  )

  for (const hotspot of hotspotMap.values()) {
    if (!componentStats.has(hotspot.name)) {
      componentStats.set(hotspot.name, {
        files: 0,
        loc: 0,
        contributors: new Set<string>(),
        paths: new Set<string>(),
      })
    }
  }

  const filteredDependencies = dependencies.filter((dependency) => dependency.decompositionKey === decompositionKey)
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  const staticPartners = new Map<string, Set<string>>()

  for (const dependency of filteredDependencies) {
    outgoing.set(dependency.fromComponent, (outgoing.get(dependency.fromComponent) ?? 0) + dependency.count)
    incoming.set(dependency.toComponent, (incoming.get(dependency.toComponent) ?? 0) + dependency.count)

    const fromPartners = staticPartners.get(dependency.fromComponent) ?? new Set<string>()
    fromPartners.add(dependency.toComponent)
    staticPartners.set(dependency.fromComponent, fromPartners)

    const toPartners = staticPartners.get(dependency.toComponent) ?? new Set<string>()
    toPartners.add(dependency.fromComponent)
    staticPartners.set(dependency.toComponent, toPartners)

    if (!componentStats.has(dependency.fromComponent)) {
      componentStats.set(dependency.fromComponent, {
        files: 0,
        loc: 0,
        contributors: new Set<string>(),
        paths: new Set<string>(),
      })
    }
    if (!componentStats.has(dependency.toComponent)) {
      componentStats.set(dependency.toComponent, {
        files: 0,
        loc: 0,
        contributors: new Set<string>(),
        paths: new Set<string>(),
      })
    }
  }

  const fileToComponents = new Map<string, string[]>()
  for (const file of files) {
    fileToComponents.set(file.relativePath, file.components)
  }

  const temporalWeights = new Map<string, number>()
  const temporalPartners = new Map<string, Set<string>>()

  for (const dependency of temporalDependencies) {
    const leftComponents = new Set(fileToComponents.get(dependency.file1) ?? [])
    const rightComponents = new Set(fileToComponents.get(dependency.file2) ?? [])

    for (const left of leftComponents) {
      for (const right of rightComponents) {
        if (left === right) continue

        temporalWeights.set(left, (temporalWeights.get(left) ?? 0) + dependency.sameCommits)
        temporalWeights.set(right, (temporalWeights.get(right) ?? 0) + dependency.sameCommits)

        const leftPartners = temporalPartners.get(left) ?? new Set<string>()
        leftPartners.add(right)
        temporalPartners.set(left, leftPartners)

        const rightPartners = temporalPartners.get(right) ?? new Set<string>()
        rightPartners.add(left)
        temporalPartners.set(right, rightPartners)
      }
    }
  }

  const contributorOverlap = new Map<string, number>()
  const componentEntries = [...componentStats.entries()]
  for (let index = 0; index < componentEntries.length; index += 1) {
    const [leftComponent, leftStats] = componentEntries[index]!
    for (let inner = index + 1; inner < componentEntries.length; inner += 1) {
      const [rightComponent, rightStats] = componentEntries[inner]!
      let overlap = 0

      for (const contributor of leftStats.contributors) {
        if (rightStats.contributors.has(contributor)) {
          overlap += 1
        }
      }

      if (overlap === 0) continue

      contributorOverlap.set(leftComponent, (contributorOverlap.get(leftComponent) ?? 0) + overlap)
      contributorOverlap.set(rightComponent, (contributorOverlap.get(rightComponent) ?? 0) + overlap)
    }
  }

  const staticWeights = componentEntries.map(
    ([component]) => (incoming.get(component) ?? 0) + (outgoing.get(component) ?? 0),
  )
  const temporalValues = componentEntries.map(([component]) => temporalWeights.get(component) ?? 0)
  const contributorOverlapValues = componentEntries.map(([component]) => contributorOverlap.get(component) ?? 0)

  const maxStatic = maxOf(staticWeights, 0)
  const maxTemporal = maxOf(temporalValues, 0)
  const maxContributorOverlap = maxOf(contributorOverlapValues, 0)

  const snapshots = componentEntries
    .map(([component, stats]) => {
      const hotspot = hotspotMap.get(component)
      const incomingDependencies = incoming.get(component) ?? 0
      const outgoingDependencies = outgoing.get(component) ?? 0
      const dependencyPressure = normalizeToTen(incomingDependencies + outgoingDependencies, maxStatic)
      const temporalPressure = normalizeToTen(temporalWeights.get(component) ?? 0, maxTemporal)
      const overlapPressure = normalizeToTen(contributorOverlap.get(component) ?? 0, maxContributorOverlap)

      const staticCoupling = round1(dependencyPressure * 0.7 + ((hotspot?.dimensions.structuralRisk ?? 0) / 10) * 0.3)
      const temporalCoupling = round1(temporalPressure)
      const coordinationCoupling = round1(
        overlapPressure * 0.6 + ((hotspot?.dimensions.coordinationCost ?? 0) / 10) * 0.4,
      )
      const heuristicKnowledgeRisk = getHeuristicKnowledgeRisk(stats.contributors.size)
      const knowledgeRisk = round1(heuristicKnowledgeRisk * 0.4 + ((hotspot?.dimensions.knowledgeRisk ?? 0) / 10) * 0.6)

      const dimensionScores = {
        staticCoupling,
        temporalCoupling,
        coordinationCoupling,
        knowledgeRisk,
      }
      const overallLoad = round1(
        staticCoupling * 0.3 + temporalCoupling * 0.25 + coordinationCoupling * 0.25 + knowledgeRisk * 0.2,
      )
      const balanceScore = round1(clamp(10 - standardDeviation(Object.values(dimensionScores)) * 1.5))
      const systemicRisk = round1(clamp(overallLoad * 0.72 + (10 - balanceScore) * 0.28))
      const dominantDimension = getDominantDimension(dimensionScores)

      return {
        id: component,
        component,
        files: stats.files,
        loc: stats.loc,
        contributors: stats.contributors.size,
        incomingDependencies,
        outgoingDependencies,
        staticPartners: staticPartners.get(component)?.size ?? 0,
        temporalPartners: temporalPartners.get(component)?.size ?? 0,
        contributorOverlap: contributorOverlap.get(component) ?? 0,
        hotspotPressure: round1((hotspot?.score ?? 0) / 10),
        staticCoupling,
        temporalCoupling,
        coordinationCoupling,
        knowledgeRisk,
        overallLoad,
        balanceScore,
        systemicRisk,
        riskTier: getRiskTier(systemicRisk),
        dominantDimension,
        explainability: buildExplainability({
          incomingDependencies,
          outgoingDependencies,
          temporalPartners: temporalPartners.get(component)?.size ?? 0,
          contributorOverlap: contributorOverlap.get(component) ?? 0,
          contributors: stats.contributors.size,
          hotspot,
          dominantDimension,
        }),
      } satisfies BalancedCouplingSnapshot
    })
    .sort((left, right) => {
      if (left.systemicRisk !== right.systemicRisk) return right.systemicRisk - left.systemicRisk
      return right.overallLoad - left.overallLoad
    })

  const dominantCounts = {
    staticCoupling: snapshots.filter((snapshot) => snapshot.dominantDimension === "staticCoupling").length,
    temporalCoupling: snapshots.filter((snapshot) => snapshot.dominantDimension === "temporalCoupling").length,
    coordinationCoupling: snapshots.filter((snapshot) => snapshot.dominantDimension === "coordinationCoupling").length,
    knowledgeRisk: snapshots.filter((snapshot) => snapshot.dominantDimension === "knowledgeRisk").length,
  }

  const aggregate: BalancedCouplingAggregate = {
    totalComponents: snapshots.length,
    averageLoad: round1(average(snapshots.map((snapshot) => snapshot.overallLoad))),
    averageBalance: round1(average(snapshots.map((snapshot) => snapshot.balanceScore))),
    averageRisk: round1(average(snapshots.map((snapshot) => snapshot.systemicRisk))),
    maxRisk: round1(
      maxOf(
        snapshots.map((snapshot) => snapshot.systemicRisk),
        0,
      ),
    ),
    overloadedComponents: snapshots.filter((snapshot) => snapshot.systemicRisk >= 7.5).length,
    knowledgeExposedComponents: snapshots.filter((snapshot) => snapshot.contributors <= 2).length,
    topRiskComponent: snapshots[0]?.component,
    dimensionMix: [
      {
        id: "staticCoupling",
        label: DIMENSION_LABELS.staticCoupling,
        value: round1(average(snapshots.map((snapshot) => snapshot.staticCoupling))),
        color: DIMENSION_COLORS.staticCoupling,
      },
      {
        id: "temporalCoupling",
        label: DIMENSION_LABELS.temporalCoupling,
        value: round1(average(snapshots.map((snapshot) => snapshot.temporalCoupling))),
        color: DIMENSION_COLORS.temporalCoupling,
      },
      {
        id: "coordinationCoupling",
        label: DIMENSION_LABELS.coordinationCoupling,
        value: round1(average(snapshots.map((snapshot) => snapshot.coordinationCoupling))),
        color: DIMENSION_COLORS.coordinationCoupling,
      },
      {
        id: "knowledgeRisk",
        label: DIMENSION_LABELS.knowledgeRisk,
        value: round1(average(snapshots.map((snapshot) => snapshot.knowledgeRisk))),
        color: DIMENSION_COLORS.knowledgeRisk,
      },
    ],
    dominantDimensionBreakdown: [
      {
        label: DIMENSION_LABELS.staticCoupling,
        value: dominantCounts.staticCoupling,
        detail: `${dominantCounts.staticCoupling} components`,
        color: DIMENSION_COLORS.staticCoupling,
      },
      {
        label: DIMENSION_LABELS.temporalCoupling,
        value: dominantCounts.temporalCoupling,
        detail: `${dominantCounts.temporalCoupling} components`,
        color: DIMENSION_COLORS.temporalCoupling,
      },
      {
        label: DIMENSION_LABELS.coordinationCoupling,
        value: dominantCounts.coordinationCoupling,
        detail: `${dominantCounts.coordinationCoupling} components`,
        color: DIMENSION_COLORS.coordinationCoupling,
      },
      {
        label: DIMENSION_LABELS.knowledgeRisk,
        value: dominantCounts.knowledgeRisk,
        detail: `${dominantCounts.knowledgeRisk} components`,
        color: DIMENSION_COLORS.knowledgeRisk,
      },
    ].filter((item) => item.value > 0),
  }

  return {
    decompositionKey,
    snapshots,
    aggregate,
  }
}
