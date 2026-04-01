import type { SourceFile } from "../aspects/SourceFile.js";
import { AnalysisConfig } from "../core/AnalysisConfig.js";
import type { CodeConfiguration } from "../core/CodeConfiguration.js";
import type { MetricsList } from "../metrics/MetricsList.js";
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js";
import { FileDistributionPerLogicalDecomposition } from "../results/FileDistributionPerLogicalDecomposition.js";
import type { FilesAnalysisResults } from "../results/FilesAnalysisResults.js";
import { SourceFileSizeDistribution } from "../stats/SourceFileSizeDistribution.js";

export const SAMPLE_SIZE = 50;

export class FileSizeAnalyzer {
	private codeConfiguration: CodeConfiguration;
	private metricsList: MetricsList;
	private analysisResults: FilesAnalysisResults;

	constructor(results: CodeAnalysisResults) {
		this.analysisResults = results.filesAnalysisResults;
		this.codeConfiguration = results.codeConfiguration!;
		this.metricsList = results.metricsList;
	}

	analyze(): void {
		const thresholds = AnalysisConfig.getFileSizeThresholds(
			this.codeConfiguration.analysis,
		);
		const allFiles = this.codeConfiguration.main.sourceFiles as SourceFile[];

		const fileSizeDistribution = new SourceFileSizeDistribution(thresholds);
		const overallDistribution =
			fileSizeDistribution.getOverallDistribution(allFiles);
		this.analysisResults.overallFileSizeDistribution = overallDistribution;

		this.analysisResults.fileSizeDistributionPerExtension =
			SourceFileSizeDistribution.getFileSizeRiskDistributionPerExtension(
				allFiles,
				thresholds,
			);

		for (const logicalDecomposition of this.codeConfiguration
			.logicalDecompositions) {
			const dist = new FileDistributionPerLogicalDecomposition();
			dist.name = logicalDecomposition.name;
			dist.fileSizeDistributionPerComponent =
				SourceFileSizeDistribution.getFileSizeRiskDistributionPerComponent(
					logicalDecomposition,
					thresholds,
				);
			this.analysisResults.fileSizeDistributionPerLogicalDecomposition.push(
				dist,
			);
		}

		this.analysisResults.allFiles = allFiles;
		this.addLongestFiles(allFiles, SAMPLE_SIZE);
		this.addMetrics(overallDistribution);
	}

	private addMetrics(dist: SourceFileSizeDistribution): void {
		const prefixes = [
			"NEGLIGIBLE_RISK_FILE_SIZE_",
			"LOW_RISK_FILE_SIZE_",
			"MEDIUM_RISK_FILE_SIZE_",
			"HIGH_RISK_FILE_SIZE_",
			"VERY_HIGH_RISK_FILE_SIZE_",
		];
		const counts = [
			dist.negligibleRiskCount,
			dist.lowRiskCount,
			dist.mediumRiskCount,
			dist.highRiskCount,
			dist.veryHighRiskCount,
		];
		const locs = [
			dist.negligibleRiskValue,
			dist.lowRiskValue,
			dist.mediumRiskValue,
			dist.highRiskValue,
			dist.veryHighRiskValue,
		];

		for (let i = 0; i < prefixes.length; i++) {
			this.metricsList
				.addSystemMetric()
				.setId(`${prefixes[i]}COUNT`)
				.setValue(counts[i]!);
			this.metricsList
				.addSystemMetric()
				.setId(`${prefixes[i]}LOC`)
				.setValue(locs[i]!);
		}
	}

	private addLongestFiles(sourceFiles: SourceFile[], sampleSize: number): void {
		const sorted = [...sourceFiles].sort(
			(a, b) => b.linesOfCode - a.linesOfCode,
		);
		for (let i = 0; i < Math.min(sampleSize, sorted.length); i++) {
			this.analysisResults.longestFiles.push(sorted[i]!);
		}
	}
}
