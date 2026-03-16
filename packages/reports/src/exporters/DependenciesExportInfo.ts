import type { Dependency, DependencyAnchor, SourceFileDependency } from "@planetnik/analyzer"
import type { FileExportInfo } from "./FileExportInfo.js"
import { fileExportInfoFromSourceFile } from "./FileExportInfo.js"

export interface SourceFileDependencyExportInfo {
  file: FileExportInfo
  codeFragment: string
}

export interface DependencyAnchorExportInfo {
  anchor: string
  codeFragment: string
  dependencyPatterns: string[]
  files: FileExportInfo[]
}

export interface DependencyExportInfo {
  from: DependencyAnchorExportInfo
  to: DependencyAnchorExportInfo
  fromFiles: SourceFileDependencyExportInfo[]
}

export interface DependenciesExportInfo {
  title: string
  timestamp: string
  links: DependencyExportInfo[]
}

function anchorExportInfo(anchor: DependencyAnchor): DependencyAnchorExportInfo {
  return {
    anchor: anchor.anchor,
    codeFragment: anchor.codeFragment,
    dependencyPatterns: [...anchor.dependencyPatterns],
    files: anchor.sourceFiles.map(fileExportInfoFromSourceFile),
  }
}

function sourceFileDependencyExportInfo(dep: SourceFileDependency): SourceFileDependencyExportInfo {
  return {
    file: dep.sourceFile
      ? fileExportInfoFromSourceFile(dep.sourceFile)
      : { relativePath: "", extension: "", linesOfCode: 0, components: [], concerns: [] },
    codeFragment: dep.codeFragment,
  }
}

export class DependenciesExporter {
  private dependencies: Dependency[]

  constructor(dependencies: Dependency[]) {
    this.dependencies = dependencies
  }

  getDependenciesExportInfo(): DependencyExportInfo[] {
    return this.dependencies.map((dep) => ({
      from: anchorExportInfo(dep.from),
      to: anchorExportInfo(dep.to),
      fromFiles: dep.fromFiles.map(sourceFileDependencyExportInfo),
    }))
  }

  static exportDependencies(dependencies: Dependency[], title: string, timestamp: string): DependenciesExportInfo {
    const exporter = new DependenciesExporter(dependencies)
    return {
      title,
      timestamp,
      links: exporter.getDependenciesExportInfo(),
    }
  }
}
