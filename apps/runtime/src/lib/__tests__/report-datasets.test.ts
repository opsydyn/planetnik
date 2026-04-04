import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	getDatasetCandidateDirs,
	isRecognizedDataDir,
	resolveNamedDatasetDataDir,
} from "../data-directories.js";
 
process.env.NODE_ENV ??= "test";
process.env.PORT ??= "1337";
process.env.CORS_ORIGIN ??= "http://localhost:4321";
process.env.DATABASE_URL ??=
	"postgresql://user:password@localhost:5432/planetnik?sslmode=disable";
process.env.BETTER_AUTH_SECRET ??= "test-secret-with-at-least-32-characters";
process.env.BETTER_AUTH_URL ??= "http://localhost:1337";
const {
	readReportArtifactSummary,
	readReportContributorDetail,
	readReportContributorsSummary,
	readReportContextSummary,
	readReportControlsSummary,
	readReportDependenciesSummary,
	readReportDuplicationSummary,
	readReportFilesView,
	readReportHotspotsSummary,
	readReportImpactSummary,
	readReportMetricsSummary,
	readReportCommitsSummary,
	readReportSecuritySummary,
	readReportLandscapeRepositoriesSummary,
	readReportLandscapeContributorsSummary,
	readReportLandscapeRepositorySummary,
	readReportLandscapeRepositoryMetricsSummary,
	readReportLandscapeRepositoryCommitsSummary,
	readReportLandscapeRepositoryDependenciesSummary,
	readReportLandscapeRepositoryDuplicationSummary,
	readReportLandscapeRepositoryFilesView,
	readReportLandscapeRepositoryUnitsView,
	readReportLandscapeRepositoryContributorsSummary,
	readReportLandscapeRepositoryContributorDetail,
	readReportLandscapeRepositoryTopologySummary,
	readReportLandscapeRepositoryImpactSummary,
	readReportLandscapeRepositoryControlsSummary,
	readReportLandscapeRepositoryComponentsSummary,
	readReportTrendsSummary,
	readReportTopologySummary,
	readReportComponentsSummary,
	readReportCouplingSummary,
	readReportLandscapeRepositoryCouplingSummary,
	readReportUnitsView,
	resolveReportDataSource,
} = await import("../report-datasets.js");

const tempRoots: string[] = [];

function makeTempRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "planetnik-runtime-test-"));
	tempRoots.push(root);
	return root;
}

function writeJson(path: string, value: unknown) {
	writeFileSync(path, JSON.stringify(value, null, 2));
}

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

describe("runtime report dataset helpers", () => {
	test("resolves a named dataset data dir from standard candidate layouts", () => {
		const datasetsRoot = makeTempRoot();
		const dataDir = join(datasetsRoot, "effect-ts", "_planetnik", "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "report_context.json"), {
			mode: "single_repository",
			reportMode: "single_repository",
			title: "Effect TS",
			rootRoute: "/",
			dataVersion: 1,
			source: "analysisResults",
			hasLandscape: false,
			hasSingleRepositoryAnalysis: true,
			primaryNavigation: ["overview"],
		});

		expect(getDatasetCandidateDirs(datasetsRoot, "effect-ts")).toContain(dataDir);
		expect(resolveNamedDatasetDataDir("effect-ts", datasetsRoot)).toBe(dataDir);
		expect(isRecognizedDataDir(dataDir)).toBe(true);
	});

	test("reads report context and single-repository artifact summaries from a recognized data dir", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "report_context.json"), {
			mode: "single_repository",
			reportMode: "single_repository",
			title: "Acme Platform",
			rootRoute: "/",
			dataVersion: 1,
			source: "analysisResults",
			hasLandscape: false,
			hasSingleRepositoryAnalysis: true,
			primaryNavigation: ["overview", "files"],
		});
		writeJson(join(dataDir, "analysisResults.json"), {
			metadata: {
				name: "Acme Platform",
			},
			filesCount: 128,
			linesOfCode: 18450,
			duplication: {
				percentage: 2.4,
				duplicatedLines: 442,
			},
		});

		const context = readReportContextSummary(dataDir);
		expect(context).toMatchObject({
			title: "Acme Platform",
			reportMode: "single_repository",
		});

		const artifact = readReportArtifactSummary(dataDir, context);
		expect(artifact).toEqual({
			kind: "single_repository",
			projectName: "Acme Platform",
			filesCount: 128,
			linesOfCode: 18450,
			duplicatedLines: 442,
			duplicationPercentage: 2.4,
		});

		expect(
			resolveReportDataSource({
				analysisRoot: join(root, "reports"),
			}),
		).toMatchObject({
			dataDir,
			title: "Acme Platform",
			reportMode: "single_repository",
		});
	});

	test("reads a landscape artifact summary when the linked dataset is in landscape mode", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "report_context.json"), {
			mode: "landscape",
			reportMode: "landscape",
			title: "Platform Landscape",
			rootRoute: "/landscape",
			dataVersion: 1,
			source: "landscape",
			hasLandscape: true,
			hasSingleRepositoryAnalysis: false,
			primaryNavigation: ["overview", "repositories"],
		});
		writeJson(join(dataDir, "landscape_overview.json"), {
			title: "Landscape Overview",
			landscapeName: "Platform Landscape",
			repositoryCount: 12,
			contributorCount: 34,
			totals: {
				totalLinesOfCode: 91234,
				commits30d: 87,
				commits90d: 241,
			},
		});

		const context = readReportContextSummary(dataDir);
		const artifact = readReportArtifactSummary(dataDir, context);

		expect(artifact).toEqual({
			kind: "landscape",
			title: "Landscape Overview",
			landscapeName: "Platform Landscape",
			repositoryCount: 12,
			contributorCount: 34,
			totalLinesOfCode: 91234,
			commits30d: 87,
			commits90d: 241,
		});
	});

	test("reads a landscape security summary and joins repo keys from the landscape repository index", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "landscape_repositories.json"), {
			repositories: [
				{ name: "web-app", repoKey: "acme__web-app" },
				{ name: "api", repoKey: "acme__api" },
			],
		});
		writeJson(join(dataDir, "landscape_dependency_health.json"), {
			totalRepos: 3,
			reposWithAlerts: 2,
			totalAlerts: 8,
			totalOpenAlerts: 5,
			severityCounts: {
				critical: 1,
				high: 2,
				medium: 1,
				low: 1,
			},
			meanTimeToResolveDays: 14,
			supplyChainExposureScore: 0.67,
			sharedVulnerablePackages: [
				{
					ecosystem: "npm",
					name: "lodash",
					severity: "high",
					affectedRepos: ["web-app", "api"],
				},
			],
			repoHealth: [
				{
					owner: "acme",
					repo: "web-app",
					totalAlerts: 5,
					openAlerts: 3,
					fixedAlerts: 2,
					severityCounts: {
						critical: 1,
						high: 1,
						medium: 1,
						low: 0,
					},
					meanTimeToResolveDays: 21,
					oldestOpenAlertDays: 40,
				},
				{
					owner: "acme",
					repo: "mobile",
					totalAlerts: 3,
					openAlerts: 2,
					fixedAlerts: 1,
					severityCounts: {
						critical: 0,
						high: 1,
						medium: 0,
						low: 1,
					},
					meanTimeToResolveDays: null,
					oldestOpenAlertDays: null,
				},
			],
		});

		expect(readReportSecuritySummary(dataDir)).toEqual({
			totalRepos: 3,
			reposWithAlerts: 2,
			totalAlerts: 8,
			totalOpenAlerts: 5,
			severityCounts: {
				critical: 1,
				high: 2,
				medium: 1,
				low: 1,
			},
			meanTimeToResolveDays: 14,
			supplyChainExposureScore: 0.67,
			sharedVulnerablePackages: [
				{
					ecosystem: "npm",
					name: "lodash",
					severity: "high",
					affectedRepos: ["web-app", "api"],
				},
			],
			repoHealth: [
				{
					owner: "acme",
					repo: "web-app",
					repoKey: "acme__web-app",
					totalAlerts: 5,
					openAlerts: 3,
					fixedAlerts: 2,
					severityCounts: {
						critical: 1,
						high: 1,
						medium: 1,
						low: 0,
					},
					meanTimeToResolveDays: 21,
					oldestOpenAlertDays: 40,
				},
				{
					owner: "acme",
					repo: "mobile",
					repoKey: null,
					totalAlerts: 3,
					openAlerts: 2,
					fixedAlerts: 1,
					severityCounts: {
						critical: 0,
						high: 1,
						medium: 0,
						low: 1,
					},
					meanTimeToResolveDays: null,
					oldestOpenAlertDays: null,
				},
			],
		});
	});

	test("reads a landscape contributors summary from landscape_contributors.json", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "landscape_contributors.json"), {
			contributors: [
				{
					email: "alan@example.com",
					displayName: "Alan Currie",
					name: "Alan Currie",
					commitsCount: 42,
					commitsCount30Days: 8,
					commitsCount90Days: 16,
					commitsCount180Days: 24,
					commitsCount365Days: 32,
					firstCommitDate: "2024-01-03",
					latestCommitDate: "2026-03-31",
					isBot: false,
					repositoryCount: 3,
					repositories: [
						{
							name: "web-app",
							description: "Web App",
							analysisResultsPath: "web-app/data/analysisResults.json",
							repoKey: "acme__web-app",
							firstCommitDate: "2024-01-03",
							latestCommitDate: "2026-03-31",
							commitsCount: 21,
							commits30Days: 4,
							commits90Days: 8,
							commits180Days: 12,
							commits365Days: 16,
							commitDates: [],
						},
					],
				},
				{
					email: "bot@example.com",
					displayName: "Renovate",
					name: "Renovate",
					commitsCount: 10,
					commitsCount30Days: 2,
					commitsCount90Days: 5,
					commitsCount180Days: 8,
					commitsCount365Days: 10,
					firstCommitDate: "2025-05-01",
					latestCommitDate: "2026-03-29",
					isBot: true,
					repositoryCount: 1,
					repositories: [],
				},
			],
		});

		expect(readReportLandscapeContributorsSummary(dataDir)).toEqual({
			totalContributors: 2,
			active30d: 2,
			multiRepoCount: 1,
			botCount: 1,
			contributors: [
				{
					email: "alan@example.com",
					userName: "Alan Currie",
					displayName: "Alan Currie",
					status: "Active",
					commitsAllTime: 42,
					commits30Days: 8,
					commits90Days: 16,
					commits180Days: 24,
					commits365Days: 32,
					firstCommit: "2024-01-03",
					lastCommit: "2026-03-31",
					percentage: "",
					filesTouched: null,
					componentsTouched: null,
					primaryComponent: "",
					knowledgeSignal: "Cross-context knowledge",
					repositoryCount: 3,
					latestCommitDate: "2026-03-31",
					isBot: false,
					repositories: [{ name: "web-app", repoKey: "acme__web-app" }],
				},
				{
					email: "bot@example.com",
					userName: "Renovate",
					displayName: "Renovate",
					status: "Active",
					commitsAllTime: 10,
					commits30Days: 2,
					commits90Days: 5,
					commits180Days: 8,
					commits365Days: 10,
					firstCommit: "2025-05-01",
					lastCommit: "2026-03-29",
					percentage: "",
					filesTouched: null,
					componentsTouched: null,
					primaryComponent: "",
					knowledgeSignal: "",
					repositoryCount: 1,
					latestCommitDate: "2026-03-29",
					isBot: true,
					repositories: [],
				},
			],
		});
	});

	test("reads a landscape repositories summary for drilldown discovery", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "landscape_repositories.json"), {
			repositories: [
				{
					repoKey: "acme__web-app",
					name: "web-app",
					description: "Customer-facing application.",
					mainLinesOfCode: 18450,
					mainFilesCount: 128,
					commits30d: 12,
					commits90d: 34,
					contributorsCount: 4,
					contributors30d: 2,
					latestCommitDate: "2026-03-31",
					tags: [{ key: "team:web", group: "team", name: "Web" }],
				},
				{
					repoKey: "acme__api",
					name: "api",
					description: "",
					mainLinesOfCode: 9200,
					mainFilesCount: 76,
					commits30d: 0,
					commits90d: 11,
					contributorsCount: 3,
					contributors30d: 0,
					latestCommitDate: "2026-03-18",
					tags: [],
				},
			],
		});

		expect(readReportLandscapeRepositoriesSummary(dataDir)).toEqual({
			totalRepositories: 2,
			active30d: 1,
			totalMainLoc: 27650,
			averageMainLoc: 13825,
			repositories: [
				{
					repoKey: "acme__web-app",
					name: "web-app",
					description: "Customer-facing application.",
					mainLinesOfCode: 18450,
					mainFilesCount: 128,
					commits30d: 12,
					commits90d: 34,
					contributorsCount: 4,
					contributors30d: 2,
					latestCommitDate: "2026-03-31",
					tags: ["Web"],
				},
				{
					repoKey: "acme__api",
					name: "api",
					description: "—",
					mainLinesOfCode: 9200,
					mainFilesCount: 76,
					commits30d: 0,
					commits90d: 11,
					contributorsCount: 3,
					contributors30d: 0,
					latestCommitDate: "2026-03-18",
					tags: [],
				},
			],
		});
	});

	test("reads a landscape repository summary from the repo export folder", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDataDir = join(root, "acme__web-app", "data");
		mkdirSync(dataDir, { recursive: true });
		mkdirSync(repoDataDir, { recursive: true });
		writeJson(join(dataDir, "landscape_repositories.json"), {
			repositories: [
				{
					name: "web-app",
					repoKey: "acme__web-app",
					description: "Customer-facing web application.",
					latestCommitDate: "2026-03-31",
					commits30d: 12,
					commits90d: 34,
					contributorsCount: 4,
					mainFilesCount: 128,
					mainLinesOfCode: 18450,
					metadata: {
						links: [{ label: "Open repository", href: "https://github.com/acme/web-app" }],
					},
				},
			],
		});
		writeJson(join(repoDataDir, "analysisResults.json"), {
			metadata: {
				name: "web-app",
				description: "Customer-facing web application.",
				links: [{ label: "Open repository", href: "https://github.com/acme/web-app" }],
			},
			filesCount: 128,
			linesOfCode: 18450,
			duplication: {
				percentage: 2.4,
				duplicatedLines: 442,
			},
		});
		writeJson(join(repoDataDir, "contributors.json"), {
			contributors: [
				{
					email: "alan@example.com",
					userName: "Alan Currie",
					commitsCount: 18,
					commitsCount30Days: 6,
					commitsCount90Days: 12,
					firstCommitDate: "2024-01-03",
					latestCommitDate: "2026-03-31",
					isBot: false,
				},
			],
		});
		writeJson(join(repoDataDir, "contributor_impact.json"), {
			periods: [
				{
					period_key: "all_time",
					contributors: [
						{
							email: "alan@example.com",
							glue_score: 8.8,
							snacking_score: 2.4,
							structural_impact_score: 7.1,
							visible_activity_score: 6.4,
							dominant_dimension: "coordination_relief",
							is_glue: true,
							is_snacking: false,
						},
					],
				},
			],
		});

		expect(
			readReportLandscapeRepositorySummary(dataDir, "acme__web-app"),
		).toEqual({
			repoKey: "acme__web-app",
			name: "web-app",
			description: "Customer-facing web application.",
			latestCommitDate: "2026-03-31",
			commits30d: 12,
			commits90d: 34,
			contributorsCount: 4,
			filesCount: 128,
			linesOfCode: 18450,
			duplicationPercentage: 2.4,
			links: [{ label: "Open repository", href: "https://github.com/acme/web-app" }],
			topContributors: [
				{
					email: "alan@example.com",
					displayName: "Alan Currie",
					commitsCount: 18,
					commits30d: 6,
					commits90d: 12,
					firstCommitDate: "2024-01-03",
					latestCommitDate: "2026-03-31",
					type: "Human",
					signal: "Glue",
				},
			],
		});
	});

	test("reads landscape repository metrics from the repo export folder", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDataDir = join(root, "acme__web-app", "data");
		mkdirSync(repoDataDir, { recursive: true });
		mkdirSync(dataDir, { recursive: true });
		writeFileSync(
			join(repoDataDir, "metrics.txt"),
			[
				"LINES_OF_CODE_MAIN: 18450",
				"LINES_OF_CODE_TEST: 4200",
				"DUPLICATION_NUMBER_OF_DUPLICATED_LINES: 442",
				"TEST_VS_MAIN_LINES_OF_CODE_PERCENTAGE: 22.8",
				"TOTAL_ANALYSIS_TIME_IN_MILLIS: 960",
				"NUMBER_OF_FILES_MAIN: 128",
			].join("\n"),
		);

		expect(
			readReportLandscapeRepositoryMetricsSummary(dataDir, "acme__web-app"),
		).toEqual({
			totalMetrics: 6,
			headlineMetrics: {
				mainLinesOfCode: 18450,
				testLinesOfCode: 4200,
				duplicatedLines: 442,
				testVsMainPercentage: 22.8,
				totalAnalysisTimeInMillis: 960,
			},
			groupSummaries: [
				{
					groupId: "LINES_OF_CODE",
					label: "Lines of Code",
					metrics: [
						{ id: "LINES_OF_CODE_MAIN", value: 18450 },
						{ id: "LINES_OF_CODE_TEST", value: 4200 },
						{ id: "TEST_VS_MAIN_LINES_OF_CODE_PERCENTAGE", value: 22.8 },
					],
				},
				{
					groupId: "NUMBER_OF_FILES",
					label: "Files",
					metrics: [{ id: "NUMBER_OF_FILES_MAIN", value: 128 }],
				},
				{
					groupId: "DUPLICATION",
					label: "Duplication",
					metrics: [{ id: "DUPLICATION_NUMBER_OF_DUPLICATED_LINES", value: 442 }],
				},
				{
					groupId: "ANALYSIS",
					label: "Analysis",
					metrics: [{ id: "TOTAL_ANALYSIS_TIME_IN_MILLIS", value: 960 }],
				},
			],
		});
	});

	test("reads landscape repository commits from the repo export folder", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDataDir = join(root, "acme__web-app", "data");
		mkdirSync(repoDataDir, { recursive: true });
		mkdirSync(dataDir, { recursive: true });
		writeFileSync(
			join(repoDataDir, "contributors.json"),
			JSON.stringify({
				contributors: [
					{
						email: "alan@example.com",
						commitsCount: 18,
						commitsCount30Days: 6,
						commitsCount90Days: 12,
						commitsCount365Days: 18,
						isRookie: false,
					},
					{
						email: "sam@example.com",
						commitsCount: 14,
						commitsCount30Days: 4,
						commitsCount90Days: 10,
						commitsCount365Days: 14,
						isRookie: false,
					},
					{
						email: "new@example.com",
						commitsCount: 8,
						commitsCount30Days: 0,
						commitsCount90Days: 2,
						commitsCount365Days: 8,
						isRookie: true,
					},
				],
			}),
		);
		writeFileSync(
			join(repoDataDir, "metrics.txt"),
			[
				"FILE_CHANGE_HISTORY_TOTAL_AGE_DAYS: 420",
				"FILE_CHANGE_HISTORY_ACTIVE_DAYS: 118",
			].join("\n"),
		);
		writeJson(join(repoDataDir, "commits_per_extension.json"), [
			{
				extension: "ts",
				commitsCount: 24,
				committersCount: 3,
				filesCount: 12,
				commitsCount30Days: 5,
				commitsCount90Days: 11,
			},
		]);
		writeJson(join(repoDataDir, "contributor_timeline.json"), {
			perYear: [
				{ timeSlot: "2024", contributors: 2, commits: 10 },
				{ timeSlot: "2025", contributors: 3, commits: 14 },
				{ timeSlot: "2026", contributors: 3, commits: 16 },
			],
		});

		expect(
			readReportLandscapeRepositoryCommitsSummary(dataDir, "acme__web-app"),
		).toEqual({
			totalCommits: 40,
			totalContributors: 3,
			activeContributors: {
				days30: 2,
				days90: 3,
				days365: 3,
			},
			repoAgeDays: 420,
			activeDays: 118,
			rookieCount: 1,
			activity: [
				{ label: "Past 30 days", value: 2, detail: "2 contributors" },
				{ label: "Past 90 days", value: 3, detail: "3 contributors" },
				{ label: "Past year", value: 3, detail: "3 contributors" },
				{ label: "All time", value: 3, detail: "3 contributors" },
			],
			timeline: [
				{ timeSlot: "2024", commits: 10, contributors: 2 },
				{ timeSlot: "2025", commits: 14, contributors: 3 },
				{ timeSlot: "2026", commits: 16, contributors: 3 },
			],
			extensions: [
				{
					extension: "ts",
					commitsCount: 24,
					committersCount: 3,
					filesCount: 12,
					commitsCount30Days: 5,
					commitsCount90Days: 11,
				},
			],
		});
	});

	test("reads landscape repository dependencies from the repo export folder", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDataDir = join(root, "acme__web-app", "data");
		mkdirSync(dataDir, { recursive: true });
		mkdirSync(repoDataDir, { recursive: true });
		writeJson(join(repoDataDir, "component_dependencies.json"), {
			dependencies: [
				{
					decompositionKey: "components",
					fromComponent: "web",
					toComponent: "runtime",
					count: 8,
					evidenceCount: 3,
					locFrom: 1200,
				},
				{
					decompositionKey: "components",
					fromComponent: "runtime",
					toComponent: "reports",
					count: 5,
					evidenceCount: 2,
					locFrom: 900,
				},
			],
		});

		expect(
			readReportLandscapeRepositoryDependenciesSummary(dataDir, "acme__web-app"),
		).toEqual({
			sections: [
				{
					decompositionKey: "components",
					linksCount: 2,
					incoming: [
						{ label: "runtime", value: 8 },
						{ label: "reports", value: 5 },
					],
					outgoing: [
						{ label: "web", value: 8 },
						{ label: "runtime", value: 5 },
					],
					links: [
						{
							fromComponent: "web",
							toComponent: "runtime",
							count: 8,
							evidenceCount: 3,
							locFrom: 1200,
						},
						{
							fromComponent: "runtime",
							toComponent: "reports",
							count: 5,
							evidenceCount: 2,
							locFrom: 900,
						},
					],
				},
			],
		});
	});

	test("reads landscape repository duplication from the repo export folder", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDataDir = join(root, "acme__web-app", "data");
		mkdirSync(dataDir, { recursive: true });
		mkdirSync(repoDataDir, { recursive: true });
		writeJson(join(repoDataDir, "analysisResults.json"), {
			duplication: {
				percentage: 2.4,
				duplicatedLines: 442,
			},
		});
		writeJson(join(repoDataDir, "duplicates.json"), {
			duplicates: [
				{
					blockSize: 24,
					duplicatedFileBlocks: [
						{
							file: { relativePath: "src/routes/reports/index.ts" },
							startLine: 10,
							endLine: 33,
						},
						{
							file: { relativePath: "src/app.ts" },
							startLine: 40,
							endLine: 63,
						},
					],
				},
				{
					blockSize: 12,
					duplicatedFileBlocks: [
						{
							file: { relativePath: "src/routes/reports/index.ts" },
							startLine: 70,
							endLine: 81,
						},
					],
				},
			],
		});

		expect(
			readReportLandscapeRepositoryDuplicationSummary(dataDir, "acme__web-app"),
		).toEqual({
			duplicationPercentage: 2.4,
			duplicatedLines: 442,
			duplicateBlocksCount: 2,
			blockSizeDistribution: [
				{ label: "6-10 lines", value: 0, detail: "0 blocks" },
				{ label: "11-20 lines", value: 1, detail: "1 blocks" },
				{ label: "21-50 lines", value: 1, detail: "1 blocks" },
				{ label: "51-100 lines", value: 0, detail: "0 blocks" },
				{ label: "100+ lines", value: 0, detail: "0 blocks" },
			],
			mostDuplicatedFiles: [
				{ label: "index.ts", value: 2 },
				{ label: "app.ts", value: 1 },
			],
			largestDuplicateBlocks: [
				{
					blockSize: 24,
					files: 2,
					locations: [
						"src/routes/reports/index.ts:10-33",
						"src/app.ts:40-63",
					],
				},
				{
					blockSize: 12,
					files: 1,
					locations: ["src/routes/reports/index.ts:70-81"],
				},
			],
		});
	});

	test("reads a landscape repository file size view from the repo export folder", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDataDir = join(root, "acme__web-app", "data");
		mkdirSync(dataDir, { recursive: true });
		mkdirSync(repoDataDir, { recursive: true });
		writeJson(join(repoDataDir, "files_main.json"), {
			files: [
				{
					relativePath: "src/index.ts",
					extension: "ts",
					linesOfCode: 1100,
					commitsCount: 18,
					contributorsCount: 4,
					firstDate: "2024-01-03",
					latestDate: "2026-03-31",
				},
				{
					relativePath: "src/app.ts",
					extension: "ts",
					linesOfCode: 320,
					commitsCount: 8,
					contributorsCount: 2,
					firstDate: "2024-02-14",
					latestDate: "2026-03-20",
				},
				{
					relativePath: "README.md",
					extension: "md",
					linesOfCode: 40,
					commitsCount: 4,
					contributorsCount: 1,
					firstDate: "2024-01-03",
					latestDate: "2026-03-10",
				},
			],
		});

		expect(
			readReportLandscapeRepositoryFilesView(dataDir, "acme__web-app", "size"),
		).toEqual({
			view: "size",
			headline: {
				fileCount: 3,
				totalLinesOfCode: 1460,
			},
			sizeDistribution: [
				{ label: "1-50 LOC", value: 40, detail: "1 files" },
				{ label: "201-500 LOC", value: 320, detail: "1 files" },
				{ label: "1001+ LOC", value: 1100, detail: "1 files" },
			],
			largestFiles: [
				{ label: "index.ts", value: 1100 },
				{ label: "app.ts", value: 320 },
				{ label: "README.md", value: 40 },
			],
			rows: [
				{
					relativePath: "src/index.ts",
					extension: "ts",
					linesOfCode: 1100,
					commitsCount: 18,
					contributorsCount: 4,
					firstDate: "2024-01-03",
					latestDate: "2026-03-31",
				},
				{
					relativePath: "src/app.ts",
					extension: "ts",
					linesOfCode: 320,
					commitsCount: 8,
					contributorsCount: 2,
					firstDate: "2024-02-14",
					latestDate: "2026-03-20",
				},
				{
					relativePath: "README.md",
					extension: "md",
					linesOfCode: 40,
					commitsCount: 4,
					contributorsCount: 1,
					firstDate: "2024-01-03",
					latestDate: "2026-03-10",
				},
			],
		});
	});

	test("reads a landscape repository unit size view from the repo export folder", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDataDir = join(root, "acme__web-app", "data");
		mkdirSync(dataDir, { recursive: true });
		mkdirSync(repoDataDir, { recursive: true });
		writeJson(join(repoDataDir, "units.json"), {
			units: [
				{
					shortName: "createRuntimeReport",
					relativeFileName: "src/lib/runtime-client.ts",
					linesOfCode: 180,
					mcCabeIndex: 12,
					numberOfParameters: 3,
					startLine: 120,
					endLine: 300,
				},
				{
					shortName: "reportRoute",
					relativeFileName: "src/routes/reports/index.ts",
					linesOfCode: 32,
					mcCabeIndex: 4,
					numberOfParameters: 2,
					startLine: 40,
					endLine: 72,
				},
				{
					shortName: "buttonCard",
					relativeFileName: "src/components/Button.tsx",
					linesOfCode: 8,
					mcCabeIndex: 1,
					numberOfParameters: 1,
					startLine: 10,
					endLine: 18,
				},
			],
		});

		expect(
			readReportLandscapeRepositoryUnitsView(dataDir, "acme__web-app", "size"),
		).toEqual({
			view: "size",
			headline: {
				unitCount: 3,
				totalLinesOfCode: 220,
			},
			sizeRisk: [
				{ label: "Low (1-20 LOC)", value: 1 },
				{ label: "Medium (21-50 LOC)", value: 1 },
				{ label: "Very High (101+ LOC)", value: 1 },
			],
			sizeDistribution: [
				{ label: "1-10 LOC", value: 8, detail: "1 units" },
				{ label: "21-50 LOC", value: 32, detail: "1 units" },
				{ label: "101+ LOC", value: 180, detail: "1 units" },
			],
			rows: [
				{
					shortName: "createRuntimeReport",
					relativeFileName: "src/lib/runtime-client.ts",
					linesOfCode: 180,
					mcCabeIndex: 12,
					numberOfParameters: 3,
					startLine: 120,
					endLine: 300,
				},
				{
					shortName: "reportRoute",
					relativeFileName: "src/routes/reports/index.ts",
					linesOfCode: 32,
					mcCabeIndex: 4,
					numberOfParameters: 2,
					startLine: 40,
					endLine: 72,
				},
				{
					shortName: "buttonCard",
					relativeFileName: "src/components/Button.tsx",
					linesOfCode: 8,
					mcCabeIndex: 1,
					numberOfParameters: 1,
					startLine: 10,
					endLine: 18,
				},
			],
		});
	});

	test("reads landscape repository contributors from repo exports", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDataDir = join(root, "acme__web-app", "data");
		mkdirSync(dataDir, { recursive: true });
		mkdirSync(repoDataDir, { recursive: true });
		writeJson(join(repoDataDir, "contributors.json"), {
			contributors: [
				{
					email: "alan@example.com",
					userName: "Alan Currie",
					commitsCount: 18,
					commitsCount30Days: 6,
					commitsCount90Days: 12,
					commitsCount180Days: 15,
					commitsCount365Days: 18,
					firstCommitDate: "2024-01-03",
					latestCommitDate: "2026-03-31",
					percentage: "45.0",
					isRookie: false,
				},
				{
					email: "new@example.com",
					userName: "",
					commitsCount: 8,
					commitsCount30Days: 0,
					commitsCount90Days: 2,
					commitsCount180Days: 4,
					commitsCount365Days: 8,
					firstCommitDate: "2026-02-18",
					latestCommitDate: "2026-03-30",
					percentage: "20.0",
					isRookie: true,
				},
			],
		});
		writeJson(join(repoDataDir, "contributor_impact.json"), {
			periods: [
				{
					period_key: "all_time",
					contributors: [
						{
							email: "alan@example.com",
							is_glue: true,
							is_snacking: false,
							dominant_dimension: "coordination_relief",
						},
						{
							email: "new@example.com",
							is_glue: false,
							is_snacking: true,
							dominant_dimension: "knowledge_spread",
						},
					],
				},
			],
		});

		expect(
			readReportLandscapeRepositoryContributorsSummary(dataDir, "acme__web-app"),
		).toEqual([
			{
				email: "alan@example.com",
				userName: "Alan Currie",
				displayName: "Alan Currie",
				status: "Active",
				commitsAllTime: 18,
				commits30Days: 6,
				commits90Days: 12,
				commits180Days: 15,
				commits365Days: 18,
				firstCommit: "2024-01-03",
				lastCommit: "2026-03-31",
				percentage: "45.0",
				filesTouched: null,
				componentsTouched: null,
				primaryComponent: "",
				knowledgeSignal: "Glue",
			},
			{
				email: "new@example.com",
				userName: "",
				displayName: "new@example.com",
				status: "Rookie",
				commitsAllTime: 8,
				commits30Days: 0,
				commits90Days: 2,
				commits180Days: 4,
				commits365Days: 8,
				firstCommit: "2026-02-18",
				lastCommit: "2026-03-30",
				percentage: "20.0",
				filesTouched: null,
				componentsTouched: null,
				primaryComponent: "",
				knowledgeSignal: "Snacking",
			},
		]);
	});

	test("reads landscape repository contributor detail from repo exports", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDataDir = join(root, "acme__web-app", "data");
		const detailsDir = join(repoDataDir, "contributor_details");
		mkdirSync(dataDir, { recursive: true });
		mkdirSync(detailsDir, { recursive: true });
		writeJson(join(repoDataDir, "contributors.json"), {
			contributors: [
				{
					email: "alan@example.com",
					userName: "Alan Currie",
					commitsCount: 18,
					commitsCount30Days: 6,
					commitsCount90Days: 12,
					commitsCount180Days: 15,
					commitsCount365Days: 18,
					firstCommitDate: "2024-01-03",
					latestCommitDate: "2026-03-31",
					percentage: "45.0",
					isRookie: false,
				},
				{
					email: "sam@example.com",
					userName: "Sam Example",
					commitsCount: 10,
					commitsCount30Days: 4,
					commitsCount90Days: 8,
					commitsCount180Days: 9,
					commitsCount365Days: 10,
					firstCommitDate: "2024-02-10",
					latestCommitDate: "2026-03-28",
					percentage: "25.0",
					isRookie: false,
				},
			],
		});
		writeJson(join(detailsDir, "alan%40example.com.json"), {
			email: "alan@example.com",
			userName: "Alan Currie",
			commitsCount: 18,
			commitsCount30Days: 6,
			commitsCount90Days: 12,
			commitsCount180Days: 15,
			commitsCount365Days: 18,
			firstCommitDate: "2024-01-03",
			latestCommitDate: "2026-03-31",
			isActive: true,
			isRookie: false,
			dailyActivity: [{ date: "2026-03-31", commits: 2 }],
			files: [
				{
					relativePath: "src/index.ts",
					extension: "ts",
					commits: 8,
					logicalComponents: ["web"],
					concerns: ["ui"],
				},
			],
			extensions: [{ extension: "ts", commits: 14, files: 6 }],
			logicalComponents: [{ name: "web", files: 6, linesOfCode: 3200 }],
			collaborators: [{ email: "sam@example.com", sharedFiles: 4 }],
		});

		expect(
			readReportLandscapeRepositoryContributorDetail(
				dataDir,
				"acme__web-app",
				"alan@example.com",
			),
		).toEqual({
			email: "alan@example.com",
			userName: "Alan Currie",
			displayName: "Alan Currie",
			status: "Active",
			commitsCount: 18,
			commitsCount30Days: 6,
			commitsCount90Days: 12,
			commitsCount180Days: 15,
			commitsCount365Days: 18,
			firstCommitDate: "2024-01-03",
			latestCommitDate: "2026-03-31",
			percentage: "45.0",
			activeDays: 1,
			filesCount: 1,
			collaboratorsCount: 1,
			topCollaboratorEmail: "sam@example.com",
			topCollaboratorDisplayName: "Sam Example",
			extensions: [{ extension: "ts", commits: 14, files: 6 }],
			logicalComponents: [{ name: "web", files: 6, linesOfCode: 3200 }],
			collaborators: [
				{
					email: "sam@example.com",
					displayName: "Sam Example",
					sharedFiles: 4,
				},
			],
			topFiles: [
				{
					relativePath: "src/index.ts",
					extension: "ts",
					commits: 8,
					logicalComponents: ["web"],
					concerns: ["ui"],
				},
			],
		});
	});

	test("reads a landscape repository topology summary from repo exports", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDataDir = join(root, "acme__web-app", "data");
		mkdirSync(dataDir, { recursive: true });
		mkdirSync(repoDataDir, { recursive: true });
		writeJson(join(repoDataDir, "people_dependencies.json"), [
			{
				from: "alan@example.com",
				to: "sam@example.com",
				count: 12,
				files: ["src/index.ts", "src/app.ts", "src/routes.ts"],
			},
		]);
		writeJson(join(repoDataDir, "people_dependencies_90d.json"), [
			{
				from: "alan@example.com",
				to: "jane@example.com",
				count: 5,
				files: ["src/index.ts"],
			},
		]);
		writeJson(join(repoDataDir, "contributor_impact.json"), {
			periods: [
				{
					period_key: "all_time",
					period_label: "All Time",
					contributors: [
						{
							email: "alan@example.com",
							display_name: "Alan Currie",
							glue_score: 8.8,
							snacking_score: 2.1,
							dominant_dimension: "coordination_relief",
						},
						{
							email: "sam@example.com",
							display_name: "Sam Example",
							glue_score: 4.4,
							snacking_score: 6.4,
							dominant_dimension: "knowledge_spread",
						},
					],
				},
			],
		});

		expect(
			readReportLandscapeRepositoryTopologySummary(dataDir, "acme__web-app"),
		).toEqual({
			availablePeriods: ["All Time", "Quarter"],
			strongestConnections: [
				{
					periodLabel: "All Time",
					from: "alan@example.com",
					fromDisplayName: "Alan Currie",
					to: "sam@example.com",
					toDisplayName: "Sam Example",
					sharedCommits: 12,
					filesCount: 3,
				},
				{
					periodLabel: "Quarter",
					from: "alan@example.com",
					fromDisplayName: "Alan Currie",
					to: "jane@example.com",
					toDisplayName: "jane@example.com",
					sharedCommits: 5,
					filesCount: 1,
				},
			],
			topGlueContributors: [
				{
					email: "alan@example.com",
					displayName: "Alan Currie",
					glueScore: 8.8,
					dominantDimension: "coordination_relief",
				},
				{
					email: "sam@example.com",
					displayName: "Sam Example",
					glueScore: 4.4,
					dominantDimension: "knowledge_spread",
				},
			],
			topSnackingContributors: [
				{
					email: "sam@example.com",
					displayName: "Sam Example",
					snackingScore: 6.4,
					dominantDimension: "knowledge_spread",
				},
				{
					email: "alan@example.com",
					displayName: "Alan Currie",
					snackingScore: 2.1,
					dominantDimension: "coordination_relief",
				},
			],
		});
	});

	test("reads contributor summaries from contributors.txt and contributor_details", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		const contributorDetailsDir = join(dataDir, "contributor_details");
		mkdirSync(contributorDetailsDir, { recursive: true });
		writeFileSync(
			join(dataDir, "contributors.txt"),
			[
				[
					"email",
					"all_time",
					"30d",
					"90d",
					"180d",
					"365d",
					"first_commit",
					"last_commit",
					"percentage",
					"user_name",
					"is_rookie",
					"is_active",
				].join("\t"),
				[
					"alan@example.com",
					"42",
					"8",
					"16",
					"24",
					"32",
					"2024-01-03",
					"2026-03-31",
					"14.2",
					"Alan Currie",
					"false",
					"true",
				].join("\t"),
				[
					"sam@example.com",
					"8",
					"8",
					"8",
					"8",
					"8",
					"2026-02-18",
					"2026-03-30",
					"2.7",
					"",
					"true",
					"true",
				].join("\t"),
			].join("\n"),
		);
		writeJson(join(contributorDetailsDir, "alan@example.com.json"), {
			email: "alan@example.com",
			logicalComponents: [{ name: "runtime", linesOfCode: 4200 }],
			files: [{ relativePath: "src/index.ts" }, { relativePath: "src/app.ts" }],
		});
		writeJson(join(contributorDetailsDir, "sam@example.com.json"), {
			email: "sam@example.com",
			logicalComponents: [
				{ name: "reports", linesOfCode: 3200 },
				{ name: "site", linesOfCode: 1800 },
				{ name: "runtime", linesOfCode: 1400 },
				{ name: "analyzer", linesOfCode: 1200 },
				{ name: "common", linesOfCode: 900 },
			],
			files: [
				{ relativePath: "src/reports.ts" },
				{ relativePath: "src/site.ts" },
				{ relativePath: "src/runtime.ts" },
			],
		});

		expect(readReportContributorsSummary(dataDir)).toEqual([
			{
				email: "alan@example.com",
				userName: "Alan Currie",
				displayName: "Alan Currie",
				status: "Active",
				commitsAllTime: 42,
				commits30Days: 8,
				commits90Days: 16,
				commits180Days: 24,
				commits365Days: 32,
				firstCommit: "2024-01-03",
				lastCommit: "2026-03-31",
				percentage: "14.2",
				filesTouched: 2,
				componentsTouched: 1,
				primaryComponent: "runtime",
				knowledgeSignal: "Single-component specialist",
			},
			{
				email: "sam@example.com",
				userName: "",
				displayName: "sam@example.com",
				status: "Rookie",
				commitsAllTime: 8,
				commits30Days: 8,
				commits90Days: 8,
				commits180Days: 8,
				commits365Days: 8,
				firstCommit: "2026-02-18",
				lastCommit: "2026-03-30",
				percentage: "2.7",
				filesTouched: 3,
				componentsTouched: 5,
				primaryComponent: "reports",
				knowledgeSignal: "Cross-context knowledge",
			},
		]);
	});

	test("reads a contributor detail view from contributor_details and contributor summary data", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		const contributorDetailsDir = join(dataDir, "contributor_details");
		mkdirSync(contributorDetailsDir, { recursive: true });
		writeFileSync(
			join(dataDir, "contributors.txt"),
			[
				[
					"email",
					"all_time",
					"30d",
					"90d",
					"180d",
					"365d",
					"first_commit",
					"last_commit",
					"percentage",
					"user_name",
					"is_rookie",
					"is_active",
				].join("\t"),
				[
					"alan@example.com",
					"42",
					"8",
					"16",
					"24",
					"32",
					"2024-01-03",
					"2026-03-31",
					"14.2",
					"Alan Currie",
					"false",
					"true",
				].join("\t"),
				[
					"sam@example.com",
					"8",
					"8",
					"8",
					"8",
					"8",
					"2026-02-18",
					"2026-03-30",
					"2.7",
					"Sam Example",
					"true",
					"true",
				].join("\t"),
			].join("\n"),
		);
		writeJson(join(contributorDetailsDir, "alan@example.com.json"), {
			email: "alan@example.com",
			userName: "Alan Currie",
			commitsCount: 42,
			commitsCount30Days: 8,
			commitsCount90Days: 16,
			commitsCount180Days: 24,
			commitsCount365Days: 32,
			firstCommitDate: "2024-01-03",
			latestCommitDate: "2026-03-31",
			isActive: true,
			isRookie: false,
			dailyActivity: [{ date: "2026-03-31", commits: 2 }],
			files: [
				{
					relativePath: "src/routes/reports/index.ts",
					extension: "ts",
					commits: 12,
					logicalComponents: ["runtime"],
					concerns: ["api"],
				},
			],
			extensions: [{ extension: "ts", commits: 30, files: 8 }],
			logicalComponents: [{ name: "runtime", files: 6, linesOfCode: 4200 }],
			collaborators: [{ email: "sam@example.com", sharedFiles: 6 }],
		});

		expect(readReportContributorDetail(dataDir, "alan@example.com")).toEqual({
			email: "alan@example.com",
			userName: "Alan Currie",
			displayName: "Alan Currie",
			status: "Active",
			commitsCount: 42,
			commitsCount30Days: 8,
			commitsCount90Days: 16,
			commitsCount180Days: 24,
			commitsCount365Days: 32,
			firstCommitDate: "2024-01-03",
			latestCommitDate: "2026-03-31",
			percentage: "14.2",
			activeDays: 1,
			filesCount: 1,
			collaboratorsCount: 1,
			topCollaboratorEmail: "sam@example.com",
			topCollaboratorDisplayName: "Sam Example",
			extensions: [{ extension: "ts", commits: 30, files: 8 }],
			logicalComponents: [{ name: "runtime", files: 6, linesOfCode: 4200 }],
			collaborators: [
				{
					email: "sam@example.com",
					displayName: "Sam Example",
					sharedFiles: 6,
				},
			],
			topFiles: [
				{
					relativePath: "src/routes/reports/index.ts",
					extension: "ts",
					commits: 12,
					logicalComponents: ["runtime"],
					concerns: ["api"],
				},
			],
		});
	});

	test("reads a topology summary from people dependency and contributor impact exports", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "people_dependencies.json"), [
			{
				from: "alan@example.com",
				to: "sam@example.com",
				count: 12,
				files: ["src/routes/reports/index.ts", "src/app.ts", "src/lib/auth.ts"],
			},
		]);
		writeJson(join(dataDir, "people_dependencies_90d.json"), [
			{
				from: "alan@example.com",
				to: "jane@example.com",
				count: 5,
				files: ["src/lib/report-datasets.ts"],
			},
		]);
		writeJson(join(dataDir, "contributor_impact.json"), {
			periods: [
				{
					period_key: "all_time",
					period_label: "All Time",
					contributors: [
						{
							email: "alan@example.com",
							display_name: "Alan Currie",
							glue_score: 8.8,
							snacking_score: 2.1,
							dominant_dimension: "coordination_relief",
						},
						{
							email: "sam@example.com",
							display_name: "Sam Example",
							glue_score: 4.4,
							snacking_score: 6.4,
							dominant_dimension: "knowledge_spread",
						},
					],
				},
			],
		});

		expect(readReportTopologySummary(dataDir)).toEqual({
			availablePeriods: ["All Time", "Quarter"],
			strongestConnections: [
				{
					periodLabel: "All Time",
					from: "alan@example.com",
					fromDisplayName: "Alan Currie",
					to: "sam@example.com",
					toDisplayName: "Sam Example",
					sharedCommits: 12,
					filesCount: 3,
				},
				{
					periodLabel: "Quarter",
					from: "alan@example.com",
					fromDisplayName: "Alan Currie",
					to: "jane@example.com",
					toDisplayName: "jane@example.com",
					sharedCommits: 5,
					filesCount: 1,
				},
			],
			topGlueContributors: [
				{
					email: "alan@example.com",
					displayName: "Alan Currie",
					glueScore: 8.8,
					dominantDimension: "coordination_relief",
				},
				{
					email: "sam@example.com",
					displayName: "Sam Example",
					glueScore: 4.4,
					dominantDimension: "knowledge_spread",
				},
			],
			topSnackingContributors: [
				{
					email: "sam@example.com",
					displayName: "Sam Example",
					snackingScore: 6.4,
					dominantDimension: "knowledge_spread",
				},
				{
					email: "alan@example.com",
					displayName: "Alan Currie",
					snackingScore: 2.1,
					dominantDimension: "coordination_relief",
				},
			],
		});
	});

	test("reads a metrics summary from metrics.txt", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeFileSync(
			join(dataDir, "metrics.txt"),
			[
				"LINES_OF_CODE_MAIN: 52000",
				"LINES_OF_CODE_TEST: 14000",
				"DUPLICATION_NUMBER_OF_DUPLICATED_LINES: 910",
				"TEST_VS_MAIN_LINES_OF_CODE_PERCENTAGE: 26.9",
				"TOTAL_ANALYSIS_TIME_IN_MILLIS: 1840",
				"NUMBER_OF_FILES_MAIN: 240",
			].join("\n"),
		);

		expect(readReportMetricsSummary(dataDir)).toEqual({
			totalMetrics: 6,
			headlineMetrics: {
				mainLinesOfCode: 52000,
				testLinesOfCode: 14000,
				duplicatedLines: 910,
				testVsMainPercentage: 26.9,
				totalAnalysisTimeInMillis: 1840,
			},
			groupSummaries: [
				{
					groupId: "LINES_OF_CODE",
					label: "Lines of Code",
					metrics: [
						{ id: "LINES_OF_CODE_MAIN", value: 52000 },
						{ id: "LINES_OF_CODE_TEST", value: 14000 },
						{ id: "TEST_VS_MAIN_LINES_OF_CODE_PERCENTAGE", value: 26.9 },
					],
				},
				{
					groupId: "NUMBER_OF_FILES",
					label: "Files",
					metrics: [{ id: "NUMBER_OF_FILES_MAIN", value: 240 }],
				},
				{
					groupId: "DUPLICATION",
					label: "Duplication",
					metrics: [{ id: "DUPLICATION_NUMBER_OF_DUPLICATED_LINES", value: 910 }],
				},
				{
					groupId: "ANALYSIS",
					label: "Analysis",
					metrics: [{ id: "TOTAL_ANALYSIS_TIME_IN_MILLIS", value: 1840 }],
				},
			],
		});
	});

	test("reads a duplication summary from analysisResults.json and duplicates.json", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "analysisResults.json"), {
			duplication: {
				percentage: 1.8,
				duplicatedLines: 910,
			},
		});
		writeJson(join(dataDir, "duplicates.json"), {
			duplicates: [
				{
					blockSize: 24,
					duplicatedFileBlocks: [
						{
							file: { relativePath: "src/routes/reports/index.ts" },
							startLine: 10,
							endLine: 33,
						},
						{
							file: { relativePath: "src/app.ts" },
							startLine: 40,
							endLine: 63,
						},
					],
				},
				{
					blockSize: 12,
					duplicatedFileBlocks: [
						{
							file: { relativePath: "src/routes/reports/index.ts" },
							startLine: 70,
							endLine: 81,
						},
					],
				},
			],
		});

		expect(readReportDuplicationSummary(dataDir)).toEqual({
			duplicationPercentage: 1.8,
			duplicatedLines: 910,
			duplicateBlocksCount: 2,
			blockSizeDistribution: [
				{ label: "6-10 lines", value: 0, detail: "0 blocks" },
				{ label: "11-20 lines", value: 1, detail: "1 blocks" },
				{ label: "21-50 lines", value: 1, detail: "1 blocks" },
				{ label: "51-100 lines", value: 0, detail: "0 blocks" },
				{ label: "100+ lines", value: 0, detail: "0 blocks" },
			],
			mostDuplicatedFiles: [
				{ label: "index.ts", value: 2 },
				{ label: "app.ts", value: 1 },
			],
			largestDuplicateBlocks: [
				{
					blockSize: 24,
					files: 2,
					locations: [
						"src/routes/reports/index.ts:10-33",
						"src/app.ts:40-63",
					],
				},
				{
					blockSize: 12,
					files: 1,
					locations: ["src/routes/reports/index.ts:70-81"],
				},
			],
		});
	});

	test("reads a dependencies summary from component_dependencies.json", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "component_dependencies.json"), {
			dependencies: [
				{
					decompositionKey: "components",
					fromComponent: "site",
					toComponent: "runtime",
					count: 8,
					locFrom: 1200,
					evidenceCount: 3,
					color: "#999999",
				},
				{
					decompositionKey: "components",
					fromComponent: "runtime",
					toComponent: "reports",
					count: 5,
					locFrom: 900,
					evidenceCount: 2,
					color: "#999999",
				},
			],
		});

		expect(readReportDependenciesSummary(dataDir)).toEqual({
			sections: [
				{
					decompositionKey: "components",
					linksCount: 2,
					incoming: [
						{ label: "runtime", value: 8 },
						{ label: "reports", value: 5 },
					],
					outgoing: [
						{ label: "site", value: 8 },
						{ label: "runtime", value: 5 },
					],
					links: [
						{
							fromComponent: "site",
							toComponent: "runtime",
							count: 8,
							evidenceCount: 3,
							locFrom: 1200,
						},
						{
							fromComponent: "runtime",
							toComponent: "reports",
							count: 5,
							evidenceCount: 2,
							locFrom: 900,
						},
					],
				},
			],
		});
	});

	test("reads a controls summary from controls.json", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "controls.json"), {
			goals: [
				{
					goal: "Maintainability",
					description: "Maintain structure",
					controls: [
						{
							metricId: "LINES_OF_CODE_MAIN",
							metricValue: 52000,
							metricDescription: "Main LOC",
							desiredRangeText: "< 50000",
							status: "FAILED",
							controlDescription: "Keep main LOC below target",
						},
						{
							metricId: "DUPLICATION_NUMBER_OF_DUPLICATED_LINES",
							metricValue: 910,
							metricDescription: "Duplicated lines",
							desiredRangeText: "< 1000",
							status: "TOLERANT",
							controlDescription: "Keep duplication manageable",
						},
					],
				},
				{
					goal: "Quality",
					description: "Preserve code quality",
					controls: [
						{
							metricId: "CONDITIONAL_COMPLEXITY_95_PERCENTILE",
							metricValue: 12,
							metricDescription: "Conditional complexity",
							desiredRangeText: "< 15",
							status: "OK",
							controlDescription: "Keep complexity under control",
						},
					],
				},
			],
		});

		expect(readReportControlsSummary(dataDir)).toEqual({
			totalControls: 3,
			statusCounts: {
				failed: 1,
				tolerant: 1,
				ok: 1,
				ignored: 0,
			},
			goals: [
				{
					goal: "Maintainability",
					total: 2,
					failed: 1,
					tolerant: 1,
					ok: 0,
					ignored: 0,
				},
				{
					goal: "Quality",
					total: 1,
					failed: 0,
					tolerant: 0,
					ok: 1,
					ignored: 0,
				},
			],
			controls: [
				{
					id: "Maintainability::LINES_OF_CODE_MAIN",
					goal: "Maintainability",
					metricId: "LINES_OF_CODE_MAIN",
					metricValue: 52000,
					desiredRangeText: "< 50000",
					status: "FAILED",
					description: "Keep main LOC below target",
				},
				{
					id: "Maintainability::DUPLICATION_NUMBER_OF_DUPLICATED_LINES",
					goal: "Maintainability",
					metricId: "DUPLICATION_NUMBER_OF_DUPLICATED_LINES",
					metricValue: 910,
					desiredRangeText: "< 1000",
					status: "TOLERANT",
					description: "Keep duplication manageable",
				},
				{
					id: "Quality::CONDITIONAL_COMPLEXITY_95_PERCENTILE",
					goal: "Quality",
					metricId: "CONDITIONAL_COMPLEXITY_95_PERCENTILE",
					metricValue: 12,
					desiredRangeText: "< 15",
					status: "OK",
					description: "Keep complexity under control",
				},
			],
		});
	});

	test("reads an impact summary from impact.json", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "impact.json"), {
			title: "Impact Report",
			timestamp: "2026-04-02T12:00:00.000Z",
			visible_activity: {
				commits: 48,
				contributors: 6,
				changed_files: 18,
				changed_units: 11,
			},
			structural_impact: {
				summary: {
					overall_score: 7.4,
					dominant_dimension: "coordination_relief",
				},
			},
			impact_dimensions: [
				{ label: "Coordination relief", score: 7.4 },
				{ label: "Knowledge spread", score: 6.2 },
			],
			impact_opportunities: [
				{
					name: "Runtime auth boundary",
					kind: "component",
					parent: "runtime",
					impact_score: 8.8,
					dominant_dimension: "coordination_relief",
					suggested_action: "Stabilize the boundary and reduce repeated coordination.",
				},
			],
			snacking_candidates: [
				{
					name: "Small refactors in report cards",
					kind: "file",
					visible_activity_score: 6.4,
					structural_impact_score: 2.1,
					reason: "Visible motion is outpacing structural leverage.",
				},
			],
		});

		expect(readReportImpactSummary(dataDir)).toEqual({
			title: "Impact Report",
			timestamp: "2026-04-02T12:00:00.000Z",
			visibleActivity: {
				commits: 48,
				contributors: 6,
				changedFiles: 18,
				changedUnits: 11,
			},
			structuralImpact: {
				overallScore: 7.4,
				dominantDimension: "coordination_relief",
			},
			impactDimensions: [
				{ label: "Coordination relief", score: 7.4 },
				{ label: "Knowledge spread", score: 6.2 },
			],
			topOpportunities: [
				{
					name: "Runtime auth boundary",
					kind: "component",
					parent: "runtime",
					impactScore: 8.8,
					dominantDimension: "coordination_relief",
					suggestedAction:
						"Stabilize the boundary and reduce repeated coordination.",
				},
			],
			snackingCandidates: [
				{
					name: "Small refactors in report cards",
					kind: "file",
					visibleActivityScore: 6.4,
					structuralImpactScore: 2.1,
					reason: "Visible motion is outpacing structural leverage.",
				},
			],
		});
	});

	test("reads a landscape repository impact summary from repo exports", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDir = join(root, "acme__web-app", "data");
		mkdirSync(repoDir, { recursive: true });
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(repoDir, "impact.json"), {
			title: "Web App Impact",
			timestamp: "2026-04-02T12:00:00.000Z",
			visible_activity: {
				commits: 18,
				contributors: 4,
				changed_files: 9,
				changed_units: 6,
			},
			structural_impact: {
				summary: {
					overall_score: 6.8,
					dominant_dimension: "coordination_relief",
				},
			},
			impact_dimensions: [
				{ label: "Coordination relief", score: 6.8 },
				{ label: "Knowledge spread", score: 5.4 },
			],
			impact_opportunities: [
				{
					name: "Runtime auth boundary",
					kind: "component",
					parent: "runtime",
					impact_score: 7.9,
					dominant_dimension: "coordination_relief",
					suggested_action: "Tighten the boundary and cut repeated coordination.",
				},
			],
			snacking_candidates: [
				{
					name: "Small UI cleanups",
					kind: "file",
					visible_activity_score: 5.8,
					structural_impact_score: 1.9,
					reason: "Visible motion is outpacing structural leverage.",
				},
			],
		});

		expect(
			readReportLandscapeRepositoryImpactSummary(
				dataDir,
				"acme__web-app",
			),
		).toEqual({
			title: "Web App Impact",
			timestamp: "2026-04-02T12:00:00.000Z",
			visibleActivity: {
				commits: 18,
				contributors: 4,
				changedFiles: 9,
				changedUnits: 6,
			},
			structuralImpact: {
				overallScore: 6.8,
				dominantDimension: "coordination_relief",
			},
			impactDimensions: [
				{ label: "Coordination relief", score: 6.8 },
				{ label: "Knowledge spread", score: 5.4 },
			],
			topOpportunities: [
				{
					name: "Runtime auth boundary",
					kind: "component",
					parent: "runtime",
					impactScore: 7.9,
					dominantDimension: "coordination_relief",
					suggestedAction: "Tighten the boundary and cut repeated coordination.",
				},
			],
			snackingCandidates: [
				{
					name: "Small UI cleanups",
					kind: "file",
					visibleActivityScore: 5.8,
					structuralImpactScore: 1.9,
					reason: "Visible motion is outpacing structural leverage.",
				},
			],
		});
	});

	test("reads a landscape repository controls summary from repo exports", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDir = join(root, "acme__web-app", "data");
		mkdirSync(repoDir, { recursive: true });
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(repoDir, "controls.json"), {
			goals: [
				{
					goal: "Maintainability",
					controls: [
						{
							metricId: "LINES_OF_CODE_MAIN",
							metricValue: 18450,
							desiredRangeText: "< 15000",
							status: "FAILED",
							controlDescription: "Keep main LOC below target",
						},
						{
							metricId: "TEST_VS_MAIN_LINES_OF_CODE_PERCENTAGE",
							metricValue: 22.8,
							desiredRangeText: "> 20",
							status: "TOLERANT",
							controlDescription: "Keep test coverage pressure healthy",
						},
					],
				},
				{
					goal: "Quality",
					controls: [
						{
							metricId: "DUPLICATION_PERCENTAGE",
							metricValue: 2.4,
							desiredRangeText: "< 5",
							status: "OK",
							controlDescription: "Keep duplication in check",
						},
					],
				},
			],
		});

		expect(
			readReportLandscapeRepositoryControlsSummary(
				dataDir,
				"acme__web-app",
			),
		).toEqual({
			totalControls: 3,
			statusCounts: {
				failed: 1,
				tolerant: 1,
				ok: 1,
				ignored: 0,
			},
			goals: [
				{
					goal: "Maintainability",
					total: 2,
					failed: 1,
					tolerant: 1,
					ok: 0,
					ignored: 0,
				},
				{
					goal: "Quality",
					total: 1,
					failed: 0,
					tolerant: 0,
					ok: 1,
					ignored: 0,
				},
			],
			controls: [
				{
					id: "Maintainability::LINES_OF_CODE_MAIN",
					goal: "Maintainability",
					metricId: "LINES_OF_CODE_MAIN",
					metricValue: 18450,
					desiredRangeText: "< 15000",
					status: "FAILED",
					description: "Keep main LOC below target",
				},
				{
					id: "Maintainability::TEST_VS_MAIN_LINES_OF_CODE_PERCENTAGE",
					goal: "Maintainability",
					metricId: "TEST_VS_MAIN_LINES_OF_CODE_PERCENTAGE",
					metricValue: 22.8,
					desiredRangeText: "> 20",
					status: "TOLERANT",
					description: "Keep test coverage pressure healthy",
				},
				{
					id: "Quality::DUPLICATION_PERCENTAGE",
					goal: "Quality",
					metricId: "DUPLICATION_PERCENTAGE",
					metricValue: 2.4,
					desiredRangeText: "< 5",
					status: "OK",
					description: "Keep duplication in check",
				},
			],
		});
	});

	test("reads a components summary from files_main.json", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "files_main.json"), {
			files: [
				{
					relativePath: "src/runtime/index.ts",
					linesOfCode: 400,
					components: ["runtime"],
					contributors: ["alan@example.com"],
				},
				{
					relativePath: "src/runtime/auth.ts",
					linesOfCode: 200,
					components: ["runtime"],
					contributors: ["alan@example.com", "sam@example.com"],
				},
				{
					relativePath: "src/reports/cards.ts",
					linesOfCode: 300,
					components: ["reports"],
					contributors: [
						"alan@example.com",
						"sam@example.com",
						"pat@example.com",
					],
				},
				{
					relativePath: "src/scripts/misc.ts",
					linesOfCode: 50,
					components: [],
					contributors: [],
				},
			],
		});

		expect(readReportComponentsSummary(dataDir)).toEqual({
			totalComponents: 2,
			singleOwnerComponents: 0,
			lowBackupComponents: 1,
			distributedComponents: 1,
			unassignedFiles: 1,
			topComponents: [
				{
					name: "runtime",
					files: 2,
					linesOfCode: 600,
					contributors: 2,
					risk: "Bus factor risk",
				},
				{
					name: "reports",
					files: 1,
					linesOfCode: 300,
					contributors: 3,
					risk: "",
				},
			],
			inventory: [
				{
					name: "runtime",
					files: 2,
					linesOfCode: 600,
					contributors: 2,
					risk: "Bus factor risk",
				},
				{
					name: "reports",
					files: 1,
					linesOfCode: 300,
					contributors: 3,
					risk: "",
				},
				{
					name: "(unassigned)",
					files: 1,
					linesOfCode: 50,
					contributors: null,
					risk: "",
				},
			],
		});
	});

	test("reads a landscape repository components summary from repo exports", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDir = join(root, "acme__web-app", "data");
		mkdirSync(repoDir, { recursive: true });
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(repoDir, "files_main.json"), {
			files: [
				{
					relativePath: "src/app.ts",
					linesOfCode: 320,
					components: ["web"],
					contributors: ["alan@example.com"],
				},
				{
					relativePath: "src/session.ts",
					linesOfCode: 180,
					components: ["web"],
					contributors: ["alan@example.com", "sam@example.com"],
				},
				{
					relativePath: "src/api.ts",
					linesOfCode: 220,
					components: ["api"],
					contributors: ["sam@example.com", "pat@example.com"],
				},
			],
		});

		expect(
			readReportLandscapeRepositoryComponentsSummary(dataDir, "acme__web-app"),
		).toEqual({
			totalComponents: 2,
			singleOwnerComponents: 0,
			lowBackupComponents: 2,
			distributedComponents: 0,
			unassignedFiles: 0,
			topComponents: [
				{
					name: "web",
					files: 2,
					linesOfCode: 500,
					contributors: 2,
					risk: "Bus factor risk",
				},
				{
					name: "api",
					files: 1,
					linesOfCode: 220,
					contributors: 2,
					risk: "Bus factor risk",
				},
			],
			inventory: [
				{
					name: "web",
					files: 2,
					linesOfCode: 500,
					contributors: 2,
					risk: "Bus factor risk",
				},
				{
					name: "api",
					files: 1,
					linesOfCode: 220,
					contributors: 2,
					risk: "Bus factor risk",
				},
			],
		});
	});

	test("reads a coupling summary from repo exports", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "files_main.json"), {
			files: [
				{
					relativePath: "src/app.ts",
					linesOfCode: 300,
					components: ["web"],
					contributors: ["alan@example.com", "sam@example.com"],
				},
				{
					relativePath: "src/session.ts",
					linesOfCode: 200,
					components: ["web"],
					contributors: ["alan@example.com"],
				},
				{
					relativePath: "src/api.ts",
					linesOfCode: 250,
					components: ["api"],
					contributors: ["sam@example.com"],
				},
			],
		});
		writeJson(join(dataDir, "component_dependencies.json"), {
			dependencies: [
				{
					decompositionKey: "primary",
					fromComponent: "web",
					toComponent: "api",
					count: 5,
				},
				{
					decompositionKey: "primary",
					fromComponent: "api",
					toComponent: "web",
					count: 2,
				},
			],
		});
		writeJson(join(dataDir, "temporal_dependencies.json"), {
			dependencies: [
				{
					periodKey: "quarter",
					periodLabel: "Quarter",
					periodDays: 90,
					file1: "src/app.ts",
					file2: "src/api.ts",
					sameCommits: 4,
				},
			],
		});
		writeJson(join(dataDir, "hotspots.json"), {
			componentHotspots: [
				{
					name: "api",
					parent: "primary",
					score: 82,
					dimensions: {
						structuralRisk: 7.8,
						changePressure: 6.2,
						coordinationCost: 8.1,
						knowledgeRisk: 9.4,
					},
					reasons: ["High coordination cost", "Single-owner knowledge exposure"],
				},
			],
		});

		const summary = readReportCouplingSummary(dataDir);
		expect(summary).not.toBeNull();
		expect(summary?.decompositionKey).toBe("primary");
		expect(summary?.temporalWindowLabel).toBe("Quarter");
		expect(summary?.aggregate.totalComponents).toBe(2);
		expect(summary?.topRiskComponents[0]?.component).toBe("api");
		expect(summary?.inventory).toHaveLength(2);
	});

	test("reads a landscape repository coupling summary from repo exports", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "data");
		const repoDir = join(root, "acme__web-app", "data");
		mkdirSync(repoDir, { recursive: true });
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(repoDir, "files_main.json"), {
			files: [
				{
					relativePath: "src/app.ts",
					linesOfCode: 300,
					components: ["web"],
					contributors: ["alan@example.com", "sam@example.com"],
				},
				{
					relativePath: "src/api.ts",
					linesOfCode: 250,
					components: ["api"],
					contributors: ["sam@example.com"],
				},
			],
		});
		writeJson(join(repoDir, "component_dependencies.json"), {
			dependencies: [
				{
					decompositionKey: "primary",
					fromComponent: "web",
					toComponent: "api",
					count: 5,
				},
			],
		});
		writeJson(join(repoDir, "temporal_dependencies.json"), {
			dependencies: [
				{
					periodKey: "quarter",
					periodLabel: "Quarter",
					periodDays: 90,
					file1: "src/app.ts",
					file2: "src/api.ts",
					sameCommits: 4,
				},
			],
		});
		writeJson(join(repoDir, "hotspots.json"), {
			componentHotspots: [
				{
					name: "api",
					parent: "primary",
					score: 82,
					dimensions: {
						structuralRisk: 7.8,
						changePressure: 6.2,
						coordinationCost: 8.1,
						knowledgeRisk: 9.4,
					},
					reasons: ["High coordination cost", "Single-owner knowledge exposure"],
				},
			],
		});

		const summary = readReportLandscapeRepositoryCouplingSummary(
			dataDir,
			"acme__web-app",
		);
		expect(summary).not.toBeNull();
		expect(summary?.decompositionKey).toBe("primary");
		expect(summary?.topRiskComponents[0]?.component).toBe("api");
	});

	test("reads a file size summary from files_main.json", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "files_main.json"), {
			files: [
				{
					relativePath: "src/index.ts",
					extension: "ts",
					linesOfCode: 1100,
					components: ["runtime"],
					concerns: ["auth"],
					commitsCount: 18,
					contributorsCount: 4,
					firstDate: "2024-01-03",
					latestDate: "2026-03-31",
				},
				{
					relativePath: "src/app.ts",
					extension: "ts",
					linesOfCode: 320,
					components: ["runtime"],
					concerns: ["routing"],
				},
				{
					relativePath: "README.md",
					extension: "md",
					linesOfCode: 40,
					components: [],
					concerns: [],
				},
			],
		});

		expect(readReportFilesView(dataDir, "size")).toEqual({
			view: "size",
			headline: {
				fileCount: 3,
				totalLinesOfCode: 1460,
			},
			sizeDistribution: [
				{
					label: "1-50 LOC",
					value: 40,
					detail: "1 files",
				},
				{
					label: "201-500 LOC",
					value: 320,
					detail: "1 files",
				},
				{
					label: "1001+ LOC",
					value: 1100,
					detail: "1 files",
				},
			],
			largestFiles: [
				{
					label: "index.ts",
					value: 1100,
				},
				{
					label: "app.ts",
					value: 320,
				},
				{
					label: "README.md",
					value: 40,
				},
			],
			rows: [
				{
					relativePath: "src/index.ts",
					extension: "ts",
					linesOfCode: 1100,
					commitsCount: 18,
					contributorsCount: 4,
					firstDate: "2024-01-03",
					latestDate: "2026-03-31",
				},
				{
					relativePath: "src/app.ts",
					extension: "ts",
					linesOfCode: 320,
					commitsCount: null,
					contributorsCount: null,
					firstDate: null,
					latestDate: null,
				},
				{
					relativePath: "README.md",
					extension: "md",
					linesOfCode: 40,
					commitsCount: null,
					contributorsCount: null,
					firstDate: null,
					latestDate: null,
				},
			],
		});
	});

	test("reads a unit size summary from units.json", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "units.json"), {
			units: [
				{
					shortName: "createRuntimeReport",
					longName: "createRuntimeReport",
					relativeFileName: "src/lib/runtime-client.ts",
					linesOfCode: 180,
					mcCabeIndex: 12,
					numberOfParameters: 3,
					startLine: 120,
					endLine: 300,
					components: ["runtime"],
				},
				{
					shortName: "buildViewModel",
					longName: "buildViewModel",
					relativeFileName: "src/lib/report-overview-view-model.ts",
					linesOfCode: 32,
					mcCabeIndex: 4,
					numberOfParameters: 1,
					startLine: 10,
					endLine: 45,
					components: ["app"],
				},
				{
					shortName: "tiny",
					longName: "tiny",
					relativeFileName: "src/lib/tiny.ts",
					linesOfCode: 8,
					mcCabeIndex: 1,
					numberOfParameters: 0,
					startLine: 1,
					endLine: 8,
					components: ["shared"],
				},
			],
		});

		expect(readReportUnitsView(dataDir, "size")).toEqual({
			view: "size",
			headline: {
				unitCount: 3,
				totalLinesOfCode: 220,
			},
			sizeRisk: [
				{
					label: "Low (1-20 LOC)",
					value: 1,
				},
				{
					label: "Medium (21-50 LOC)",
					value: 1,
				},
				{
					label: "Very High (101+ LOC)",
					value: 1,
				},
			],
			sizeDistribution: [
				{
					label: "1-10 LOC",
					value: 8,
					detail: "1 units",
				},
				{
					label: "21-50 LOC",
					value: 32,
					detail: "1 units",
				},
				{
					label: "101+ LOC",
					value: 180,
					detail: "1 units",
				},
			],
			rows: [
				{
					shortName: "createRuntimeReport",
					relativeFileName: "src/lib/runtime-client.ts",
					linesOfCode: 180,
					mcCabeIndex: 12,
					numberOfParameters: 3,
					startLine: 120,
					endLine: 300,
				},
				{
					shortName: "buildViewModel",
					relativeFileName: "src/lib/report-overview-view-model.ts",
					linesOfCode: 32,
					mcCabeIndex: 4,
					numberOfParameters: 1,
					startLine: 10,
					endLine: 45,
				},
				{
					shortName: "tiny",
					relativeFileName: "src/lib/tiny.ts",
					linesOfCode: 8,
					mcCabeIndex: 1,
					numberOfParameters: 0,
					startLine: 1,
					endLine: 8,
				},
			],
		});
	});

	test("reads a hotspot summary from hotspots.json", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeJson(join(dataDir, "hotspots.json"), {
			fileHotspots: [
				{
					kind: "file",
					name: "src/runtime/index.ts",
					parent: "runtime",
					route: "/files/churn",
					score: 8.8,
					severity: "Critical",
					size: 1100,
					commitsCount: 18,
					contributorsCount: 4,
					temporalLinks: 7,
					complexity: 12,
					dimensions: {
						structuralRisk: 6.1,
						changePressure: 7.4,
						coordinationCost: 8.8,
						knowledgeRisk: 4.2,
					},
					dominantDimension: "coordinationCost",
					suggestedAction: "Stabilize the runtime boundary.",
					reasons: ["High coordination cost", "Sustained change pressure"],
				},
			],
			unitHotspots: [
				{
					kind: "unit",
					name: "createRuntimeReport",
					parent: "runtime-client",
					route: "/units/complexity",
					score: 7.2,
					severity: "High",
					size: 180,
					commitsCount: 12,
					contributorsCount: 3,
					temporalLinks: 5,
					complexity: 12,
					dimensions: {
						structuralRisk: 5.1,
						changePressure: 7.2,
						coordinationCost: 6.4,
						knowledgeRisk: 4.1,
					},
					dominantDimension: "changePressure",
					suggestedAction: "Split the report creation flow.",
					reasons: ["Too many change vectors"],
				},
			],
			componentHotspots: [
				{
					kind: "component",
					name: "runtime",
					parent: "",
					route: "/dependencies",
					score: 6.6,
					severity: "Medium",
					size: 4200,
					commitsCount: 22,
					contributorsCount: 5,
					temporalLinks: 9,
					complexity: 0,
					dimensions: {
						structuralRisk: 6.6,
						changePressure: 5.8,
						coordinationCost: 6.1,
						knowledgeRisk: 5.2,
					},
					dominantDimension: "structuralRisk",
					suggestedAction: "Clarify seams and ownership.",
					reasons: ["Large coordination surface"],
				},
			],
		});

		expect(readReportHotspotsSummary(dataDir)).toEqual({
			totalHotspots: 3,
			severityCounts: {
				critical: 1,
				high: 1,
				medium: 1,
				low: 0,
			},
			kindCounts: {
				files: 1,
				units: 1,
				components: 1,
			},
			dominantCounts: {
				structuralRisk: 1,
				changePressure: 1,
				coordinationCost: 1,
				knowledgeRisk: 0,
			},
			topHotspots: [
				{
					name: "src/runtime/index.ts",
					score: 8.8,
					severity: "Critical",
					kind: "file",
					dominantDimension: "coordinationCost",
					suggestedAction: "Stabilize the runtime boundary.",
				},
				{
					name: "createRuntimeReport",
					score: 7.2,
					severity: "High",
					kind: "unit",
					dominantDimension: "changePressure",
					suggestedAction: "Split the report creation flow.",
				},
				{
					name: "runtime",
					score: 6.6,
					severity: "Medium",
					kind: "component",
					dominantDimension: "structuralRisk",
					suggestedAction: "Clarify seams and ownership.",
				},
			],
			rows: [
				{
					name: "src/runtime/index.ts",
					route: "/files/churn",
					kind: "file",
					parent: "runtime",
					score: 8.8,
					severity: "Critical",
					dominantDimension: "coordinationCost",
					size: 1100,
					commitsCount: 18,
					contributorsCount: 4,
					temporalLinks: 7,
					complexity: 12,
					structuralRisk: 6.1,
					changePressure: 7.4,
					coordinationCost: 8.8,
					knowledgeRisk: 4.2,
					suggestedAction: "Stabilize the runtime boundary.",
					reasons: ["High coordination cost", "Sustained change pressure"],
				},
				{
					name: "createRuntimeReport",
					route: "/units/complexity",
					kind: "unit",
					parent: "runtime-client",
					score: 7.2,
					severity: "High",
					dominantDimension: "changePressure",
					size: 180,
					commitsCount: 12,
					contributorsCount: 3,
					temporalLinks: 5,
					complexity: 12,
					structuralRisk: 5.1,
					changePressure: 7.2,
					coordinationCost: 6.4,
					knowledgeRisk: 4.1,
					suggestedAction: "Split the report creation flow.",
					reasons: ["Too many change vectors"],
				},
				{
					name: "runtime",
					route: "/dependencies",
					kind: "component",
					parent: "",
					score: 6.6,
					severity: "Medium",
					dominantDimension: "structuralRisk",
					size: 4200,
					commitsCount: 22,
					contributorsCount: 5,
					temporalLinks: 9,
					complexity: 0,
					structuralRisk: 6.6,
					changePressure: 5.8,
					coordinationCost: 6.1,
					knowledgeRisk: 5.2,
					suggestedAction: "Clarify seams and ownership.",
					reasons: ["Large coordination surface"],
				},
			],
		});
	});

	test("reads a commit summary from contributors, metrics, extensions, and timeline exports", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });
		writeFileSync(
			join(dataDir, "contributors.txt"),
			[
				"email\tcommitsAllTime\tcommits30Days\tcommits90Days\tcommits180Days\tcommits365Days\tfirstCommit\tlastCommit\tpercentage\tuserName\tisRookie\tisActive",
				"alan@example.com\t32\t6\t12\t18\t24\t2024-01-03\t2026-03-31\t50.0\tAlan Currie\tfalse\ttrue",
				"sam@example.com\t22\t2\t6\t10\t14\t2024-06-10\t2026-03-30\t34.4\tSam Example\tfalse\ttrue",
				"new@example.com\t10\t0\t1\t2\t4\t2026-02-18\t2026-03-21\t15.6\tNew Dev\ttrue\tfalse",
			].join("\n"),
		);
		writeFileSync(
			join(dataDir, "metrics.txt"),
			[
				"FILE_CHANGE_HISTORY_TOTAL_AGE_DAYS: 420",
				"FILE_CHANGE_HISTORY_ACTIVE_DAYS: 118",
			].join("\n"),
		);
		writeJson(join(dataDir, "commits_per_extension.json"), [
			{
				extension: "ts",
				commitsCount: 42,
				committersCount: 3,
				filesCount: 16,
				commitsCount30Days: 8,
				committersCount30Days: 2,
				filesCount30Days: 4,
				commitsCount90Days: 18,
				committersCount90Days: 3,
				filesCount90Days: 9,
			},
			{
				extension: "astro",
				commitsCount: 12,
				committersCount: 2,
				filesCount: 5,
				commitsCount30Days: 4,
				committersCount30Days: 1,
				filesCount30Days: 2,
				commitsCount90Days: 7,
				committersCount90Days: 2,
				filesCount90Days: 3,
			},
		]);
		writeJson(join(dataDir, "contributor_timeline.json"), {
			perYear: [
				{
					timeSlot: "2024",
					contributors: 2,
					commits: 18,
				},
				{
					timeSlot: "2025",
					contributors: 3,
					commits: 22,
				},
				{
					timeSlot: "2026",
					contributors: 3,
					commits: 24,
				},
			],
		});

		expect(readReportCommitsSummary(dataDir)).toEqual({
			totalCommits: 64,
			totalContributors: 3,
			activeContributors: {
				days30: 2,
				days90: 3,
				days365: 3,
			},
			repoAgeDays: 420,
			activeDays: 118,
			rookieCount: 1,
			activity: [
				{ label: "Past 30 days", value: 2, detail: "2 contributors" },
				{ label: "Past 90 days", value: 3, detail: "3 contributors" },
				{ label: "Past year", value: 3, detail: "3 contributors" },
				{ label: "All time", value: 3, detail: "3 contributors" },
			],
			timeline: [
				{ timeSlot: "2024", commits: 18, contributors: 2 },
				{ timeSlot: "2025", commits: 22, contributors: 3 },
				{ timeSlot: "2026", commits: 24, contributors: 3 },
			],
			extensions: [
				{
					extension: "ts",
					commitsCount: 42,
					committersCount: 3,
					filesCount: 16,
					commitsCount30Days: 8,
					commitsCount90Days: 18,
				},
				{
					extension: "astro",
					commitsCount: 12,
					committersCount: 2,
					filesCount: 5,
					commitsCount30Days: 4,
					commitsCount90Days: 7,
				},
			],
		});
	});

	test("returns the static trends empty state until snapshot history is exported", () => {
		const root = makeTempRoot();
		const dataDir = join(root, "reports", "data");
		mkdirSync(dataDir, { recursive: true });

		expect(readReportTrendsSummary(dataDir)).toEqual({
			available: false,
			message: "Trend data requires multiple analysis snapshots over time.",
			hint: "Run planetnik generateReports periodically. Each run adds a snapshot to the trend baseline.",
		});
	});
});
