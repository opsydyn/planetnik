import * as fs from "node:fs"
import * as path from "node:path"
import type { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import { SourceFile } from "../aspects/SourceFile.js"
import type { AnalysisConfigType } from "../core/AnalysisConfig.js"
import { DEFAULT_CONFIGURATION_FOLDER } from "../core/CodeConfiguration.js"
import { SourceFileFilter, type SourceFileFilterType } from "../core/SourceFileFilter.js"

export class SourceCodeFiles {
  allFiles: SourceFile[] = []
  filesInBroadScope: SourceFile[] = []
  filesExcludedByExtension: SourceFile[] = []
  ignoredFilesGroups: Map<string, { filter: SourceFileFilterType | null; sourceFiles: SourceFile[] }> = new Map()
  private root: string = ""

  load(rootPath: string): void {
    this.root = rootPath
    this.allFiles = []
    this.addFile(rootPath)
  }

  private addFile(filePath: string): void {
    let stat: fs.Stats
    try {
      stat = fs.statSync(filePath)
    } catch {
      return
    }

    if (stat.isDirectory()) {
      if (this.isNotVCSFolder(filePath)) {
        let children: string[]
        try {
          children = fs.readdirSync(filePath)
        } catch {
          return
        }
        for (const child of children) {
          this.addFile(path.join(filePath, child))
        }
      }
    } else {
      const relativePath = path.relative(this.root, filePath)
      let content: string
      try {
        content = fs.readFileSync(filePath, "utf-8")
      } catch {
        content = ""
      }
      const sourceFile = new SourceFile(relativePath, content)
      this.allFiles.push(sourceFile)
    }
  }

  private isNotVCSFolder(folderPath: string): boolean {
    const folderName = path.basename(folderPath)
    const vcsFolderNames = [".svn", ".git", DEFAULT_CONFIGURATION_FOLDER]
    return !vcsFolderNames.some((name) => name.toLowerCase() === folderName.toLowerCase())
  }

  createBroadScope(
    extensions: string[],
    exclusions: SourceFileFilterType[],
    analysisConfig: AnalysisConfigType,
    addLoc: boolean = true,
  ): void {
    this.filesInBroadScope = []
    this.filesExcludedByExtension = []

    for (const sourceFile of this.allFiles) {
      const ext = sourceFile.extension
      if (extensions.includes(ext)) {
        if (!this.shouldExcludeFile(sourceFile, exclusions, analysisConfig)) {
          if (addLoc) {
            sourceFile.linesOfCode = sourceFile.lines.filter((line) => line.trim().length > 0).length
          }
          this.filesInBroadScope.push(sourceFile)
        }
      } else {
        this.filesExcludedByExtension.push(sourceFile)
      }
    }
  }

  private shouldExcludeFile(
    sourceFile: SourceFile,
    exclusions: SourceFileFilterType[],
    analysisConfig: AnalysisConfigType,
  ): boolean {
    if (sourceFile.content.length > analysisConfig.maxFileSizeBytes) {
      this.addToIgnoredGroup(`Too long file (${analysisConfig.maxFileSizeBytes}+ bytes)`, null, sourceFile)
      return true
    }

    if (sourceFile.lines.length > analysisConfig.maxLines) {
      this.addToIgnoredGroup(`Too many lines (${analysisConfig.maxLines})`, null, sourceFile)
      return true
    }

    for (const line of sourceFile.lines) {
      if (line.length > analysisConfig.maxLineLength) {
        this.addToIgnoredGroup(`Too long lines (${analysisConfig.maxLineLength}+ characters)`, null, sourceFile)
        return true
      }
    }

    for (const filter of exclusions) {
      if (SourceFileFilter.matches(filter, sourceFile.relativePath, sourceFile.lines)) {
        this.addToIgnoredGroup(`${filter.pathPattern}:${filter.contentPattern}`, filter, sourceFile)
        return true
      }
    }

    return false
  }

  private addToIgnoredGroup(key: string, filter: SourceFileFilterType | null, sourceFile: SourceFile): void {
    let group = this.ignoredFilesGroups.get(key)
    if (!group) {
      group = { filter, sourceFiles: [] }
      this.ignoredFilesGroups.set(key, group)
    }
    group.sourceFiles.push(sourceFile)
  }

  getSourceFiles(aspect: NamedSourceCodeAspect): SourceFile[] {
    return SourceCodeFiles.getSourceFilesFromScope(aspect, this.filesInBroadScope)
  }

  static getSourceFilesFromScope(aspect: NamedSourceCodeAspect, scopeSourceFiles: SourceFile[]): SourceFile[] {
    aspect.sourceFiles = []
    const sourceFiles: SourceFile[] = []

    for (const sourceFile of scopeSourceFiles) {
      let included = false
      let excluded = false

      if (aspect.files.includes(sourceFile.relativePath)) {
        included = true
      }

      for (const filter of aspect.sourceFileFilters) {
        if (SourceFileFilter.matches(filter, sourceFile.relativePath, sourceFile.lines)) {
          if (!filter.exception) {
            included = true
          } else {
            excluded = true
          }
        }
      }

      if (included && !excluded) {
        if (!sourceFiles.includes(sourceFile)) {
          sourceFiles.push(sourceFile)
        }
        if (!aspect.sourceFiles.includes(sourceFile)) {
          aspect.sourceFiles.push(sourceFile)
        }
      }
    }

    return sourceFiles
  }

  getExcludedFiles(): SourceFile[] {
    return this.allFiles.filter((f) => !this.filesInBroadScope.includes(f))
  }

  getExtensionsCountMap(sourceFiles: SourceFile[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const file of sourceFiles) {
      const ext = file.extension
      map.set(ext, (map.get(ext) ?? 0) + 1)
    }
    return map
  }
}
