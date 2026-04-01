import type { SourceFile } from "../../aspects/SourceFile.js";

export class Block {
	lineIndexes: number[] = [];
	private allPossibleLineBlocks: Block[] = [];
	files: SourceFile[] = [];
	private keyCache: string | null = null;

	constructor(lineIndexes?: number[]) {
		if (lineIndexes) {
			this.lineIndexes = lineIndexes;
			this.getStringKey();
		}
	}

	extractAllPossibleSubBlocks(subBlockSize: number): Block[] {
		if (subBlockSize < 1) {
			throw new Error("The sub-block size has to be bigger than 0.");
		}

		this.allPossibleLineBlocks = [];

		for (let i = 0; i <= this.lineIndexes.length - subBlockSize; i++) {
			const block = new Block();
			block.lineIndexes = this.lineIndexes.slice(i, i + subBlockSize);
			this.allPossibleLineBlocks.push(block);
		}

		return this.allPossibleLineBlocks;
	}

	equals(other: Block): boolean {
		if (other.lineIndexes.length !== this.lineIndexes.length) {
			return false;
		}
		for (let i = 0; i < this.lineIndexes.length; i++) {
			if (other.lineIndexes[i] !== this.lineIndexes[i]) {
				return false;
			}
		}
		return true;
	}

	getStringKey(): string {
		if (this.keyCache !== null) {
			return this.keyCache;
		}
		this.keyCache = `${this.lineIndexes.join(";")};`;
		return this.keyCache;
	}

	setLineIndexes(indexes: number[]): void {
		this.lineIndexes = indexes;
		this.keyCache = null;
		this.getStringKey();
	}
}
