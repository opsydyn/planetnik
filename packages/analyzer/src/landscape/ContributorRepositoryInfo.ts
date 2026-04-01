import type { RepositoryAnalysisResult } from "./LandscapeAnalysisResults.js";

export class ContributorRepositoryInfo {
	repositoryAnalysisResult: RepositoryAnalysisResult | null;
	firstCommitDate: string;
	latestCommitDate: string;
	commitsCount: number;
	commits30Days: number;
	commits90Days: number;
	commits180Days: number;
	commits365Days: number;
	commitDates: string[];

	constructor(
		repositoryAnalysisResult: RepositoryAnalysisResult | null = null,
		firstCommitDate: string = "",
		latestCommitDate: string = "",
		commitsCount: number = 0,
		commits30Days: number = 0,
		commits90Days: number = 0,
		commits180Days: number = 0,
		commits365Days: number = 0,
		commitDates: string[] = [],
	) {
		this.repositoryAnalysisResult = repositoryAnalysisResult;
		this.firstCommitDate = firstCommitDate;
		this.latestCommitDate = latestCommitDate;
		this.commitsCount = commitsCount;
		this.commits30Days = commits30Days;
		this.commits90Days = commits90Days;
		this.commits180Days = commits180Days;
		this.commits365Days = commits365Days;
		this.commitDates = [...commitDates];
	}
}
