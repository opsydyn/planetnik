import { SourceCodeCleanerUtils } from "../cleaners/SourceCodeCleanerUtils.js"
import { DependencyAnchor } from "../dependencies/DependencyAnchor.js"
import { HeuristicDependenciesExtractor } from "../dependencies/HeuristicDependenciesExtractor.js"
import type { SourceFile } from "../aspects/SourceFile.js"

export class JavaHeuristicDependenciesExtractor extends HeuristicDependenciesExtractor {
  static readonly PACKAGE_PREFIX = "package "

  override extractDependencyAnchors(sourceFile: SourceFile): DependencyAnchor[] {
    const anchors: DependencyAnchor[] = []

    let content = sourceFile.content.replace(/\t/g, " ")
    content = SourceCodeCleanerUtils.normalizeLineEnds(content)

    const packageStart = content.indexOf(JavaHeuristicDependenciesExtractor.PACKAGE_PREFIX)
    if (packageStart < 0) {
      return anchors
    }

    const packageEnd = content.indexOf(";", packageStart + JavaHeuristicDependenciesExtractor.PACKAGE_PREFIX.length)
    if (packageEnd < 0) {
      return anchors
    }

    const packageName = content
      .substring(packageStart + JavaHeuristicDependenciesExtractor.PACKAGE_PREFIX.length, packageEnd)
      .trim()

    if (!packageName) {
      return anchors
    }

    const anchor = new DependencyAnchor(packageName)
    anchor.codeFragment = content.substring(packageStart, packageEnd + 1).trim()
    anchor.dependencyPatterns.push(`import.* ${packageName.replace(/\./g, "[.]")}([.][A-Z].*|[.][*]|);`)
    anchor.sourceFiles.push(sourceFile)
    anchors.push(anchor)

    return anchors
  }
}
