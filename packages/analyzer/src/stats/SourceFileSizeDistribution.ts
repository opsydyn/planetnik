import type { LogicalDecomposition } from "../aspects/LogicalDecomposition.js";
import type { SourceFile } from "../aspects/SourceFile.js";
import type { Thresholds } from "../core/Thresholds.js";
import { RiskDistributionStats } from "../metrics/RiskDistributionStats.js";

export class SourceFileSizeDistribution extends RiskDistributionStats {
	constructor(thresholds: Thresholds) {
		super(
			thresholds.low,
			thresholds.medium,
			thresholds.high,
			thresholds.veryHigh,
		);
	}

	getOverallDistribution(
		sourceFiles: SourceFile[],
	): SourceFileSizeDistribution {
		for (const file of sourceFiles) {
			this.update(file.linesOfCode, file.linesOfCode);
		}
		return this;
	}

	static getFileSizeRiskDistributionPerExtension(
		sourceFiles: SourceFile[],
		thresholds: Thresholds,
	): RiskDistributionStats[] {
		const extensionMap = new Map<string, RiskDistributionStats>();

		for (const file of sourceFiles) {
			const ext = file.extension;
			let stats = extensionMap.get(ext);
			if (!stats) {
				stats = new RiskDistributionStats(
					thresholds.low,
					thresholds.medium,
					thresholds.high,
					thresholds.veryHigh,
				);
				stats.key = ext;
				extensionMap.set(ext, stats);
			}
			stats.update(file.linesOfCode, file.linesOfCode);
		}

		return Array.from(extensionMap.values());
	}

	static getFileSizeRiskDistributionPerComponent(
		logicalDecomposition: LogicalDecomposition,
		thresholds: Thresholds,
	): RiskDistributionStats[] {
		const result: RiskDistributionStats[] = [];

		for (const component of logicalDecomposition.components) {
			const stats = new RiskDistributionStats(
				thresholds.low,
				thresholds.medium,
				thresholds.high,
				thresholds.veryHigh,
			);
			stats.key = component.name;
			for (const file of component.sourceFiles) {
				stats.update(file.linesOfCode, file.linesOfCode);
			}
			result.push(stats);
		}

		return result;
	}
}
