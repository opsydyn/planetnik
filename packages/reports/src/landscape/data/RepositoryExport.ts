import type {
	MetadataType,
	RepositoryAnalysisResult,
} from "@planetnik/analyzer";

export class RepositoryExport {
	metadata: MetadataType;
	latestCommitDate: string;
	commitsCount: number;
	commitsCount30Days: number;
	commitsCount90Days: number;
	contributors: string[];
	contributors30Days: string[];
	contributors90Days: string[];
	analysisResultsPath: string;
	mainFilesCount: number;
	mainLinesOfCode: number;
	testFilesCount: number;
	testLinesOfCode: number;
	generatedLinesOfCode: number;
	buildAndDeployLinesOfCode: number;
	otherLinesOfCode: number;

	constructor(repo: RepositoryAnalysisResult) {
		this.metadata = repo.metadata;
		this.latestCommitDate = repo.latestCommitDate;
		this.analysisResultsPath = repo.analysisResultsPath;
		this.mainFilesCount = repo.mainFilesCount;
		this.mainLinesOfCode = repo.mainLoc;
		this.testFilesCount = repo.testFilesCount ?? 0;
		this.testLinesOfCode = repo.testLoc;
		this.generatedLinesOfCode = repo.generatedLoc;
		this.buildAndDeployLinesOfCode = repo.buildAndDeployLoc;
		this.otherLinesOfCode = repo.otherLoc;

		// Populate contributors from the repo's contributor list
		this.contributors = repo.contributors.map((c) => c.email);
		this.contributors30Days = repo.contributors
			.filter((c) => c.commitsCount30Days > 0)
			.map((c) => c.email);
		this.contributors90Days = repo.contributors
			.filter((c) => c.commitsCount90Days > 0)
			.map((c) => c.email);

		// Sum commit counts from contributors
		this.commitsCount = repo.contributors.reduce(
			(sum, c) => sum + c.commitsCount,
			0,
		);
		this.commitsCount30Days = repo.contributors.reduce(
			(sum, c) => sum + c.commitsCount30Days,
			0,
		);
		this.commitsCount90Days = repo.contributors.reduce(
			(sum, c) => sum + c.commitsCount90Days,
			0,
		);
	}
}
