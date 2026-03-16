import type { SourceFile } from "../aspects/SourceFile.js"
import { ComponentDependency } from "../dependencies/ComponentDependency.js"
import { Dependency } from "../dependencies/Dependency.js"
import { DependencyAnchor } from "../dependencies/DependencyAnchor.js"
import { SourceFileDependency } from "../dependencies/SourceFileDependency.js"
import type { FoundLine } from "./FoundLine.js"
import type { SearchResult, SourceFileSearchData } from "./SearchResult.js"
import type { SearchResultCleaner } from "./SearchResultCleaner.js"

export enum SourceNodeExtractionType {
  FILE_NAME = "FILE_NAME",
  FILE_PATH = "FILE_PATH",
  COMPONENT = "COMPONENT",
}

export enum TargetNodeExtractionType {
  ORIGINAL_TEXT = "ORIGINAL_TEXT",
  CLEANED_TEXT = "CLEANED_TEXT",
}

export class SearchResultDependencies {
  searchResult: SearchResult
  private searchResultCleaner: SearchResultCleaner
  sourceNodeExtractionType: SourceNodeExtractionType = SourceNodeExtractionType.COMPONENT
  targetNodeExtractionType: TargetNodeExtractionType = TargetNodeExtractionType.CLEANED_TEXT
  minimalNumberOfInstancesFilter: number = 1

  constructor(searchResult: SearchResult, searchResultCleaner: SearchResultCleaner) {
    this.searchResult = searchResult
    this.searchResultCleaner = searchResultCleaner
  }

  getDependencies(): Dependency[] {
    const dependencies: Dependency[] = []

    for (const data of this.searchResult.foundFiles.values()) {
      if (data.linesWithSearchedContent.length >= this.minimalNumberOfInstancesFilter) {
        if (dependencies.length <= 1000) {
          this.addDependencies(dependencies, data)
        }
      }
    }

    return dependencies
  }

  private addDependencies(dependencies: Dependency[], data: SourceFileSearchData): void {
    for (const line of data.linesWithSearchedContent) {
      const from = new DependencyAnchor(data.filePath)
      const target = this.getTarget(line)
      if (target) {
        const to = new DependencyAnchor(target)
        const sfd = new SourceFileDependency()
        sfd.codeFragment = line.foundText

        const dependency = new Dependency(from, to)
        dependency.fromFiles.push(sfd)
        dependencies.push(dependency)
      }
    }
  }

  private getTarget(line: FoundLine): string {
    switch (this.targetNodeExtractionType) {
      case TargetNodeExtractionType.ORIGINAL_TEXT:
        return line.foundText
      default:
        return this.searchResultCleaner.clean(line.foundText)
    }
  }

  getComponentDependencies(dependencies: Dependency[], group: string): ComponentDependency[] {
    const componentDependencies: ComponentDependency[] = []

    for (const dep of dependencies) {
      if (dep.fromFiles.length === 0) continue
      const sourceFile = dep.fromFiles[0]!.sourceFile
      const sourceNode = sourceFile ? this.getSourceNode(sourceFile, group) : ""
      const target = dep.to.anchor

      const cd = new ComponentDependency(sourceNode, target)
      const existingIndex = componentDependencies.findIndex(
        (c) => c.fromComponent === cd.fromComponent && c.toComponent === cd.toComponent,
      )
      if (existingIndex >= 0) {
        componentDependencies[existingIndex]!.count++
      } else {
        componentDependencies.push(cd)
      }
    }

    return componentDependencies
  }

  private getSourceNode(sourceFile: SourceFile, group: string): string {
    switch (this.sourceNodeExtractionType) {
      case SourceNodeExtractionType.COMPONENT: {
        const components = sourceFile.logicalComponents.filter((c) => c.name === group || !group)
        return components.length > 0 ? components[0]!.name || "/" : "/"
      }
      case SourceNodeExtractionType.FILE_NAME: {
        const parts = sourceFile.relativePath.split("/")
        return parts[parts.length - 1] || "/"
      }
      default:
        return sourceFile.relativePath || "/"
    }
  }
}
