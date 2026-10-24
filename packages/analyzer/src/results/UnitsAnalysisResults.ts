import { RiskDistributionStats } from "../metrics/RiskDistributionStats.js"
import type { UnitInfo } from "../units/UnitInfo.js"

export class UnitsAnalysisResults {
  totalNumberOfUnits: number = 0
  linesOfCodeInUnits: number = 0

  unitSizeRiskDistribution: RiskDistributionStats = new RiskDistributionStats("system")
  conditionalComplexityRiskDistribution: RiskDistributionStats = new RiskDistributionStats("system")

  unitSizeRiskDistributionPerExtension: RiskDistributionStats[] = []
  unitSizeRiskDistributionPerComponent: RiskDistributionStats[][] = []

  conditionalComplexityRiskDistributionPerExtension: RiskDistributionStats[] = []
  conditionalComplexityRiskDistributionPerComponent: RiskDistributionStats[][] = []

  longestUnits: UnitInfo[] = []
  mostComplexUnits: UnitInfo[] = []

  // Not serialized
  allUnits: UnitInfo[] = []
}
