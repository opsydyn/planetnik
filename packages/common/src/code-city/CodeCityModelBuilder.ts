import {
  type CanonicalComponentDependencyRecord,
  type CanonicalFileRecord,
  type CanonicalHotspotRecord,
  type CanonicalImpactOpportunityRecord,
  type CanonicalReportContext,
  type CanonicalUnitRecord,
  type CodeCityBuilding,
  type CodeCityCoverage,
  type CodeCityDependencyEdge,
  type CodeCityDiagnostic,
  type CodeCityDistrict,
  type CodeCityEvidenceKind,
  type CodeCityEvidenceRef,
  CodeCityInputError,
  type CodeCityLegend,
  type CodeCityModel,
  type CodeCitySignals,
  type CodeCitySnapshotInput,
  type CodeCitySourceSet,
  type CodeCityUnit,
} from "./CodeCityModel.js"

type FileDraft = {
  readonly id: string
  relativePath: string
  extension: string
  sourceSets: Set<CodeCitySourceSet>
  components: Set<string>
  concerns: Set<string>
  linesOfCode: number
  commitsCount: number | null
  contributorIds: Set<string>
}

type DistrictDraft = {
  readonly id: string
  readonly kind: "component" | "path"
  readonly label: string
  readonly decompositionKey: string | null
  readonly pathPrefix: string | null
  readonly buildingIds: Set<string>
  loc: number
  commits: number | null
  contributorIds: Set<string>
  unitCount: number
  maxMcCabe: number | null
  derived: boolean
}

type HotspotEntry = {
  readonly record: CanonicalHotspotRecord
  readonly kind: CodeCityEvidenceKind
}

const LEGEND: CodeCityLegend = {
  channels: [
    {
      id: "footprint",
      label: "Footprint",
      unit: "LOC",
      source: "files_main.json/files_test.json",
    },
    {
      id: "complexity",
      label: "Complexity",
      unit: "McCabe index",
      source: "units.json",
    },
    {
      id: "health",
      label: "Health",
      unit: "score",
      source: "hotspots.json",
    },
    {
      id: "change_pressure",
      label: "Change pressure",
      unit: "commits",
      source: "files_main.json/files_test.json/hotspots.json",
    },
    {
      id: "ownership",
      label: "Ownership",
      unit: "contributors",
      source: "files_main.json/files_test.json",
    },
    {
      id: "impact",
      label: "Impact",
      unit: "score",
      source: "impact.json",
    },
  ],
}

function assertValidInput(input: CodeCitySnapshotInput): {
  readonly context: CanonicalReportContext
} {
  const context = input?.context
  if (context?.dataVersion !== 2) {
    throw new CodeCityInputError("invalid_context", "Code City requires a v2 report context")
  }

  if (typeof context.repositoryId !== "string" || context.repositoryId.trim().length === 0) {
    throw new CodeCityInputError("missing_repository", "Code City requires a repository identity")
  }

  if (!input.filesMain || !Array.isArray(input.filesMain.files)) {
    throw new CodeCityInputError("missing_files_main", "Code City requires the files_main shard")
  }

  return { context }
}

function normalisePath(value: string): string {
  return value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^(?:\.\/)+/, "")
    .replace(/\/{2,}/g, "/")
}

function pathDistrictId(relativePath: string): string {
  const normalisedPath = normalisePath(relativePath)
  const [firstSegment] = normalisedPath.split("/")
  return `path:${firstSegment || "root"}`
}

function finiteNonNegative(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0
}

function optionalCount(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null
}

function stableCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(stableCompare)
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

function sortEvidence(evidence: readonly CodeCityEvidenceRef[]): CodeCityEvidenceRef[] {
  return [...evidence].sort((left, right) =>
    stableCompare(`${left.kind}:${left.id}:${left.route ?? ""}`, `${right.kind}:${right.id}:${right.route ?? ""}`),
  )
}

function sortDiagnostics(diagnostics: readonly CodeCityDiagnostic[]): CodeCityDiagnostic[] {
  return [...diagnostics].sort((left, right) =>
    stableCompare(
      `${left.code}:${left.shard}:${left.entityId ?? ""}:${left.detail}`,
      `${right.code}:${right.shard}:${right.entityId ?? ""}:${right.detail}`,
    ),
  )
}

function emptySignals(): CodeCitySignals {
  return {
    footprint: { loc: 0, buildingCount: 0 },
    complexity: { maxMcCabe: null, unitCount: 0 },
    health: { score: null, severity: null, dominantDimension: null },
    change: { commits: null, temporalLinks: null },
    ownership: { contributorIds: [], contributorCount: 0 },
    impact: { score: null, dimension: null, sourceId: null },
  }
}

function signalsForFile(file: FileDraft): CodeCitySignals {
  return {
    ...emptySignals(),
    footprint: {
      loc: file.linesOfCode,
      buildingCount: 1,
    },
    change: {
      commits: file.commitsCount,
      temporalLinks: null,
    },
    ownership: {
      contributorIds: sortedUnique(file.contributorIds),
      contributorCount: file.contributorIds.size,
    },
  }
}

function signalsForDistrict(district: DistrictDraft): CodeCitySignals {
  return {
    ...emptySignals(),
    footprint: {
      loc: district.loc,
      buildingCount: district.buildingIds.size,
    },
    complexity: {
      maxMcCabe: district.maxMcCabe,
      unitCount: district.unitCount,
    },
    change: {
      commits: district.commits,
      temporalLinks: null,
    },
    ownership: {
      contributorIds: sortedUnique(district.contributorIds),
      contributorCount: district.contributorIds.size,
    },
  }
}

function mergeFileRecord(draft: FileDraft, record: CanonicalFileRecord, sourceSet: CodeCitySourceSet): void {
  draft.sourceSets.add(sourceSet)
  if (record.relativePath) {
    const relativePath = normalisePath(record.relativePath)
    if (relativePath.length > 0) draft.relativePath = relativePath
  }
  if (record.extension?.trim()) draft.extension = record.extension.trim()
  draft.linesOfCode = Math.max(draft.linesOfCode, finiteNonNegative(record.linesOfCode))
  const commitsCount = optionalCount(record.commitsCount)
  if (commitsCount !== null) {
    draft.commitsCount = draft.commitsCount === null ? commitsCount : Math.max(draft.commitsCount, commitsCount)
  }
  for (const component of record.components ?? []) {
    if (component.trim()) draft.components.add(component.trim())
  }
  for (const concern of record.concerns ?? []) {
    if (concern.trim()) draft.concerns.add(concern.trim())
  }
  for (const contributor of record.contributors ?? []) {
    if (contributor.trim()) draft.contributorIds.add(contributor.trim())
  }
}

function collectFiles(input: CodeCitySnapshotInput): {
  readonly files: Map<string, FileDraft>
  readonly diagnostics: CodeCityDiagnostic[]
} {
  const files = new Map<string, FileDraft>()
  const diagnostics: CodeCityDiagnostic[] = []
  const shards: Array<[CodeCitySourceSet, readonly CanonicalFileRecord[], string]> = [
    ["main", input.filesMain.files ?? [], "files_main.json"],
  ]
  if (input.filesTest) {
    shards.push(["test", input.filesTest.files ?? [], "files_test.json"])
  }

  for (const [sourceSet, records, shard] of shards) {
    for (const [index, record] of records.entries()) {
      const id = typeof record.id === "string" ? record.id.trim() : ""
      const relativePath = typeof record.relativePath === "string" ? normalisePath(record.relativePath) : ""
      if (!id || !relativePath) {
        diagnostics.push({
          code: "malformed_record",
          severity: "warning",
          shard,
          entityId: id || `record:${index}`,
          detail: "File records require a stable id and relativePath",
        })
        continue
      }

      let draft = files.get(id)
      if (!draft) {
        draft = {
          id,
          relativePath,
          extension: typeof record.extension === "string" ? record.extension.trim() : "",
          sourceSets: new Set<CodeCitySourceSet>(),
          components: new Set<string>(),
          concerns: new Set<string>(),
          linesOfCode: 0,
          commitsCount: null,
          contributorIds: new Set<string>(),
        }
        files.set(id, draft)
      }
      mergeFileRecord(draft, record, sourceSet)
    }
  }

  for (const file of files.values()) {
    if (!file.extension) {
      const extension = file.relativePath.split(".").at(-1)
      file.extension = extension && extension !== file.relativePath ? extension : ""
    }
  }

  return { files, diagnostics }
}

function normaliseComponentPart(value: string): string {
  return value.trim().replace(/\s+/g, "-")
}

function componentId(decompositionKey: string, name: string): string {
  return `component:${normaliseComponentPart(decompositionKey)}:${name.trim()}`
}

function componentNameFromId(id: string): string {
  const parts = id.split(":")
  return parts.at(-1)?.trim() ?? id
}

function componentKeyFromId(id: string): string | null {
  const parts = id.split(":")
  return parts.length >= 3 ? parts[1]!.trim() || null : null
}

function componentEndpointId(
  decompositionKey: string | undefined,
  name: string | undefined,
  canonicalId: string | undefined,
): string | null {
  const explicitId = canonicalId?.trim()
  if (explicitId) return explicitId
  const normalisedKey = decompositionKey?.trim()
  const normalisedName = name?.trim()
  if (!normalisedKey || !normalisedName) return null
  return componentId(normalisedKey, normalisedName)
}

function ensureComponentDraft(
  districtDrafts: Map<string, DistrictDraft>,
  id: string,
  decompositionKey?: string,
  name?: string,
): DistrictDraft {
  let district = districtDrafts.get(id)
  if (district) return district
  const parsedKey = componentKeyFromId(id)
  const label = name?.trim() || componentNameFromId(id)
  const key = decompositionKey?.trim() || parsedKey
  district = {
    id,
    kind: "component",
    label,
    decompositionKey: key,
    pathPrefix: null,
    buildingIds: new Set<string>(),
    loc: 0,
    commits: null,
    contributorIds: new Set<string>(),
    unitCount: 0,
    maxMcCabe: null,
    derived: true,
  }
  districtDrafts.set(id, district)
  return district
}

function collectComponentCandidates(
  input: CodeCitySnapshotInput,
  districtDrafts: Map<string, DistrictDraft>,
): Map<string, string[]> {
  const componentIdsByName = new Map<string, Set<string>>()
  for (const dependency of input.componentDependencies?.dependencies ?? []) {
    for (const [name, canonicalId] of [
      [dependency.fromComponent, dependency.fromComponentId],
      [dependency.toComponent, dependency.toComponentId],
    ] as const) {
      const id = componentEndpointId(dependency.decompositionKey, name, canonicalId)
      if (!id) continue
      const key = name?.trim() || componentNameFromId(id)
      const candidates = componentIdsByName.get(key) ?? new Set<string>()
      candidates.add(id)
      componentIdsByName.set(key, candidates)
      ensureComponentDraft(districtDrafts, id, dependency.decompositionKey, name)
    }
  }

  return new Map([...componentIdsByName.entries()].map(([name, ids]) => [name, sortedUnique(ids)]))
}

function rebuildDistrictMetrics(
  districtDrafts: ReadonlyMap<string, DistrictDraft>,
  buildingById: ReadonlyMap<string, CodeCityBuilding>,
  unitById: ReadonlyMap<string, CodeCityUnit>,
): void {
  for (const district of districtDrafts.values()) {
    district.loc = 0
    district.commits = null
    district.contributorIds.clear()
    district.unitCount = 0
    district.maxMcCabe = null
  }
  for (const building of buildingById.values()) {
    for (const districtId of building.districtIds) {
      const district = districtDrafts.get(districtId)
      if (!district) continue
      district.loc += building.metrics.footprint.loc
      const commits = building.metrics.change.commits
      if (commits !== null) {
        district.commits = district.commits === null ? commits : district.commits + commits
      }
      for (const contributor of building.metrics.ownership.contributorIds) {
        district.contributorIds.add(contributor)
      }
    }
  }
  for (const unit of unitById.values()) {
    for (const districtId of unit.districtIds) {
      const district = districtDrafts.get(districtId)
      if (!district) continue
      district.unitCount += 1
      district.maxMcCabe =
        district.maxMcCabe === null ? unit.mcCabeIndex : Math.max(district.maxMcCabe, unit.mcCabeIndex)
    }
  }
}

function signalsForUnit(record: CanonicalUnitRecord): CodeCitySignals {
  return {
    ...emptySignals(),
    footprint: {
      loc: finiteNonNegative(record.linesOfCode),
      buildingCount: 0,
    },
  }
}

function unitFromRecord(record: CanonicalUnitRecord, file: CodeCityBuilding): CodeCityUnit | null {
  const id = typeof record.id === "string" ? record.id.trim() : ""
  if (!id) return null
  return {
    id,
    fileId: file.id,
    shortName: record.shortName?.trim() || id,
    longName: record.longName?.trim() || record.shortName?.trim() || id,
    relativeFileName: file.relativePath,
    linesOfCode: finiteNonNegative(record.linesOfCode),
    mcCabeIndex: finiteNonNegative(record.mcCabeIndex),
    numberOfParameters: finiteNonNegative(record.numberOfParameters),
    startLine: finiteNonNegative(record.startLine),
    endLine: finiteNonNegative(record.endLine),
    districtIds: file.districtIds,
    metrics: signalsForUnit(record),
    evidence: [],
  }
}

function collectUnits(
  input: CodeCitySnapshotInput,
  buildingById: ReadonlyMap<string, CodeCityBuilding>,
  districtDrafts: ReadonlyMap<string, DistrictDraft>,
  diagnostics: CodeCityDiagnostic[],
): Map<string, CodeCityUnit> {
  const filesByPath = new Map<string, CodeCityBuilding>()
  for (const building of buildingById.values()) {
    if (!filesByPath.has(building.relativePath)) {
      filesByPath.set(building.relativePath, building)
    }
  }
  const units = new Map<string, CodeCityUnit>()
  for (const [index, record] of (input.units?.units ?? []).entries()) {
    const id = typeof record.id === "string" ? record.id.trim() : ""
    const relativeFileName = typeof record.relativeFileName === "string" ? normalisePath(record.relativeFileName) : ""
    if (!id) {
      diagnostics.push({
        code: "malformed_record",
        severity: "warning",
        shard: "units.json",
        entityId: `record:${index}`,
        detail: "Unit records require a stable id",
      })
      continue
    }
    const building = filesByPath.get(relativeFileName)
    if (!building) {
      diagnostics.push({
        code: "orphan_unit",
        severity: "warning",
        shard: "units.json",
        entityId: id,
        detail: `No file building matches ${relativeFileName || "the unit file"}`,
      })
      continue
    }
    const unit = unitFromRecord(record, building)
    if (unit) units.set(unit.id, unit)
  }
  for (const unit of units.values()) {
    for (const districtId of unit.districtIds) {
      if (!districtDrafts.has(districtId)) {
        diagnostics.push({
          code: "orphan_unit",
          severity: "warning",
          shard: "units.json",
          entityId: unit.id,
          detail: `Unit district ${districtId} is not present`,
        })
      }
    }
  }
  return units
}

function dependencyEdge(
  dependency: CanonicalComponentDependencyRecord,
  districtDrafts: Map<string, DistrictDraft>,
  diagnostics: CodeCityDiagnostic[],
): CodeCityDependencyEdge {
  const decompositionKey = dependency.decompositionKey?.trim() || "unknown"
  const sourceDistrictId = componentEndpointId(
    dependency.decompositionKey,
    dependency.fromComponent,
    dependency.fromComponentId,
  )
  const targetDistrictId = componentEndpointId(
    dependency.decompositionKey,
    dependency.toComponent,
    dependency.toComponentId,
  )
  if (sourceDistrictId) {
    ensureComponentDraft(districtDrafts, sourceDistrictId, dependency.decompositionKey, dependency.fromComponent)
  }
  if (targetDistrictId) {
    ensureComponentDraft(districtDrafts, targetDistrictId, dependency.decompositionKey, dependency.toComponent)
  }
  const edgeId = `${decompositionKey}:${sourceDistrictId ?? "null"}->${targetDistrictId ?? "null"}`
  if (!sourceDistrictId || !targetDistrictId) {
    diagnostics.push({
      code: "unresolved_edge",
      severity: "warning",
      shard: "component_dependencies.json",
      entityId: edgeId,
      detail: "Dependency endpoints require a component id or decomposition/name pair",
    })
  }
  return {
    id: edgeId,
    kind: "component_dependency",
    decompositionKey,
    sourceDistrictId,
    targetDistrictId,
    count: finiteNonNegative(dependency.count),
    locFrom: optionalCount(dependency.locFrom),
    evidenceCount: optionalCount(dependency.evidenceCount),
    resolution:
      sourceDistrictId && targetDistrictId
        ? "both"
        : sourceDistrictId
          ? "source"
          : targetDistrictId
            ? "target"
            : "none",
    evidence: [],
  }
}

function evidenceRef(kind: CodeCityEvidenceKind, id: string, route: string | undefined): CodeCityEvidenceRef {
  return {
    kind,
    id,
    route: route?.trim() || null,
  }
}

function indexHotspots(
  shard: CodeCitySnapshotInput["hotspots"],
  diagnostics: CodeCityDiagnostic[],
): Map<string, HotspotEntry> {
  const hotspotIndex = new Map<string, HotspotEntry>()
  const collections: readonly [CodeCityEvidenceKind, readonly CanonicalHotspotRecord[] | undefined, string][] = [
    ["file", shard?.fileHotspots, "fileHotspots"],
    ["unit", shard?.unitHotspots, "unitHotspots"],
    ["component", shard?.componentHotspots, "componentHotspots"],
  ]
  for (const [kind, records, collection] of collections) {
    for (const [position, record] of (records ?? []).entries()) {
      const id = typeof record.id === "string" ? record.id.trim() : ""
      if (!id) {
        diagnostics.push({
          code: "malformed_record",
          severity: "warning",
          shard: "hotspots.json",
          entityId: `hotspot:${collection}:${position}`,
          detail: "Hotspot records require a stable id",
        })
        continue
      }
      hotspotIndex.set(id, { record, kind })
    }
  }
  return hotspotIndex
}

function indexImpact(
  shard: CodeCitySnapshotInput["impact"],
  diagnostics: CodeCityDiagnostic[],
): Map<string, CanonicalImpactOpportunityRecord> {
  const index = new Map<string, CanonicalImpactOpportunityRecord>()
  for (const [position, record] of (shard?.impact_opportunities ?? []).entries()) {
    const id = typeof record.id === "string" ? record.id.trim() : ""
    if (!id) {
      diagnostics.push({
        code: "malformed_record",
        severity: "warning",
        shard: "impact.json",
        entityId: `impact:${position}`,
        detail: "Impact opportunities require a stable id",
      })
      continue
    }
    index.set(id, record)
  }
  return index
}

function hotspotDimension(record: CanonicalHotspotRecord): string | null {
  if (record.dominantDimension?.trim()) return record.dominantDimension.trim()
  const dimensions = record.dimensions
  if (!dimensions) return null
  const strongest = Object.entries(dimensions)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => (right[1] as number) - (left[1] as number))
  return strongest[0]?.[0] ?? null
}

function applyHotspot(metrics: CodeCitySignals, record: CanonicalHotspotRecord): CodeCitySignals {
  return {
    ...metrics,
    health: {
      score: optionalCount(record.score),
      severity: record.severity?.trim() || null,
      dominantDimension: hotspotDimension(record),
    },
    change: {
      ...metrics.change,
      temporalLinks: optionalCount(record.temporalLinks),
    },
  }
}

function applyImpact(metrics: CodeCitySignals, record: CanonicalImpactOpportunityRecord): CodeCitySignals {
  return {
    ...metrics,
    impact: {
      score: optionalCount(record.impact_score),
      dimension: record.dominant_dimension?.trim() || null,
      sourceId: record.id?.trim() || null,
    },
  }
}

function highestHotspot(entries: Iterable<HotspotEntry | undefined>): HotspotEntry | null {
  return (
    [...entries]
      .filter((entry): entry is HotspotEntry => entry !== undefined && optionalCount(entry.record.score) !== null)
      .sort((left, right) => {
        const scoreDelta = optionalCount(right.record.score)! - optionalCount(left.record.score)!
        return scoreDelta || stableCompare(left.record.id ?? "", right.record.id ?? "")
      })[0] ?? null
  )
}

function highestImpact(
  entries: Iterable<CanonicalImpactOpportunityRecord | undefined>,
): CanonicalImpactOpportunityRecord | null {
  return (
    [...entries]
      .filter(
        (entry): entry is CanonicalImpactOpportunityRecord =>
          entry !== undefined && optionalCount(entry.impact_score) !== null,
      )
      .sort((left, right) => {
        const scoreDelta = optionalCount(right.impact_score)! - optionalCount(left.impact_score)!
        return scoreDelta || stableCompare(left.id ?? "", right.id ?? "")
      })[0] ?? null
  )
}

function addOrphanSignalDiagnostics(
  hotspots: ReadonlyMap<string, HotspotEntry>,
  impact: ReadonlyMap<string, CanonicalImpactOpportunityRecord>,
  buildingById: ReadonlyMap<string, CodeCityBuilding>,
  units: ReadonlyMap<string, CodeCityUnit>,
  districtDrafts: ReadonlyMap<string, DistrictDraft>,
  diagnostics: CodeCityDiagnostic[],
): void {
  for (const [id, entry] of hotspots) {
    const exists =
      entry.kind === "file" ? buildingById.has(id) : entry.kind === "unit" ? units.has(id) : districtDrafts.has(id)
    if (!exists) {
      diagnostics.push({
        code: "orphan_hotspot",
        severity: "warning",
        shard: "hotspots.json",
        entityId: id,
        detail: `Hotspot ${id} does not match a ${entry.kind} entity`,
      })
    }
  }
  for (const [id, record] of impact) {
    if (!buildingById.has(id) && !units.has(id) && !districtDrafts.has(id)) {
      diagnostics.push({
        code: "orphan_impact",
        severity: "warning",
        shard: "impact.json",
        entityId: id,
        detail: `Impact opportunity ${record.id ?? id} does not match a model entity`,
      })
    }
  }
}

function addUnitMetricsToBuildings(
  buildingById: Map<string, CodeCityBuilding>,
  units: ReadonlyMap<string, CodeCityUnit>,
): void {
  const unitsByBuilding = new Map<string, CodeCityUnit[]>()
  for (const unit of units.values()) {
    if (!unit.fileId) continue
    const list = unitsByBuilding.get(unit.fileId) ?? []
    list.push(unit)
    unitsByBuilding.set(unit.fileId, list)
  }
  for (const [buildingId, building] of buildingById) {
    const childUnits = unitsByBuilding.get(buildingId) ?? []
    const maxMcCabe = childUnits.reduce<number | null>(
      (max, unit) => (max === null ? unit.mcCabeIndex : Math.max(max, unit.mcCabeIndex)),
      null,
    )
    buildingById.set(buildingId, {
      ...building,
      metrics: {
        ...building.metrics,
        complexity: {
          maxMcCabe,
          unitCount: childUnits.length,
        },
      },
    })
  }
}

function districtPresentation(
  district: DistrictDraft,
  units: ReadonlyMap<string, CodeCityUnit>,
  hotspots: ReadonlyMap<string, HotspotEntry>,
  impact: ReadonlyMap<string, CanonicalImpactOpportunityRecord>,
): {
  readonly metrics: CodeCitySignals
  readonly evidence: readonly CodeCityEvidenceRef[]
  readonly derived: boolean
} {
  const baseMetrics = signalsForDistrict(district)
  const childHotspots: HotspotEntry[] = []
  for (const buildingId of district.buildingIds) {
    const hotspot = hotspots.get(buildingId)
    if (hotspot) childHotspots.push(hotspot)
  }
  for (const unit of units.values()) {
    if (!unit.districtIds.includes(district.id)) continue
    const hotspot = hotspots.get(unit.id)
    if (hotspot) childHotspots.push(hotspot)
  }
  const directHotspot = district.kind === "component" ? hotspots.get(district.id) : undefined
  const healthSource = directHotspot ?? highestHotspot(childHotspots)
  const childImpacts = [
    ...[...district.buildingIds].map((buildingId) => impact.get(buildingId)),
    ...[...units.values()].filter((unit) => unit.districtIds.includes(district.id)).map((unit) => impact.get(unit.id)),
  ]
  const directImpact = district.kind === "component" ? impact.get(district.id) : undefined
  const impactSource = directImpact ?? highestImpact(childImpacts)
  let metrics = baseMetrics
  const evidence: CodeCityEvidenceRef[] = []
  if (healthSource) {
    metrics = applyHotspot(metrics, healthSource.record)
    if (healthSource.record.id) {
      evidence.push(evidenceRef(healthSource.kind, healthSource.record.id, healthSource.record.route))
    }
  }
  if (impactSource) {
    metrics = applyImpact(metrics, impactSource)
    evidence.push(evidenceRef("impact", impactSource.id ?? "", impactSource.route))
  }
  if (!healthSource) {
    const temporalLinks = childHotspots
      .map((entry) => optionalCount(entry.record.temporalLinks))
      .filter((value): value is number => value !== null)
      .sort((left, right) => right - left)[0]
    if (temporalLinks !== undefined) {
      metrics = {
        ...metrics,
        change: { ...metrics.change, temporalLinks },
      }
    }
  }
  return {
    metrics,
    evidence,
    derived: !(directHotspot || directImpact),
  }
}

function createCoverage(
  input: CodeCitySnapshotInput,
  diagnostics: readonly CodeCityDiagnostic[],
  derivedDistrictIds: readonly string[],
  counts: CodeCityCoverage["counts"],
): CodeCityCoverage {
  const presentShards = ["report_context.json", "files_main.json"]
  const optionalInputs: readonly [string, unknown][] = [
    ["files_test.json", input.filesTest],
    ["units.json", input.units],
    ["component_dependencies.json", input.componentDependencies],
    ["hotspots.json", input.hotspots],
    ["impact.json", input.impact],
  ]
  const missingOptionalShards: string[] = []
  for (const [shard, value] of optionalInputs) {
    if (value === undefined) missingOptionalShards.push(shard)
    else presentShards.push(shard)
  }

  return {
    presentShards,
    missingOptionalShards,
    diagnostics,
    derivedDistrictIds,
    counts,
  }
}

function snapshotFromContext(context: CanonicalReportContext) {
  return {
    repositoryId: context.repositoryId!.trim(),
    title:
      typeof context.title === "string" && context.title.trim() ? context.title.trim() : context.repositoryId!.trim(),
    ...(context.snapshotId?.trim() ? { snapshotId: context.snapshotId.trim() } : {}),
    ...(context.generatedAt?.trim() ? { generatedAt: context.generatedAt.trim() } : {}),
  }
}

export function buildCodeCityModel(input: CodeCitySnapshotInput): CodeCityModel {
  const { context } = assertValidInput(input)
  const { files, diagnostics } = collectFiles(input)
  const districtDrafts = new Map<string, DistrictDraft>()
  const buildingById = new Map<string, CodeCityBuilding>()

  for (const file of files.values()) {
    const districtId = pathDistrictId(file.relativePath)
    const pathPrefix = districtId.slice("path:".length)
    let district = districtDrafts.get(districtId)
    if (!district) {
      district = {
        id: districtId,
        kind: "path",
        label: pathPrefix,
        decompositionKey: null,
        pathPrefix,
        buildingIds: new Set<string>(),
        loc: 0,
        commits: null,
        contributorIds: new Set<string>(),
        unitCount: 0,
        maxMcCabe: null,
        derived: true,
      }
      districtDrafts.set(districtId, district)
    }
    district.buildingIds.add(file.id)
    buildingById.set(file.id, {
      id: file.id,
      relativePath: file.relativePath,
      extension: file.extension,
      sourceSets: sortedUnique(file.sourceSets) as CodeCitySourceSet[],
      components: sortedUnique(file.components),
      districtIds: [districtId],
      primaryDistrictId: districtId,
      metrics: signalsForFile(file),
      evidence: [],
    })
  }

  const componentIdsByName = collectComponentCandidates(input, districtDrafts)
  for (const [buildingId, building] of buildingById) {
    const pathDistrictIdForBuilding = building.primaryDistrictId
    const affiliations = new Set<string>()
    let hasAmbiguousComponent = false
    for (const componentName of building.components) {
      const candidates = componentIdsByName.get(componentName) ?? []
      if (candidates.length === 1) affiliations.add(candidates[0]!)
      if (candidates.length > 1) {
        hasAmbiguousComponent = true
        diagnostics.push({
          code: "ambiguous_component",
          severity: "warning",
          shard: "component_dependencies.json",
          entityId: buildingId,
          detail: `Component ${componentName} resolves to multiple districts`,
        })
      }
    }
    if (affiliations.size === 0) continue

    const districtIds = sortedUnique([...affiliations, ...(hasAmbiguousComponent ? [pathDistrictIdForBuilding] : [])])
    const primaryDistrictId = hasAmbiguousComponent ? pathDistrictIdForBuilding : districtIds[0]!
    buildingById.set(buildingId, {
      ...building,
      districtIds,
      primaryDistrictId,
    })
    for (const districtId of districtIds) {
      const district = districtDrafts.get(districtId)
      if (district) district.buildingIds.add(buildingId)
    }
    if (!hasAmbiguousComponent) {
      districtDrafts.get(pathDistrictIdForBuilding)?.buildingIds.delete(buildingId)
    }
  }

  const units = collectUnits(input, buildingById, districtDrafts, diagnostics)
  const edges = (input.componentDependencies?.dependencies ?? []).map((dependency) =>
    dependencyEdge(dependency, districtDrafts, diagnostics),
  )
  const hotspots = indexHotspots(input.hotspots, diagnostics)
  const impact = indexImpact(input.impact, diagnostics)
  addOrphanSignalDiagnostics(hotspots, impact, buildingById, units, districtDrafts, diagnostics)
  for (const [buildingId, building] of buildingById) {
    const hotspot = hotspots.get(buildingId)
    const opportunity = impact.get(buildingId)
    let metrics = building.metrics
    const evidence: CodeCityEvidenceRef[] = []
    if (hotspot?.kind === "file") {
      metrics = applyHotspot(metrics, hotspot.record)
      evidence.push(evidenceRef("file", buildingId, hotspot.record.route))
    }
    if (opportunity) {
      metrics = applyImpact(metrics, opportunity)
      evidence.push(evidenceRef("impact", buildingId, opportunity.route))
    }
    if (hotspot || opportunity) {
      buildingById.set(buildingId, {
        ...building,
        metrics,
        evidence: sortEvidence(evidence),
      })
    }
  }
  for (const [unitId, unit] of units) {
    const hotspot = hotspots.get(unitId)
    const opportunity = impact.get(unitId)
    let metrics = unit.metrics
    const evidence: CodeCityEvidenceRef[] = []
    if (hotspot?.kind === "unit") {
      metrics = applyHotspot(metrics, hotspot.record)
      evidence.push(evidenceRef("unit", unitId, hotspot.record.route))
    }
    if (opportunity) {
      metrics = applyImpact(metrics, opportunity)
      evidence.push(evidenceRef("impact", unitId, opportunity.route))
    }
    if (hotspot || opportunity) {
      units.set(unitId, {
        ...unit,
        metrics,
        evidence: sortEvidence(evidence),
      })
    }
  }
  addUnitMetricsToBuildings(buildingById, units)
  rebuildDistrictMetrics(districtDrafts, buildingById, units)

  const sortedBuildings = [...buildingById.values()].sort((left, right) => stableCompare(left.id, right.id))
  const sortedUnits = [...units.values()].sort((left, right) => stableCompare(left.id, right.id))
  const sortedEdges = [...edges].sort((left, right) => stableCompare(left.id, right.id))
  const sortedDistricts: CodeCityDistrict[] = [...districtDrafts.values()]
    .filter((district) => district.kind !== "path" || district.buildingIds.size > 0)
    .map((district) => {
      const presentation = districtPresentation(district, units, hotspots, impact)
      district.derived = presentation.derived
      return {
        id: district.id,
        kind: district.kind,
        label: district.label,
        decompositionKey: district.decompositionKey,
        pathPrefix: district.pathPrefix,
        buildingIds: [...district.buildingIds].sort(stableCompare),
        metrics: presentation.metrics,
        evidence: sortEvidence(presentation.evidence),
        derived: presentation.derived,
      }
    })
    .sort((left, right) => stableCompare(left.id, right.id))
  const sortedDiagnostics = sortDiagnostics(diagnostics)
  const derivedDistrictIds = sortedDistricts.filter(({ derived }) => derived).map(({ id }) => id)
  const counts = {
    files: sortedBuildings.length,
    districts: sortedDistricts.length,
    units: sortedUnits.length,
    edges: sortedEdges.length,
    diagnostics: sortedDiagnostics.length,
  }

  return {
    contractVersion: 1,
    snapshot: snapshotFromContext(context),
    districts: sortedDistricts,
    buildings: sortedBuildings,
    units: sortedUnits,
    edges: sortedEdges,
    coverage: createCoverage(input, sortedDiagnostics, derivedDistrictIds, counts),
    layout: {
      contractVersion: 1,
      seed: `code-city-v1:${stableHash(context.repositoryId!.trim())}`,
      districtOrder: sortedDistricts.map(({ id }) => id),
      buildingOrder: sortedBuildings.map(({ id }) => id),
      unitOrder: sortedUnits.map(({ id }) => id),
    },
    legend: LEGEND,
  }
}
