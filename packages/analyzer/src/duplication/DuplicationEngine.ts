import type { SourceFile } from "../aspects/SourceFile.js";
import type { DuplicationInstance } from "./DuplicationInstance.js";
import { DuplicationUtils } from "./DuplicationUtils.js";
import { Blocks } from "./impl/Blocks.js";
import { FilesForDuplication } from "./impl/FilesForDuplication.js";

export class DuplicationEngine {
	private _duplicates: DuplicationInstance[] = [];
	private _totalCleanedLinesOfCode = 0;
	private _numberOfDuplicatedLines = 0;

	findDuplicates(
		sourceFiles: SourceFile[],
		threshold: number,
	): DuplicationInstance[] {
		this._duplicates = [];

		const files = new FilesForDuplication();
		files.addAll(sourceFiles);

		const blocks = new Blocks(files, threshold);
		this._duplicates = blocks.extractDuplicatedBlocks();

		this._totalCleanedLinesOfCode = files.totalCleanedLinesOfCode;
		this._numberOfDuplicatedLines = DuplicationUtils.getNumberOfDuplicatedLines(
			this._duplicates,
		);

		return this._duplicates;
	}

	get duplicates(): DuplicationInstance[] {
		return this._duplicates;
	}

	get totalCleanedLinesOfCode(): number {
		return this._totalCleanedLinesOfCode;
	}

	get numberOfDuplicatedLines(): number {
		return this._numberOfDuplicatedLines;
	}
}
