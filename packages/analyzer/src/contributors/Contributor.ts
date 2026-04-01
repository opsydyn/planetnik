export class Contributor {
	static readonly RECENTLY_ACTIVITY_THRESHOLD_DAYS = 30;
	static readonly ACTIVITY_THRESHOLD_DAYS = 180;
	static readonly ROOKIE_THRESHOLD_DAYS = 365;

	email: string = "";
	userName: string = "";
	commitsCount: number = 0;
	commitsCount30Days: number = 0;
	fileUpdatesCount30Days: number = 0;
	commitsCount90Days: number = 0;
	commitsCount180Days: number = 0;
	commitsCount365Days: number = 0;
	firstCommitDate: string = "";
	latestCommitDate: string = "";
	activeYears: string[] = [];
	commitDates: string[] = [];
	isBot: boolean = false;

	constructor(email: string = "") {
		this.email = email;
	}

	addCommit(date: string, fileUpdatesCount: number = 0): void {
		if (!this.commitDates.includes(date)) {
			this.commitDates.push(date);
		}
		if (!this.firstCommitDate || date < this.firstCommitDate) {
			this.firstCommitDate = date;
		}
		if (!this.latestCommitDate || date > this.latestCommitDate) {
			this.latestCommitDate = date;
		}
		if (date.length > 4) {
			const year = date.substring(0, 4);
			if (!this.activeYears.includes(year)) {
				this.activeYears.push(year);
				this.activeYears.sort();
			}

			if (
				Contributor.isCommittedLessThanDaysAgo(
					date,
					Contributor.RECENTLY_ACTIVITY_THRESHOLD_DAYS,
				)
			) {
				this.commitsCount30Days += 1;
				this.fileUpdatesCount30Days += fileUpdatesCount;
			}
			if (Contributor.isCommittedLessThanDaysAgo(date, 90)) {
				this.commitsCount90Days += 1;
			}
			if (Contributor.isCommittedLessThanDaysAgo(date, 180)) {
				this.commitsCount180Days += 1;
			}
			if (Contributor.isCommittedLessThanDaysAgo(date, 365)) {
				this.commitsCount365Days += 1;
			}
		}
		this.commitsCount += 1;
	}

	isActive(rangeInDays: number = Contributor.ACTIVITY_THRESHOLD_DAYS): boolean {
		return Contributor.isDateWithinRange(this.latestCommitDate, rangeInDays);
	}

	isRookie(
		activityThreshold: number = Contributor.ACTIVITY_THRESHOLD_DAYS,
	): boolean {
		if (!this.firstCommitDate || !this.isActive(activityThreshold))
			return false;
		const now = new Date();
		now.setDate(now.getDate() - Contributor.ROOKIE_THRESHOLD_DAYS);
		const thresholdDate = now.toISOString().substring(0, 10);
		return this.firstCommitDate > thresholdDate;
	}

	private static isCommittedLessThanDaysAgo(
		date: string,
		days: number,
	): boolean {
		return Contributor.isDateWithinRange(date, days);
	}

	private static isDateWithinRange(date: string, days: number): boolean {
		if (!date || date.length < 10) return false;
		const now = new Date();
		now.setDate(now.getDate() - days);
		const thresholdDate = now.toISOString().substring(0, 10);
		return date >= thresholdDate;
	}
}
