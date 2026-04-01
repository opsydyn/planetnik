import type { SourceFile } from "../aspects/SourceFile.js";
import type { DuplicationInstance } from "./DuplicationInstance.js";

export class DuplicationUtils {
	static getLinesAsString(
		lines: string[],
		startLine: number,
		blockSize: number,
	): string {
		const result: string[] = [];
		for (
			let lineIndex = startLine;
			lineIndex < startLine + blockSize;
			lineIndex++
		) {
			const line = lines[lineIndex];
			if (line === undefined) break;
			result.push(line);
		}
		return result.join("\n");
	}

	static indexOf(
		lines: string[],
		linesToLookFor: string[],
		startIndex = 0,
	): number {
		for (let i = startIndex; i <= lines.length - linesToLookFor.length; i++) {
			let found = true;
			for (let j = 0; j < linesToLookFor.length; j++) {
				const line = lines[i + j];
				const expected = linesToLookFor[j];
				if (
					!line ||
					!expected ||
					line.toLowerCase() !== expected.toLowerCase()
				) {
					found = false;
					break;
				}
			}
			if (found) return i;
		}
		return -1;
	}

	static getNumberOfDuplicatedLines(
		duplicationInstances: DuplicationInstance[],
	): number {
		const lines = new Set<string>();

		for (const instance of duplicationInstances) {
			for (const block of instance.duplicatedFileBlocks) {
				if (!block.sourceFile) continue;
				for (let i = block.cleanedStartLine; i <= block.cleanedEndLine; i++) {
					lines.add(`${block.sourceFile.relativePath}::${i}`);
				}
			}
		}

		return lines.size;
	}

	static getTotalNumberOfCleanedLines(sourceFiles: SourceFile[]): number {
		let count = 0;
		for (const file of sourceFiles) {
			count += file.cleanedLinesForDuplication.length;
		}
		return count;
	}

	static getTotalNumberOfCleanedLinesPerExtension(
		sourceFiles: SourceFile[],
	): Map<string, number> {
		const map = new Map<string, number>();
		for (const file of sourceFiles) {
			const ext = file.extension;
			const lineCount = file.cleanedLinesForDuplication.length;
			map.set(ext, (map.get(ext) ?? 0) + lineCount);
		}
		return map;
	}

	static getTotalNumberOfCleanedLinesForLogicalComponent(
		sourceFiles: SourceFile[],
		componentName: string,
	): number {
		let count = 0;
		for (const file of sourceFiles) {
			for (const component of file.logicalComponents) {
				if (component.name.toLowerCase() === componentName.toLowerCase()) {
					count += file.cleanedLinesForDuplication.length;
				}
			}
		}
		return count;
	}
}
