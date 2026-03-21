import type { ContributionTimeSlot } from "../contributors/ContributionTimeSlot.js"
import type { Contributor } from "../contributors/Contributor.js"
import type { MetadataType } from "../core/Metadata.js"
import type { ComponentDependency } from "../dependencies/ComponentDependency.js"

export interface RepositoryAnalysisResult {
  name: string
  analysisResultsPath: string
  metadata: MetadataType
  mainLoc: number
  mainFilesCount: number
  testLoc: number
  testFilesCount: number
  generatedLoc: number
  buildAndDeployLoc: number
  otherLoc: number
  extensions: string[]
  linesOfCodePerExtension: { extension: string; linesOfCode: number }[]
  contributors: Contributor[]
  firstCommitDate: string
  latestCommitDate: string
  duplicationPercentage: number
}

export class LandscapeAnalysisResults {
  metadata: MetadataType = { name: "", description: "", tooltip: "", logoLink: "", links: [] }

  repositoryAnalysisResults: RepositoryAnalysisResult[] = []

  totalMainLoc: number = 0
  totalTestLoc: number = 0
  totalGeneratedLoc: number = 0
  totalBuildAndDeployLoc: number = 0
  totalOtherLoc: number = 0
  totalMainFilesCount: number = 0

  linesOfCodePerExtension: Map<string, number> = new Map()
  repositoriesPerExtension: Map<string, number> = new Map()

  allContributors: Contributor[] = []
  contributorsPerYear: ContributionTimeSlot[] = []
  contributorsPerMonth: ContributionTimeSlot[] = []

  peopleDependencies: ComponentDependency[] = []
  peopleDependencies30Days: ComponentDependency[] = []
  peopleDependencies90Days: ComponentDependency[] = []
  peopleDependencies180Days: ComponentDependency[] = []
  peopleDependencies365Days: ComponentDependency[] = []
  peopleDependenciesAllTime: ComponentDependency[] = []

  firstCommitDate: string = ""
  latestCommitDate: string = ""

  getRepositoryCount(): number {
    return this.repositoryAnalysisResults.length
  }

  getTotalLoc(): number {
    return (
      this.totalMainLoc + this.totalTestLoc + this.totalGeneratedLoc + this.totalBuildAndDeployLoc + this.totalOtherLoc
    )
  }
}
