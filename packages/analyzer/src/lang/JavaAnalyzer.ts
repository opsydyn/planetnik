import { CommentsAndEmptyLinesCleaner } from "../cleaners/CommentsAndEmptyLinesCleaner.js"
import { MetaDependencyRule } from "../dependencies/MetaDependencyRule.js"
import { OperationStatement } from "../operations/OperationStatement.js"
import { CStyleAnalyzer } from "./CStyleAnalyzer.js"

export class JavaAnalyzer extends CStyleAnalyzer {
  protected override duplicationPatterns = ["{", "}", "import .*;", "package .*"]

  protected override createCleaner(): CommentsAndEmptyLinesCleaner {
    return new CommentsAndEmptyLinesCleaner()
      .addCommentBlockHelper("/*", "*/")
      .addCommentBlockHelper("//", "\n")
      .addStringBlockHelper('"', '"', "\\")
      .addStringBlockHelper("'", "'", "\\")
  }

  override getMetaDependencyRules(): MetaDependencyRule[] {
    // Match Java import statements and extract the top-level package as the component name.
    // e.g. "import nl.obren.sokrates.common.utils.Foo;" → component "common"
    // The nameOperations pipeline:
    //   1. extract the package path between "import " and the last dot (class name)
    //   2. replace dots with "/" so it matches folder-based component paths
    // The component name is then matched against logical decomposition components.
    const rule = new MetaDependencyRule(".*[.]java", "import .*;")
    rule.nameOperations = [
      // Remove "import " prefix (including optional "static ") and trailing ";"
      new OperationStatement("replace", ["^import\\s+(static\\s+)?", ""]),
      new OperationStatement("replace", [";\\s*$", ""]),
      // Remove the last dotted segment (class name, method name, or wildcard)
      new OperationStatement("replace", ["\\.[^.]+$", ""]),
    ]
    return [rule]
  }
}
