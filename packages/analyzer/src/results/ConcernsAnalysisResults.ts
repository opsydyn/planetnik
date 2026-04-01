import type { ConcernsGroup } from "../aspects/ConcernsGroup.js";
import { NumericMetric } from "../metrics/NumericMetric.js";
import type { AspectAnalysisResults } from "./AspectAnalysisResults.js";

export class ConcernsAnalysisResults {
	key: string = "";
	concerns: AspectAnalysisResults[] = [];
	concernsGroup: ConcernsGroup | null = null;

	constructor(key?: string) {
		if (key) this.key = key;
	}

	getFileCountPerConcern(): NumericMetric[] {
		return this.concerns.map((c) => new NumericMetric(c.name, c.filesCount));
	}

	getLinesOfCodePerConcern(): NumericMetric[] {
		return this.concerns.map((c) => new NumericMetric(c.name, c.linesOfCode));
	}
}
