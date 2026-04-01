import type { Block } from "./Block.js";
import type { FilesForDuplication } from "./FilesForDuplication.js";

export class BlocksExtractor {
	private files: FilesForDuplication;
	private uniqueBlocks = new Map<string, Block>();
	private _duplicateBlocks = new Map<string, Block>();
	private minDuplicationBlockSize: number;

	constructor(files: FilesForDuplication, minDuplicationBlockSize: number) {
		this.files = files;
		this.minDuplicationBlockSize = minDuplicationBlockSize;
	}

	extractMinimalBlocks(): void {
		for (const file of this.files.getFiles()) {
			for (const blockInFile of file.extractBlocks(
				this.minDuplicationBlockSize,
			)) {
				for (const b of blockInFile.extractAllPossibleSubBlocks(
					this.minDuplicationBlockSize,
				)) {
					this.addBlockToMaps(b, file.sourceFile);
				}
			}
		}
	}

	private addBlockToMaps(
		block: Block,
		sourceFile: { relativePath: string } & object,
	): void {
		const key = block.getStringKey();
		if (!this.uniqueBlocks.has(key)) {
			if (!block.files.includes(sourceFile as never)) {
				block.files.push(sourceFile as never);
			}
			this.uniqueBlocks.set(key, block);
		} else {
			const originalBlock = this.uniqueBlocks.get(key)!;
			this._duplicateBlocks.set(key, originalBlock);
			if (!originalBlock.files.includes(sourceFile as never)) {
				originalBlock.files.push(sourceFile as never);
			}
		}
	}

	get duplicateBlocks(): Map<string, Block> {
		return this._duplicateBlocks;
	}
}
