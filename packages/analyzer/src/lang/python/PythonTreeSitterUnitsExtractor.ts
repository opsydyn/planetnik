import type { Node } from "web-tree-sitter"
import type { SourceFile } from "../../aspects/SourceFile.js"
import { CommentsAndEmptyLinesCleaner } from "../../cleaners/CommentsAndEmptyLinesCleaner.js"
import { UnitInfo } from "../../units/UnitInfo.js"
import { parsePythonSource } from "./TreeSitterPythonParser.js"

const DECISION_NODE_TYPES = new Set([
  "if_statement",
  "elif_clause",
  "for_statement",
  "while_statement",
  "except_clause",
  "conditional_expression",
])

const PARAMETER_SEPARATOR_TYPES = new Set(["keyword_separator", "positional_separator"])

export class PythonTreeSitterUnitsExtractor {
  private readonly cleaner = new CommentsAndEmptyLinesCleaner()
    .addCommentBlockHelper("#", "\n")
    .addCommentBlockHelper('"""', '"""')
    .addCommentBlockHelper("'''", "'''")
    .addStringBlockHelper('"', '"', "\\")
    .addStringBlockHelper("'", "'", "\\")

  extractUnits(sourceFile: SourceFile): UnitInfo[] {
    if (sourceFile.content.trim().length === 0) {
      return []
    }

    const parsed = parsePythonSource(sourceFile.content)

    try {
      return this.collectUnits(parsed.tree.rootNode, sourceFile)
    } finally {
      parsed.dispose()
    }
  }

  private collectUnits(node: Node, sourceFile: SourceFile, enclosingNames: readonly string[] = []): UnitInfo[] {
    if (node.type === "class_definition") {
      const name = node.childForFieldName("name")?.text ?? "<anonymous>"
      const qualifiedNames = [...enclosingNames, name]
      const body = node.childForFieldName("body")

      return [
        this.createUnit(node, sourceFile, qualifiedNames, "class"),
        ...(body?.namedChildren.flatMap((child) => this.collectUnits(child, sourceFile, qualifiedNames)) ?? []),
      ]
    }

    if (node.type === "function_definition") {
      const name = node.childForFieldName("name")?.text ?? "<anonymous>"
      const qualifiedNames = [...enclosingNames, name]
      const body = node.childForFieldName("body")

      return [
        this.createUnit(node, sourceFile, qualifiedNames, "function"),
        ...(body?.namedChildren.flatMap((child) => this.collectUnits(child, sourceFile, qualifiedNames)) ?? []),
      ]
    }

    return node.namedChildren.flatMap((child) => this.collectUnits(child, sourceFile, enclosingNames))
  }

  private createUnit(
    node: Node,
    sourceFile: SourceFile,
    qualifiedNames: readonly string[],
    kind: "class" | "function",
  ): UnitInfo {
    const unit = new UnitInfo()
    const bodyNode = node.childForFieldName("body")
    const parametersNode = node.childForFieldName("parameters")
    const startLine = node.startPosition.row
    const endLine = node.endPosition.row
    const declarationEndIndex = bodyNode?.startIndex ?? node.endIndex
    const declaration = sourceFile.content.slice(node.startIndex, declarationEndIndex).replace(/\s+/g, " ").trim()
    const body = bodyNode?.text ?? ""

    unit.sourceFile = sourceFile
    unit.shortName = qualifiedNames.join("::")
    unit.longName = declaration
    unit.startLine = startLine
    unit.endLine = endLine
    unit.linesOfCode = endLine - startLine + 1
    unit.numberOfParameters = kind === "function" ? this.countParameters(parametersNode) : 0
    unit.body = body
    unit.cleanedBody = this.cleaner.clean(body).cleanedContent
    unit.mcCabeIndex = kind === "function" && bodyNode ? this.getMcCabeIndex(bodyNode) : 1

    return unit
  }

  private countParameters(parametersNode: Node | null): number {
    if (parametersNode === null) {
      return 0
    }

    return parametersNode.namedChildren.filter((child) => !PARAMETER_SEPARATOR_TYPES.has(child.type)).length
  }

  private getMcCabeIndex(bodyNode: Node): number {
    let count = 1
    const stack = [bodyNode]

    while (stack.length > 0) {
      const currentNode = stack.pop()

      if (currentNode === undefined) {
        continue
      }

      if (DECISION_NODE_TYPES.has(currentNode.type)) {
        count += 1
      } else if (currentNode.type === "match_statement") {
        count += Math.max(1, this.countCaseClauses(currentNode))
      } else if (currentNode.type === "boolean_operator") {
        count += currentNode.children.filter((child) => child.type === "and" || child.type === "or").length
      }

      stack.push(...currentNode.namedChildren)
    }

    return count
  }

  private countCaseClauses(node: Node): number {
    return node.namedChildren.reduce(
      (count, child) =>
        count +
        (child.type === "case_clause"
          ? 1
          : child.namedChildren.filter((grandchild) => grandchild.type === "case_clause").length),
      0,
    )
  }
}
