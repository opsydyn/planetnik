import type { SourceFile } from "../aspects/SourceFile.js"
import type { CleanedContent } from "../cleaners/CleanedContent.js"
import type { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js"
import type { MetaDependencyRule } from "../dependencies/MetaDependencyRule.js"
import type { UnitInfo } from "../units/UnitInfo.js"

export interface LanguageAnalyzer {
  cleanForLinesOfCodeCalculations(sourceFile: SourceFile): CleanedContent
  cleanForDuplicationCalculations(sourceFile: SourceFile): CleanedContent
  extractUnits(sourceFile: SourceFile): UnitInfo[]
  extractDependencies(sourceFiles: readonly SourceFile[]): DependenciesAnalysis
  getMetaDependencyRules(): MetaDependencyRule[]
  getFeaturesDescription(): string[]
}

export const FEATURE_ALL_STANDARD_ANALYSES =
  "All basic standard analyses supported (source code overview, duplication, file size, concerns, findings, metrics, controls)"
export const FEATURE_BASIC_CODE_CLEANING =
  "Basic code cleaning (empty lines removed for LOC calculations and duplication calculations)"
export const FEATURE_ADVANCED_CODE_CLEANING =
  "Advanced code cleaning (empty lines and comments removed for LOC calculations, additional cleaning for duplication calculations)"
export const FEATURE_UNIT_SIZE_ANALYSIS = "Unit size analysis"
export const FEATURE_CONDITIONAL_COMPLEXITY_ANALYSIS = "Conditional complexity analysis"
export const FEATURE_ADVANCED_DEPENDENCIES_ANALYSIS = "Advanced heuristic dependency analysis"
export const FEATURE_NO_UNIT_SIZE_ANALYSIS = "No unit size analysis"
export const FEATURE_NO_CONDITIONAL_COMPLEXITY_ANALYSIS = "No conditional complexity analysis"
export const FEATURE_NO_DEPENDENCIES_ANALYSIS = "No dependency analysis"
export const FEATURE_BASIC_DEPENDENCIES_ANALYSIS = "Basic heuristic dependency analysis"
