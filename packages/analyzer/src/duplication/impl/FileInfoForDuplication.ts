import type { SourceFile } from "../../aspects/SourceFile.js"
import { Block } from "./Block.js"

export class FileInfoForDuplication {
  static readonly IGNORE_LINE_INDEX = -1

  sourceFile!: SourceFile
  lineIDs: number[] = []
  blocks: Block[] = []

  extractBlocks(minBlockSize: number): Block[] {
    this.blocks = []

    let block = new Block()
    for (const id of this.lineIDs) {
      if (id === FileInfoForDuplication.IGNORE_LINE_INDEX) {
        if (block.lineIndexes.length >= minBlockSize) {
          this.blocks.push(block)
        }
        block = new Block()
      } else {
        block.lineIndexes.push(id)
      }
    }
    if (block.lineIndexes.length >= minBlockSize) {
      this.blocks.push(block)
    }

    return this.blocks
  }

  getBiggestBlockSize(): number {
    let blockSize = 0
    for (const block of this.blocks) {
      blockSize = Math.max(blockSize, block.lineIndexes.length)
    }
    return blockSize
  }

  indexesOf(block: Block): number[] {
    const indexes: number[] = []
    for (let i = 0; i <= this.lineIDs.length - block.lineIndexes.length; i++) {
      if (this.lineIDs[i] === block.lineIndexes[0]) {
        let containsBlock = true
        for (let j = 0; j < block.lineIndexes.length; j++) {
          if (this.lineIDs[i + j] !== block.lineIndexes[j]) {
            containsBlock = false
            break
          }
        }
        if (containsBlock) {
          indexes.push(i)
          i += block.lineIndexes.length - 1
        }
      }
    }
    return indexes
  }

  clearSubBlock(block: Block): void {
    const indexes = this.indexesOf(block)
    for (const index of indexes) {
      for (let i = index; i < index + block.lineIndexes.length; i++) {
        this.lineIDs[i] = FileInfoForDuplication.IGNORE_LINE_INDEX
      }
    }
  }
}
