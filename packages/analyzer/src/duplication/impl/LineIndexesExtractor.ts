import { FileInfoForDuplication } from "./FileInfoForDuplication.js";
import { LineInfo } from "./LineInfo.js";

export class LineIndexesExtractor {
	static readonly MAX_LINE_LENGTH = 500;

	private totalLinesCount = 0;
	private uniqueLinesMap = new Map<string, LineInfo>();
	private uniqueLinesIdMap = new Map<number, LineInfo>();

	getTotalLinesCount(): number {
		return this.totalLinesCount;
	}

	getLineIDs(lines: string[]): number[] {
		this.totalLinesCount += lines.length;
		const lineIDs: number[] = [];
		for (const line of lines) {
			this.addLineID(lineIDs, line);
		}
		return lineIDs;
	}

	private addLineID(lineIDs: number[], line: string): void {
		const truncated =
			line.length > LineIndexesExtractor.MAX_LINE_LENGTH
				? line.substring(0, LineIndexesExtractor.MAX_LINE_LENGTH)
				: line;

		let lineInfo = this.uniqueLinesMap.get(truncated);

		if (!lineInfo) {
			lineInfo = new LineInfo();
			this.uniqueLinesMap.set(truncated, lineInfo);
			this.uniqueLinesIdMap.set(lineInfo.id, lineInfo);
		} else {
			lineInfo.incrementCount();
		}

		lineIDs.push(lineInfo.id);
	}

	clearUniqueLines(lineIndexes: number[]): void {
		for (let i = 0; i < lineIndexes.length; i++) {
			const index = lineIndexes[i];
			if (index === undefined) continue;
			const lineInfo = this.uniqueLinesIdMap.get(index);
			if (!lineInfo || lineInfo.count === 1) {
				lineIndexes[i] = FileInfoForDuplication.IGNORE_LINE_INDEX;
			}
		}
	}
}
