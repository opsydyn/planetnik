import type { SourceFile } from "../aspects/SourceFile.js"
import type { CleanedContent } from "../cleaners/CleanedContent.js"
import { CommentsAndEmptyLinesCleaner } from "../cleaners/CommentsAndEmptyLinesCleaner.js"
import { SourceCodeCleanerUtils } from "../cleaners/SourceCodeCleanerUtils.js"
import { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js"
import type { UnitInfo } from "../units/UnitInfo.js"
import {
  FEATURE_ADVANCED_CODE_CLEANING,
  FEATURE_ALL_STANDARD_ANALYSES,
  type LanguageAnalyzer,
} from "./LanguageAnalyzer.js"

export class RubyAnalyzer implements LanguageAnalyzer {
  private createCleaner(): CommentsAndEmptyLinesCleaner {
    return new CommentsAndEmptyLinesCleaner()
      .addCommentBlockHelper("=begin", "=end")
      .addCommentBlockHelper("#", "\n")
      .addStringBlockHelper('"', '"', "\\")
      .addStringBlockHelper("'", "'", "\\")
  }

  cleanForLinesOfCodeCalculations(sourceFile: SourceFile): CleanedContent {
    return this.createCleaner().clean(sourceFile.content)
  }

  cleanForDuplicationCalculations(sourceFile: SourceFile): CleanedContent {
    const cleaned = this.createCleaner().clean(sourceFile.content)
    let content = SourceCodeCleanerUtils.trimLines(cleaned.cleanedContent)
    content = SourceCodeCleanerUtils.emptyLinesMatchingPattern("^\\s*require .*$", content)
    return SourceCodeCleanerUtils.cleanEmptyLinesWithLineIndexes(content)
  }

  extractUnits(_sourceFile: SourceFile): UnitInfo[] {
    return []
  }

  extractDependencies(_sourceFiles: readonly SourceFile[]): DependenciesAnalysis {
    return new DependenciesAnalysis()
  }

  getFeaturesDescription(): string[] {
    return [FEATURE_ALL_STANDARD_ANALYSES, FEATURE_ADVANCED_CODE_CLEANING]
  }
}
