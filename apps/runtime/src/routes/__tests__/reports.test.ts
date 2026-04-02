import { beforeEach, describe, expect, mock, test } from "bun:test";

process.env.NODE_ENV ??= "test";
process.env.PORT ??= "1337";
process.env.CORS_ORIGIN ??= "http://localhost:4321";
process.env.DATABASE_URL ??=
	"postgresql://user:password@localhost:5432/planetnik?sslmode=disable";
process.env.BETTER_AUTH_SECRET ??= "test-secret-with-at-least-32-characters";
process.env.BETTER_AUTH_URL ??= "http://localhost:1337";
process.env.AUTH_COOKIE_SECURE ??= "false";
process.env.AUTH_COOKIE_SAME_SITE ??= "lax";

const authorizedSession = {
	user: {
		id: "user-1",
		email: "alan@example.com",
		name: "Alan Currie",
		image: null,
		emailVerified: false,
	},
	session: {
		id: "session-1",
		userId: "user-1",
		expiresAt: new Date("2026-04-09T17:20:19.145Z"),
	},
} as const;

const personalWorkspace = {
	id: "workspace-1",
	slug: "workspace-alan",
	name: "Alan Currie's Workspace",
	ownerUserId: "user-1",
	createdAt: new Date("2026-04-02T12:00:00.000Z"),
	updatedAt: new Date("2026-04-02T12:00:00.000Z"),
} as const;

type StoredReport = {
	readonly id: string;
	readonly workspaceId: string;
	readonly slug: string;
	readonly name: string;
	readonly kind: string;
	readonly status: string;
	readonly analysisRoot: string | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
	readonly lastSyncedAt: Date | null;
};

let currentSession:
	| typeof authorizedSession
	| null = authorizedSession;
let storedReports: StoredReport[] = [];

const authHandler = mock(async () => new Response("ok"));
const getSession = mock(async () => currentSession);
const ensurePersonalWorkspace = mock(async () => personalWorkspace);
const listWorkspaceReports = mock(
	async () => storedReports,
);
const findWorkspaceReportBySlug = mock(
	async (_workspaceId: string, slug: string) =>
		storedReports.find((report) => report.slug === slug) ?? null,
);
const createWorkspaceReport = mock(
	async (input: {
		readonly workspaceId: string;
		readonly name: string;
		readonly analysisRoot?: string | null;
	}) => {
		const now = new Date("2026-04-02T17:20:19.145Z");
		const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const created: StoredReport = {
			id: `report-${storedReports.length + 1}`,
			workspaceId: input.workspaceId,
			slug,
			name: input.name,
			kind: "planetnik-report",
			status: input.analysisRoot ? "connected" : "draft",
			analysisRoot: input.analysisRoot ?? null,
			createdAt: now,
			updatedAt: now,
			lastSyncedAt: input.analysisRoot ? now : null,
		};
		storedReports = [...storedReports, created];
		return created;
	},
);
const listAvailableDatasets = mock(() => [
	{
		name: "effect-ts",
		dataDir: "/datasets/effect-ts/data",
		title: "Effect TS",
		reportMode: "single_repository",
	},
]);
const resolveReportDataSource = mock(
	(input: { readonly datasetName?: string | null; readonly analysisRoot?: string | null }) => {
		if (input.datasetName === "effect-ts") {
			return {
				dataDir: "/datasets/effect-ts/data",
				datasetName: "effect-ts",
				title: "Effect TS",
				reportMode: "single_repository",
			};
		}

		if (input.analysisRoot === "/reports/acme/data") {
			return {
				dataDir: "/reports/acme/data",
				title: "Acme Platform",
				reportMode: "single_repository",
			};
		}

		return null;
	},
);
const readReportContextSummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data") {
		return null;
	}

	return {
		mode: "single_repository" as const,
		reportMode: "single_repository" as const,
		title: "Effect TS",
		rootRoute: "/",
		dataVersion: 1,
		source: "analysisResults",
		hasLandscape: false,
		hasSingleRepositoryAnalysis: true,
		primaryNavigation: ["overview", "files", "contributors"],
	};
});
const readReportArtifactSummary = mock(() => ({
	kind: "single_repository" as const,
	projectName: "Effect TS",
	filesCount: 240,
	linesOfCode: 52000,
	duplicatedLines: 910,
	duplicationPercentage: 1.8,
}));
const readReportContributorsSummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data") {
		return [];
	}

	return [
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
			filesTouched: 12,
			componentsTouched: 3,
			primaryComponent: "runtime",
			knowledgeSignal: "",
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
			filesTouched: null,
			componentsTouched: null,
			primaryComponent: "",
			knowledgeSignal: "",
		},
	];
});
const readReportContributorDetail = mock(
	(analysisRoot: string, email: string) => {
		if (
			analysisRoot !== "/datasets/effect-ts/data" ||
			email !== "alan@example.com"
		) {
			return null;
		}

		return {
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
			activeDays: 18,
			filesCount: 12,
			collaboratorsCount: 4,
			topCollaboratorEmail: "sam@example.com",
			topCollaboratorDisplayName: "Sam Example",
			extensions: [
				{ extension: "ts", commits: 30, files: 8 },
				{ extension: "astro", commits: 12, files: 4 },
			],
			logicalComponents: [
				{ name: "runtime", files: 6, linesOfCode: 4200 },
				{ name: "reports", files: 4, linesOfCode: 1900 },
			],
			collaborators: [
				{ email: "sam@example.com", displayName: "Sam Example", sharedFiles: 6 },
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
		};
	},
);
const readReportTopologySummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data") {
		return null;
	}

	return {
		availablePeriods: ["All Time", "Quarter", "Month"],
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
		],
		topGlueContributors: [
			{
				email: "alan@example.com",
				displayName: "Alan Currie",
				glueScore: 8.8,
				dominantDimension: "coordination_relief",
			},
		],
		topSnackingContributors: [
			{
				email: "sam@example.com",
				displayName: "Sam Example",
				snackingScore: 6.4,
				dominantDimension: "knowledge_spread",
			},
		],
	};
});
const readReportMetricsSummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data") {
		return null;
	}

	return {
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
				],
			},
			{
				groupId: "DUPLICATION",
				label: "Duplication",
				metrics: [{ id: "DUPLICATION_NUMBER_OF_DUPLICATED_LINES", value: 910 }],
			},
		],
	};
});

mock.module("../../lib/auth.js", () => ({
	auth: {
		api: {
			getSession,
		},
		handler: authHandler,
	},
}));

mock.module("../../lib/personal-workspace.js", () => ({
	ensurePersonalWorkspace,
	listWorkspaceReports,
	findWorkspaceReportBySlug,
	createWorkspaceReport,
}));

mock.module("../../lib/report-datasets.js", () => ({
	listAvailableDatasets,
	resolveReportDataSource,
	readReportContextSummary,
	readReportArtifactSummary,
	readReportContributorsSummary,
	readReportContributorDetail,
	readReportTopologySummary,
	readReportMetricsSummary,
}));

const { createApp } = await import("../../app.js");

describe("runtime report routes", () => {
	beforeEach(() => {
		currentSession = authorizedSession;
		storedReports = [];
		authHandler.mockClear();
		getSession.mockClear();
		ensurePersonalWorkspace.mockClear();
		listWorkspaceReports.mockClear();
		findWorkspaceReportBySlug.mockClear();
		createWorkspaceReport.mockClear();
		listAvailableDatasets.mockClear();
		resolveReportDataSource.mockClear();
		readReportContextSummary.mockClear();
		readReportArtifactSummary.mockClear();
	});

	test("creates a connected report from a valid dataset source and loads its detail", async () => {
		const app = createApp();

		const createResponse = await app.fetch(
			new Request("http://localhost/api/reports", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: "better-auth.session_token=test",
				},
				body: JSON.stringify({
					datasetName: "effect-ts",
				}),
			}),
		);

		expect(createResponse.status).toBe(200);
		const created = (await createResponse.json()) as {
			report: {
				slug: string;
				name: string;
				status: string;
				analysisRoot: string | null;
			};
		};
		expect(created.report.slug).toBe("effect-ts");
		expect(created.report.name).toBe("Effect TS");
		expect(created.report.status).toBe("connected");
		expect(created.report.analysisRoot).toBe("/datasets/effect-ts/data");

		const detailResponse = await app.fetch(
			new Request(`http://localhost/api/reports/${created.report.slug}`, {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(detailResponse.status).toBe(200);
		const detail = (await detailResponse.json()) as {
			context: {
				title: string;
				reportMode: string;
			} | null;
			artifact:
				| {
						kind: string;
						projectName: string;
						linesOfCode: number;
				  }
				| null;
		};

		expect(detail.context).toMatchObject({
			title: "Effect TS",
			reportMode: "single_repository",
		});
		expect(detail.artifact).toMatchObject({
			kind: "single_repository",
			projectName: "Effect TS",
			linesOfCode: 52000,
		});
		expect(resolveReportDataSource).toHaveBeenCalledWith({
			datasetName: "effect-ts",
		});
	});

	test("returns contributor summaries for a connected report", async () => {
		storedReports = [
			{
				id: "report-1",
				workspaceId: personalWorkspace.id,
				slug: "effect-ts",
				name: "Effect TS",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/effect-ts/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request("http://localhost/api/reports/effect-ts/contributors", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			contributors: Array<{
				email: string;
				displayName: string;
				status: string;
				commitsAllTime: number;
				componentsTouched: number | null;
			}>;
		};

		expect(body.contributors).toHaveLength(2);
		expect(body.contributors[0]).toMatchObject({
			email: "alan@example.com",
			displayName: "Alan Currie",
			status: "Active",
			commitsAllTime: 42,
			componentsTouched: 3,
		});
		expect(body.contributors[1]).toMatchObject({
			email: "sam@example.com",
			displayName: "sam@example.com",
			status: "Rookie",
			commitsAllTime: 8,
			componentsTouched: null,
		});
		expect(readReportContributorsSummary).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
		);
	});

	test("returns contributor detail for a connected report", async () => {
		storedReports = [
			{
				id: "report-1",
				workspaceId: personalWorkspace.id,
				slug: "effect-ts",
				name: "Effect TS",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/effect-ts/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request(
				"http://localhost/api/reports/effect-ts/contributors/alan%40example.com",
				{
					headers: {
						cookie: "better-auth.session_token=test",
					},
				},
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			contributor: {
				email: string;
				displayName: string;
				commitsCount: number;
				filesCount: number;
				topCollaboratorDisplayName: string | null;
			};
		};

		expect(body.contributor).toMatchObject({
			email: "alan@example.com",
			displayName: "Alan Currie",
			commitsCount: 42,
			filesCount: 12,
			topCollaboratorDisplayName: "Sam Example",
		});
		expect(readReportContributorDetail).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
			"alan@example.com",
		);
	});

	test("returns topology summary for a connected report", async () => {
		storedReports = [
			{
				id: "report-1",
				workspaceId: personalWorkspace.id,
				slug: "effect-ts",
				name: "Effect TS",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/effect-ts/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request("http://localhost/api/reports/effect-ts/topology", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			topology: {
				availablePeriods: string[];
				strongestConnections: Array<{
					from: string;
					to: string;
					sharedCommits: number;
				}>;
				topGlueContributors: Array<{
					email: string;
					displayName: string;
					glueScore: number;
				}>;
			};
		};

		expect(body.topology.availablePeriods).toEqual([
			"All Time",
			"Quarter",
			"Month",
		]);
		expect(body.topology.strongestConnections[0]).toMatchObject({
			from: "alan@example.com",
			to: "sam@example.com",
			sharedCommits: 12,
		});
		expect(body.topology.topGlueContributors[0]).toMatchObject({
			email: "alan@example.com",
			displayName: "Alan Currie",
			glueScore: 8.8,
		});
		expect(readReportTopologySummary).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
		);
	});

	test("returns metrics summary for a connected report", async () => {
		storedReports = [
			{
				id: "report-1",
				workspaceId: personalWorkspace.id,
				slug: "effect-ts",
				name: "Effect TS",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/effect-ts/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request("http://localhost/api/reports/effect-ts/metrics", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			metrics: {
				totalMetrics: number;
				headlineMetrics: {
					mainLinesOfCode: number;
					duplicatedLines: number;
				};
				groupSummaries: Array<{
					groupId: string;
					label: string;
				}>;
			};
		};

		expect(body.metrics.totalMetrics).toBe(6);
		expect(body.metrics.headlineMetrics).toMatchObject({
			mainLinesOfCode: 52000,
			duplicatedLines: 910,
		});
		expect(body.metrics.groupSummaries[0]).toMatchObject({
			groupId: "LINES_OF_CODE",
			label: "Lines of Code",
		});
		expect(readReportMetricsSummary).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
		);
	});

	test("rejects report creation when the dataset source cannot be resolved", async () => {
		const app = createApp();

		const response = await app.fetch(
			new Request("http://localhost/api/reports", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: "better-auth.session_token=test",
				},
				body: JSON.stringify({
					datasetName: "missing-dataset",
				}),
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "invalid_dataset_source",
		});
	});

	test("returns unauthorized for report reads without a session", async () => {
		currentSession = null;
		const app = createApp();

		const response = await app.fetch(
			new Request("http://localhost/api/reports"),
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: "unauthorized",
		});
	});
});
