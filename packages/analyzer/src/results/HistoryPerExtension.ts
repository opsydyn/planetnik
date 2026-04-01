export class HistoryPerExtension {
	extension: string;
	year: string;
	commitsCount: number;
	contributors: Set<string> = new Set();

	constructor(
		extension: string = "",
		year: string = "",
		commitsCount: number = 0,
	) {
		this.extension = extension;
		this.year = year;
		this.commitsCount = commitsCount;
	}
}
