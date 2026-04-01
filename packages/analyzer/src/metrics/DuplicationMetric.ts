export class DuplicationMetric {
	key: string;
	numberOfDuplicates: number = 0;
	cleanedLinesOfCode: number = 0;
	duplicatedLinesOfCode: number = 0;
	numberOfFilesWithDuplicates: number = 0;

	constructor(
		key: string = "",
		cleanedLinesOfCode: number = 0,
		duplicatedLinesOfCode: number = 0,
	) {
		this.key = key;
		this.cleanedLinesOfCode = cleanedLinesOfCode;
		this.duplicatedLinesOfCode = duplicatedLinesOfCode;
	}

	getDuplicationPercentage(): number {
		if (this.cleanedLinesOfCode === 0) return 0;
		return (100.0 * this.duplicatedLinesOfCode) / this.cleanedLinesOfCode;
	}
}
