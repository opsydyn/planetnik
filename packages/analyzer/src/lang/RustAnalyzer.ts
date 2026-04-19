import type { SourceFile } from "../aspects/SourceFile.js"
import { CommentsAndEmptyLinesCleaner } from "../cleaners/CommentsAndEmptyLinesCleaner.js"
import type { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js"
import type { UnitInfo } from "../units/UnitInfo.js"
import { CStyleAnalyzer } from "./CStyleAnalyzer.js"
import { FEATURE_ADVANCED_DEPENDENCIES_ANALYSIS } from "./LanguageAnalyzer.js"
import { RustTreeSitterDependenciesExtractor } from "./rust/RustTreeSitterDependenciesExtractor.js"
import { RustTreeSitterUnitsExtractor } from "./rust/RustTreeSitterUnitsExtractor.js"

export class RustAnalyzer extends CStyleAnalyzer {
  protected override duplicationPatterns = ["{", "}", "use .*", "mod .*"]

  override extractUnits(sourceFile: SourceFile): UnitInfo[] {
    return new RustTreeSitterUnitsExtractor().extractUnits(sourceFile)
  }

  override extractDependencies(sourceFiles: readonly SourceFile[]): DependenciesAnalysis {
    return new RustTreeSitterDependenciesExtractor().extractDependencies(sourceFiles)
  }

  protected override createCleaner(): CommentsAndEmptyLinesCleaner {
    return new CommentsAndEmptyLinesCleaner()
      .addCommentBlockHelper("/*", "*/")
      .addCommentBlockHelper("//", "\n")
      .addStringBlockHelper('"', '"', "\\")
      .addStringBlockHelper("'", "'", "\\")
  }

  override getFeaturesDescription(): string[] {
    return [
      ...super.getFeaturesDescription(),
      `${FEATURE_ADVANCED_DEPENDENCIES_ANALYSIS} (tree-sitter Rust use declarations)`,
    ]
  }
}
