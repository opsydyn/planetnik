import type { LinkType } from "../core/Link.js"
import type { MetadataType } from "../core/Metadata.js"

export interface RepositoryLink {
  analysisResultsPath: string
  name: string
}

export interface SubLandscapeLink {
  analysisResultsPath: string
  name: string
}

export class LandscapeConfiguration {
  metadata: MetadataType = { name: "", description: "", tooltip: "", logoLink: "", links: [] }
  analysisRoot: string = "."
  repositoryReportsUrlPrefix: string = "../"
  parentUrl: string = ""
  breadcrumbs: LinkType[] = []

  extensionThresholdLoc: number = 0
  repositoryThresholdLocMain: number = 0
  repositoryThresholdContributors: number = 1
  contributorThresholdCommits: number = 1

  ignoreRepositoriesLastUpdatedBefore: string = ""
  commitsMaxYears: number = 10
  significantContributorMinCommitDaysPerYear: number = 10

  repositories: RepositoryLink[] = []
  subLandscapes: SubLandscapeLink[] = []

  ignoreContributors: string[] = []
  ignoreExtensions: string[] = []
}
