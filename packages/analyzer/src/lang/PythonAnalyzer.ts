import type { SourceFile } from "../aspects/SourceFile.js";
import type { CleanedContent } from "../cleaners/CleanedContent.js";
import { CommentsAndEmptyLinesCleaner } from "../cleaners/CommentsAndEmptyLinesCleaner.js";
import { SourceCodeCleanerUtils } from "../cleaners/SourceCodeCleanerUtils.js";
import type { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js";
import type { MetaDependencyRule } from "../dependencies/MetaDependencyRule.js";
import type { UnitInfo } from "../units/UnitInfo.js";
import {
	FEATURE_ADVANCED_CODE_CLEANING,
	FEATURE_ADVANCED_DEPENDENCIES_ANALYSIS,
	FEATURE_ALL_STANDARD_ANALYSES,
	FEATURE_CONDITIONAL_COMPLEXITY_ANALYSIS,
	FEATURE_UNIT_SIZE_ANALYSIS,
	type LanguageAnalyzer,
} from "./LanguageAnalyzer.js";
import {
	PythonTreeSitterDependenciesExtractor,
	PythonTreeSitterUnitsExtractor,
} from "./python/index.js";

export class PythonAnalyzer implements LanguageAnalyzer {
	private createCleaner(): CommentsAndEmptyLinesCleaner {
		return new CommentsAndEmptyLinesCleaner()
			.addCommentBlockHelper('"""', '"""')
			.addCommentBlockHelper("#", "\n")
			.addStringBlockHelper('"', '"', "\\")
			.addStringBlockHelper("'", "'", "\\")
			.addStringBlockHelper("'''", "'''");
	}

	cleanForLinesOfCodeCalculations(sourceFile: SourceFile): CleanedContent {
		return this.createCleaner().clean(sourceFile.content);
	}

	cleanForDuplicationCalculations(sourceFile: SourceFile): CleanedContent {
		const cleaned = this.createCleaner().clean(sourceFile.content);
		let content = cleaned.cleanedContent;
		content = SourceCodeCleanerUtils.emptyLinesMatchingPattern(
			"^\\s*from .*import.*$",
			content,
		);
		content = SourceCodeCleanerUtils.emptyLinesMatchingPattern(
			"^\\s*import .*$",
			content,
		);
		content = SourceCodeCleanerUtils.trimLines(content);
		return SourceCodeCleanerUtils.cleanEmptyLinesWithLineIndexes(content);
	}

	extractUnits(sourceFile: SourceFile): UnitInfo[] {
		return new PythonTreeSitterUnitsExtractor().extractUnits(sourceFile);
	}

	extractDependencies(
		sourceFiles: readonly SourceFile[],
	): DependenciesAnalysis {
		return new PythonTreeSitterDependenciesExtractor().extractDependencies(sourceFiles);
	}

	getMetaDependencyRules(): MetaDependencyRule[] {
		return [];
	}

	getFeaturesDescription(): string[] {
		return [
			FEATURE_ALL_STANDARD_ANALYSES,
			FEATURE_ADVANCED_CODE_CLEANING,
			`${FEATURE_ADVANCED_DEPENDENCIES_ANALYSIS} (tree-sitter Python imports)`,
			FEATURE_UNIT_SIZE_ANALYSIS,
			FEATURE_CONDITIONAL_COMPLEXITY_ANALYSIS,
		];
	}
}
