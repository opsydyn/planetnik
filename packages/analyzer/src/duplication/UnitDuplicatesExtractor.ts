import type { UnitInfo } from "../units/UnitInfo.js"
import { DuplicatedFileBlock } from "./DuplicatedFileBlock.js"
import { DuplicationInstance } from "./DuplicationInstance.js"

export class UnitDuplicatesExtractor {
  private cleanedUnitsMap = new Map<string, string>()

  findDuplicatedUnits(units: UnitInfo[], threshold: number): DuplicationInstance[] {
    const map = new Map<string, DuplicationInstance>()

    for (const unit of units) {
      const cleaned = this.getLinesCleanedForDuplication(unit)
      const lineCount = cleaned.split("\n").filter((l) => l.trim().length > 0).length

      if (lineCount < threshold) continue

      const existing = map.get(cleaned)
      if (!existing) {
        const instance = new DuplicationInstance()
        instance.blockSize = lineCount
        instance.displayContent = cleaned
        instance.duplicatedFileBlocks.push(this.getDuplicatedFileBlock(unit))
        map.set(cleaned, instance)
      } else {
        const block = this.getDuplicatedFileBlock(unit)
        if (!this.containsBlock(existing, block)) {
          existing.duplicatedFileBlocks.push(block)
        }
      }
    }

    return Array.from(map.values()).filter((i) => i.duplicatedFileBlocks.length > 1)
  }

  getLinesCleanedForDuplication(unit: UnitInfo): string {
    const cacheKey = `${unit.sourceFile?.relativePath ?? ""} ${unit.startLine}:${unit.endLine}`
    const cached = this.cleanedUnitsMap.get(cacheKey)
    if (cached !== undefined) return cached

    const lines = unit.body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    // Skip first line (function signature)
    const result = lines.slice(1).join("\n")
    this.cleanedUnitsMap.set(cacheKey, result)
    return result
  }

  private getDuplicatedFileBlock(unit: UnitInfo): DuplicatedFileBlock {
    const block = new DuplicatedFileBlock()
    block.sourceFile = unit.sourceFile ?? null
    block.startLine = unit.startLine
    block.endLine = unit.endLine
    block.cleanedStartLine = unit.startLine
    block.cleanedEndLine = unit.endLine
    return block
  }

  private containsBlock(instance: DuplicationInstance, block: DuplicatedFileBlock): boolean {
    return instance.duplicatedFileBlocks.some(
      (b) => b.sourceFile === block.sourceFile && b.startLine === block.startLine && b.endLine === block.endLine,
    )
  }
}
