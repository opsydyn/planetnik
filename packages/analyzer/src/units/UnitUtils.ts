import type { LogicalDecomposition } from "../aspects/LogicalDecomposition.js"
import type { Thresholds } from "../core/Thresholds.js"
import { RiskDistributionStats } from "../metrics/RiskDistributionStats.js"
import type { UnitInfo } from "./UnitInfo.js"

export class UnitUtils {
  static getLinesOfCode(units: UnitInfo[]): number {
    return units.reduce((sum, u) => sum + u.linesOfCode, 0)
  }

  static getUnitSizeDistribution(units: UnitInfo[], thresholds: Thresholds): RiskDistributionStats {
    const stats = new RiskDistributionStats(thresholds.low, thresholds.medium, thresholds.high, thresholds.veryHigh)
    stats.key = "system"
    for (const unit of units) {
      stats.update(unit.linesOfCode, unit.linesOfCode)
    }
    return stats
  }

  static getConditionalComplexityDistribution(units: UnitInfo[], thresholds: Thresholds): RiskDistributionStats {
    const stats = new RiskDistributionStats(thresholds.low, thresholds.medium, thresholds.high, thresholds.veryHigh)
    stats.key = "system"
    for (const unit of units) {
      stats.update(unit.mcCabeIndex, unit.linesOfCode)
    }
    return stats
  }

  static getUnitSizeDistributionPerExtension(units: UnitInfo[], thresholds: Thresholds): RiskDistributionStats[] {
    return UnitUtils.getDistributionPerExtension(units, thresholds, (u) => u.linesOfCode)
  }

  static getConditionalComplexityDistributionPerExtension(
    units: UnitInfo[],
    thresholds: Thresholds,
  ): RiskDistributionStats[] {
    return UnitUtils.getDistributionPerExtension(units, thresholds, (u) => u.mcCabeIndex)
  }

  private static getDistributionPerExtension(
    units: UnitInfo[],
    thresholds: Thresholds,
    getTestValue: (u: UnitInfo) => number,
  ): RiskDistributionStats[] {
    const extensionMap = new Map<string, RiskDistributionStats>()

    for (const unit of units) {
      const ext = unit.sourceFile?.extension ?? ""
      let stats = extensionMap.get(ext)
      if (!stats) {
        stats = new RiskDistributionStats(thresholds.low, thresholds.medium, thresholds.high, thresholds.veryHigh)
        stats.key = ext
        extensionMap.set(ext, stats)
      }
      stats.update(getTestValue(unit), unit.linesOfCode)
    }

    return Array.from(extensionMap.values())
  }

  static getUnitSizeDistributionPerComponent(
    logicalDecompositions: LogicalDecomposition[],
    units: UnitInfo[],
    thresholds: Thresholds,
  ): RiskDistributionStats[][] {
    return UnitUtils.getDistributionPerComponent(logicalDecompositions, units, thresholds, (u) => u.linesOfCode)
  }

  static getConditionalComplexityDistributionPerComponent(
    logicalDecompositions: LogicalDecomposition[],
    units: UnitInfo[],
    thresholds: Thresholds,
  ): RiskDistributionStats[][] {
    return UnitUtils.getDistributionPerComponent(logicalDecompositions, units, thresholds, (u) => u.mcCabeIndex)
  }

  private static getDistributionPerComponent(
    logicalDecompositions: LogicalDecomposition[],
    units: UnitInfo[],
    thresholds: Thresholds,
    getTestValue: (u: UnitInfo) => number,
  ): RiskDistributionStats[][] {
    const result: RiskDistributionStats[][] = []

    for (const decomposition of logicalDecompositions) {
      const group: RiskDistributionStats[] = []
      for (const component of decomposition.components) {
        const stats = new RiskDistributionStats(thresholds.low, thresholds.medium, thresholds.high, thresholds.veryHigh)
        stats.key = component.name

        const componentUnits = units.filter((u) => u.sourceFile?.isInLogicalComponent(component.name))
        for (const unit of componentUnits) {
          stats.update(getTestValue(unit), unit.linesOfCode)
        }
        group.push(stats)
      }
      result.push(group)
    }

    return result
  }
}
