import type { CommitInfo } from "../githistory/CommitInfo.js";
import { FileHistoryUtils } from "./FileHistoryUtils.js";

export class FileModificationHistory {
	path: string;
	dates: string[] = [];
	commits: CommitInfo[] = [];
	private sorted = false;

	constructor(path: string = "") {
		this.path = path;
	}

	getOldestDate(): string {
		this.sortOldestFirst();
		return this.dates[0] ?? "";
	}

	getLatestDate(): string {
		this.sortOldestFirst();
		return this.dates[this.dates.length - 1] ?? "";
	}

	getOldestContributor(): string {
		this.sortOldestFirst();
		return this.commits[0]?.email ?? "";
	}

	getLatestContributor(): string {
		this.sortOldestFirst();
		return this.commits[this.commits.length - 1]?.email ?? "";
	}

	sortOldestFirst(): void {
		if (this.sorted) return;
		this.sorted = true;
		this.dates.sort();
		this.commits.sort((a, b) => a.date.localeCompare(b.date));
	}

	daysSinceFirstUpdate(): number {
		const oldest = this.getOldestDate();
		if (!oldest) return 0;
		return FileHistoryUtils.daysFromToday(oldest);
	}

	daysSinceLatestUpdate(): number {
		const latest = this.getLatestDate();
		if (!latest) return 0;
		return FileHistoryUtils.daysFromToday(latest);
	}

	countContributors(): number {
		const unique = new Set<string>();
		for (const commit of this.commits) {
			if (commit.email) unique.add(commit.email);
		}
		return unique.size;
	}
}
