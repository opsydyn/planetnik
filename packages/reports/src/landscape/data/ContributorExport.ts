import type { Contributor, ContributorRepositories } from "@planetnik/analyzer"
import { contributorEntityId } from "../../exporters/EntityIdentity.js"
import { ContributorRepositoryInfoExport } from "./ContributorRepositoryInfoExport.js"

export class ContributorExport {
  id: string
  contributor: Contributor
  mainLang: string = ""
  repositories: ContributorRepositoryInfoExport[]
  members: string[]

  constructor(contributorRepositories: ContributorRepositories) {
    this.contributor = contributorRepositories.contributor
    this.id = contributorEntityId(this.contributor.email)
    this.repositories = contributorRepositories.repositories.map((r) => new ContributorRepositoryInfoExport(r))
    this.members = contributorRepositories.members.map((m) => m.contributor.email)
  }
}
