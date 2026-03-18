import type { SourceFile } from "../aspects/SourceFile.js"
import type { CleanedContent } from "../cleaners/CleanedContent.js"
import { SourceCodeCleanerUtils } from "../cleaners/SourceCodeCleanerUtils.js"
import { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js"
import type { MetaDependencyRule } from "../dependencies/MetaDependencyRule.js"
import type { UnitInfo } from "../units/UnitInfo.js"
import {
  FEATURE_ALL_STANDARD_ANALYSES,
  FEATURE_BASIC_CODE_CLEANING,
  type LanguageAnalyzer,
} from "./LanguageAnalyzer.js"

export class DefaultLanguageAnalyzer implements LanguageAnalyzer {
  cleanForLinesOfCodeCalculations(sourceFile: SourceFile): CleanedContent {
    const content = sourceFile.content
    const normalized = SourceCodeCleanerUtils.normalizeLineEnds(content)
    return SourceCodeCleanerUtils.cleanEmptyLinesWithLineIndexes(normalized)
  }

  cleanForDuplicationCalculations(sourceFile: SourceFile): CleanedContent {
    const content = sourceFile.content
    const normalized = SourceCodeCleanerUtils.normalizeLineEnds(content)
    const trimmed = SourceCodeCleanerUtils.trimLines(normalized)
    return SourceCodeCleanerUtils.cleanEmptyLinesWithLineIndexes(trimmed)
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
    return [FEATURE_ALL_STANDARD_ANALYSES, FEATURE_BASIC_CODE_CLEANING]
  }
}
