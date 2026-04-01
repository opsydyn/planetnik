import type { SourceFile } from "../aspects/SourceFile.js";
import type { RiskDistributionStats } from "../metrics/RiskDistributionStats.js";
import type { SourceFileSizeDistribution } from "../stats/SourceFileSizeDistribution.js";
import type { FileDistributionPerLogicalDecomposition } from "./FileDistributionPerLogicalDecomposition.js";

export class FilesAnalysisResults {
	overallFileSizeDistribution: SourceFileSizeDistribution | null = null;
	fileSizeDistributionPerExtension: RiskDistributionStats[] = [];
	fileSizeDistributionPerLogicalDecomposition: FileDistributionPerLogicalDecomposition[] =
		[];

	// Not serialized
	allFiles: SourceFile[] = [];

	longestFiles: SourceFile[] = [];
	filesWithMostUnits: SourceFile[] = [];

	getSourceFileByRelativePath(relativePath: string): SourceFile | undefined {
		return this.allFiles.find(
			(f) => f.relativePath.toLowerCase() === relativePath.toLowerCase(),
		);
	}
}
