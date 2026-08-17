import type { DuplicationInstance } from "@planetnik/analyzer";
import type { FileExportInfo } from "./FileExportInfo.js";
import { fileExportInfoFromSourceFile } from "./FileExportInfo.js";
import { fileEntityId } from "./EntityIdentity.js";

export interface DuplicateFileBlockExportInfo {
	file: FileExportInfo;
	sourceFileCleanedLinesOfCode: number;
	startLine: number;
	endLine: number;
	cleanedStartLine: number;
	cleanedEndLine: number;
}

export interface DuplicateExportInfo {
	blockSize: number;
	duplicatedFileBlocks: DuplicateFileBlockExportInfo[];
}

export interface DuplicationExportInfo {
	title: string;
	timestamp: string;
	duplicates: DuplicateExportInfo[];
}

export class DuplicationExporter {
	private duplicates: DuplicationInstance[];

	constructor(duplicates: DuplicationInstance[]) {
		this.duplicates = duplicates;
	}

	getDuplicatesExportInfo(): DuplicateExportInfo[] {
		return this.duplicates.map((instance) => ({
			blockSize: instance.blockSize,
			duplicatedFileBlocks: instance.duplicatedFileBlocks.map((block) => ({
				file: block.sourceFile
					? fileExportInfoFromSourceFile(block.sourceFile)
					: {
							id: fileEntityId(""),
							relativePath: "",
							extension: "",
							linesOfCode: 0,
							components: [],
							concerns: [],
						},
				sourceFileCleanedLinesOfCode: block.sourceFileCleanedLinesOfCode,
				startLine: block.startLine,
				endLine: block.endLine,
				cleanedStartLine: block.cleanedStartLine,
				cleanedEndLine: block.cleanedEndLine,
			})),
		}));
	}

	static exportDuplication(
		duplicates: DuplicationInstance[],
		title: string,
		timestamp: string,
	): DuplicationExportInfo {
		const exporter = new DuplicationExporter(duplicates);
		return {
			title,
			timestamp,
			duplicates: exporter.getDuplicatesExportInfo(),
		};
	}
}
