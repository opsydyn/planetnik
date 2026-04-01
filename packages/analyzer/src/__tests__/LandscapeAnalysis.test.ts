import { describe, expect, test } from "bun:test";
import { Contributor } from "../contributors/Contributor.js";
import { ContributorRepositories } from "../landscape/ContributorRepositories.js";
import { ContributorRepositoryInfo } from "../landscape/ContributorRepositoryInfo.js";
import type { RepositoryAnalysisResult } from "../landscape/LandscapeAnalysisResults.js";
import { LandscapeAnalysisResultsReadData } from "../landscape/LandscapeAnalysisResultsReadData.js";

function makeRepoResult(name: string): RepositoryAnalysisResult {
	return {
		name,
		analysisResultsPath: `${name}/data/analysisResults.json`,
		metadata: { name, description: "", tooltip: "", logoLink: "", links: [] },
		mainLoc: 1000,
		mainFilesCount: 10,
		testLoc: 200,
		testFilesCount: 5,
		generatedLoc: 0,
		buildAndDeployLoc: 0,
		otherLoc: 0,
		extensions: ["ts"],
		linesOfCodePerExtension: [{ extension: "ts", linesOfCode: 1000 }],
		contributors: [],
		firstCommitDate: "2024-01-01",
		latestCommitDate: "2024-06-01",
		duplicationPercentage: 5,
	};
}

describe("ContributorRepositoryInfo", () => {
	test("has correct defaults", () => {
		const info = new ContributorRepositoryInfo();
		expect(info.repositoryAnalysisResult).toBeNull();
		expect(info.firstCommitDate).toBe("");
		expect(info.commitsCount).toBe(0);
		expect(info.commitDates).toEqual([]);
	});

	test("constructs with all parameters", () => {
		const repo = makeRepoResult("test-repo");
		const info = new ContributorRepositoryInfo(
			repo,
			"2024-01-01",
			"2024-06-01",
			42,
			5,
			15,
			25,
			40,
			["2024-05-01"],
		);
		expect(info.repositoryAnalysisResult!.name).toBe("test-repo");
		expect(info.commitsCount).toBe(42);
		expect(info.commits30Days).toBe(5);
		expect(info.commits365Days).toBe(40);
		expect(info.commitDates).toEqual(["2024-05-01"]);
	});
});

describe("ContributorRepositories", () => {
	test("adds repository for contributor", () => {
		const contributor = new Contributor();
		contributor.email = "alice@test.com";
		const cr = new ContributorRepositories(contributor);

		const repo = makeRepoResult("my-repo");
		cr.addRepository(repo, "2024-01-01", "2024-06-01", 10, 2, 5, 8, 10, [
			"2024-05-01",
			"2024-05-15",
		]);

		expect(cr.repositories).toHaveLength(1);
		expect(cr.repositories[0]!.commitsCount).toBe(10);
		expect(cr.repositories[0]!.commitDates).toHaveLength(2);
	});

	test("merges duplicate repositories", () => {
		const contributor = new Contributor();
		contributor.email = "alice@test.com";
		const cr = new ContributorRepositories(contributor);

		const repo = makeRepoResult("my-repo");
		cr.addRepository(repo, "2024-03-01", "2024-06-01", 5, 1, 3, 4, 5, [
			"2024-05-01",
		]);
		cr.addRepository(repo, "2024-01-01", "2024-05-01", 3, 1, 2, 3, 3, [
			"2024-04-01",
		]);

		expect(cr.repositories).toHaveLength(1);
		expect(cr.repositories[0]!.firstCommitDate).toBe("2024-01-01"); // takes earlier
		expect(cr.repositories[0]!.latestCommitDate).toBe("2024-06-01"); // keeps later
		expect(cr.repositories[0]!.commitsCount).toBe(8);
		expect(cr.repositories[0]!.commits30Days).toBe(2);
		expect(cr.repositories[0]!.commitDates).toHaveLength(2); // deduped
	});

	test("adds separate entries for different repos", () => {
		const contributor = new Contributor();
		contributor.email = "alice@test.com";
		const cr = new ContributorRepositories(contributor);

		cr.addRepository(
			makeRepoResult("repo-a"),
			"2024-01-01",
			"2024-06-01",
			5,
			1,
			2,
			3,
			5,
			[],
		);
		cr.addRepository(
			makeRepoResult("repo-b"),
			"2024-02-01",
			"2024-05-01",
			3,
			1,
			2,
			3,
			3,
			[],
		);

		expect(cr.repositories).toHaveLength(2);
	});
});

describe("LandscapeAnalysisResultsReadData", () => {
	test("has correct defaults", () => {
		const data = new LandscapeAnalysisResultsReadData();
		expect(data.commitsCount).toBe(0);
		expect(data.contributorsCount).toBe(0);
		expect(data.repositoriesCount).toBe(0);
		expect(data.mainLoc).toBe(0);
		expect(data.allLoc).toBe(0);
		expect(data.recentContributorsCount).toBe(0);
		expect(data.rookiesContributorsCount).toBe(0);
	});

	test("can be populated from landscape results", () => {
		const data = new LandscapeAnalysisResultsReadData();
		data.metadata = {
			name: "My Landscape",
			description: "",
			tooltip: "",
			logoLink: "",
			links: [],
		};
		data.repositoriesCount = 5;
		data.mainLoc = 50000;
		data.testLoc = 10000;
		data.contributorsCount = 20;
		data.allLoc = data.mainLoc + data.testLoc;

		expect(data.metadata.name).toBe("My Landscape");
		expect(data.allLoc).toBe(60000);
	});
});
