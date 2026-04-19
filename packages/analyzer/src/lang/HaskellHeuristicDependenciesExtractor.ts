import type { SourceFile } from "../aspects/SourceFile.js"
import { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js"
import { DependencyAnchor } from "../dependencies/DependencyAnchor.js"
import { DependencyUtils } from "../dependencies/DependencyUtils.js"
import { SourceFileDependency } from "../dependencies/SourceFileDependency.js"
import { HaskellSourceCodeUtils } from "./HaskellSourceCodeUtils.js"

const HASKELL_EXTENSIONS = new Set(["chs", "hs", "hsc", "hsig", "lhs"])
const COMMON_SOURCE_ROOTS = new Set(["app", "lib", "src", "test", "tests"])

interface HaskellModuleAnchorInfo {
  readonly moduleName: string
  readonly sourceFile: SourceFile
  readonly anchor: DependencyAnchor
}

export class HaskellHeuristicDependenciesExtractor {
  extractDependencies(sourceFiles: readonly SourceFile[]): DependenciesAnalysis {
    const analysis = new DependenciesAnalysis()
    const haskellFiles = sourceFiles.filter((sourceFile) => HASKELL_EXTENSIONS.has(sourceFile.extension))
    const anchorInfos = haskellFiles
      .map((sourceFile) => this.createModuleAnchorInfo(sourceFile))
      .filter((anchorInfo): anchorInfo is HaskellModuleAnchorInfo => anchorInfo !== null)

    const anchorInfoMap = new Map<string, HaskellModuleAnchorInfo>()
    const sourceFileAnchorInfoMap = new Map<string, HaskellModuleAnchorInfo>()

    for (const anchorInfo of anchorInfos) {
      sourceFileAnchorInfoMap.set(anchorInfo.sourceFile.relativePath, anchorInfo)

      const existing = anchorInfoMap.get(anchorInfo.moduleName)
      if (existing) {
        existing.anchor.sourceFiles.push(anchorInfo.sourceFile)
      } else {
        anchorInfoMap.set(anchorInfo.moduleName, anchorInfo)
      }
    }

    for (const sourceFile of haskellFiles) {
      const sourceAnchorInfo = sourceFileAnchorInfoMap.get(sourceFile.relativePath)
      if (!sourceAnchorInfo) {
        continue
      }

      for (const line of sourceFile.content.split(/\r?\n/)) {
        const importModuleName = this.extractImportedModuleName(line)
        if (!importModuleName) {
          continue
        }

        const targetAnchorInfo = anchorInfoMap.get(importModuleName)
        if (!targetAnchorInfo) {
          continue
        }

        const sourceFileDependency = new SourceFileDependency(sourceFile)
        sourceFileDependency.codeFragment = line.trim().replace(/^>\s*/, "").replace(/\s+/g, " ")

        DependencyUtils.addDependency(
          analysis.dependencies,
          sourceFileDependency,
          sourceAnchorInfo.anchor,
          targetAnchorInfo.anchor,
        )
      }
    }

    return analysis
  }

  private createModuleAnchorInfo(sourceFile: SourceFile): HaskellModuleAnchorInfo | null {
    const moduleName = this.extractDeclaredModuleName(sourceFile.content) ?? this.inferModuleNameFromPath(sourceFile)
    if (!moduleName) {
      return null
    }

    const anchor = new DependencyAnchor(moduleName)
    anchor.sourceFiles.push(sourceFile)

    return {
      moduleName,
      sourceFile,
      anchor,
    }
  }

  private extractDeclaredModuleName(content: string): string | null {
    for (const line of content.split(/\r?\n/)) {
      const normalizedLine = HaskellSourceCodeUtils.normalizeCodeLine(line)
      const match = normalizedLine.match(/^module\s+([A-Z][A-Za-z0-9_']*(?:\.[A-Z][A-Za-z0-9_']*)*)\b/)
      if (match?.[1]) {
        return match[1]
      }
    }

    return null
  }

  private inferModuleNameFromPath(sourceFile: SourceFile): string | null {
    const normalizedPath = sourceFile.relativePath.replace(/\\/g, "/")
    const pathParts = normalizedPath.split("/").filter((part) => part.length > 0)
    if (pathParts.length === 0) {
      return null
    }

    const rootIndex = pathParts.findIndex((part) => COMMON_SOURCE_ROOTS.has(part))
    const relevantParts = rootIndex >= 0 ? pathParts.slice(rootIndex + 1) : [...pathParts]
    if (relevantParts.length === 0) {
      return null
    }

    const fileName = relevantParts[relevantParts.length - 1] ?? ""
    const stem = fileName.replace(/\.[^.]+$/, "")
    if (!stem) {
      return null
    }

    relevantParts[relevantParts.length - 1] = stem
    return relevantParts.map((part) => part.replace(/-/g, "_")).join(".")
  }

  private extractImportedModuleName(line: string): string | null {
    const normalizedLine = HaskellSourceCodeUtils.normalizeCodeLine(line)
    if (!normalizedLine.startsWith("import ")) {
      return null
    }

    let remainder = normalizedLine.slice("import".length).trim()

    while (remainder.length > 0) {
      const strippedPragma = remainder.replace(/^\{-#\s*SOURCE\s*#-}\s*/, "")
      if (strippedPragma !== remainder) {
        remainder = strippedPragma
        continue
      }

      const strippedModifier = remainder.replace(/^(qualified|safe)\s+/, "")
      if (strippedModifier !== remainder) {
        remainder = strippedModifier
        continue
      }

      const strippedPackage = remainder.replace(/^"[^"]+"\s+/, "")
      if (strippedPackage !== remainder) {
        remainder = strippedPackage
        continue
      }

      break
    }

    return remainder.match(/^([A-Z][A-Za-z0-9_']*(?:\.[A-Z][A-Za-z0-9_']*)*)\b/)?.[1] ?? null
  }
}
