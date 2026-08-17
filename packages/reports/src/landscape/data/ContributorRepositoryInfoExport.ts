import type { ContributorRepositoryInfo } from "@planetnik/analyzer";
import { repositoryEntityId } from "../../exporters/EntityIdentity.js";
import { getLandscapeRepoKey } from "./getLandscapeRepoKey.js";

export class ContributorRepositoryInfoExport {
	id: string;
	name: string;
	description: string;
	analysisResultsPath: string;
	repoKey: string;
	firstCommitDate: string;
	latestCommitDate: string;
	commitsCount: number;
	commits30Days: number;
	commits90Days: number;
	commits180Days: number;
	commits365Days: number;
	commitDates: string[];

	constructor(info: ContributorRepositoryInfo) {
		const metadata = info.repositoryAnalysisResult?.metadata;
		const analysisResultsPath =
			info.repositoryAnalysisResult?.analysisResultsPath ?? "";
		this.id = repositoryEntityId(
			analysisResultsPath ? getLandscapeRepoKey(analysisResultsPath) : "",
		);
		this.name = metadata?.name ?? "";
		this.description = metadata?.description ?? "";
		this.analysisResultsPath = analysisResultsPath;
		this.repoKey = analysisResultsPath
			? getLandscapeRepoKey(analysisResultsPath)
			: "";
		this.firstCommitDate = info.firstCommitDate;
		this.latestCommitDate = info.latestCommitDate;
		this.commitsCount = info.commitsCount;
		this.commits30Days = info.commits30Days;
		this.commits90Days = info.commits90Days;
		this.commits180Days = info.commits180Days;
		this.commits365Days = info.commits365Days;
		this.commitDates = [...info.commitDates];
	}
}
