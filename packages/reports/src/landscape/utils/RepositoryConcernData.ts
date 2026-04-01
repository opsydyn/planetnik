import type { RepositoryAnalysisResult } from "@planetnik/analyzer";

export interface ConcernInfo {
	name: string;
	filesCount: number;
	numberOfRegexLineMatches: number;
}

export class RepositoryConcernData {
	repositoryName: string;
	concern: ConcernInfo;
	repository: RepositoryAnalysisResult;

	constructor(
		repositoryName: string,
		concern: ConcernInfo,
		repository: RepositoryAnalysisResult,
	) {
		this.repositoryName = repositoryName;
		this.concern = concern;
		this.repository = repository;
	}
}
