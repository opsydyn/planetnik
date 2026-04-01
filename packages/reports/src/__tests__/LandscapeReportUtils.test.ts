import { describe, expect, test } from "bun:test";
import {
	Contributor,
	ContributorRepositories,
	ContributorRepositoryInfo,
	LandscapeConfiguration,
	MergeExtension,
	type RepositoryAnalysisResult,
	RepositoryTag,
	TagGroup,
} from "@planetnik/analyzer";
import { ContributorExport } from "../landscape/data/ContributorExport.js";
import { ContributorRepositoryInfoExport } from "../landscape/data/ContributorRepositoryInfoExport.js";
import { RepositoryExport } from "../landscape/data/RepositoryExport.js";
import { FeaturesOfInterestAggregator } from "../landscape/utils/FeaturesOfInterestAggregator.js";
import { LandscapeGeneratorUtils } from "../landscape/utils/LandscapeGeneratorUtils.js";
import { TagMap } from "../landscape/utils/TagMap.js";
import { TagStats } from "../landscape/utils/TagStats.js";

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

describe("LandscapeGeneratorUtils", () => {
	test("filters extensions by threshold", () => {
		const config = new LandscapeConfiguration();
		config.extensionThresholdLoc = 500;

		const extensions = [
			{ name: "*.ts", value: 1000, description: [] },
			{ name: "*.json", value: 100, description: [] },
		];
		const result = LandscapeGeneratorUtils.getLinesOfCodePerExtension(
			config,
			extensions,
		);
		expect(result).toHaveLength(1);
		expect(result[0]!.name).toBe("ts");
	});

	test("filters ignored extensions", () => {
		const config = new LandscapeConfiguration();
		config.ignoreExtensions = ["json"];

		const extensions = [
			{ name: "*.ts", value: 1000, description: [] },
			{ name: "*.json", value: 500, description: [] },
		];
		const result = LandscapeGeneratorUtils.getLinesOfCodePerExtension(
			config,
			extensions,
		);
		expect(result).toHaveLength(1);
		expect(result[0]!.name).toBe("ts");
	});

	test("merges extensions via MergeExtension config", () => {
		const config = new LandscapeConfiguration();
		const merge = new MergeExtension();
		merge.primary = "ts";
		merge.secondary = "tsx";
		config.mergeExtensions = [merge];

		const extensions = [
			{ name: "*.ts", value: 800, description: [] },
			{ name: "*.tsx", value: 200, description: [] },
		];
		const result = LandscapeGeneratorUtils.getLinesOfCodePerExtension(
			config,
			extensions,
		);
		expect(result).toHaveLength(1);
		expect(result[0]!.name).toBe("ts");
		expect(result[0]!.value).toBe(1000);
	});

	test("filters h- prefixed extensions", () => {
		const config = new LandscapeConfiguration();
		const extensions = [
			{ name: "*.ts", value: 1000, description: [] },
			{ name: "*.h-test", value: 500, description: [] },
		];
		const result = LandscapeGeneratorUtils.getLinesOfCodePerExtension(
			config,
			extensions,
		);
		expect(result).toHaveLength(1);
	});
});

describe("TagStats", () => {
	test("tracks tag and repositories", () => {
		const tag = new RepositoryTag();
		tag.tag = "backend";
		const stats = new TagStats(tag);
		stats.repositoryAnalysisResults.push(makeRepoResult("repo-a"));
		expect(stats.tag.tag).toBe("backend");
		expect(stats.repositoryAnalysisResults).toHaveLength(1);
	});
});

describe("TagMap", () => {
	test("tags repositories by name pattern", () => {
		const config = new LandscapeConfiguration();
		const group = new TagGroup();
		group.name = "Type";
		const tag = new RepositoryTag();
		tag.tag = "API";
		tag.patterns = [".*-api"];
		tag.group = group;
		group.repositoryTags = [tag];

		const tagMap = new TagMap(config, [group]);
		const repos = [makeRepoResult("user-api"), makeRepoResult("web-frontend")];

		tagMap.updateTagMap(
			repos,
			(repo) =>
				repo.linesOfCodePerExtension.map((e) => ({
					name: `*.${e.extension}`,
					value: e.linesOfCode,
					description: [],
				})),
			() => [],
		);

		expect(tagMap.tagsCount()).toBe(1);
		expect(
			tagMap.getTagStats("Type / API")?.repositoryAnalysisResults,
		).toHaveLength(1);
		expect(tagMap.getRepositoryTags(repos[0]!)).toHaveLength(1);
		// untagged goes to "" bucket
		expect(tagMap.containsKey("")).toBe(true);
	});

	test("tags by main technology", () => {
		const config = new LandscapeConfiguration();
		const group = new TagGroup();
		group.name = "Lang";
		const tag = new RepositoryTag();
		tag.tag = "TypeScript";
		tag.mainExtensions = ["ts"];
		tag.group = group;
		group.repositoryTags = [tag];

		const tagMap = new TagMap(config, [group]);
		tagMap.updateTagMap(
			[makeRepoResult("my-app")],
			(repo) =>
				repo.linesOfCodePerExtension.map((e) => ({
					name: `*.${e.extension}`,
					value: e.linesOfCode,
					description: [],
				})),
			() => [],
		);

		expect(tagMap.tagsCount()).toBe(1);
	});
});

describe("FeaturesOfInterestAggregator", () => {
	test("aggregates concerns across repositories", () => {
		const repos = [makeRepoResult("repo-a"), makeRepoResult("repo-b")];
		const aggregator = new FeaturesOfInterestAggregator(repos);

		aggregator.aggregateFeaturesOfInterest(100, (repo) => ({
			name: repo.name,
			concerns: [
				{ name: "logging", filesCount: 5, numberOfRegexLineMatches: 20 },
				{ name: "auth", filesCount: 3, numberOfRegexLineMatches: 10 },
			],
		}));

		expect(aggregator.concernsMap.size).toBe(2);
		expect(aggregator.concernsMap.get("logging")).toHaveLength(2);
		expect(aggregator.concerns).toHaveLength(2);
		expect(aggregator.repositories).toHaveLength(2);
	});

	test("skips unclassified concerns", () => {
		const repos = [makeRepoResult("repo-a")];
		const aggregator = new FeaturesOfInterestAggregator(repos);

		aggregator.aggregateFeaturesOfInterest(100, () => ({
			name: "repo",
			concerns: [
				{ name: "Unclassified", filesCount: 10, numberOfRegexLineMatches: 0 },
				{ name: "logging", filesCount: 3, numberOfRegexLineMatches: 5 },
			],
		}));

		expect(aggregator.concernsMap.size).toBe(1);
		expect(aggregator.concernsMap.has("Unclassified")).toBe(false);
	});

	test("respects limit on repositories", () => {
		const repos = Array.from({ length: 10 }, (_, i) =>
			makeRepoResult(`repo-${i}`),
		);
		const aggregator = new FeaturesOfInterestAggregator(repos);

		aggregator.aggregateFeaturesOfInterest(3, (repo) => ({
			name: repo.name,
			concerns: [
				{ name: "feature", filesCount: 1, numberOfRegexLineMatches: 1 },
			],
		}));

		expect(aggregator.repositories.length).toBeLessThanOrEqual(3);
	});
});

describe("RepositoryExport", () => {
	test("extracts fields from RepositoryAnalysisResult", () => {
		const repo = makeRepoResult("test-repo");
		repo.contributors = [
			Object.assign(new Contributor(), {
				email: "alice@test.com",
				commitsCount: 50,
				commitsCount30Days: 5,
				commitsCount90Days: 15,
			}),
		];

		const exportData = new RepositoryExport(repo);
		expect(exportData.metadata.name).toBe("test-repo");
		expect(exportData.mainLinesOfCode).toBe(1000);
		expect(exportData.testLinesOfCode).toBe(200);
		expect(exportData.contributors).toEqual(["alice@test.com"]);
		expect(exportData.contributors30Days).toEqual(["alice@test.com"]);
		expect(exportData.commitsCount).toBe(50);
	});
});

describe("ContributorExport", () => {
	test("extracts contributor data", () => {
		const contributor = new Contributor();
		contributor.email = "alice@test.com";
		contributor.commitsCount = 100;
		const cr = new ContributorRepositories(contributor);

		const repo = makeRepoResult("repo-a");
		cr.addRepository(repo, "2024-01-01", "2024-06-01", 50, 5, 10, 20, 40, []);

		const exportData = new ContributorExport(cr);
		expect(exportData.contributor.email).toBe("alice@test.com");
		expect(exportData.repositories).toHaveLength(1);
		expect(exportData.repositories[0]!.name).toBe("repo-a");
		expect(exportData.members).toEqual([]);
	});
});

describe("ContributorRepositoryInfoExport", () => {
	test("extracts repository info", () => {
		const repo = makeRepoResult("test-repo");
		const info = new ContributorRepositoryInfo(
			repo,
			"2024-01-01",
			"2024-06-01",
			42,
			5,
			10,
			20,
			40,
			["2024-05-01"],
		);
		const exportData = new ContributorRepositoryInfoExport(info);

		expect(exportData.name).toBe("test-repo");
		expect(exportData.commitsCount).toBe(42);
		expect(exportData.commits30Days).toBe(5);
		expect(exportData.commits365Days).toBe(40);
		expect(exportData.commitDates).toEqual(["2024-05-01"]);
	});
});
