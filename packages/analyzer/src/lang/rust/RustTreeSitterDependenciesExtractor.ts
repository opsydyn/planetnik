import type { Node } from "web-tree-sitter"
import type { SourceFile } from "../../aspects/SourceFile.js"
import { DependenciesAnalysis } from "../../dependencies/DependenciesAnalysis.js"
import { DependencyAnchor } from "../../dependencies/DependencyAnchor.js"
import { DependencyUtils } from "../../dependencies/DependencyUtils.js"
import { SourceFileDependency } from "../../dependencies/SourceFileDependency.js"
import { parseRustSource } from "./TreeSitterRustParser.js"

const SUPPORTED_ROOT_DIRECTORIES = new Set(["benches", "examples", "src", "tests"])
const LEAF_PATH_NODE_TYPES = new Set(["crate", "identifier", "metavariable", "scoped_identifier", "self", "super"])

interface RustModuleAnchorInfo {
  readonly crateName: string
  readonly modulePath: string
  readonly sourceFile: SourceFile
  readonly anchor: DependencyAnchor
}

export class RustTreeSitterDependenciesExtractor {
  extractDependencies(sourceFiles: readonly SourceFile[]): DependenciesAnalysis {
    const analysis = new DependenciesAnalysis()
    const rustFiles = sourceFiles.filter((sourceFile) => sourceFile.extension === "rs")
    const anchorInfos = rustFiles
      .map((sourceFile) => this.createModuleAnchorInfo(sourceFile))
      .filter((anchorInfo): anchorInfo is RustModuleAnchorInfo => anchorInfo !== null)

    const anchorInfoMap = new Map(anchorInfos.map((anchorInfo) => [anchorInfo.modulePath, anchorInfo]))
    const knownCrateNames = new Set(anchorInfos.map((anchorInfo) => anchorInfo.crateName))
    const sortedAnchorPaths = [...anchorInfoMap.keys()].sort((left, right) => right.length - left.length)

    for (const sourceFile of rustFiles) {
      const sourceAnchorInfo = anchorInfos.find(
        (anchorInfo) => anchorInfo.sourceFile.relativePath === sourceFile.relativePath,
      )

      if (!sourceAnchorInfo || !sourceFile.content.includes("use ")) {
        continue
      }

      const parsed = parseRustSource(sourceFile.content)

      try {
        for (const useDeclaration of this.collectUseDeclarations(parsed.tree.rootNode)) {
          const importPaths = new Set(
            this.flattenUseArgument(useDeclaration.childForFieldName("argument"))
              .map((segments) => this.normalizeImportPath(segments, sourceAnchorInfo))
              .filter((importPath): importPath is string => importPath !== null),
          )

          const codeFragment = useDeclaration.text.replace(/\s+/g, " ").trim()

          for (const importPath of importPaths) {
            const targetAnchorInfo = this.findTargetAnchorInfo(
              importPath,
              sourceAnchorInfo,
              anchorInfoMap,
              knownCrateNames,
              sortedAnchorPaths,
            )

            if (!targetAnchorInfo) {
              continue
            }

            const sourceFileDependency = new SourceFileDependency(sourceFile)
            sourceFileDependency.codeFragment = codeFragment

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

  private createModuleAnchorInfo(sourceFile: SourceFile): RustModuleAnchorInfo | null {
    const normalizedPath = sourceFile.relativePath.replace(/\\/g, "/")
    const pathParts = normalizedPath.split("/")
    const crateDirectory = pathParts[0]

    if (crateDirectory === undefined) {
      return null
    }

    const rootDirectoryIndex = pathParts.findIndex((part, index) => index > 0 && SUPPORTED_ROOT_DIRECTORIES.has(part))

    if (rootDirectoryIndex < 0) {
      return null
    }

    const crateName = crateDirectory.replace(/-/g, "_")
    const moduleSegments = pathParts.slice(rootDirectoryIndex + 1)

    if (moduleSegments.length === 0) {
      const anchor = new DependencyAnchor(crateName)
      anchor.sourceFiles.push(sourceFile)

      return {
        crateName,
        modulePath: crateName,
        sourceFile,
        anchor,
      }
    }

    const fileName = moduleSegments[moduleSegments.length - 1] ?? ""
    const stem = fileName.replace(/\.rs$/, "").replace(/-/g, "_")
    const normalizedSegments = moduleSegments.slice(0, -1).map((segment) => segment.replace(/-/g, "_"))

    if (stem !== "lib" && stem !== "main" && stem !== "mod") {
      normalizedSegments.push(stem)
    }

    const modulePath = [crateName, ...normalizedSegments].join("::")
    const anchor = new DependencyAnchor(modulePath)
    anchor.sourceFiles.push(sourceFile)

    return {
      crateName,
      modulePath,
      sourceFile,
      anchor,
    }
  }

  private collectUseDeclarations(node: Node): Node[] {
    const declarations: Node[] = []
    const stack = [node]

    while (stack.length > 0) {
      const currentNode = stack.pop()

      if (currentNode === undefined) {
        continue
      }

      if (currentNode.type === "use_declaration") {
        declarations.push(currentNode)
      }

      stack.push(...currentNode.namedChildren)
    }

    return declarations
  }

  private flattenUseArgument(node: Node | null, prefixSegments: readonly string[] = []): string[][] {
    if (node === null) {
      return []
    }

    if (LEAF_PATH_NODE_TYPES.has(node.type)) {
      const leafSegments = node.text.split("::").filter((segment) => segment.length > 0)
      return [[...prefixSegments, ...leafSegments]]
    }

    if (node.type === "use_as_clause") {
      return this.flattenUseArgument(node.childForFieldName("path"), prefixSegments)
    }

    if (node.type === "use_wildcard") {
      const explicitPath = node.namedChildren[0]
      if (explicitPath === undefined) {
        return [[...prefixSegments]]
      }

      return this.flattenUseArgument(explicitPath, prefixSegments)
    }

    if (node.type === "use_list") {
      return node.namedChildren.flatMap((child) => this.flattenUseArgument(child, prefixSegments))
    }

    if (node.type === "scoped_use_list") {
      const pathNode = node.childForFieldName("path")
      const listNode = node.childForFieldName("list")
      const nextPrefixes = pathNode ? this.flattenUseArgument(pathNode, prefixSegments) : [[...prefixSegments]]

      if (listNode === null) {
        return nextPrefixes
      }

      return nextPrefixes.flatMap((nextPrefix) => this.flattenUseArgument(listNode, nextPrefix))
    }

    return node.namedChildren.flatMap((child) => this.flattenUseArgument(child, prefixSegments))
  }

  private normalizeImportPath(rawSegments: readonly string[], sourceAnchorInfo: RustModuleAnchorInfo): string | null {
    if (rawSegments.length === 0) {
      return null
    }

    const currentModuleSegments = sourceAnchorInfo.modulePath.split("::")
    const resolvedSegments: string[] = []
    let initialized = false

    for (const rawSegment of rawSegments) {
      const segment = rawSegment.replace(/-/g, "_")

      if (segment === "crate") {
        resolvedSegments.length = 0
        resolvedSegments.push(sourceAnchorInfo.crateName)
        initialized = true
        continue
      }

      if (segment === "self") {
        if (!initialized) {
          resolvedSegments.push(...currentModuleSegments)
          initialized = true
        }
        continue
      }

      if (segment === "super") {
        if (!initialized) {
          resolvedSegments.push(...currentModuleSegments)
          initialized = true
        }

        if (resolvedSegments.length > 1) {
          resolvedSegments.pop()
        }
        continue
      }

      resolvedSegments.push(segment)
      initialized = true
    }

    if (resolvedSegments.length === 0) {
      return null
    }

    return resolvedSegments.join("::")
  }

  private findTargetAnchorInfo(
    importPath: string,
    sourceAnchorInfo: RustModuleAnchorInfo,
    anchorInfoMap: Map<string, RustModuleAnchorInfo>,
    knownCrateNames: Set<string>,
    sortedAnchorPaths: readonly string[],
  ): RustModuleAnchorInfo | null {
    const firstSegment = importPath.split("::")[0]

    const directMatch = this.findMatchingAnchorInfo(importPath, anchorInfoMap, sortedAnchorPaths)

    if (directMatch) {
      return directMatch
    }

    if (firstSegment !== undefined && !knownCrateNames.has(firstSegment)) {
      return this.findMatchingAnchorInfo(
        `${sourceAnchorInfo.crateName}::${importPath}`,
        anchorInfoMap,
        sortedAnchorPaths,
        {
          excludedAnchorPaths: new Set([sourceAnchorInfo.crateName]),
        },
      )
    }

    return null
  }

  private findMatchingAnchorInfo(
    candidatePath: string,
    anchorInfoMap: Map<string, RustModuleAnchorInfo>,
    sortedAnchorPaths: readonly string[],
    options?: {
      readonly excludedAnchorPaths?: ReadonlySet<string>
    },
  ): RustModuleAnchorInfo | null {
    for (const anchorPath of sortedAnchorPaths) {
      if (options?.excludedAnchorPaths?.has(anchorPath)) {
        continue
      }

      if (candidatePath === anchorPath || candidatePath.startsWith(`${anchorPath}::`)) {
        return anchorInfoMap.get(anchorPath) ?? null
      }
    }

    return null
  }
}
