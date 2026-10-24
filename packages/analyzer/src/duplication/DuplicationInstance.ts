import type { DuplicatedFileBlock } from "./DuplicatedFileBlock.js"

export class DuplicationInstance {
  displayContent: string = ""
  duplicatedFileBlocks: DuplicatedFileBlock[] = []
  blockSize: number = 0
}
