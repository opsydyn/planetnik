import type { Node } from "web-tree-sitter"
import type { SourceFile } from "../../aspects/SourceFile.js"
import { CommentsAndEmptyLinesCleaner } from "../../cleaners/CommentsAndEmptyLinesCleaner.js"
import { UnitInfo } from "../../units/UnitInfo.js"
import { parseRustSource } from "./TreeSitterRustParser.js"

const BRANCH_NODE_TYPES = new Set(["for_expression", "if_expression", "loop_expression", "while_expression"])

export class RustTreeSitterUnitsExtractor {
  private readonly cleaner = new CommentsAndEmptyLinesCleaner()
    .addCommentBlockHelper("/*", "*/")
    .addCommentBlockHelper("//", "\n")
    .addStringBlockHelper('"', '"', "\\")
    .addStringBlockHelper("'", "'", "\\")

  extractUnits(sourceFile: SourceFile): UnitInfo[] {
    if (sourceFile.content.trim().length === 0) {
      return []
    }

    const parsed = parseRustSource(sourceFile.content)

    try {
      return this.collectUnits(parsed.tree.rootNode, sourceFile)
    } finally {
      parsed.dispose()
    }
  }

  private collectUnits(node: Node, sourceFile: SourceFile, enclosingScope: readonly string[] = []): UnitInfo[] {
    if (node.type === "function_item") {
      const functionName = node.childForFieldName("name")?.text ?? "<anonymous>"
      const unit = this.createUnit(node, sourceFile, [...enclosingScope, functionName])
      const nestedScope = [...enclosingScope, functionName]
      const nestedUnits = node.namedChildren.flatMap((child) => this.collectUnits(child, sourceFile, nestedScope))

      return [unit, ...nestedUnits]
    }

    if (node.type === "mod_item" || node.type === "trait_item") {
      const scopeName = node.childForFieldName("name")?.text
      const nextScope = scopeName ? [...enclosingScope, scopeName] : enclosingScope
      const body = node.childForFieldName("body")
      return body?.namedChildren.flatMap((child) => this.collectUnits(child, sourceFile, nextScope)) ?? []
    }

    if (node.type === "impl_item") {
      const implType = node.childForFieldName("type")?.text
      const nextScope = implType ? [...enclosingScope, implType] : enclosingScope
      const body = node.childForFieldName("body")
      return body?.namedChildren.flatMap((child) => this.collectUnits(child, sourceFile, nextScope)) ?? []
    }

    return node.namedChildren.flatMap((child) => this.collectUnits(child, sourceFile, enclosingScope))
  }

  private createUnit(node: Node, sourceFile: SourceFile, qualifiedName: readonly string[]): UnitInfo {
    const unit = new UnitInfo()
    const bodyNode = node.childForFieldName("body")
    const nameNode = node.childForFieldName("name")
    const parametersNode = node.childForFieldName("parameters")
    const functionName = nameNode?.text ?? "<anonymous>"
    const signatureText = this.getSignatureText(node, bodyNode, sourceFile)
    const bodyText = bodyNode?.text ?? ""

    unit.sourceFile = sourceFile
    unit.shortName = qualifiedName.length > 0 ? qualifiedName.join("::") : functionName
    unit.longName = signatureText
    unit.startLine = node.startPosition.row
    unit.endLine = node.endPosition.row
    unit.linesOfCode = unit.endLine - unit.startLine + 1
    unit.numberOfParameters = this.countParameters(parametersNode)
    unit.body = bodyText
    unit.cleanedBody = this.cleaner.clean(bodyText).cleanedContent
    unit.mcCabeIndex = bodyNode ? this.getMcCabeIndex(bodyNode) : 1

    return unit
  }

  private getSignatureText(node: Node, bodyNode: Node | null, sourceFile: SourceFile): string {
    const endIndex = bodyNode ? bodyNode.startIndex : node.endIndex
    return sourceFile.content.slice(node.startIndex, endIndex).replace(/\s+/g, " ").trim()
  }

  private countParameters(parametersNode: Node | null): number {
    if (parametersNode === null) {
      return 0
    }

    return parametersNode.namedChildren.filter(
      (child) => child.type === "parameter" || child.type === "self_parameter" || child.type === "variadic_parameter",
    ).length
  }

  private getMcCabeIndex(bodyNode: Node): number {
    let count = 1
    const stack = [bodyNode]

    while (stack.length > 0) {
      const currentNode = stack.pop()

      if (currentNode === undefined) {
        continue
      }

      if (currentNode.type === "match_expression") {
        const matchBlock = currentNode.namedChildren.find((child) => child.type === "match_block")
        const matchArms = matchBlock?.namedChildren.filter((child) => child.type === "match_arm").length ?? 0
        count += Math.max(1, matchArms)
      } else if (BRANCH_NODE_TYPES.has(currentNode.type)) {
        count += 1
      }

      if (currentNode.type === "binary_expression") {
        count += currentNode.children.filter((child) => child.type === "&&" || child.type === "||").length
      }

      stack.push(...currentNode.namedChildren)
    }

    return count
  }
}
