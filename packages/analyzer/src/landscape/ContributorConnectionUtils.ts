import type { Contributor } from "../contributors/Contributor.js";
import { ComponentDependency } from "../dependencies/ComponentDependency.js";
import { DateUtils } from "../filehistory/FileHistoryUtils.js";
import type { FileModificationHistory } from "../filehistory/FileModificationHistory.js";
import {
	ContributorConnection,
	type ContributorConnections,
} from "./ContributorConnection.js";

const MAX_PEOPLE_DEPENDENCIES_SIZE = 10_000;

export class ContributorConnectionUtils {
	static getContributorConnections(
		peopleDependencies: ComponentDependency[],
		contributors: Contributor[],
		countFn: (c: Contributor) => number,
	): ContributorConnection[] {
		const connections: ContributorConnection[] = [];
		const map = new Map<string, ContributorConnection>();

		for (const contributor of contributors) {
			const cc = new ContributorConnection(
				contributor.email,
				contributor.email,
				0,
				countFn(contributor),
			);
			map.set(contributor.email, cc);
			connections.push(cc);
		}

		for (const dep of peopleDependencies) {
			if (dep.fromComponent.toLowerCase() === dep.toComponent.toLowerCase())
				continue;
			const cc1 = map.get(dep.fromComponent);
			if (cc1) cc1.count++;
			const cc2 = map.get(dep.toComponent);
			if (cc2) cc2.count++;
		}

		connections.sort((a, b) => b.count - a.count);
		return connections;
	}

	/**
	 * Get people dependencies from file history — contributors who modified the same files.
	 */
	static getPeopleDependencies(
		history: FileModificationHistory[],
		daysAgo: number,
	): ComponentDependency[] {
		const contributionMap = new Map<string, Set<string>>();

		for (const fileHistory of history) {
			for (const commit of fileHistory.commits) {
				if (!DateUtils.isCommittedBetween(commit.date, 0, daysAgo)) continue;
				const path = fileHistory.path;
				let emails = contributionMap.get(path);
				if (!emails) {
					emails = new Set<string>();
					contributionMap.set(path, emails);
				}
				emails.add(commit.email);
			}
		}

		const dependencies: ComponentDependency[] = [];
		const dependenciesMap = new Map<string, ComponentDependency>();

		for (const [path, emails] of contributionMap) {
			const emailList = Array.from(emails);
			for (const email1 of emailList) {
				for (const email2 of emailList) {
					if (dependencies.length > MAX_PEOPLE_DEPENDENCIES_SIZE)
						return dependencies;
					if (email1.toLowerCase() === email2.toLowerCase()) continue;

					const key1 = `${email1}::${email2}`;
					const key2 = `${email2}::${email1}`;
					let dep = dependenciesMap.get(key1) ?? dependenciesMap.get(key2);

					if (!dep) {
						dep = new ComponentDependency(email1, email2);
						dep.count = 0;
						dep.data = [];
						dependenciesMap.set(key1, dep);
						dependencies.push(dep);
					}

					if (!dep.data.includes(path)) {
						dep.data.push(path);
					}
					dep.count = dep.data.length;
				}
			}
		}

		dependencies.sort((a, b) => b.count - a.count);
		return dependencies;
	}

	/**
	 * Get people-file dependencies — which contributors touched which files.
	 */
	static getPeopleFileDependencies(
		history: FileModificationHistory[],
		daysAgo: number,
	): ComponentDependency[] {
		const dependencies: ComponentDependency[] = [];
		const dependenciesMap = new Map<string, ComponentDependency>();

		for (const fileHistory of history) {
			for (const commit of fileHistory.commits) {
				if (dependencies.length > MAX_PEOPLE_DEPENDENCIES_SIZE)
					return dependencies;
				if (!DateUtils.isCommittedBetween(commit.date, 0, daysAgo)) continue;

				const path = `[${fileHistory.path}]`;
				const email = commit.email;
				const key1 = `${email}::${path}`;
				const key2 = `${path}::${email}`;

				let dep = dependenciesMap.get(key1) ?? dependenciesMap.get(key2);
				if (!dep) {
					dep = new ComponentDependency(email, path);
					dep.count = 0;
					dependenciesMap.set(key1, dep);
					dependencies.push(dep);
				}
				dep.count++;
			}
		}

		dependencies.sort((a, b) => b.count - a.count);
		return dependencies;
	}

	static getCIndex(contributorConnections: ContributorConnections[]): number {
		const sorted = [...contributorConnections].sort(
			(a, b) => b.connectionsCount - a.connectionsCount,
		);
		for (let i = 0; i < sorted.length; i++) {
			if (i === sorted[i]!.connectionsCount) return i;
			if (i > sorted[i]!.connectionsCount) return i - 1;
		}
		return 0;
	}

	static getCMedian(contributorConnections: ContributorConnections[]): number {
		const sorted = [...contributorConnections].sort(
			(a, b) => b.connectionsCount - a.connectionsCount,
		);
		const n = sorted.length;
		if (n === 0) return 0;
		const mid = Math.floor(n / 2);
		return n % 2 === 1
			? sorted[mid]!.connectionsCount
			: (sorted[mid - 1]!.connectionsCount + sorted[mid]!.connectionsCount) / 2;
	}

	static getCMean(contributorConnections: ContributorConnections[]): number {
		if (contributorConnections.length === 0) return 0;
		let total = 0;
		for (const c of contributorConnections) total += c.connectionsCount;
		return total / contributorConnections.length;
	}
}
