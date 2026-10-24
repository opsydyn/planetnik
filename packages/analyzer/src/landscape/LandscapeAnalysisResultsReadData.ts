import type { MetadataType } from "../core/Metadata.js"

export class LandscapeAnalysisResultsReadData {
  metadata: MetadataType = {
    name: "",
    description: "",
    tooltip: "",
    logoLink: "",
    links: [],
  }
  firstCommitDate: string = ""
  latestCommitDate: string = ""
  commitsCount: number = 0
  commitsCount30Days: number = 0
  contributorsCount: number = 0
  repositoriesCount: number = 0
  mainLoc: number = 0
  mainLocActive: number = 0
  mainLocNew: number = 0
  testLoc: number = 0
  generatedLoc: number = 0
  buildAndDeploymentLoc: number = 0
  otherLoc: number = 0
  allLoc: number = 0
  recentContributorsCount: number = 0
  recentContributorsCount6Months: number = 0
  recentContributorsCount3Months: number = 0
  rookiesContributorsCount: number = 0
}
