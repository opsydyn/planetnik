import type { SourceFile } from "../aspects/SourceFile.js"
import type { RiskDistributionStats } from "../metrics/RiskDistributionStats.js"

export class FilesHistoryAnalysisResults {
  firstDate: string = ""
  latestDate: string = ""
  daysBetweenFirstAndLastDate: number = 0
  weeksBetweenFirstAndLastDate: number = 0
  estimatedWorkingDays: number = 0

  ageRiskDistribution: RiskDistributionStats | null = null
  freshnesssRiskDistribution: RiskDistributionStats | null = null
  changeDistribution: RiskDistributionStats | null = null
  contributorsCountDistribution: RiskDistributionStats | null = null

  ageRiskDistributionPerExtension: RiskDistributionStats[] = []
  freshnesssRiskDistributionPerExtension: RiskDistributionStats[] = []

  oldestFiles: SourceFile[] = []
  youngestFiles: SourceFile[] = []
  mostRecentlyChangedFiles: SourceFile[] = []
  mostPreviouslyChangedFiles: SourceFile[] = []
  mostChangedFiles: SourceFile[] = []
  filesWithMostContributors: SourceFile[] = []
  filesWithLeastContributors: SourceFile[] = []
}
