import type { LinkType } from "../core/Link.js"
import type { MetadataType } from "../core/Metadata.js"
import type { ContributorTag } from "./ContributorTag.js"
import type { CustomTab } from "./CustomTab.js"
import type { MergeExtension } from "./MergeExtension.js"
import { PeopleConfig } from "./PeopleConfig.js"
import type { SokratesRepositoryLink } from "./SokratesRepositoryLink.js"
import type { SubLandscapeLink } from "./SubLandscapeLink.js"
import type { TagGroup } from "./TagGroup.js"
import { TeamsConfig } from "./TeamsConfig.js"

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

  repositories: SokratesRepositoryLink[] = []
  subLandscapes: SubLandscapeLink[] = []

  ignoreContributors: string[] = []
  ignoreExtensions: string[] = []

  teamsConfig: TeamsConfig = new TeamsConfig()
  peopleConfig: PeopleConfig = new PeopleConfig()
  contributorTags: ContributorTag[] = []
  tagGroups: TagGroup[] = []
  customTabs: CustomTab[] = []
  mergeExtensions: MergeExtension[] = []
}
