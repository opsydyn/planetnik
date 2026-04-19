import type { SourceFile } from "../aspects/SourceFile.js"
import type { CleanedContent } from "../cleaners/CleanedContent.js"
import { CommentsAndEmptyLinesCleaner } from "../cleaners/CommentsAndEmptyLinesCleaner.js"
import { SourceCodeCleanerUtils } from "../cleaners/SourceCodeCleanerUtils.js"
import { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js"
import type { MetaDependencyRule } from "../dependencies/MetaDependencyRule.js"
import type { UnitInfo } from "../units/UnitInfo.js"
import {
  FEATURE_ADVANCED_CODE_CLEANING,
  FEATURE_ALL_STANDARD_ANALYSES,
  FEATURE_NO_CONDITIONAL_COMPLEXITY_ANALYSIS,
  FEATURE_NO_DEPENDENCIES_ANALYSIS,
  FEATURE_NO_UNIT_SIZE_ANALYSIS,
  type LanguageAnalyzer,
} from "./LanguageAnalyzer.js"

export class ShellAnalyzer implements LanguageAnalyzer {
  private createCleaner(): CommentsAndEmptyLinesCleaner {
    return new CommentsAndEmptyLinesCleaner()
      .addCommentBlockHelper("#", "\n")
      .addStringBlockHelper('"', '"', "\\")
      .addStringBlockHelper("'", "'", "\\")
  }

  cleanForLinesOfCodeCalculations(sourceFile: SourceFile): CleanedContent {
    return this.createCleaner().clean(sourceFile.content)
  }

  cleanForDuplicationCalculations(sourceFile: SourceFile): CleanedContent {
    const content = SourceCodeCleanerUtils.trimLines(this.createCleaner().cleanKeepEmptyLines(sourceFile.content))
    return SourceCodeCleanerUtils.cleanEmptyLinesWithLineIndexes(content)
  }

  extractUnits(_sourceFile: SourceFile): UnitInfo[] {
    return []
  }

  extractDependencies(_sourceFiles: readonly SourceFile[]): DependenciesAnalysis {
    return new DependenciesAnalysis()
  }

  getMetaDependencyRules(): MetaDependencyRule[] {
    return []
  }

  getFeaturesDescription(): string[] {
    return [
      FEATURE_ALL_STANDARD_ANALYSES,
      FEATURE_ADVANCED_CODE_CLEANING,
      FEATURE_NO_UNIT_SIZE_ANALYSIS,
      FEATURE_NO_CONDITIONAL_COMPLEXITY_ANALYSIS,
      FEATURE_NO_DEPENDENCIES_ANALYSIS,
    ]
  }
}
