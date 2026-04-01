import type { Contributor, ContributorRepositories } from "@planetnik/analyzer";
import { ContributorRepositoryInfoExport } from "./ContributorRepositoryInfoExport.js";

export class ContributorExport {
	contributor: Contributor;
	mainLang: string = "";
	repositories: ContributorRepositoryInfoExport[];
	members: string[];

	constructor(contributorRepositories: ContributorRepositories) {
		this.contributor = contributorRepositories.contributor;
		this.repositories = contributorRepositories.repositories.map(
			(r) => new ContributorRepositoryInfoExport(r),
		);
		this.members = contributorRepositories.members.map(
			(m) => m.contributor.email,
		);
	}
}
