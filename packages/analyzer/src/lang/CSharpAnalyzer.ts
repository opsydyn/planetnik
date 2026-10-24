import { CommentsAndEmptyLinesCleaner } from "../cleaners/CommentsAndEmptyLinesCleaner.js"
import { CStyleAnalyzer } from "./CStyleAnalyzer.js"

export class CSharpAnalyzer extends CStyleAnalyzer {
  protected override duplicationPatterns = ["{", "}", "using .*;"]

  protected override createCleaner(): CommentsAndEmptyLinesCleaner {
    return new CommentsAndEmptyLinesCleaner()
      .addCommentBlockHelper("/*", "*/")
      .addCommentBlockHelper("//", "\n")
      .addStringBlockHelper('"', '"', "\\")
      .addStringBlockHelper("'", "'", "\\")
  }
}
