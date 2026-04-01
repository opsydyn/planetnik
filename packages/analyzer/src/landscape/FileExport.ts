export class FileExport {
	repository: string;
	path: string;
	scope: string;
	linesOfCode: number;

	constructor(
		repository: string = "",
		path: string = "",
		scope: string = "",
		linesOfCode: number = 0,
	) {
		this.repository = repository;
		this.path = path;
		this.scope = scope;
		this.linesOfCode = linesOfCode;
	}
}
