import type { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js";
import type { NumericMetric } from "../metrics/NumericMetric.js";

export class AspectAnalysisResults {
	name: string = "";
	filesCount: number = 0;
	linesOfCode: number = 0;
	numberOfRegexLineMatches: number = 0;
	fileCountPerExtension: NumericMetric[] = [];
	linesOfCodePerExtension: NumericMetric[] = [];

	// Not serialized
	aspect: NamedSourceCodeAspect | null = null;

	constructor(name?: string) {
		if (name) this.name = name;
	}

	getExtensions(): string[] {
		const set = new Set<string>();
		for (const m of this.linesOfCodePerExtension) {
			const ext = m.name.replace(/.*[.]/, "").trim().toLowerCase();
			set.add(ext);
		}
		return Array.from(set);
	}
}
