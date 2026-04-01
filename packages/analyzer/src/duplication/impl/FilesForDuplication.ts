import type { SourceFile } from "../../aspects/SourceFile.js";
import type { CleanedContent } from "../../cleaners/CleanedContent.js";
import { LanguageAnalyzerFactory } from "../../lang/LanguageAnalyzerFactory.js";
import { FileInfoForDuplication } from "./FileInfoForDuplication.js";
import { LineIndexesExtractor } from "./LineIndexesExtractor.js";

export class FilesForDuplication {
	private files: FileInfoForDuplication[] = [];
	private filesMap = new Map<SourceFile, FileInfoForDuplication>();
	private lineIndexesExtractor: LineIndexesExtractor | null =
		new LineIndexesExtractor();
	private pathToCleanedContent = new Map<SourceFile, CleanedContent>();
	private _totalCleanedLinesOfCode = 0;

	addAll(sourceFiles: SourceFile[]): void {
		for (const sourceFile of sourceFiles) {
			this.add(sourceFile);
		}
		this.clearUniqueLines();
		this.lineIndexesExtractor = null;
	}

	private clearUniqueLines(): void {
		if (!this.lineIndexesExtractor) return;
		for (const fileInfo of this.files) {
			this.lineIndexesExtractor.clearUniqueLines(fileInfo.lineIDs);
		}
	}

	private add(sourceFile: SourceFile): void {
		const fileInfo = new FileInfoForDuplication();
		fileInfo.sourceFile = sourceFile;
		fileInfo.lineIDs = this.getLinesAsNumbers(sourceFile);
		this.files.push(fileInfo);
		this.filesMap.set(sourceFile, fileInfo);
	}

	private getLinesAsNumbers(sourceFile: SourceFile): number[] {
		if (!this.lineIndexesExtractor) return [];

		const analyzer = LanguageAnalyzerFactory.getInstance().getLanguageAnalyzer(
			sourceFile.extension,
		);
		const cleanedContent = analyzer.cleanForDuplicationCalculations(sourceFile);

		this.pathToCleanedContent.set(sourceFile, cleanedContent);
		this._totalCleanedLinesOfCode += cleanedContent.fileLineIndexes.length;

		return this.lineIndexesExtractor.getLineIDs(cleanedContent.getLines());
	}

	getFiles(): FileInfoForDuplication[] {
		return this.files;
	}

	getFilesMap(): Map<SourceFile, FileInfoForDuplication> {
		return this.filesMap;
	}

	getPathToCleanedContent(): Map<SourceFile, CleanedContent> {
		return this.pathToCleanedContent;
	}

	get totalCleanedLinesOfCode(): number {
		return this._totalCleanedLinesOfCode;
	}
}
