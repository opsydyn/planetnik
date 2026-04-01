import type { SourceFile } from "../aspects/SourceFile.js";
import type { FileModificationHistory } from "../filehistory/FileModificationHistory.js";
import type { RiskDistributionStats } from "../metrics/RiskDistributionStats.js";

export interface FilePairChangedTogether {
	sourceFile1Path: string;
	sourceFile2Path: string;
	commitsCountFile1: number;
	commitsCountFile2: number;
	commits: string[];
	latestCommit: string;
}

export class FilesHistoryAnalysisResults {
	history: FileModificationHistory[] = [];

	firstDate: string = "";
	latestDate: string = "";
	ageInDays: number = 0;
	daysBetweenFirstAndLastDate: number = 0;
	weeksBetweenFirstAndLastDate: number = 0;
	estimatedWorkingDays: number = 0;
	activeDays: number = 0;

	ageRiskDistribution: RiskDistributionStats | null = null;
	freshnesssRiskDistribution: RiskDistributionStats | null = null;
	changeDistribution: RiskDistributionStats | null = null;
	contributorsCountDistribution: RiskDistributionStats | null = null;

	ageRiskDistributionPerExtension: RiskDistributionStats[] = [];
	freshnesssRiskDistributionPerExtension: RiskDistributionStats[] = [];

	filePairsChangedTogether: FilePairChangedTogether[] = [];
	filePairsChangedTogether30Days: FilePairChangedTogether[] = [];
	filePairsChangedTogether90Days: FilePairChangedTogether[] = [];
	filePairsChangedTogether180Days: FilePairChangedTogether[] = [];

	filesWithoutCommitHistoryCount: number = 0;
	filesWithoutCommitHistoryLinesOfCode: number = 0;

	oldestFiles: SourceFile[] = [];
	youngestFiles: SourceFile[] = [];
	mostRecentlyChangedFiles: SourceFile[] = [];
	mostPreviouslyChangedFiles: SourceFile[] = [];
	mostChangedFiles: SourceFile[] = [];
	filesWithMostContributors: SourceFile[] = [];
	filesWithLeastContributors: SourceFile[] = [];
}
