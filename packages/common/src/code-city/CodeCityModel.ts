export type CodeCityReportMode = "single_repository" | "landscape"

export type CanonicalReportContext = {
  readonly dataVersion?: number
  readonly mode?: CodeCityReportMode
  readonly reportMode?: CodeCityReportMode
  readonly title?: string
  readonly repositoryId?: string
  readonly snapshotId?: string
  readonly generatedAt?: string
  readonly canonicalShards?: Readonly<Record<string, string>>
}

export type CanonicalFileRecord = {
  readonly id?: string
  readonly relativePath?: string
  readonly extension?: string
  readonly linesOfCode?: number
  readonly components?: readonly string[]
  readonly concerns?: readonly string[]
  readonly commitsCount?: number
  readonly contributorsCount?: number
  readonly contributors?: readonly string[]
  readonly firstDate?: string
  readonly latestDate?: string
}

export type CanonicalFilesShard = {
  readonly files?: readonly CanonicalFileRecord[]
}

export type CanonicalUnitRecord = {
  readonly id?: string
  readonly shortName?: string
  readonly longName?: string
  readonly relativeFileName?: string
  readonly linesOfCode?: number
  readonly mcCabeIndex?: number
  readonly numberOfParameters?: number
  readonly startLine?: number
  readonly endLine?: number
  readonly components?: readonly string[]
}

export type CanonicalUnitsShard = {
  readonly units?: readonly CanonicalUnitRecord[]
}

export type CanonicalComponentDependencyRecord = {
  readonly decompositionKey?: string
  readonly fromComponent?: string
  readonly toComponent?: string
  readonly fromComponentId?: string
  readonly toComponentId?: string
  readonly count?: number
  readonly locFrom?: number
  readonly evidenceCount?: number
}

export type CanonicalComponentDependenciesShard = {
  readonly dependencies?: readonly CanonicalComponentDependencyRecord[]
}

export type CanonicalHotspotRecord = {
  readonly id?: string
  readonly kind?: "file" | "unit" | "component" | string
  readonly name?: string
  readonly parent?: string
  readonly route?: string
  readonly score?: number
  readonly severity?: string
  readonly size?: number
  readonly commitsCount?: number
  readonly contributorsCount?: number
  readonly temporalLinks?: number
  readonly complexity?: number
  readonly dominantDimension?: string
  readonly dimensions?: Readonly<Record<string, unknown>>
}

export type CanonicalHotspotsShard = {
  readonly fileHotspots?: readonly CanonicalHotspotRecord[]
  readonly unitHotspots?: readonly CanonicalHotspotRecord[]
  readonly componentHotspots?: readonly CanonicalHotspotRecord[]
}

export type CanonicalImpactOpportunityRecord = {
  readonly id?: string
  readonly kind?: "file" | "unit" | "component" | string
  readonly name?: string
  readonly parent?: string
  readonly route?: string
  readonly impact_score?: number
  readonly dominant_dimension?: string
  readonly dimensions?: Readonly<Record<string, unknown>>
}

export type CanonicalImpactShard = {
  readonly impact_opportunities?: readonly CanonicalImpactOpportunityRecord[]
}

export type CodeCitySnapshotInput = {
  readonly context: CanonicalReportContext
  readonly filesMain: CanonicalFilesShard
  readonly filesTest?: CanonicalFilesShard
  readonly units?: CanonicalUnitsShard
  readonly componentDependencies?: CanonicalComponentDependenciesShard
  readonly hotspots?: CanonicalHotspotsShard
  readonly impact?: CanonicalImpactShard
}

export type CodeCitySnapshotIdentity = {
  readonly repositoryId: string
  readonly snapshotId?: string
  readonly title: string
  readonly generatedAt?: string
}

export type CodeCitySourceSet = "main" | "test"

export type CodeCityEvidenceKind = "file" | "unit" | "component" | "hotspot" | "impact"

export type CodeCityEvidenceRef = {
  readonly kind: CodeCityEvidenceKind
  readonly id: string
  readonly route: string | null
}

export type CodeCitySignals = {
  readonly footprint: {
    readonly loc: number
    readonly buildingCount: number
  }
  readonly complexity: {
    readonly maxMcCabe: number | null
    readonly unitCount: number
  }
  readonly health: {
    readonly score: number | null
    readonly severity: string | null
    readonly dominantDimension: string | null
  }
  readonly change: {
    readonly commits: number | null
    readonly temporalLinks: number | null
  }
  readonly ownership: {
    readonly contributorIds: readonly string[]
    readonly contributorCount: number
  }
  readonly impact: {
    readonly score: number | null
    readonly dimension: string | null
    readonly sourceId: string | null
  }
}

export type CodeCityDistrict = {
  readonly id: string
  readonly kind: "component" | "path"
  readonly label: string
  readonly decompositionKey: string | null
  readonly pathPrefix: string | null
  readonly buildingIds: readonly string[]
  readonly metrics: CodeCitySignals
  readonly evidence: readonly CodeCityEvidenceRef[]
  readonly derived: boolean
}

export type CodeCityBuilding = {
  readonly id: string
  readonly relativePath: string
  readonly extension: string
  readonly sourceSets: readonly CodeCitySourceSet[]
  readonly components: readonly string[]
  readonly districtIds: readonly string[]
  readonly primaryDistrictId: string
  readonly metrics: CodeCitySignals
  readonly evidence: readonly CodeCityEvidenceRef[]
}

export type CodeCityUnit = {
  readonly id: string
  readonly fileId: string | null
  readonly shortName: string
  readonly longName: string
  readonly relativeFileName: string
  readonly linesOfCode: number
  readonly mcCabeIndex: number
  readonly numberOfParameters: number
  readonly startLine: number
  readonly endLine: number
  readonly districtIds: readonly string[]
  readonly metrics: CodeCitySignals
  readonly evidence: readonly CodeCityEvidenceRef[]
}

export type CodeCityDependencyEdge = {
  readonly id: string
  readonly kind: "component_dependency"
  readonly decompositionKey: string
  readonly sourceDistrictId: string | null
  readonly targetDistrictId: string | null
  readonly count: number
  readonly locFrom: number | null
  readonly evidenceCount: number | null
  readonly resolution: "both" | "source" | "target" | "none"
  readonly evidence: readonly CodeCityEvidenceRef[]
}

export type CodeCityDiagnosticCode =
  | "malformed_record"
  | "orphan_unit"
  | "orphan_hotspot"
  | "orphan_impact"
  | "ambiguous_component"
  | "unresolved_edge"
  | "derived_district"

export type CodeCityDiagnostic = {
  readonly code: CodeCityDiagnosticCode
  readonly severity: "warning" | "error"
  readonly shard: string
  readonly entityId: string | null
  readonly detail: string
}

export type CodeCityCoverage = {
  readonly presentShards: readonly string[]
  readonly missingOptionalShards: readonly string[]
  readonly diagnostics: readonly CodeCityDiagnostic[]
  readonly derivedDistrictIds: readonly string[]
  readonly counts: {
    readonly files: number
    readonly districts: number
    readonly units: number
    readonly edges: number
    readonly diagnostics: number
  }
}

export type CodeCityLayoutHints = {
  readonly contractVersion: 1
  readonly seed: string
  readonly districtOrder: readonly string[]
  readonly buildingOrder: readonly string[]
  readonly unitOrder: readonly string[]
}

export type CodeCityLegendChannel = {
  readonly id: "footprint" | "complexity" | "health" | "change_pressure" | "ownership" | "impact"
  readonly label: string
  readonly unit: string
  readonly source: string
}

export type CodeCityLegend = {
  readonly channels: readonly CodeCityLegendChannel[]
}

export class CodeCityInputError extends Error {
  readonly _tag = "CodeCityInputError" as const

  constructor(
    readonly code: "invalid_context" | "missing_repository" | "missing_files_main",
    message: string,
  ) {
    super(message)
    this.name = "CodeCityInputError"
  }
}

export type CodeCityModel = {
  readonly contractVersion: 1
  readonly snapshot: CodeCitySnapshotIdentity
  readonly districts: readonly CodeCityDistrict[]
  readonly buildings: readonly CodeCityBuilding[]
  readonly units: readonly CodeCityUnit[]
  readonly edges: readonly CodeCityDependencyEdge[]
  readonly coverage: CodeCityCoverage
  readonly layout: CodeCityLayoutHints
  readonly legend: CodeCityLegend
}
