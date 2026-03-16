import type { UnitInfo } from "@planetnik/analyzer"

export interface UnitInfoExport {
  shortName: string
  longName: string
  relativeFileName: string
  linesOfCode: number
  mcCabeIndex: number
  numberOfParameters: number
  startLine: number
  endLine: number
  components: string[]
}

export interface UnitsExportInfo {
  timestamp: string
  srcRoot: string
  title: string
  totalUnitsCount: number
  totalLinesOfCode: number
  units: UnitInfoExport[]
}

export class UnitListExporter {
  static exportUnits(units: UnitInfo[], title: string, srcRoot: string, timestamp: string): UnitsExportInfo {
    const exportedUnits: UnitInfoExport[] = units
      .filter((u) => u.sourceFile)
      .map((u) => ({
        shortName: u.shortName,
        longName: u.longName || u.shortName,
        relativeFileName: u.sourceFile?.relativePath ?? "",
        linesOfCode: u.linesOfCode,
        mcCabeIndex: u.mcCabeIndex,
        numberOfParameters: u.numberOfParameters,
        startLine: u.startLine,
        endLine: u.endLine,
        components: u.sourceFile?.logicalComponents.map((c) => c.name) ?? [],
      }))

    return {
      timestamp,
      srcRoot,
      title,
      totalUnitsCount: exportedUnits.length,
      totalLinesOfCode: exportedUnits.reduce((sum, u) => sum + u.linesOfCode, 0),
      units: exportedUnits,
    }
  }
}
