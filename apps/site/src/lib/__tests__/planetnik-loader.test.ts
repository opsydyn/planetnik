import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	analysisLoader,
	commitsPerExtensionLoader,
	contributorDetailsLoader,
	contributorImpactLoader,
	contributorsLoader,
	contributorTimelineLoader,
	controlsLoader,
	dependenciesLoader,
	duplicatesLoader,
	filesLoader,
	findingsLoader,
	hotspotsLoader,
	impactLoader,
	landscapeContributorsLoader,
	landscapeDependencyAlertsLoader,
	landscapeDependencyHealthLoader,
	landscapeOverviewLoader,
	landscapeRepositoriesLoader,
	landscapeTagMatrixLoader,
	landscapeTagsLoader,
	landscapeTeamsLoader,
	landscapeTopologyLoader,
	metricsLoader,
	peopleDependenciesLoader,
	reportContextLoader,
	resolveDatasetsRoot,
	temporalDepsLoader,
	unitsLoader,
} from "../../loaders/planetnik-loader.js";

type StoredEntry = { id: string; data: Record<string, unknown> };

const temporaryRoots: string[] = [];
const previousDataDir = process.env.PLANETNIK_DATA_DIR;
const previousDatasetsRoot = process.env.PLANETNIK_DATASETS_ROOT;

function createDataDir(): string {
	const root = mkdtempSync(join(tmpdir(), "planetnik-site-loader-"));
	const dataDir = join(root, "data");
	mkdirSync(dataDir, { recursive: true });
	temporaryRoots.push(root);
	process.env.PLANETNIK_DATA_DIR = dataDir;
	return dataDir;
}

async function collect(loader: { load?: (context: unknown) => Promise<void> }) {
	const entries: StoredEntry[] = [];
	await loader.load?.({
		parseData: async ({ data }: StoredEntry) => data,
		store: {
			set: (entry: StoredEntry) => entries.push(entry),
		},
	});
	return entries;
}

function writeJson(path: string, value: unknown): void {
	writeFileSync(path, JSON.stringify(value, null, 2));
}

function findTextProjections(directory: string): string[] {
	const projections: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			projections.push(...findTextProjections(path));
		} else if (entry.name.endsWith(".txt")) {
			projections.push(path);
		}
	}
	return projections;
}

function writeStaticSingleRepositoryJsonFixture(dataDir: string): void {
	const contributor = {
		id: "contributor:alan@example.com",
		email: "alan@example.com",
		userName: "Alan Currie",
		commitsCount: 12,
		commitsCount30Days: 4,
		commitsCount90Days: 7,
		commitsCount180Days: 10,
		commitsCount365Days: 12,
		firstCommitDate: "2025-01-01",
		latestCommitDate: "2026-03-31",
		percentage: "100%",
		isRookie: false,
		isActive: true,
	};
	const filesMain = {
		files: [
			{
				id: "file:src/index.ts",
				relativePath: "src/index.ts",
				extension: "ts",
				linesOfCode: 120,
				components: ["runtime"],
				concerns: ["api"],
				contributors: ["alan@example.com"],
			},
		],
	};
	const files = {
		"analysisResults.json": { metadata: { name: "JSON-only repo" } },
		"files_main.json": filesMain,
		"files_test.json": { files: filesMain.files },
		"units.json": {
			units: [
				{
					id: "unit:src/index.ts:1",
					shortName: "main",
					relativeFileName: "src/index.ts",
					linesOfCode: 12,
					mcCabeIndex: 3,
					numberOfParameters: 0,
					startLine: 1,
					endLine: 12,
				},
			],
		},
		"duplicates.json": { duplicates: [{ blockSize: 8, duplicatedFileBlocks: [] }] },
		"component_dependencies.json": {
			dependencies: [
				{
					decompositionKey: "primary",
					fromComponent: "runtime",
					toComponent: "reports",
					count: 1,
				},
			],
		},
		"metrics.json": { metrics: [{ id: "LINES_OF_CODE_MAIN", value: 120 }] },
		"controls.json": {
			goals: [
				{
					goal: "Quality",
					controls: [{ metricId: "LINES_OF_CODE_MAIN", metricValue: 120, status: "OK" }],
				},
			],
		},
		"hotspots.json": { componentHotspots: [{ id: "hotspot-1", kind: "component", name: "runtime" }] },
		"impact.json": { title: "Impact", timestamp: "2026-03-31T00:00:00.000Z" },
		"findings.json": { items: [{ id: "finding-1", summary: "Finding", bodyText: "Evidence" }] },
		"contributors.json": { contributors: [contributor] },
		"people_dependencies.json": [{ from: "alan@example.com", to: "sam@example.com", count: 1, files: [] }],
		"commits_per_extension.json": [{ extension: "ts", commitsCount: 1 }],
		"contributor_timeline.json": { perYear: [{ timeSlot: "2026", commits: 1, contributors: 1 }] },
		"contributor_impact.json": { periods: [{ period_key: "all_time", contributors: [{ email: "alan@example.com" }] }] },
		"temporal_dependencies.json": {
			dependencies: [{ periodKey: "quarter", periodLabel: "Quarter", periodDays: 90, file1: "a.ts", file2: "b.ts" }],
		},
	};
	for (const [fileName, value] of Object.entries(files)) writeJson(join(dataDir, fileName), value);

	const detailsDir = join(dataDir, "contributor_details");
	mkdirSync(detailsDir, { recursive: true });
	writeJson(join(detailsDir, "alan@example.com.json"), { email: "alan@example.com" });

	const canonicalShards = {
		summary: "analysisResults.json",
		filesMain: "files_main.json",
		filesTest: "files_test.json",
		units: "units.json",
		duplicates: "duplicates.json",
		componentDependencies: "component_dependencies.json",
		metrics: "metrics.json",
		controls: "controls.json",
		hotspots: "hotspots.json",
		impact: "impact.json",
		findings: "findings.json",
		contributors: "contributors.json",
		peopleDependencies: "people_dependencies.json",
		commitsPerExtension: "commits_per_extension.json",
		contributorTimeline: "contributor_timeline.json",
		contributorImpact: "contributor_impact.json",
		temporalDependencies: "temporal_dependencies.json",
	};
	writeJson(join(dataDir, "report_context.json"), {
		mode: "single_repository",
		reportMode: "single_repository",
		title: "JSON-only repo",
		rootRoute: "/",
		dataVersion: 2,
		source: "generateReports",
		hasLandscape: false,
		hasSingleRepositoryAnalysis: true,
		primaryNavigation: ["overview"],
		repositoryId: "repo:json-only-repo",
		snapshotId: "8d2d9f6f-2246-4c4d-a89a-4ca3cbbce4c3",
		generatedAt: "2026-08-05T10:00:00.000Z",
		capabilities: Object.keys(canonicalShards),
		canonicalShards,
		compatibilityProjections: {},
		entityIdPolicy: {
			repository: "repo:<normalised repository key>",
			file: "file:<normalised relative path>",
			unit: "unit:<normalised relative path>:<start line>",
			component: "component:<decomposition key>:<component name>",
			contributor: "contributor:<lowercase trimmed email>",
		},
	});
}

function writeStaticLandscapeJsonFixture(dataDir: string): void {
	const files: Record<string, unknown> = {
		"landscape_overview.json": {
			title: "JSON-only landscape",
			landscapeName: "Acme",
			repositoryCount: 1,
			contributorCount: 1,
			totals: { mainLinesOfCode: 120, totalLinesOfCode: 120, contributorCount30Days: 1, commits30d: 1, commits90d: 1 },
		},
		"landscape_repositories.json": {
			repositories: [{ id: "repo:acme", name: "Acme", repoKey: "acme", latestCommitDate: "2026-03-31" }],
		},
		"landscape_contributors.json": {
			contributors: [{ id: "contributor:alan@example.com", email: "alan@example.com", displayName: "Alan", name: "Alan", commitsCount: 1, commitsCount30Days: 1, commitsCount90Days: 1, commitsCount180Days: 1, commitsCount365Days: 1, firstCommitDate: "2026-01-01", latestCommitDate: "2026-03-31", isBot: false, repositoryCount: 1, repositories: [] }],
		},
		"landscape_teams.json": { teams: [{ id: "team-acme", name: "Acme", members: ["alan@example.com"], repositories: [] }] },
		"landscape_topology.json": { periods: [{ periodLabel: "All Time", strongestConnections: [{ from: "alan@example.com", to: "sam@example.com", sharedFilesCount: 1 }] }] },
		"landscape_tags.json": { groups: [{ name: "Product", tags: [{ key: "web", name: "Web" }] }] },
		"landscape_tag_matrix.json": { repositories: [{ name: "Acme", isUntagged: false }] },
		"landscape_dependency_alerts.json": { Acme: [{ severity: "high" }] },
		"landscape_dependency_health.json": { totalRepos: 1, reposWithAlerts: 1, totalAlerts: 1, totalOpenAlerts: 1, severityCounts: { critical: 0, high: 1, medium: 0, low: 0 }, supplyChainExposureScore: 1 },
	};
	for (const [fileName, value] of Object.entries(files)) writeJson(join(dataDir, fileName), value);
	const canonicalShards = {
		analysis: "landscape_overview.json",
		overview: "landscape_overview.json",
		repositories: "landscape_repositories.json",
		contributors: "landscape_contributors.json",
		teams: "landscape_teams.json",
		topology: "landscape_topology.json",
		tags: "landscape_tags.json",
		tagMatrix: "landscape_tag_matrix.json",
		dependencyAlerts: "landscape_dependency_alerts.json",
		dependencyHealth: "landscape_dependency_health.json",
	};
	writeJson(join(dataDir, "report_context.json"), {
		mode: "landscape",
		reportMode: "landscape",
		title: "JSON-only landscape",
		rootRoute: "/landscape",
		dataVersion: 2,
		source: "analyzeLandscape",
		hasLandscape: true,
		hasSingleRepositoryAnalysis: false,
		primaryNavigation: ["overview"],
		snapshotId: "8d2d9f6f-2246-4c4d-a89a-4ca3cbbce4c3",
		generatedAt: "2026-08-05T10:00:00.000Z",
		capabilities: Object.keys(canonicalShards),
		canonicalShards,
		compatibilityProjections: {},
		entityIdPolicy: {
			repository: "repo:<normalised repository key>",
			file: "file:<normalised relative path>",
			unit: "unit:<normalised relative path>:<start line>",
			component: "component:<decomposition key>:<component name>",
			contributor: "contributor:<lowercase trimmed email>",
		},
	});
}

afterEach(() => {
	while (temporaryRoots.length > 0) {
		const root = temporaryRoots.pop();
		if (root) rmSync(root, { recursive: true, force: true });
	}
	if (previousDataDir === undefined) {
		delete process.env.PLANETNIK_DATA_DIR;
	} else {
		process.env.PLANETNIK_DATA_DIR = previousDataDir;
	}
	if (previousDatasetsRoot === undefined) {
		delete process.env.PLANETNIK_DATASETS_ROOT;
	} else {
		process.env.PLANETNIK_DATASETS_ROOT = previousDatasetsRoot;
	}
});

describe("Planetnik static loaders", () => {
	test("resolves the explicitly configured dataset root", () => {
		process.env.PLANETNIK_DATASETS_ROOT = "/tmp/planetnik-datasets";

		expect(resolveDatasetsRoot()).toBe("/tmp/planetnik-datasets");
	});

	test("loads metrics JSON before a conflicting TXT projection", async () => {
		const dataDir = createDataDir();
		writeFileSync(
			join(dataDir, "metrics.json"),
			JSON.stringify({ metrics: [{ id: "JSON_METRIC", value: 7 }] }),
		);
		writeFileSync(join(dataDir, "metrics.txt"), "TXT_METRIC: 99\n");

		await expect(collect(metricsLoader())).resolves.toEqual([
			{ id: "JSON_METRIC", data: { id: "JSON_METRIC", value: 7 } },
		]);
	});

	test("does not fall back to metrics TXT for a valid v2 context with a malformed JSON shape", async () => {
		const dataDir = createDataDir();
		writeStaticSingleRepositoryJsonFixture(dataDir);
		writeJson(join(dataDir, "metrics.json"), { legacyMetrics: [{ id: "JSON_METRIC", value: 7 }] });
		writeFileSync(join(dataDir, "metrics.txt"), "TXT_METRIC: 99\n");

		await expect(collect(metricsLoader())).resolves.toEqual([]);
	});

	test("ignores metrics TXT when the JSON shard is absent", async () => {
		const dataDir = createDataDir();
		writeFileSync(join(dataDir, "metrics.txt"), "TXT_METRIC: 99\n");

		await expect(collect(metricsLoader())).resolves.toEqual([]);
	});

	test("loads contributor JSON before a conflicting TXT projection", async () => {
		const dataDir = createDataDir();
		writeFileSync(
			join(dataDir, "contributors.json"),
			JSON.stringify({
				contributors: [
					{
						email: "json@example.com",
						userName: "Json User",
						commitsCount: 4,
						commitsCount30Days: 2,
						commitsCount90Days: 3,
						commitsCount180Days: 4,
						commitsCount365Days: 4,
						firstCommitDate: "2025-01-01",
						latestCommitDate: "2025-01-02",
						percentage: "100%",
						isRookie: false,
						isActive: true,
					},
				],
			}),
		);
		writeFileSync(
			join(dataDir, "contributors.txt"),
			"Contributor\t#commits\ntext@example.com\t99\n",
		);

		await expect(collect(contributorsLoader())).resolves.toEqual([
			{
				id: "json@example.com",
				data: {
					email: "json@example.com",
					commitsAllTime: 4,
					commits30Days: 2,
					commits90Days: 3,
					commits180Days: 4,
					commits365Days: 4,
					firstCommit: "2025-01-01",
					lastCommit: "2025-01-02",
					percentage: "100%",
					userName: "Json User",
					isRookie: false,
					isActive: true,
				},
			},
		]);
	});

	test("does not fall back to contributors TXT for a valid v2 context with a malformed JSON shape", async () => {
		const dataDir = createDataDir();
		writeStaticSingleRepositoryJsonFixture(dataDir);
		writeJson(join(dataDir, "contributors.json"), { legacyContributors: [] });
		writeFileSync(
			join(dataDir, "contributors.txt"),
			[
				"Contributor\t#commits (all time)\t#commits (30 days)\t#commits (90 days)\t#commits (180 days)\t#commits (365 days)\tfirst commit\tlast commit\tpercentage",
				"text@example.com\t3\t1\t2\t3\t3\t2024-01-01\t2024-02-01\t100%",
			].join("\n"),
		);

		await expect(collect(contributorsLoader())).resolves.toEqual([]);
	});

	test("ignores contributor TXT when the JSON shard is absent", async () => {
		const dataDir = createDataDir();
		writeFileSync(
			join(dataDir, "contributors.txt"),
			[
				"Contributor\t#commits (all time)\t#commits (30 days)\t#commits (90 days)\t#commits (180 days)\t#commits (365 days)\tfirst commit\tlast commit\tpercentage\tuserName\tisRookie\tisActive",
				"text@example.com\t3\t1\t2\t3\t3\t2024-01-01\t2024-02-01\t100%\tText User\tfalse\ttrue",
			].join("\n"),
		);

		await expect(collect(contributorsLoader())).resolves.toEqual([]);
	});

	test("falls back to the derived v1 context when a v2 manifest is invalid", async () => {
		const dataDir = createDataDir();
		writeFileSync(
			join(dataDir, "report_context.json"),
			JSON.stringify({
				mode: "single_repository",
				reportMode: "single_repository",
				title: "Invalid Snapshot",
				rootRoute: "/",
				dataVersion: 2,
				source: "generateReports",
				hasLandscape: false,
				hasSingleRepositoryAnalysis: true,
				primaryNavigation: ["overview"],
				snapshotId: "not-a-uuid",
			}),
		);

		await expect(collect(reportContextLoader())).resolves.toEqual([
			{
				id: "context",
				data: expect.objectContaining({
					dataVersion: 1,
					title: "Planetnik",
				}),
			},
		]);
	});

	test("accepts legacy v1 context without reading TXT projections", async () => {
		const dataDir = createDataDir();
		writeFileSync(
			join(dataDir, "report_context.json"),
			JSON.stringify({
				mode: "single_repository",
				reportMode: "single_repository",
				title: "Legacy Repo",
				rootRoute: "/",
				dataVersion: 1,
				source: "analysisResults",
				hasLandscape: false,
				hasSingleRepositoryAnalysis: true,
				primaryNavigation: ["overview"],
			}),
		);
		writeFileSync(join(dataDir, "metrics.txt"), "LINES_OF_CODE: 42\n");

		await expect(collect(reportContextLoader())).resolves.toEqual([
			{
				id: "context",
				data: expect.objectContaining({
					dataVersion: 1,
					title: "Legacy Repo",
				}),
			},
		]);
	});
});

describe("static compatibility projection removal matrix", () => {
	test("loads every single-repository content collection from JSON-only shards", async () => {
		const dataDir = createDataDir();
		writeStaticSingleRepositoryJsonFixture(dataDir);

		expect(findTextProjections(dataDir)).toEqual([]);
		expect(existsSync(join(dataDir, "metrics.txt"))).toBe(false);
		expect(existsSync(join(dataDir, "contributors.txt"))).toBe(false);
		expect((await collect(reportContextLoader()))[0]?.data.dataVersion).toBe(2);

		const matrix = [
			["report context", reportContextLoader()],
			["analysis", analysisLoader()],
			["files main", filesLoader("main")],
			["files test", filesLoader("test")],
			["units", unitsLoader()],
			["duplicates", duplicatesLoader()],
			["dependencies", dependenciesLoader()],
			["metrics", metricsLoader()],
			["controls", controlsLoader()],
			["hotspots", hotspotsLoader()],
			["impact", impactLoader()],
			["findings", findingsLoader()],
			["contributors", contributorsLoader()],
			["people dependencies", peopleDependenciesLoader()],
			["commits per extension", commitsPerExtensionLoader()],
			["contributor timeline", contributorTimelineLoader()],
			["contributor details", contributorDetailsLoader()],
			["contributor impact", contributorImpactLoader()],
			["temporal dependencies", temporalDepsLoader()],
		] as const;

		for (const [route, loader] of matrix) {
			const entries = await collect(loader);
			expect(entries.length, route).toBeGreaterThan(0);
		}
	});

	test("loads every landscape content collection from JSON-only shards", async () => {
		const dataDir = createDataDir();
		writeStaticLandscapeJsonFixture(dataDir);

		expect(findTextProjections(dataDir)).toEqual([]);
		expect((await collect(reportContextLoader()))[0]?.data.dataVersion).toBe(2);
		const matrix = [
			["report context", reportContextLoader()],
			["landscape overview", landscapeOverviewLoader()],
			["landscape repositories", landscapeRepositoriesLoader()],
			["landscape contributors", landscapeContributorsLoader()],
			["landscape teams", landscapeTeamsLoader()],
			["landscape topology", landscapeTopologyLoader()],
			["landscape tags", landscapeTagsLoader()],
			["landscape tag matrix", landscapeTagMatrixLoader()],
			["landscape dependency alerts", landscapeDependencyAlertsLoader()],
			["landscape dependency health", landscapeDependencyHealthLoader()],
		] as const;

		for (const [route, loader] of matrix) {
			const entries = await collect(loader);
			expect(entries.length, route).toBeGreaterThan(0);
		}
	});
});
