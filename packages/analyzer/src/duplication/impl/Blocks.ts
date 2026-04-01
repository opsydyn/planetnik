import type { SourceFile } from "../../aspects/SourceFile.js";
import { DuplicatedFileBlock } from "../DuplicatedFileBlock.js";
import { DuplicationInstance } from "../DuplicationInstance.js";
import type { Block } from "./Block.js";
import { BlocksExtractor } from "./BlocksExtractor.js";
import {
	DuplicateRange,
	DuplicateRangePair,
	DuplicateRangePairs,
} from "./DuplicateRange.js";
import { FileInfoForDuplication } from "./FileInfoForDuplication.js";
import type { FilesForDuplication } from "./FilesForDuplication.js";

export class Blocks {
	private files: FilesForDuplication;
	private minDuplicationBlockSize: number;
	private optimize = true;

	private filePairMap = new Map<string, [SourceFile, SourceFile]>();
	private blocksDuplicatedAmongFiles: Block[] = [];
	private duplicatedFilePairs: Block[] = [];
	private duplicateBlocks: Block[] = [];
	private fileRangePairs = new Map<string, DuplicateRangePairs>();
	private duplicationInstances = new Map<string, DuplicationInstance>();

	constructor(files: FilesForDuplication, minDuplicationBlockSize: number) {
		this.files = files;
		this.minDuplicationBlockSize = minDuplicationBlockSize;
	}

	extractDuplicatedBlocks(): DuplicationInstance[] {
		const blocksExtractor = new BlocksExtractor(
			this.files,
			this.minDuplicationBlockSize,
		);
		blocksExtractor.extractMinimalBlocks();

		this.duplicateBlocks = [];
		for (const block of blocksExtractor.duplicateBlocks.values()) {
			this.duplicateBlocks.push(block);
		}

		this.findDuplicatedSharedAmongFiles();
		this.findDuplicatesAmongFiles();
		this.findDuplicatesWithinFiles();

		return Array.from(this.duplicationInstances.values());
	}

	private findDuplicatedSharedAmongFiles(): void {
		for (const b of this.duplicateBlocks) {
			if (b.files.length > 1) {
				this.blocksDuplicatedAmongFiles.push(b);
			}
		}
		this.createDuplicatedFilesMap();
	}

	private createDuplicatedFilesMap(): void {
		for (const db of this.blocksDuplicatedAmongFiles) {
			if (db.files.length === 2) {
				const f1 = db.files[0];
				const f2 = db.files[1];
				if (!f1 || !f2) continue;

				this.duplicatedFilePairs.push(db);
				const pairKey1 = this.getPairKey(f1.relativePath, f2.relativePath);
				const pairKey2 = this.getPairKey(f2.relativePath, f1.relativePath);

				if (
					!this.filePairMap.has(pairKey1) &&
					!this.filePairMap.has(pairKey2)
				) {
					this.filePairMap.set(pairKey1, [f1, f2]);
				}
			} else if (db.files.length > 2) {
				for (const f1 of db.files) {
					for (const f2 of db.files) {
						if (f1 !== f2) {
							const newBlock = new (db.constructor as { new (): Block })();
							this.duplicatedFilePairs.push(newBlock);
							newBlock.setLineIndexes(db.lineIndexes);
							newBlock.files.push(f1);
							newBlock.files.push(f2);

							const pairKey1 = this.getPairKey(
								f1.relativePath,
								f2.relativePath,
							);
							const pairKey2 = this.getPairKey(
								f2.relativePath,
								f1.relativePath,
							);

							if (
								!this.filePairMap.has(pairKey1) &&
								!this.filePairMap.has(pairKey2)
							) {
								this.filePairMap.set(pairKey1, [f1, f2]);
							}
						}
					}
				}
			}
		}
	}

	private getPairKey(path1: string, path2: string): string {
		return `${path1}::${path2}`;
	}

	private findDuplicatesAmongFiles(): void {
		for (const [f1, f2] of this.filePairMap.values()) {
			const fileInfo1 = this.files.getFilesMap().get(f1);
			const fileInfo2Orig = this.files.getFilesMap().get(f2);
			if (!fileInfo1 || !fileInfo2Orig) continue;

			const fileInfo2Copy = new FileInfoForDuplication();
			fileInfo2Copy.sourceFile = fileInfo2Orig.sourceFile;
			fileInfo2Copy.blocks = [...fileInfo2Orig.blocks];
			fileInfo2Copy.lineIDs = [...fileInfo2Orig.lineIDs];

			this.addDuplicationInstances(
				fileInfo1,
				fileInfo2Copy,
				this.minDuplicationBlockSize,
			);
		}
	}

	private addDuplicationInstances(
		fileInfo1: FileInfoForDuplication,
		fileInfo2: FileInfoForDuplication,
		blockSize: number,
	): void {
		const blocks = fileInfo1.extractBlocks(blockSize);
		for (const block1 of blocks) {
			const allSubBlocks = block1.extractAllPossibleSubBlocks(blockSize);
			for (const subBlock1 of allSubBlocks) {
				let instance = this.duplicationInstances.get(subBlock1.getStringKey());
				if (!instance) {
					instance = new DuplicationInstance();
					instance.blockSize = blockSize;
				}

				const cleanedStartLine1 = fileInfo1.indexesOf(subBlock1)[0];
				if (cleanedStartLine1 === undefined) continue;

				this.addFileToDuplicationInstance(
					instance,
					fileInfo1.sourceFile,
					cleanedStartLine1 + 1,
					blockSize,
				);

				const foundBlockIDs = fileInfo2.indexesOf(subBlock1);
				if (foundBlockIDs.length > 0) {
					const cleanedStartLine2 = foundBlockIDs[0];
					if (cleanedStartLine2 === undefined) continue;

					const range1 = new DuplicateRange(
						cleanedStartLine1,
						cleanedStartLine1 + blockSize - 1,
					);
					const range2 = new DuplicateRange(
						cleanedStartLine2,
						cleanedStartLine2 + blockSize - 1,
					);

					const pair1 = new DuplicateRangePair(range1, range2);
					const pair2 = new DuplicateRangePair(range2, range1);

					const path1 = fileInfo1.sourceFile.relativePath;
					const path2 = fileInfo2.sourceFile.relativePath;
					const key1 = this.getPairKey(path1, path2);
					const key2 = this.getPairKey(path2, path1);

					let alreadyIncluded = false;
					const rangePairs1 = this.fileRangePairs.get(key1);
					const rangePairs2 = this.fileRangePairs.get(key2);

					if (rangePairs1?.includes(pair1)) alreadyIncluded = true;
					if (!alreadyIncluded && rangePairs2?.includes(pair2))
						alreadyIncluded = true;

					if (!alreadyIncluded) {
						this.duplicationInstances.set(subBlock1.getStringKey(), instance);
						this.addFileToDuplicationInstance(
							instance,
							fileInfo2.sourceFile,
							cleanedStartLine2 + 1,
							blockSize,
						);

						const rp1 = rangePairs1 ?? new DuplicateRangePairs();
						if (!rangePairs1) this.fileRangePairs.set(key1, rp1);
						rp1.ranges.push(pair1);

						const rp2 = rangePairs2 ?? new DuplicateRangePairs();
						if (!rangePairs2) this.fileRangePairs.set(key2, rp2);
						rp2.ranges.push(pair2);
					}
				}
			}
		}
	}

	private findDuplicatesWithinFiles(): void {
		for (const fileLineIndexes of this.files.getFiles()) {
			const ranges: DuplicateRange[] = [];

			const copy = new FileInfoForDuplication();
			copy.sourceFile = fileLineIndexes.sourceFile;
			copy.blocks = [...fileLineIndexes.blocks];
			copy.lineIDs = [...fileLineIndexes.lineIDs];

			const startSize = this.optimize
				? this.minDuplicationBlockSize
				: copy.getBiggestBlockSize();

			for (
				let blockSize = startSize;
				blockSize >= this.minDuplicationBlockSize;
				blockSize--
			) {
				const blocks = copy.extractBlocks(blockSize);
				for (const block of blocks) {
					for (const subBlock of block.extractAllPossibleSubBlocks(blockSize)) {
						const indexesOf = copy.indexesOf(subBlock);
						if (indexesOf.length > 1) {
							let instance = this.duplicationInstances.get(
								subBlock.getStringKey(),
							);
							if (!instance) {
								instance = new DuplicationInstance();
								instance.blockSize = blockSize;
							}

							for (const index of indexesOf) {
								const range = new DuplicateRange(index, index + blockSize - 1);
								if (!this.alreadyIncludedInRange(ranges, range)) {
									this.addFileToDuplicationInstance(
										instance,
										copy.sourceFile,
										index + 1,
										blockSize,
									);
									ranges.push(range);
								}
							}

							if (instance.duplicatedFileBlocks.length > 1) {
								this.duplicationInstances.set(
									subBlock.getStringKey(),
									instance,
								);
							}
						}
					}
				}
			}
		}
	}

	private alreadyIncludedInRange(
		ranges: DuplicateRange[],
		range: DuplicateRange,
	): boolean {
		for (const testRange of ranges) {
			if (testRange.includes(range)) {
				return true;
			}
		}
		return false;
	}

	private addFileToDuplicationInstance(
		instance: DuplicationInstance,
		sourceFile: SourceFile,
		cleanedStartLine: number,
		blockSize: number,
	): void {
		const duplicatedFileBlock = new DuplicatedFileBlock();
		duplicatedFileBlock.sourceFile = sourceFile;

		duplicatedFileBlock.cleanedStartLine = cleanedStartLine;
		const cleanedEndLine = cleanedStartLine + blockSize - 1;
		duplicatedFileBlock.cleanedEndLine = cleanedEndLine;

		const cleanedContent = this.files.getPathToCleanedContent().get(sourceFile);
		if (cleanedContent) {
			const fileLineIndexes = cleanedContent.fileLineIndexes;
			if (cleanedStartLine - 1 < fileLineIndexes.length) {
				const startLine = fileLineIndexes[cleanedStartLine - 1];
				if (startLine !== undefined) {
					duplicatedFileBlock.startLine = startLine + 1;
				}
			}
			if (cleanedEndLine - 1 < fileLineIndexes.length) {
				const endLine = fileLineIndexes[cleanedEndLine - 1];
				if (endLine !== undefined) {
					duplicatedFileBlock.endLine = endLine + 1;
				}
			}
			duplicatedFileBlock.sourceFileCleanedLinesOfCode = fileLineIndexes.length;
		}

		// Check if block already exists
		const exists = instance.duplicatedFileBlocks.some(
			(b) =>
				b.sourceFile === duplicatedFileBlock.sourceFile &&
				b.cleanedStartLine === duplicatedFileBlock.cleanedStartLine &&
				b.cleanedEndLine === duplicatedFileBlock.cleanedEndLine,
		);

		if (!exists) {
			instance.duplicatedFileBlocks.push(duplicatedFileBlock);
		}
	}
}
