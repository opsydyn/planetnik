import type { LogicalDecomposition } from "../aspects/LogicalDecomposition.js";
import type { SourceFile } from "../aspects/SourceFile.js";
import type { Thresholds } from "../core/Thresholds.js";
import { RiskDistributionStats } from "../metrics/RiskDistributionStats.js";

export enum AgeDistributionType {
	LAST_MODIFIED = "LAST_MODIFIED",
	FIRST_MODIFIED = "FIRST_MODIFIED",
}

export class SourceFileAgeDistribution extends RiskDistributionStats {
	private thresholds: Thresholds;
	private type: AgeDistributionType;

	constructor(
		thresholds: Thresholds,
		type: AgeDistributionType = AgeDistributionType.LAST_MODIFIED,
	) {
		super(
			thresholds.low,
			thresholds.medium,
			thresholds.high,
			thresholds.veryHigh,
		);
		this.thresholds = thresholds;
		this.type = type;
		this.negligibleRiskLabel = `0-${thresholds.low} days`;
		this.lowRiskLabel = `${thresholds.low + 1}-${thresholds.medium} days`;
		this.mediumRiskLabel = `${thresholds.medium + 1}-${thresholds.high} days`;
		this.highRiskLabel = `${thresholds.high + 1}-${thresholds.veryHigh} days`;
		this.veryHighRiskLabel = `${thresholds.veryHigh + 1}+ days`;
	}

	private getAge(sourceFile: SourceFile): number {
		const history = sourceFile.fileModificationHistory;
		if (!history) return 0;
		return this.type === AgeDistributionType.LAST_MODIFIED
			? history.daysSinceLatestUpdate()
			: history.daysSinceFirstUpdate();
	}

	getFileAgeRiskDistributionPerExtension(
		files: SourceFile[],
	): RiskDistributionStats[] {
		const map = new Map<string, SourceFileAgeDistribution>();
		const result: RiskDistributionStats[] = [];

		for (const file of files) {
			let dist = map.get(file.extension);
			if (!dist) {
				dist = new SourceFileAgeDistribution(this.thresholds, this.type);
				dist.key = file.extension;
				map.set(file.extension, dist);
				result.push(dist);
			}
			if (file.fileModificationHistory) {
				dist.update(this.getAge(file), file.linesOfCode);
			}
		}

		return result;
	}

	getFileAgeRiskDistributionPerComponent(
		logicalDecomposition: LogicalDecomposition,
	): RiskDistributionStats[] {
		const result: RiskDistributionStats[] = [];

		for (const component of logicalDecomposition.components) {
			const dist = new SourceFileAgeDistribution(
				this.thresholds,
				AgeDistributionType.LAST_MODIFIED,
			);
			dist.key = component.name;
			for (const file of component.sourceFiles) {
				if (file.fileModificationHistory) {
					dist.update(this.getAge(file), file.linesOfCode);
				}
			}
			result.push(dist);
		}

		return result;
	}

	getOverallLastModifiedDistribution(
		files: SourceFile[],
	): SourceFileAgeDistribution {
		this.reset();
		for (const file of files) {
			if (file.fileModificationHistory) {
				this.update(this.getAge(file), file.linesOfCode);
			}
		}
		return this;
	}

	getOverallFirstModifiedDistribution(
		files: SourceFile[],
	): SourceFileAgeDistribution {
		this.reset();
		for (const file of files) {
			if (file.fileModificationHistory) {
				this.update(
					file.fileModificationHistory.daysSinceFirstUpdate(),
					file.linesOfCode,
				);
			}
		}
		return this;
	}
}
