export class ContributionTimeSlot {
	timeSlot: string = "";
	contributorsCount: number = 0;
	commitsCount: number = 0;
	fileUpdatesCount: number = 0;

	constructor(timeSlot: string = "") {
		this.timeSlot = timeSlot;
	}

	incrementCommitsCount(): void {
		this.commitsCount++;
	}

	incrementFileUpdatesCount(count: number): void {
		this.fileUpdatesCount += count;
	}
}
