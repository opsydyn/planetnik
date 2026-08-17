import {
  type CanonicalComponentDependenciesShard,
  type CanonicalComponentDependencyRecord,
  type CanonicalFileRecord,
  type CanonicalFilesShard,
  type CanonicalHotspotRecord,
  type CanonicalHotspotsShard,
  type CanonicalImpactShard,
  type CanonicalReportContext,
  type CanonicalUnitRecord,
  type CanonicalUnitsShard,
  CodeCityInputError,
  type CodeCitySnapshotInput,
} from "@planetnik/common"
import { type CodeCityCollectionEntry, toCodeCitySnapshotInput } from "./codeCitySnapshot.js"
import { readLandscapeRepoJson } from "./landscape.js"

export type LandscapeCodeCitySnapshotRecords = {
  readonly context: CanonicalReportContext | null
  readonly filesMain: readonly CanonicalFileRecord[] | null
  readonly filesTest: readonly CanonicalFileRecord[]
  readonly units: readonly CanonicalUnitRecord[]
  readonly dependencies: readonly CanonicalComponentDependencyRecord[]
  readonly hotspots: readonly CanonicalHotspotRecord[]
  readonly impact: CanonicalImpactShard | undefined
}

export type LandscapeCodeCityJsonReader = <T>(repoKey: string, fileName: string) => T | null

const entries = <T>(records: readonly T[]): CodeCityCollectionEntry<T>[] => records.map((data) => ({ data }))

export function toLandscapeCodeCitySnapshotInput(records: LandscapeCodeCitySnapshotRecords): CodeCitySnapshotInput {
  const context = records.context
  if (
    context?.dataVersion !== 2 ||
    context.mode !== "single_repository" ||
    context.reportMode !== "single_repository"
  ) {
    throw new CodeCityInputError(
      "invalid_context",
      "Landscape repository Code City requires a v2 single-repository report context",
    )
  }

  if (!records.filesMain) {
    throw new CodeCityInputError("missing_files_main", "Landscape repository Code City requires the files_main shard")
  }

  return toCodeCitySnapshotInput({
    context,
    filesMain: entries(records.filesMain),
    filesTest: entries(records.filesTest),
    units: entries(records.units),
    dependencies: entries(records.dependencies),
    hotspots: entries(records.hotspots),
    impact: records.impact,
  })
}

const defaultReader: LandscapeCodeCityJsonReader = <T>(repoKey: string, fileName: string) =>
  readLandscapeRepoJson<T>(repoKey, fileName)

export function readLandscapeRepositoryCodeCitySnapshot(
  repoKey: string,
  readJson: LandscapeCodeCityJsonReader = defaultReader,
): CodeCitySnapshotInput {
  const filesMainExport = readJson<CanonicalFilesShard>(repoKey, "files_main.json")
  const filesTestExport = readJson<CanonicalFilesShard>(repoKey, "files_test.json")
  const unitsExport = readJson<CanonicalUnitsShard>(repoKey, "units.json")
  const dependenciesExport = readJson<CanonicalComponentDependenciesShard>(repoKey, "component_dependencies.json")
  const hotspotsExport = readJson<CanonicalHotspotsShard>(repoKey, "hotspots.json")

  return toLandscapeCodeCitySnapshotInput({
    context: readJson<CanonicalReportContext>(repoKey, "report_context.json"),
    filesMain: filesMainExport?.files ?? null,
    filesTest: filesTestExport?.files ?? [],
    units: unitsExport?.units ?? [],
    dependencies: dependenciesExport?.dependencies ?? [],
    hotspots: [
      ...(hotspotsExport?.fileHotspots ?? []),
      ...(hotspotsExport?.unitHotspots ?? []),
      ...(hotspotsExport?.componentHotspots ?? []),
    ],
    impact: readJson<CanonicalImpactShard>(repoKey, "impact.json") ?? undefined,
  })
}
