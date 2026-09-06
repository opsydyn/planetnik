import type { Node } from "web-tree-sitter"
import type { SourceFile } from "../../aspects/SourceFile.js"
import { DependenciesAnalysis } from "../../dependencies/DependenciesAnalysis.js"
import { DependencyAnchor } from "../../dependencies/DependencyAnchor.js"
import { DependencyUtils } from "../../dependencies/DependencyUtils.js"
import { SourceFileDependency } from "../../dependencies/SourceFileDependency.js"
import { parsePythonSource } from "./TreeSitterPythonParser.js"

const PYTHON_SOURCE_ROOTS = new Set(["app", "lib", "src", "test", "tests"])

interface PythonModuleAnchorInfo {
  readonly moduleName: string
  readonly packageSegments: readonly string[]
  isPackage: boolean
  readonly sourceFile: SourceFile
  readonly anchor: DependencyAnchor
}

interface PythonImportCandidate {
  readonly moduleName: string
  readonly relativeLevel: number
  readonly codeFragment: string
}

export class PythonTreeSitterDependenciesExtractor {
  extractDependencies(sourceFiles: readonly SourceFile[]): DependenciesAnalysis {
    const analysis = new DependenciesAnalysis()
    const pythonFiles = sourceFiles.filter((sourceFile) => sourceFile.extension === "py")
    const { anchorInfoMap, sourceFileAnchorInfoMap } = this.createModuleAnchors(pythonFiles)

    for (const sourceFile of pythonFiles) {
      const sourceAnchorInfo = sourceFileAnchorInfoMap.get(sourceFile.relativePath)
      if (!sourceAnchorInfo) {
        continue
      }

      const parsed = parsePythonSource(sourceFile.content)

      try {
        for (const importDeclaration of this.collectImportDeclarations(parsed.tree.rootNode)) {
          for (const candidate of this.extractImportCandidates(importDeclaration)) {
            const resolvedModuleName = this.resolveImportModuleName(candidate, sourceAnchorInfo)
            if (!resolvedModuleName) {
              continue
            }

            const targetAnchorInfo = this.findTargetAnchorInfo(resolvedModuleName, anchorInfoMap)
            if (!targetAnchorInfo) {
              continue
            }

            const sourceFileDependency = new SourceFileDependency(sourceFile)
            sourceFileDependency.codeFragment = candidate.codeFragment
            DependencyUtils.addDependency(
              analysis.dependencies,
              sourceFileDependency,
              sourceAnchorInfo.anchor,
              targetAnchorInfo.anchor,
            )
          }
        }
      } finally {
        parsed.dispose()
      }
    }

    return analysis
  }

  private createModuleAnchors(sourceFiles: readonly SourceFile[]): {
    readonly anchorInfoMap: Map<string, PythonModuleAnchorInfo>
    readonly sourceFileAnchorInfoMap: Map<string, PythonModuleAnchorInfo>
  } {
    const anchorInfoMap = new Map<string, PythonModuleAnchorInfo>()
    const sourceFileAnchorInfoMap = new Map<string, PythonModuleAnchorInfo>()

    for (const sourceFile of sourceFiles) {
      const moduleAnchorInfo = this.createModuleAnchorInfo(sourceFile)
      if (!moduleAnchorInfo) {
        continue
      }

      const existing = anchorInfoMap.get(moduleAnchorInfo.moduleName)
      if (existing) {
        existing.isPackage = existing.isPackage || moduleAnchorInfo.isPackage
        existing.anchor.sourceFiles.push(sourceFile)
        sourceFileAnchorInfoMap.set(sourceFile.relativePath, existing)
        continue
      }

      anchorInfoMap.set(moduleAnchorInfo.moduleName, moduleAnchorInfo)
      sourceFileAnchorInfoMap.set(sourceFile.relativePath, moduleAnchorInfo)
    }

    return { anchorInfoMap, sourceFileAnchorInfoMap }
  }

  private createModuleAnchorInfo(sourceFile: SourceFile): PythonModuleAnchorInfo | null {
    const pathParts = sourceFile.relativePath
      .replace(/\\/g, "/")
      .split("/")
      .filter((part) => part.length > 0)
    if (pathParts.length === 0) {
      return null
    }

    const rootIndex = pathParts.findIndex((part) => PYTHON_SOURCE_ROOTS.has(part))
    const relevantParts = rootIndex >= 0 ? pathParts.slice(rootIndex + 1) : pathParts
    const fileName = relevantParts[relevantParts.length - 1] ?? ""
    const stem = fileName.replace(/\.[^.]+$/, "")

    if (!stem) {
      return null
    }

    const moduleParts = relevantParts.slice(0, -1).map((part) => part.replace(/-/g, "_"))
    if (stem !== "__init__") {
      moduleParts.push(stem.replace(/-/g, "_"))
    }

    if (moduleParts.length === 0) {
      return null
    }

    const moduleName = moduleParts.join(".")
    const packageSegments = stem === "__init__" ? moduleParts : moduleParts.slice(0, -1)
    const anchor = new DependencyAnchor(moduleName)
    anchor.sourceFiles.push(sourceFile)

    return {
      moduleName,
      packageSegments,
      isPackage: stem === "__init__",
      sourceFile,
      anchor,
    }
  }

  private collectImportDeclarations(rootNode: Node): Node[] {
    const declarations: Node[] = []
    const stack = [rootNode]

    while (stack.length > 0) {
      const currentNode = stack.pop()

      if (currentNode === undefined) {
        continue
      }

      if (currentNode.type === "import_statement" || currentNode.type === "import_from_statement") {
        declarations.push(currentNode)
        continue
      }

      stack.push(...currentNode.namedChildren)
    }

    return declarations
  }

  private extractImportCandidates(node: Node): PythonImportCandidate[] {
    const codeFragment = node.text.replace(/\s+/g, " ").trim()

    if (node.type === "import_statement") {
      return node.namedChildren.flatMap((child) => {
        const moduleName = child.type === "aliased_import" ? child.childForFieldName("name")?.text : child.text
        return moduleName ? [{ moduleName, relativeLevel: 0, codeFragment }] : []
      })
    }

    const source = node.namedChildren[0]
    if (!source) {
      return []
    }

    if (source.type === "relative_import") {
      const prefix = source.namedChildren.find((child) => child.type === "import_prefix")?.text ?? ""
      const dottedName = source.namedChildren.find((child) => child.type === "dotted_name")?.text ?? ""

      return dottedName || prefix ? [{ moduleName: dottedName, relativeLevel: prefix.length, codeFragment }] : []
    }

    if (source.type === "dotted_name") {
      return [{ moduleName: source.text, relativeLevel: 0, codeFragment }]
    }

    return []
  }

  private resolveImportModuleName(candidate: PythonImportCandidate, source: PythonModuleAnchorInfo): string | null {
    if (candidate.relativeLevel === 0) {
      return candidate.moduleName || null
    }

    const parentSegments = source.packageSegments.slice(
      0,
      Math.max(0, source.packageSegments.length - candidate.relativeLevel + 1),
    )
    const moduleSegments = candidate.moduleName
      ? [...parentSegments, ...candidate.moduleName.split(".")]
      : parentSegments

    return moduleSegments.length > 0 ? moduleSegments.join(".") : null
  }

  private findTargetAnchorInfo(
    moduleName: string,
    anchorInfoMap: Map<string, PythonModuleAnchorInfo>,
  ): PythonModuleAnchorInfo | null {
    const segments = moduleName.split(".")

    const exactMatch = anchorInfoMap.get(moduleName)
    if (exactMatch) {
      return exactMatch
    }

    for (let length = segments.length - 1; length > 0; length -= 1) {
      const candidate = segments.slice(0, length).join(".")
      const anchorInfo = anchorInfoMap.get(candidate)
      if (anchorInfo?.isPackage) {
        return anchorInfo
      }
    }

    return null
  }
}
