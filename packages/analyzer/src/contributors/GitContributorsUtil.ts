import type { AuthorCommit } from "../githistory/GitHistoryUtils.js";
import { ContributionTimeSlot } from "./ContributionTimeSlot.js";
import { Contributor } from "./Contributor.js";
import { ContributorsImport } from "./ContributorsImport.js";

export class GitContributorsUtil {
	static importFromAuthorCommits(
		authorCommits: AuthorCommit[],
	): ContributorsImport {
		const result = new ContributorsImport();

		for (const commit of authorCommits) {
			const date = commit.date;
			if (!result.firstCommitDate || date <= result.firstCommitDate) {
				result.firstCommitDate = date;
			}
			if (!result.latestCommitDate || date >= result.latestCommitDate) {
				result.latestCommitDate = date;
			}
		}

		result.contributors = GitContributorsUtil.getContributors(authorCommits);
		result.contributorsPerYear = GitContributorsUtil.getContributorsPerTimeSlot(
			authorCommits,
			(c) => c.getYear(),
		);
		result.contributorsPerMonth =
			GitContributorsUtil.getContributorsPerTimeSlot(authorCommits, (c) =>
				c.getMonth(),
			);
		result.contributorsPerWeek = GitContributorsUtil.getContributorsPerTimeSlot(
			authorCommits,
			(c) => c.getWeekOfYear(),
		);
		result.contributorsPerDay = GitContributorsUtil.getContributorsPerTimeSlot(
			authorCommits,
			(c) => c.date,
		);

		return result;
	}

	static getContributors(authorCommits: AuthorCommit[]): Contributor[] {
		const list: Contributor[] = [];
		const map = new Map<string, Contributor>();

		for (const commit of authorCommits) {
			const id = commit.email;
			const existing = map.get(id);
			if (existing) {
				existing.addCommit(commit.date, commit.filesUpdated);
			} else {
				const contributor = new Contributor(commit.email);
				contributor.userName = commit.userName;
				contributor.isBot = commit.bot;
				contributor.addCommit(commit.date, commit.filesUpdated);
				map.set(id, contributor);
				list.push(contributor);
			}
		}

		list.sort((a, b) => b.commitsCount - a.commitsCount);
		return list;
	}

	static getContributorsPerTimeSlot(
		authorCommits: AuthorCommit[],
		idFunction: (commit: AuthorCommit) => string,
	): ContributionTimeSlot[] {
		const list: ContributionTimeSlot[] = [];
		const map = new Map<string, ContributionTimeSlot>();
		const peopleIds = new Map<string, string[]>();

		for (const commit of authorCommits) {
			const timeSlot = idFunction(commit);
			const id = commit.email;

			let ids = peopleIds.get(timeSlot);
			if (!ids) {
				ids = [];
				peopleIds.set(timeSlot, ids);
			}
			if (!ids.includes(id)) {
				ids.push(id);
			}

			let slot = map.get(timeSlot);
			if (!slot) {
				slot = new ContributionTimeSlot(timeSlot);
				map.set(timeSlot, slot);
				list.push(slot);
			}
			slot.incrementCommitsCount();
			slot.contributorsCount = ids.length;
			slot.incrementFileUpdatesCount(commit.filesUpdated);
		}

		list.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
		return list;
	}
}
