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
	readReportDuplicationSummary,
	readReportMetricsSummary,
	readReportTopologySummary,
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
});
