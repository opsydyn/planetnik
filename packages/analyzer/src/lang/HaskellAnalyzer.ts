import type { SourceFile } from "../aspects/SourceFile.js"
import type { CleanedContent } from "../cleaners/CleanedContent.js"
import { SourceCodeCleanerUtils } from "../cleaners/SourceCodeCleanerUtils.js"
import type { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js"
import type { MetaDependencyRule } from "../dependencies/MetaDependencyRule.js"
import type { UnitInfo } from "../units/UnitInfo.js"
import { HaskellHeuristicDependenciesExtractor } from "./HaskellHeuristicDependenciesExtractor.js"
import { HaskellHeuristicUnitsExtractor } from "./HaskellHeuristicUnitsExtractor.js"
import { HaskellSourceCodeUtils } from "./HaskellSourceCodeUtils.js"
import {
  FEATURE_ADVANCED_CODE_CLEANING,
  FEATURE_ALL_STANDARD_ANALYSES,
  FEATURE_BASIC_DEPENDENCIES_ANALYSIS,
  FEATURE_CONDITIONAL_COMPLEXITY_ANALYSIS,
  FEATURE_UNIT_SIZE_ANALYSIS,
  type LanguageAnalyzer,
} from "./LanguageAnalyzer.js"

export class HaskellAnalyzer implements LanguageAnalyzer {
  cleanForLinesOfCodeCalculations(sourceFile: SourceFile): CleanedContent {
    return SourceCodeCleanerUtils.cleanEmptyLinesWithLineIndexes(
      HaskellSourceCodeUtils.cleanKeepEmptyLines(sourceFile.content),
    )
  }

  cleanForDuplicationCalculations(sourceFile: SourceFile): CleanedContent {
    const content = SourceCodeCleanerUtils.trimLines(HaskellSourceCodeUtils.cleanKeepEmptyLines(sourceFile.content))
    return SourceCodeCleanerUtils.cleanEmptyLinesWithLineIndexes(content)
  }

  extractUnits(sourceFile: SourceFile): UnitInfo[] {
    return new HaskellHeuristicUnitsExtractor().extractUnits(sourceFile)
  }

  extractDependencies(sourceFiles: readonly SourceFile[]): DependenciesAnalysis {
    return new HaskellHeuristicDependenciesExtractor().extractDependencies(sourceFiles)
  }

  getMetaDependencyRules(): MetaDependencyRule[] {
    return []
  }

  getFeaturesDescription(): string[] {
    return [
      FEATURE_ALL_STANDARD_ANALYSES,
      FEATURE_ADVANCED_CODE_CLEANING,
      FEATURE_UNIT_SIZE_ANALYSIS,
      FEATURE_CONDITIONAL_COMPLEXITY_ANALYSIS,
      `${FEATURE_BASIC_DEPENDENCIES_ANALYSIS} (based on import declarations)`,
    ]
  }
}
