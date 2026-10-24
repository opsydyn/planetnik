import type { SourceFile } from "../aspects/SourceFile.js"
import { UnitInfo } from "./UnitInfo.js"

const IDENTIFIER = "[a-zA-Z0-9_$?:~]+"
const UNIT_SIGNATURE_RE = new RegExp(`(${IDENTIFIER}[ ]+)+${IDENTIFIER}[ ]*[(]`)
const MCCABE_LITERALS = ["if", "while", "for", "foreach", "case", "&&", "||", "?", "catch"]

export class CStyleHeuristicUnitsExtractor {
  extractUnits(sourceFile: SourceFile): UnitInfo[] {
    const lines = sourceFile.cleanedLines.length > 0 ? sourceFile.cleanedLines : sourceFile.lines

    if (lines.length === 0) return []

    const units: UnitInfo[] = []
    this.findUnits(lines, units, sourceFile)
    return units
  }

  private findUnits(lines: string[], units: UnitInfo[], sourceFile: SourceFile): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim()
      if (this.isUnitSignature(line)) {
        const endIndex = this.getEndOfUnitBodyIndex(lines, i)
        if (endIndex > i) {
          const unit = new UnitInfo()
          unit.sourceFile = sourceFile
          unit.startLine = i
          unit.endLine = endIndex
          unit.linesOfCode = endIndex - i + 1

          const body = lines.slice(i, endIndex + 1).join("\n")
          unit.body = body
          unit.cleanedBody = this.extraCleanContent(body)

          this.setNameAndParameters(unit, line)
          unit.mcCabeIndex = this.getMcCabeIndex(unit.cleanedBody)

          units.push(unit)
        }
      }
    }
  }

  private isUnitSignature(line: string): boolean {
    if (line.startsWith("//") || line.startsWith("*") || line.startsWith("/*")) return false
    if (line.startsWith("import ") || line.startsWith("package ") || line.startsWith("using ")) return false
    if (line.includes("=") && !line.includes("=>")) return false
    return UNIT_SIGNATURE_RE.test(line)
  }

  private getEndOfUnitBodyIndex(lines: string[], startIndex: number): number {
    let braceCount = 0
    let foundOpen = false

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]!
      for (const ch of line) {
        if (ch === "{") {
          braceCount++
          foundOpen = true
        } else if (ch === "}") {
          braceCount--
          if (foundOpen && braceCount === 0) {
            return i
          }
        }
      }
    }

    return -1
  }

  private setNameAndParameters(unit: UnitInfo, line: string): void {
    const parenIdx = line.indexOf("(")
    if (parenIdx < 0) {
      unit.shortName = line
      unit.longName = line
      return
    }

    const beforeParen = line.substring(0, parenIdx).trim()
    const parts = beforeParen.split(/\s+/)
    unit.shortName = parts[parts.length - 1] ?? beforeParen
    unit.longName = line.substring(0, line.indexOf(")") + 1) || line

    // Count parameters
    const paramStr = line.substring(parenIdx + 1, line.indexOf(")", parenIdx))
    if (paramStr && paramStr.trim().length > 0) {
      unit.numberOfParameters = paramStr.split(",").length
    }
  }

  private getMcCabeIndex(body: string): number {
    let count = 1 // base complexity
    for (const literal of MCCABE_LITERALS) {
      // Match as word boundary for keywords, literal for operators
      const isOperator = ["&&", "||", "?"].includes(literal)
      if (isOperator) {
        let idx = body.indexOf(literal, 0)
        while (idx >= 0) {
          count++
          idx = body.indexOf(literal, idx + literal.length)
        }
      } else {
        const re = new RegExp(`\\b${literal}\\b`, "g")
        const matches = body.match(re)
        if (matches) count += matches.length
      }
    }
    return count
  }

  private extraCleanContent(content: string): string {
    return content
      .replace(/\\"/g, "") // escaped quotes
      .replace(/:\/\//g, ":/ /") // URLs
      .replace(/@".*?"/g, '""') // verbatim strings
      .replace(/".*?"/g, '""') // string literals
      .replace(/'.*?'/g, "''") // char literals
  }
}
