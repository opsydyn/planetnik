import type { LogicalDecomposition } from "../aspects/LogicalDecomposition.js";
import type { SourceFile } from "../aspects/SourceFile.js";
import { DuplicationMetric } from "../metrics/DuplicationMetric.js";
import type { DuplicationInstance } from "./DuplicationInstance.js";

export interface SourceFileDuplication {
	sourceFile: SourceFile;
	cleanedLinesOfCode: number;
	duplicatedLineIndexes: number[];
}

export interface ExtensionDuplication {
	extension: string;
	cleanedLinesOfCode: number;
	duplicatedLinesOfCode: number;
}

export interface AspectDuplication {
	name: string;
	cleanedLinesOfCode: number;
	duplicatedLinesOfCode: number;
}

export class DuplicationAggregator {
	static getDuplicationPerSourceFile(
		duplicates: DuplicationInstance[],
	): SourceFileDuplication[] {
		const map = new Map<string, SourceFileDuplication>();

		for (const instance of duplicates) {
			for (const block of instance.duplicatedFileBlocks) {
				if (!block.sourceFile) continue;
				const path = block.sourceFile.relativePath;
				let entry = map.get(path);
				if (!entry) {
					entry = {
						sourceFile: block.sourceFile,
						cleanedLinesOfCode: 0,
						duplicatedLineIndexes: [],
					};
					map.set(path, entry);
				}
				for (let i = block.cleanedStartLine; i <= block.cleanedEndLine; i++) {
					if (!entry.duplicatedLineIndexes.includes(i)) {
						entry.duplicatedLineIndexes.push(i);
					}
				}
			}
		}

		return Array.from(map.values());
	}

	static getDuplicationPerExtension(
		sourceFiles: SourceFile[],
		fileDuplications: SourceFileDuplication[],
	): DuplicationMetric[] {
		const map = new Map<string, DuplicationMetric>();

		// Initialize all extensions
		for (const file of sourceFiles) {
			if (!map.has(file.extension)) {
				map.set(file.extension, new DuplicationMetric(file.extension));
			}
			const metric = map.get(file.extension)!;
			metric.cleanedLinesOfCode += file.cleanedLinesForDuplication.length;
		}

		// Aggregate duplication
		for (const fileDup of fileDuplications) {
			const ext = fileDup.sourceFile.extension;
			const metric = map.get(ext);
			if (metric) {
				metric.duplicatedLinesOfCode += fileDup.duplicatedLineIndexes.length;
			}
		}

		return Array.from(map.values());
	}

	static getDuplicationPerLogicalComponent(
		logicalDecompositions: LogicalDecomposition[],
		_sourceFiles: SourceFile[],
		fileDuplications: SourceFileDuplication[],
	): DuplicationMetric[][] {
		const result: DuplicationMetric[][] = [];

		for (const decomposition of logicalDecompositions) {
			const metrics: DuplicationMetric[] = [];

			for (const component of decomposition.components) {
				const metric = new DuplicationMetric(component.name);

				// Count cleaned lines
				for (const file of component.sourceFiles) {
					metric.cleanedLinesOfCode += file.cleanedLinesForDuplication.length;
				}

				// Count duplicated lines
				for (const fileDup of fileDuplications) {
					if (fileDup.sourceFile.isInLogicalComponent(component.name)) {
						metric.duplicatedLinesOfCode +=
							fileDup.duplicatedLineIndexes.length;
					}
				}

				metrics.push(metric);
			}

			result.push(metrics);
		}

		return result;
	}
}
