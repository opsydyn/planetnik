import type { DuplicationInstance } from "../duplication/DuplicationInstance.js";
import { DuplicationMetric } from "../metrics/DuplicationMetric.js";

export class DuplicationAnalysisResults {
	overallDuplication: DuplicationMetric = new DuplicationMetric("system");

	duplicationPerComponent: DuplicationMetric[][] = [];
	duplicationPerConcern: DuplicationMetric[] = [];
	duplicationPerExtension: DuplicationMetric[] = [];

	// Not serialized
	allDuplicates: DuplicationInstance[] = [];
	unitDuplicates: DuplicationInstance[] = [];

	longestDuplicates: DuplicationInstance[] = [];
	mostFrequentDuplicates: DuplicationInstance[] = [];
}
