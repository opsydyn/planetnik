import type { SourceFile } from "../aspects/SourceFile.js";

export class UnitInfo {
	shortName: string = "";
	longName: string = "";
	sourceFile: SourceFile | null = null;
	startLine: number = 0;
	endLine: number = 0;
	linesOfCode: number = 0;
	mcCabeIndex: number = 1;
	numberOfParameters: number = 0;
	cleanedBody: string = "";
	body: string = "";
	children: UnitInfo[] = [];
}
