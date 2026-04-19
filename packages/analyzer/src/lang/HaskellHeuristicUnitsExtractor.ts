import type { SourceFile } from "../aspects/SourceFile.js"
import { SourceCodeCleanerUtils } from "../cleaners/SourceCodeCleanerUtils.js"
import { UnitInfo } from "../units/UnitInfo.js"
import { HaskellSourceCodeUtils } from "./HaskellSourceCodeUtils.js"

const RESERVED_TOP_LEVEL_WORDS = new Set([
  "class",
  "data",
  "default",
  "foreign",
  "import",
  "infix",
  "infixl",
  "infixr",
  "instance",
  "module",
  "newtype",
  "type",
])

const FUNCTION_HEAD_RE = /^([a-z_][A-Za-z0-9_']*|\([^()\s]+\))(.*)$/
const TYPE_DECLARATION_RE = /^(data|newtype|type)\s+([A-Z][A-Za-z0-9_']*)\b(.*)$/
const CLASS_DECLARATION_RE = /^class\b\s*(?:.*?=>\s*)?([A-Z][A-Za-z0-9_']*)\b(.*)$/
const MCCABE_KEYWORDS = ["if", "case"]
const MCCABE_OPERATORS = ["&&", "||"]

interface HaskellUnitCandidate {
  readonly kind: "function" | "signature" | "type"
  readonly name: string
  readonly lineIndex: number
}

interface MergedHaskellUnitCandidate {
  readonly kind: "function" | "type"
  readonly name: string
  readonly startLine: number
  readonly declarationLine: number
  readonly signatureLine?: number
}

export class HaskellHeuristicUnitsExtractor {
  extractUnits(sourceFile: SourceFile): UnitInfo[] {
    if (sourceFile.content.trim().length === 0) {
      return []
    }

    const lines = SourceCodeCleanerUtils.normalizeLineEnds(sourceFile.content).split("\n")
    const candidates = this.mergeCandidates(this.collectCandidates(lines))

    return candidates.map((candidate, index) => {
      const nextStartLine = candidates[index + 1]?.startLine ?? lines.length
      return this.createUnit(
        candidate,
        lines,
        sourceFile,
        this.getUnitEndLine(lines, candidate.startLine, nextStartLine),
      )
    })
  }

  private collectCandidates(lines: readonly string[]): HaskellUnitCandidate[] {
    const candidates: HaskellUnitCandidate[] = []

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      if (!this.isTopLevelLine(lines[lineIndex]!)) {
        continue
      }

      const candidate = this.parseTopLevelCandidate(lines, lineIndex)
      if (candidate) {
        candidates.push(candidate)
      }
    }

    return candidates
  }

  private mergeCandidates(candidates: readonly HaskellUnitCandidate[]): MergedHaskellUnitCandidate[] {
    const mergedCandidates: MergedHaskellUnitCandidate[] = []

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index]!

      if (candidate.kind === "type") {
        mergedCandidates.push({
          kind: "type",
          name: candidate.name,
          startLine: candidate.lineIndex,
          declarationLine: candidate.lineIndex,
        })
        continue
      }

      if (candidate.kind === "signature") {
        const nextCandidate = candidates[index + 1]
        if (nextCandidate?.kind === "function" && nextCandidate.name === candidate.name) {
          while (candidates[index + 2]?.kind === "function" && candidates[index + 2]?.name === candidate.name) {
            index += 1
          }

          mergedCandidates.push({
            kind: "function",
            name: candidate.name,
            startLine: candidate.lineIndex,
            declarationLine: nextCandidate.lineIndex,
            signatureLine: candidate.lineIndex,
          })
          index += 1
        }

        continue
      }

      while (candidates[index + 1]?.kind === "function" && candidates[index + 1]?.name === candidate.name) {
        index += 1
      }

      mergedCandidates.push({
        kind: "function",
        name: candidate.name,
        startLine: candidate.lineIndex,
        declarationLine: candidate.lineIndex,
      })
    }

    return mergedCandidates
  }

  private createUnit(
    candidate: MergedHaskellUnitCandidate,
    lines: readonly string[],
    sourceFile: SourceFile,
    endLine: number,
  ): UnitInfo {
    const unit = new UnitInfo()
    const body = lines.slice(candidate.startLine, endLine + 1).join("\n")

    unit.sourceFile = sourceFile
    unit.shortName = candidate.name
    unit.startLine = candidate.startLine
    unit.endLine = endLine
    unit.linesOfCode = endLine - candidate.startLine + 1
    unit.body = body
    unit.cleanedBody = HaskellSourceCodeUtils.clean(body)

    if (candidate.kind === "function") {
      unit.longName = this.getFunctionLongName(lines, candidate)
      unit.numberOfParameters = this.countFunctionParameters(lines[candidate.declarationLine]!)
      unit.mcCabeIndex = this.getMcCabeIndex(unit.cleanedBody)
    } else {
      unit.longName = HaskellSourceCodeUtils.normalizeCodeLine(lines[candidate.startLine]!)
      unit.numberOfParameters = this.countTypeParameters(lines[candidate.declarationLine]!)
      unit.mcCabeIndex = 1
    }

    return unit
  }

  private isTopLevelLine(line: string): boolean {
    return (
      HaskellSourceCodeUtils.normalizeCodeLine(line).length > 0 &&
      HaskellSourceCodeUtils.getIndentationWidth(line) === 0
    )
  }

  private parseTopLevelCandidate(lines: readonly string[], lineIndex: number): HaskellUnitCandidate | null {
    const normalizedLine = HaskellSourceCodeUtils.normalizeCodeLine(lines[lineIndex]!)

    if (
      normalizedLine.startsWith("--") ||
      normalizedLine.startsWith("{-#") ||
      normalizedLine.startsWith("import ") ||
      normalizedLine.startsWith("module ")
    ) {
      return null
    }

    const typeLikeDeclaration = this.extractTypeLikeDeclaration(normalizedLine)
    if (typeLikeDeclaration) {
      return {
        kind: "type",
        name: typeLikeDeclaration.name,
        lineIndex,
      }
    }

    const functionHead = this.extractFunctionHead(normalizedLine)
    if (!functionHead) {
      return null
    }

    if (functionHead.rest.trimStart().startsWith("::")) {
      return {
        kind: "signature",
        name: functionHead.name,
        lineIndex,
      }
    }

    if (functionHead.rest.includes("=") || this.hasContinuationForTopLevelFunction(lines, lineIndex)) {
      return {
        kind: "function",
        name: functionHead.name,
        lineIndex,
      }
    }

    return null
  }

  private hasContinuationForTopLevelFunction(lines: readonly string[], lineIndex: number): boolean {
    for (let index = lineIndex + 1; index < lines.length; index += 1) {
      const line = lines[index]!
      const normalizedLine = HaskellSourceCodeUtils.normalizeCodeLine(line)

      if (normalizedLine.length === 0 || normalizedLine.startsWith("--")) {
        continue
      }

      if (HaskellSourceCodeUtils.getIndentationWidth(line) === 0) {
        return false
      }

      return normalizedLine.startsWith("=") || normalizedLine.startsWith("|") || normalizedLine.startsWith("where")
    }

    return false
  }

  private getUnitEndLine(lines: readonly string[], startLine: number, nextStartLine: number): number {
    let endLine = nextStartLine - 1

    while (endLine > startLine && HaskellSourceCodeUtils.normalizeCodeLine(lines[endLine]!).length === 0) {
      endLine -= 1
    }

    return endLine
  }

  private getFunctionLongName(lines: readonly string[], candidate: MergedHaskellUnitCandidate): string {
    return lines
      .slice(candidate.startLine, candidate.declarationLine + 1)
      .map((line) => HaskellSourceCodeUtils.normalizeCodeLine(line))
      .filter((line) => line.length > 0)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  }

  private countFunctionParameters(line: string): number {
    return this.tokenizeDeclarationRemainder(
      this.extractFunctionHead(HaskellSourceCodeUtils.normalizeCodeLine(line))?.rest ?? "",
    ).length
  }

  private countTypeParameters(line: string): number {
    return this.tokenizeDeclarationRemainder(
      this.extractTypeLikeDeclaration(HaskellSourceCodeUtils.normalizeCodeLine(line))?.rest ?? "",
    ).length
  }

  private tokenizeDeclarationRemainder(remainder: string): string[] {
    const tokens: string[] = []
    let currentToken = ""
    let nestingDepth = 0

    for (let index = 0; index < remainder.length; index += 1) {
      const character = remainder[index]!

      if (nestingDepth === 0 && (character === "=" || character === "|")) {
        break
      }

      if (nestingDepth === 0 && /\s/.test(character)) {
        if (currentToken.length > 0) {
          tokens.push(currentToken)
          currentToken = ""
        }
        continue
      }

      if (character === "(" || character === "[" || character === "{") {
        nestingDepth += 1
      } else if ((character === ")" || character === "]" || character === "}") && nestingDepth > 0) {
        nestingDepth -= 1
      }

      currentToken += character
    }

    if (currentToken.length > 0) {
      tokens.push(currentToken)
    }

    const whereIndex = tokens.indexOf("where")
    return whereIndex >= 0 ? tokens.slice(0, whereIndex) : tokens
  }

  private getMcCabeIndex(cleanedBody: string): number {
    let count = 1

    for (const keyword of MCCABE_KEYWORDS) {
      const matches = cleanedBody.match(new RegExp(`\\b${keyword}\\b`, "g"))
      if (matches) {
        count += matches.length
      }
    }

    for (const operator of MCCABE_OPERATORS) {
      let index = cleanedBody.indexOf(operator)
      while (index >= 0) {
        count += 1
        index = cleanedBody.indexOf(operator, index + operator.length)
      }
    }

    count += cleanedBody
      .split("\n")
      .filter((line) => HaskellSourceCodeUtils.normalizeCodeLine(line).startsWith("|")).length

    return count
  }

  private extractFunctionHead(line: string): { name: string; rest: string } | null {
    const match = line.match(FUNCTION_HEAD_RE)
    if (!match) {
      return null
    }

    const rawName = match[1]!
    const name = rawName.startsWith("(") ? rawName.slice(1, -1) : rawName
    if (RESERVED_TOP_LEVEL_WORDS.has(name)) {
      return null
    }

    return {
      name,
      rest: match[2] ?? "",
    }
  }

  private extractTypeLikeDeclaration(line: string): { name: string; rest: string } | null {
    const typeDeclarationMatch = line.match(TYPE_DECLARATION_RE)
    if (typeDeclarationMatch?.[2]) {
      return {
        name: typeDeclarationMatch[2],
        rest: typeDeclarationMatch[3] ?? "",
      }
    }

    const classDeclarationMatch = line.match(CLASS_DECLARATION_RE)
    if (classDeclarationMatch?.[1]) {
      return {
        name: classDeclarationMatch[1],
        rest: classDeclarationMatch[2] ?? "",
      }
    }

    return null
  }
}
