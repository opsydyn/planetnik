import type { SourceFile } from "../aspects/SourceFile.js";
import type { CleanedContent } from "../cleaners/CleanedContent.js";
import { CommentsAndEmptyLinesCleaner } from "../cleaners/CommentsAndEmptyLinesCleaner.js";
import { SourceCodeCleanerUtils } from "../cleaners/SourceCodeCleanerUtils.js";
import { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js";
import type { MetaDependencyRule } from "../dependencies/MetaDependencyRule.js";
import { CStyleHeuristicUnitsExtractor } from "../units/CStyleHeuristicUnitsExtractor.js";
import type { UnitInfo } from "../units/UnitInfo.js";
import {
	FEATURE_ADVANCED_CODE_CLEANING,
	FEATURE_ALL_STANDARD_ANALYSES,
	FEATURE_CONDITIONAL_COMPLEXITY_ANALYSIS,
	FEATURE_UNIT_SIZE_ANALYSIS,
	type LanguageAnalyzer,
} from "./LanguageAnalyzer.js";

export class CStyleAnalyzer implements LanguageAnalyzer {
	protected duplicationPatterns: string[] = ["{", "}"];

	protected createCleaner(): CommentsAndEmptyLinesCleaner {
		return new CommentsAndEmptyLinesCleaner()
			.addCommentBlockHelper("/*", "*/")
			.addCommentBlockHelper("//", "\n")
			.addStringBlockHelper('"', '"', "\\")
			.addStringBlockHelper("'", "'", "\\");
	}

	cleanForLinesOfCodeCalculations(sourceFile: SourceFile): CleanedContent {
		return this.createCleaner().clean(sourceFile.content);
	}

	cleanForDuplicationCalculations(sourceFile: SourceFile): CleanedContent {
		const cleaned = this.createCleaner().clean(sourceFile.content);
		let content = cleaned.cleanedContent;

		for (const pattern of this.duplicationPatterns) {
			content = SourceCodeCleanerUtils.emptyLinesMatchingPattern(
				`^\\s*${pattern.replace(/[{}[\]()]/g, "\\$&")}\\s*$`,
				content,
			);
		}

		content = SourceCodeCleanerUtils.trimLines(content);
		return SourceCodeCleanerUtils.cleanEmptyLinesWithLineIndexes(content);
	}

	extractUnits(sourceFile: SourceFile): UnitInfo[] {
		return new CStyleHeuristicUnitsExtractor().extractUnits(sourceFile);
	}

	extractDependencies(
		_sourceFiles: readonly SourceFile[],
	): DependenciesAnalysis {
		return new DependenciesAnalysis();
	}

	getMetaDependencyRules(): MetaDependencyRule[] {
		return [];
	}

	getFeaturesDescription(): string[] {
		return [
			FEATURE_ALL_STANDARD_ANALYSES,
			FEATURE_ADVANCED_CODE_CLEANING,
			FEATURE_UNIT_SIZE_ANALYSIS,
			FEATURE_CONDITIONAL_COMPLEXITY_ANALYSIS,
		];
	}
}
