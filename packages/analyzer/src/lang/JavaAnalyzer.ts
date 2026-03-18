import type { SourceFile } from "../aspects/SourceFile.js"
import { CommentsAndEmptyLinesCleaner } from "../cleaners/CommentsAndEmptyLinesCleaner.js"
import { ProgressFeedback } from "@planetnik/common"
import { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js"
import { CStyleAnalyzer } from "./CStyleAnalyzer.js"
import { FEATURE_ADVANCED_DEPENDENCIES_ANALYSIS } from "./LanguageAnalyzer.js"
import { JavaHeuristicDependenciesExtractor } from "./JavaHeuristicDependenciesExtractor.js"

export class JavaAnalyzer extends CStyleAnalyzer {
  protected override duplicationPatterns = ["{", "}", "import .*;", "package .*"]

  protected override createCleaner(): CommentsAndEmptyLinesCleaner {
    return new CommentsAndEmptyLinesCleaner()
      .addCommentBlockHelper("/*", "*/")
      .addCommentBlockHelper("//", "\n")
      .addStringBlockHelper('"', '"', "\\")
      .addStringBlockHelper("'", "'", "\\")
  }

  override extractDependencies(sourceFiles: readonly SourceFile[]): DependenciesAnalysis {
    return new JavaHeuristicDependenciesExtractor().extractDependencies([...sourceFiles], new ProgressFeedback())
  }

  override getFeaturesDescription(): string[] {
    return [...super.getFeaturesDescription(), `${FEATURE_ADVANCED_DEPENDENCIES_ANALYSIS} (based on package names)`]
  }
}
