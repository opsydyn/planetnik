import { afterEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	ComponentDependency,
	Contributor,
	LandscapeAnalysisResults,
	LandscapeConfiguration,
	type RepositoryAnalysisResult,
	RepositoryTag,
	TagGroup,
	TeamConfig,
	TeamsConfig,
} from "@planetnik/analyzer";
import { LandscapeDataExport } from "../landscape/data/LandscapeDataExport.js";
import { TagMap } from "../landscape/utils/TagMap.js";

function makeContributor(
	email: string,
	commitsCount: number,
	commitsCount30Days: number,
	commitsCount90Days: number,
): Contributor {
	const contributor = new Contributor();
	contributor.email = email;
	contributor.commitsCount = commitsCount;
	contributor.commitsCount30Days = commitsCount30Days;
	contributor.commitsCount90Days = commitsCount90Days;
	contributor.firstCommitDate = "2024-01-01";
	contributor.latestCommitDate = "2024-06-01";
	return contributor;
}

function makeDependency(
	from: string,
	to: string,
	count: number,
	sharedFiles: string[],
): ComponentDependency {
	const dependency = new ComponentDependency(from, to);
	dependency.count = count;
	dependency.data = [...sharedFiles];
	return dependency;
}

function makeRepoResult(
	name: string,
	mainLoc: number,
	contributors: Contributor[],
	latestCommitDate: string,
): RepositoryAnalysisResult {
	return {
		name,
		analysisResultsPath: `${name}/data/analysisResults.json`,
		metadata: { name, description: "", tooltip: "", logoLink: "", links: [] },
		mainLoc,
		mainFilesCount: Math.max(1, Math.round(mainLoc / 100)),
		testLoc: Math.round(mainLoc / 4),
		testFilesCount: 2,
		generatedLoc: 0,
		buildAndDeployLoc: 0,
		otherLoc: 0,
		extensions: ["java", "ts"],
		linesOfCodePerExtension: [
			{ extension: "java", linesOfCode: mainLoc },
			{ extension: "ts", linesOfCode: Math.round(mainLoc / 10) },
		],
		contributors,
		firstCommitDate: "2024-01-01",
		latestCommitDate,
		duplicationPercentage: 4,
	};
}

describe("LandscapeDataExport", () => {
	const roots: string[] = [];

	afterEach(() => {
		for (const root of roots.splice(0)) {
			if (existsSync(root)) {
				rmSync(root, { recursive: true, force: true });
			}
		}
	});

	test("exports report context and overview contracts", () => {
		const root = mkdtempSync(join(tmpdir(), "planetnik-landscape-export-"));
		roots.push(root);

		const results = new LandscapeAnalysisResults();
		results.metadata.name = "Acme Landscape";
		results.totalMainLoc = 1700;
		results.totalTestLoc = 400;
		results.totalGeneratedLoc = 50;
		results.totalBuildAndDeployLoc = 25;
		results.totalOtherLoc = 10;
		results.totalMainFilesCount = 17;
		results.firstCommitDate = "2024-01-01";
		results.latestCommitDate = "2024-07-01";
		results.linesOfCodePerExtension.set("java", 1500);
		results.linesOfCodePerExtension.set("ts", 200);
		results.repositoriesPerExtension.set("java", 2);
		results.repositoriesPerExtension.set("ts", 1);
		results.allContributors = [
			makeContributor("alice@example.com", 20, 4, 10),
			makeContributor("bob@example.com", 10, 2, 6),
		];
		results.repositoryAnalysisResults = [
			makeRepoResult(
				"repo-a",
				1200,
				[results.allContributors[0]!],
				"2024-07-01",
			),
			makeRepoResult(
				"repo-b",
				500,
				[results.allContributors[1]!],
				"2024-06-15",
			),
		];

		const exportData = new LandscapeDataExport(results, root);
		exportData.exportCoreContracts("analyzeLandscape");

		const dataDir = join(root, "data");
		const reportContextPath = join(dataDir, "report_context.json");
		const overviewPath = join(dataDir, "landscape_overview.json");
		const rawResultsPath = join(dataDir, "landscapeAnalysisResults.json");

		expect(existsSync(reportContextPath)).toBe(true);
		expect(existsSync(overviewPath)).toBe(true);
		expect(existsSync(rawResultsPath)).toBe(true);

		const reportContext = JSON.parse(
			readFileSync(reportContextPath, "utf-8"),
		) as {
			mode: string;
			reportMode: string;
			dataVersion: number;
			source: string;
			rootRoute: string;
			hasLandscape: boolean;
			hasSingleRepositoryAnalysis: boolean;
			snapshotId: string;
			generatedAt: string;
			capabilities: string[];
			canonicalShards: Record<string, string>;
			compatibilityProjections: Record<string, string>;
			entityIdPolicy: Record<string, string>;
		};
		const overview = JSON.parse(readFileSync(overviewPath, "utf-8")) as {
			landscapeName: string;
			repositoryCount: number;
			contributorCount: number;
			totals: {
				totalLinesOfCode: number;
				mainLinesOfCode: number;
				commits30d: number;
				repositoryCount30Days: number;
				contributorCount30Days: number;
			};
			languages: Array<{
				extension: string;
				linesOfCode: number;
				repositories: number;
			}>;
			topRepositories: Array<{
				name: string;
				repoKey: string;
				mainLinesOfCode: number;
			}>;
		};
		const rawResults = JSON.parse(readFileSync(rawResultsPath, "utf-8")) as {
			linesOfCodePerExtension: Record<string, number>;
			repositoriesPerExtension: Record<string, number>;
		};

		expect(reportContext).toEqual(
			expect.objectContaining({
				mode: "landscape",
				reportMode: "landscape",
				source: "analyzeLandscape",
				rootRoute: "/landscape",
				dataVersion: 2,
				hasLandscape: true,
				hasSingleRepositoryAnalysis: false,
			}),
		);
		expect(reportContext.snapshotId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		expect(reportContext.generatedAt).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
		);
		expect(reportContext.entityIdPolicy.repository).toBe(
			"repo:<normalised repository key>",
		);
		expect(reportContext.capabilities).toEqual([
			"analysis",
			"overview",
		]);
		expect(reportContext.canonicalShards).toEqual(
			expect.objectContaining({
				analysis: "landscapeAnalysisResults.json",
				overview: "landscape_overview.json",
			}),
		);
		expect(reportContext.compatibilityProjections).toEqual({});

		const tagMap = new TagMap(new LandscapeConfiguration(), []);
		exportData.exportPeopleContracts(new TeamsConfig());
		exportData.exportRepositories(tagMap);
		exportData.exportTagContracts(tagMap, []);

		const completedContext = JSON.parse(
			readFileSync(reportContextPath, "utf-8"),
		) as typeof reportContext;
		expect(completedContext.snapshotId).toBe(reportContext.snapshotId);
		expect(completedContext.generatedAt).toBe(reportContext.generatedAt);
		expect(completedContext.capabilities).toEqual([
			"analysis",
			"overview",
			"repositories",
			"contributors",
			"teams",
			"topology",
			"tags",
			"tagMatrix",
		]);
		expect(completedContext.canonicalShards).toEqual({
			analysis: "landscapeAnalysisResults.json",
			overview: "landscape_overview.json",
			repositories: "landscape_repositories.json",
			contributors: "landscape_contributors.json",
			teams: "landscape_teams.json",
			topology: "landscape_topology.json",
			tags: "landscape_tags.json",
			tagMatrix: "landscape_tag_matrix.json",
		});
		expect(completedContext.compatibilityProjections).toEqual({});
		expect(overview.landscapeName).toBe("Acme Landscape");
		expect(overview.repositoryCount).toBe(2);
		expect(overview.contributorCount).toBe(2);
		expect(overview.totals.mainLinesOfCode).toBe(1700);
		expect(overview.totals.totalLinesOfCode).toBe(2185);
		expect(overview.totals.commits30d).toBe(6);
		expect(overview.totals.repositoryCount30Days).toBe(2);
		expect(overview.totals.contributorCount30Days).toBe(2);
		expect(overview.languages).toEqual([
			{ extension: "java", linesOfCode: 1500, repositories: 2 },
			{ extension: "ts", linesOfCode: 200, repositories: 1 },
		]);
		expect(overview.topRepositories[0]).toEqual(
			expect.objectContaining({
				id: "repo:repo-a",
				name: "repo-a",
				repoKey: "repo-a",
				mainLinesOfCode: 1200,
				contributors: 1,
				latestCommitDate: "2024-07-01",
				analysisResultsPath: "repo-a/data/analysisResults.json",
			}),
		);
		expect(rawResults.linesOfCodePerExtension).toEqual({ java: 1500, ts: 200 });
		expect(rawResults.repositoriesPerExtension).toEqual({ java: 2, ts: 1 });
	});

	test("exports canonical and normalized repositories data", () => {
		const root = mkdtempSync(
			join(tmpdir(), "planetnik-landscape-repositories-"),
		);
		roots.push(root);

		const results = new LandscapeAnalysisResults();
		const contributors = [makeContributor("alice@example.com", 20, 4, 10)];
		results.repositoryAnalysisResults = [
			makeRepoResult("repo-a", 1200, contributors, "2024-07-01"),
			makeRepoResult("repo-b", 500, contributors, "2024-06-15"),
		];

		const tagMap = new TagMap(new LandscapeConfiguration(), []);
		const exportData = new LandscapeDataExport(results, root);
		exportData.exportRepositories(tagMap);

		const legacyPath = join(root, "data", "repositories.json");
		const normalizedPath = join(root, "data", "landscape_repositories.json");

		expect(existsSync(legacyPath)).toBe(true);
		expect(existsSync(normalizedPath)).toBe(true);

		const normalized = JSON.parse(readFileSync(normalizedPath, "utf-8")) as {
			title: string;
			repositoryCount: number;
			repositories: Array<{
				metadata: { name: string };
				name: string;
				repoKey: string;
				commits30d: number;
				contributors30d: number;
				contributorEmails: string[];
			}>;
		};

		expect(normalized.title).toBe("Repositories");
		expect(normalized.repositoryCount).toBe(2);
		expect(normalized.repositories.map((repo) => repo.metadata.name)).toEqual([
			"repo-a",
			"repo-b",
		]);
		expect(normalized.repositories[0]).toEqual(
			expect.objectContaining({
				id: "repo:repo-a",
				name: "repo-a",
				repoKey: "repo-a",
				commits30d: 4,
				contributors30d: 1,
				contributorEmails: ["alice@example.com"],
			}),
		);
	});

	test("does not emit landscape TXT compatibility projections by default", () => {
		const root = mkdtempSync(
			join(tmpdir(), "planetnik-landscape-json-only-"),
		);
		roots.push(root);

		const contributor = makeContributor("alice@example.com", 20, 4, 10);
		const results = new LandscapeAnalysisResults();
		results.allContributors = [contributor];
		results.repositoryAnalysisResults = [
			makeRepoResult("repo-a", 1200, [contributor], "2024-07-01"),
		];

		const exportData = new LandscapeDataExport(results, root);
		exportData.exportCoreContracts("analyzeLandscape");
		exportData.exportPeopleContracts(new TeamsConfig());
		exportData.exportRepositories(new TagMap(new LandscapeConfiguration(), []));

		const dataDir = join(root, "data");
		expect(existsSync(join(dataDir, "landscape_overview.json"))).toBe(true);
		expect(existsSync(join(dataDir, "landscape_repositories.json"))).toBe(true);
		expect(existsSync(join(dataDir, "landscape_contributors.json"))).toBe(true);
		expect(existsSync(join(dataDir, "landscape_teams.json"))).toBe(true);
		expect(existsSync(join(dataDir, "repositories.txt"))).toBe(false);
		expect(existsSync(join(dataDir, "contributors.txt"))).toBe(false);
		expect(existsSync(join(dataDir, "teams.txt"))).toBe(false);

		const context = JSON.parse(
			readFileSync(join(dataDir, "report_context.json"), "utf-8"),
		) as { compatibilityProjections: Record<string, string> };
		expect(context.compatibilityProjections).toEqual({});
	});

	test("emits landscape TXT compatibility projections when explicitly opted in", () => {
		const root = mkdtempSync(
			join(tmpdir(), "planetnik-landscape-compatibility-"),
		);
		roots.push(root);

		const contributor = makeContributor("alice@example.com", 20, 4, 10);
		const results = new LandscapeAnalysisResults();
		results.allContributors = [contributor];
		results.repositoryAnalysisResults = [
			makeRepoResult("repo-a", 1200, [contributor], "2024-07-01"),
		];

		const exportData = new LandscapeDataExport(results, root, {
			emitCompatibilityProjections: true,
		});
		exportData.exportCoreContracts("analyzeLandscape");
		exportData.exportPeopleContracts(new TeamsConfig());
		exportData.exportRepositories(new TagMap(new LandscapeConfiguration(), []));

		const dataDir = join(root, "data");
		expect(existsSync(join(dataDir, "repositories.txt"))).toBe(true);
		expect(existsSync(join(dataDir, "contributors.txt"))).toBe(true);
		expect(existsSync(join(dataDir, "teams.txt"))).toBe(true);

		const context = JSON.parse(
			readFileSync(join(dataDir, "report_context.json"), "utf-8"),
		) as { compatibilityProjections: Record<string, string> };
		expect(context.compatibilityProjections).toEqual({
			repositories: "repositories.txt",
			contributors: "contributors.txt",
			teams: "teams.txt",
		});
	});

	test("does not advertise stale landscape TXT files when opt-in is disabled", () => {
		const root = mkdtempSync(
			join(tmpdir(), "planetnik-landscape-stale-compatibility-"),
		);
		roots.push(root);

		const dataDir = join(root, "data");
		mkdirSync(dataDir, { recursive: true });
		for (const fileName of [
			"repositories.txt",
			"contributors.txt",
			"teams.txt",
		]) {
			writeFileSync(join(dataDir, fileName), "stale", "utf-8");
		}

		const results = new LandscapeAnalysisResults();
		const exportData = new LandscapeDataExport(results, root);
		exportData.exportCoreContracts("updateLandscape");

		const context = JSON.parse(
			readFileSync(join(dataDir, "report_context.json"), "utf-8"),
		) as { compatibilityProjections: Record<string, string> };
		expect(context.compatibilityProjections).toEqual({});
		expect(existsSync(join(dataDir, "repositories.txt"))).toBe(true);
	});

	test("exports normalized tags and repository tag matrix", () => {
		const root = mkdtempSync(join(tmpdir(), "planetnik-landscape-tags-"));
		roots.push(root);

		const results = new LandscapeAnalysisResults();
		const repository = makeRepoResult(
			"repo-a",
			1200,
			[makeContributor("alice@example.com", 20, 4, 10)],
			"2024-07-01",
		);
		results.repositoryAnalysisResults = [repository];

		const config = new LandscapeConfiguration();
		const group = new TagGroup();
		group.name = "Domain";
		group.description = "Repository domain";
		group.color = "#8b5cf6";
		const tag = new RepositoryTag();
		tag.tag = "API";
		tag.patterns = ["repo-a"];
		tag.group = group;
		group.repositoryTags = [tag];

		const tagMap = new TagMap(config, [group]);
		tagMap.updateTagMap(
			[repository],
			(repo) =>
				repo.linesOfCodePerExtension.map((entry) => ({
					name: `*.${entry.extension}`,
					value: entry.linesOfCode,
					description: [],
				})),
			() => [],
		);

		const exportData = new LandscapeDataExport(results, root);
		exportData.exportRepositories(tagMap);
		exportData.exportTagContracts(tagMap, [group]);

		const repositoriesPath = join(root, "data", "landscape_repositories.json");
		const tagsPath = join(root, "data", "landscape_tags.json");
		const matrixPath = join(root, "data", "landscape_tag_matrix.json");

		expect(existsSync(repositoriesPath)).toBe(true);
		expect(existsSync(tagsPath)).toBe(true);
		expect(existsSync(matrixPath)).toBe(true);

		const repositories = JSON.parse(
			readFileSync(repositoriesPath, "utf-8"),
		) as {
			repositories: Array<{
				tags: Array<{ key: string; group: string; name: string }>;
			}>;
		};
		const tags = JSON.parse(readFileSync(tagsPath, "utf-8")) as {
			groupCount: number;
			tagCount: number;
			groups: Array<{
				name: string;
				tags: Array<{
					key: string;
					repositoryCount: number;
					repositories: Array<{ name: string; repoKey: string }>;
				}>;
			}>;
		};
		const matrix = JSON.parse(readFileSync(matrixPath, "utf-8")) as {
			repositories: Array<{
				name: string;
				repoKey: string;
				tags: Array<{ key: string; group: string; name: string }>;
				isUntagged: boolean;
			}>;
		};

		expect(repositories.repositories[0]!.tags).toEqual([
			{ key: "Domain / API", group: "Domain", name: "API" },
		]);
		expect(tags.groupCount).toBe(1);
		expect(tags.tagCount).toBe(1);
		expect(tags.groups[0]!.name).toBe("Domain");
		expect(tags.groups[0]!.tags[0]!.repositoryCount).toBe(1);
		expect(tags.groups[0]!.tags[0]!.repositories[0]).toEqual(
			expect.objectContaining({
				name: "repo-a",
				repoKey: "repo-a",
			}),
		);
		expect(matrix.repositories[0]).toEqual(
			expect.objectContaining({
				name: "repo-a",
				repoKey: "repo-a",
				isUntagged: false,
				tags: [{ key: "Domain / API", group: "Domain", name: "API" }],
			}),
		);
	});

	test("exports normalized contributor and team contracts", () => {
		const root = mkdtempSync(join(tmpdir(), "planetnik-landscape-people-"));
		roots.push(root);

		const aliceRepoA = makeContributor("alice@example.com", 12, 3, 8);
		aliceRepoA.commitsCount180Days = 10;
		aliceRepoA.commitsCount365Days = 12;
		aliceRepoA.latestCommitDate = "2024-07-01";

		const aliceRepoB = makeContributor("alice@example.com", 4, 1, 2);
		aliceRepoB.commitsCount180Days = 3;
		aliceRepoB.commitsCount365Days = 4;
		aliceRepoB.firstCommitDate = "2024-02-01";
		aliceRepoB.latestCommitDate = "2024-06-10";

		const bobRepoB = makeContributor("bob@example.com", 7, 2, 5);
		bobRepoB.commitsCount180Days = 6;
		bobRepoB.commitsCount365Days = 7;
		bobRepoB.firstCommitDate = "2024-03-01";
		bobRepoB.latestCommitDate = "2024-06-15";

		const results = new LandscapeAnalysisResults();
		results.allContributors = [
			Object.assign(makeContributor("alice@example.com", 16, 4, 10), {
				commitsCount180Days: 13,
				commitsCount365Days: 16,
				latestCommitDate: "2024-07-01",
			}),
			Object.assign(makeContributor("bob@example.com", 7, 2, 5), {
				commitsCount180Days: 6,
				commitsCount365Days: 7,
				firstCommitDate: "2024-03-01",
				latestCommitDate: "2024-06-15",
			}),
		];
		results.repositoryAnalysisResults = [
			makeRepoResult("repo-a", 1200, [aliceRepoA], "2024-07-01"),
			makeRepoResult("repo-b", 500, [aliceRepoB, bobRepoB], "2024-06-15"),
		];
		results.peopleDependenciesAllTime = [
			makeDependency("alice@example.com", "bob@example.com", 3, [
				"repo-a/src/service.ts",
				"repo-b/src/controller.ts",
				"repo-b/src/model.ts",
			]),
		];
		results.peopleDependencies = results.peopleDependenciesAllTime;
		results.peopleDependencies30Days = [
			makeDependency("alice@example.com", "bob@example.com", 1, [
				"repo-b/src/model.ts",
			]),
		];

		const teamsConfig = new TeamsConfig();
		const platform = new TeamConfig();
		platform.name = "Platform";
		platform.description = "Shared platform work";
		platform.emailPatterns = ["alice@example.com", "bob@example.com"];
		teamsConfig.teams = [platform];

		const exportData = new LandscapeDataExport(results, root);
		exportData.exportPeopleContracts(teamsConfig);

		const contributorsPath = join(root, "data", "landscape_contributors.json");
		const teamsPath = join(root, "data", "landscape_teams.json");
		const topologyPath = join(root, "data", "landscape_topology.json");

		expect(existsSync(contributorsPath)).toBe(true);
		expect(existsSync(teamsPath)).toBe(true);
		expect(existsSync(topologyPath)).toBe(true);

		const contributors = JSON.parse(
			readFileSync(contributorsPath, "utf-8"),
		) as {
			contributorCount: number;
			contributors: Array<{
				email: string;
				displayName: string;
				commitsCount: number;
				commits30d: number;
				repositoryCount: number;
				repositories: Array<{
					name: string;
					repoKey: string;
					analysisResultsPath: string;
				}>;
			}>;
		};
		const teams = JSON.parse(readFileSync(teamsPath, "utf-8")) as {
			teamCount: number;
			teams: Array<{
				name: string;
				description: string;
				commitsCount: number;
				commits30d: number;
				repositoryCount: number;
				memberCount: number;
				members: string[];
				repositories: Array<{
					name: string;
					repoKey: string;
					analysisResultsPath: string;
				}>;
			}>;
		};
		const topology = JSON.parse(readFileSync(topologyPath, "utf-8")) as {
			title: string;
			contributorCount: number;
			periodsByKey: Record<
				string,
				{
					periodKey: string;
					periodLabel: string;
					contributorCount: number;
					connectionCount: number;
				}
			>;
			periods: Array<{
				periodKey: string;
				periodLabel: string;
				contributorCount: number;
				connectionCount: number;
				mostConnectedContributor: {
					email: string;
					connectionCount: number;
				} | null;
				contributors: Array<{
					email: string;
					commitsCount: number;
					repositoryCount: number;
					connectionCount: number;
					sharedFilesCount: number;
					repositories: Array<{ name: string; commitsCount: number }>;
				}>;
				strongestConnections: Array<{
					from: string;
					to: string;
					sharedFilesCount: number;
					sharedFiles: string[];
				}>;
			}>;
		};

		expect(contributors.contributorCount).toBe(2);
		expect(contributors.contributors[0]).toEqual(
			expect.objectContaining({
				id: "contributor:alice@example.com",
				email: "alice@example.com",
				displayName: "alice@example.com",
				commitsCount: 16,
				commits30d: 4,
				repositoryCount: 2,
			}),
		);
		expect(contributors.contributors[0]!.repositories).toEqual([
			expect.objectContaining({
				id: "repo:repo-a",
				name: "repo-a",
				repoKey: "repo-a",
				analysisResultsPath: "repo-a/data/analysisResults.json",
			}),
			expect.objectContaining({
				id: "repo:repo-b",
				name: "repo-b",
				repoKey: "repo-b",
				analysisResultsPath: "repo-b/data/analysisResults.json",
			}),
		]);
		expect(teams.teamCount).toBe(1);
		expect(teams.teams[0]).toEqual(
			expect.objectContaining({
				name: "Platform",
				description: "Shared platform work",
				commitsCount: 23,
				commits30d: 6,
				repositoryCount: 2,
				memberCount: 2,
			}),
		);
		expect(teams.teams[0]!.members).toEqual([
			"alice@example.com",
			"bob@example.com",
		]);
		expect(teams.teams[0]!.repositories).toEqual([
			expect.objectContaining({
				name: "repo-a",
				repoKey: "repo-a",
				analysisResultsPath: "repo-a/data/analysisResults.json",
			}),
			expect.objectContaining({
				name: "repo-b",
				repoKey: "repo-b",
				analysisResultsPath: "repo-b/data/analysisResults.json",
			}),
		]);

		expect(topology.title).toBe("Landscape Team Topology");
		expect(topology.contributorCount).toBe(2);
		expect(topology.periodsByKey.all_time).toEqual(
			expect.objectContaining({
				periodKey: "all_time",
				periodLabel: "All Time",
				contributorCount: 2,
				connectionCount: 1,
			}),
		);
		expect(topology.periodsByKey["30d"]).toEqual(
			expect.objectContaining({
				periodKey: "30d",
				periodLabel: "Past 30 Days",
				contributorCount: 2,
				connectionCount: 1,
			}),
		);

		const allTimePeriod = topology.periods.find(
			(period) => period.periodKey === "all_time",
		);
		const recentPeriod = topology.periods.find(
			(period) => period.periodKey === "30d",
		);

		expect(allTimePeriod).toEqual(
			expect.objectContaining({
				periodLabel: "All Time",
				contributorCount: 2,
				connectionCount: 1,
				mostConnectedContributor: expect.objectContaining({
					email: "alice@example.com",
					connectionCount: 1,
				}),
			}),
		);
		expect(allTimePeriod?.contributors[0]).toEqual(
			expect.objectContaining({
				email: "alice@example.com",
				commitsCount: 16,
				repositoryCount: 2,
				connectionCount: 1,
				sharedFilesCount: 3,
			}),
		);
		expect(allTimePeriod?.contributors[0]?.repositories).toEqual([
			{ name: "repo-a", commitsCount: 12 },
			{ name: "repo-b", commitsCount: 4 },
		]);
		expect(allTimePeriod?.strongestConnections[0]).toEqual({
			from: "alice@example.com",
			to: "bob@example.com",
			sharedFilesCount: 3,
			sharedFiles: [
				"repo-a/src/service.ts",
				"repo-b/src/controller.ts",
				"repo-b/src/model.ts",
			],
		});

		expect(recentPeriod).toEqual(
			expect.objectContaining({
				periodLabel: "Past 30 Days",
				contributorCount: 2,
				connectionCount: 1,
			}),
		);
		expect(recentPeriod?.contributors[0]?.repositories).toEqual([
			{ name: "repo-a", commitsCount: 3 },
			{ name: "repo-b", commitsCount: 1 },
		]);
	});
});
