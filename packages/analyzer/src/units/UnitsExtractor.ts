import type { SourceFile } from "../aspects/SourceFile.js";
import { LanguageAnalyzerFactory } from "../lang/LanguageAnalyzerFactory.js";
import type { UnitInfo } from "./UnitInfo.js";

export class UnitsExtractor {
	getUnits(sourceFiles: SourceFile[]): UnitInfo[] {
		const allUnits: UnitInfo[] = [];

		for (const sourceFile of sourceFiles) {
			const analyzer =
				LanguageAnalyzerFactory.getInstance().getLanguageAnalyzer(
					sourceFile.extension,
				);
			const units = analyzer.extractUnits(sourceFile);
			allUnits.push(...units);
		}

		return allUnits;
	}
}
