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
const readReportDuplicationSummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data") {
		return null;
	}

	return {
		duplicationPercentage: 1.8,
		duplicatedLines: 910,
		duplicateBlocksCount: 2,
		blockSizeDistribution: [
			{ label: "11-20 lines", value: 1, detail: "1 blocks" },
			{ label: "21-50 lines", value: 1, detail: "1 blocks" },
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
		],
	};
});
const readReportDependenciesSummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data") {
		return null;
	}

	return {
		sections: [
			{
				decompositionKey: "components",
				linksCount: 2,
				incoming: [
					{ label: "runtime", value: 9 },
					{ label: "reports", value: 5 },
				],
				outgoing: [
					{ label: "site", value: 8 },
					{ label: "runtime", value: 6 },
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
	};
});
const readReportControlsSummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data") {
		return null;
	}

	return {
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
		],
	};
});
const readReportImpactSummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data") {
		return null;
	}

	return {
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
				suggestedAction: "Stabilize the boundary and reduce repeated coordination.",
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
	};
});
const readReportFilesView = mock((analysisRoot: string, view: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data" || view !== "size") {
		return null;
	}

	return {
		view: "size" as const,
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
		],
	};
});
const readReportUnitsView = mock((analysisRoot: string, view: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data" || view !== "size") {
		return null;
	}

	return {
		view: "size" as const,
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
		],
	};
});
const readReportHotspotsSummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data") {
		return null;
	}

	return {
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
		],
	};
});
const readReportCommitsSummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data") {
		return null;
	}

	return {
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
	};
});
const readReportTrendsSummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/effect-ts/data") {
		return null;
	}

	return {
		available: false,
		message: "Trend data requires multiple analysis snapshots over time.",
		hint: "Run planetnik generateReports periodically. Each run adds a snapshot to the trend baseline.",
	};
});
const readReportSecuritySummary = mock((analysisRoot: string) => {
	if (analysisRoot !== "/datasets/platform-landscape/data") {
		return null;
	}

	return {
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
		],
	};
});
const readReportLandscapeRepositorySummary = mock(
	(analysisRoot: string, repoKey: string) => {
		if (
			analysisRoot !== "/datasets/platform-landscape/data" ||
			repoKey !== "acme__web-app"
		) {
			return null;
		}

		return {
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
		};
	},
);
const readReportLandscapeRepositoryMetricsSummary = mock(
	(analysisRoot: string, repoKey: string) => {
		if (
			analysisRoot !== "/datasets/platform-landscape/data" ||
			repoKey !== "acme__web-app"
		) {
			return null;
		}

		return {
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
					],
				},
				{
					groupId: "DUPLICATION",
					label: "Duplication",
					metrics: [{ id: "DUPLICATION_NUMBER_OF_DUPLICATED_LINES", value: 442 }],
				},
			],
		};
	},
);
const readReportLandscapeRepositoryCommitsSummary = mock(
	(analysisRoot: string, repoKey: string) => {
		if (
			analysisRoot !== "/datasets/platform-landscape/data" ||
			repoKey !== "acme__web-app"
		) {
			return null;
		}

		return {
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
		};
	},
);
const readReportLandscapeRepositoryDependenciesSummary = mock(
	(analysisRoot: string, repoKey: string) => {
		if (
			analysisRoot !== "/datasets/platform-landscape/data" ||
			repoKey !== "acme__web-app"
		) {
			return null;
		}

		return {
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
		};
	},
);
const readReportLandscapeRepositoryDuplicationSummary = mock(
	(analysisRoot: string, repoKey: string) => {
		if (
			analysisRoot !== "/datasets/platform-landscape/data" ||
			repoKey !== "acme__web-app"
		) {
			return null;
		}

		return {
			duplicationPercentage: 2.4,
			duplicatedLines: 442,
			duplicateBlocksCount: 2,
			blockSizeDistribution: [
				{ label: "11-20 lines", value: 1, detail: "1 blocks" },
				{ label: "21-50 lines", value: 1, detail: "1 blocks" },
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
			],
		};
	},
);
const readReportLandscapeRepositoryFilesView = mock(
	(analysisRoot: string, repoKey: string, view: string) => {
		if (
			analysisRoot !== "/datasets/platform-landscape/data" ||
			repoKey !== "acme__web-app" ||
			view !== "size"
		) {
			return null;
		}

		return {
			view: "size" as const,
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
			],
		};
	},
);
const readReportLandscapeRepositoryUnitsView = mock(
	(analysisRoot: string, repoKey: string, view: string) => {
		if (
			analysisRoot !== "/datasets/platform-landscape/data" ||
			repoKey !== "acme__web-app" ||
			view !== "size"
		) {
			return null;
		}

		return {
			view: "size" as const,
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
			],
		};
	},
);
const readReportLandscapeRepositoryContributorsSummary = mock(
	(analysisRoot: string, repoKey: string) => {
		if (
			analysisRoot !== "/datasets/platform-landscape/data" ||
			repoKey !== "acme__web-app"
		) {
			return [];
		}

		return [
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
		];
	},
);
const readReportLandscapeRepositoryContributorDetail = mock(
	(analysisRoot: string, repoKey: string, email: string) => {
		if (
			analysisRoot !== "/datasets/platform-landscape/data" ||
			repoKey !== "acme__web-app" ||
			email !== "alan@example.com"
		) {
			return null;
		}

		return {
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
		};
	},
);
const readReportLandscapeRepositoryTopologySummary = mock(
	(analysisRoot: string, repoKey: string) => {
		if (
			analysisRoot !== "/datasets/platform-landscape/data" ||
			repoKey !== "acme__web-app"
		) {
			return null;
		}

		return {
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
	},
);

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
	readReportDuplicationSummary,
	readReportDependenciesSummary,
	readReportControlsSummary,
	readReportImpactSummary,
	readReportFilesView,
	readReportUnitsView,
	readReportHotspotsSummary,
	readReportCommitsSummary,
	readReportTrendsSummary,
	readReportSecuritySummary,
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
		readReportFilesView.mockClear();
		readReportUnitsView.mockClear();
		readReportHotspotsSummary.mockClear();
		readReportCommitsSummary.mockClear();
		readReportTrendsSummary.mockClear();
		readReportSecuritySummary.mockClear();
		readReportLandscapeRepositorySummary.mockClear();
		readReportLandscapeRepositoryMetricsSummary.mockClear();
		readReportLandscapeRepositoryCommitsSummary.mockClear();
		readReportLandscapeRepositoryDependenciesSummary.mockClear();
		readReportLandscapeRepositoryDuplicationSummary.mockClear();
		readReportLandscapeRepositoryFilesView.mockClear();
		readReportLandscapeRepositoryUnitsView.mockClear();
		readReportLandscapeRepositoryContributorsSummary.mockClear();
		readReportLandscapeRepositoryContributorDetail.mockClear();
		readReportLandscapeRepositoryTopologySummary.mockClear();
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

	test("returns duplication summary for a connected report", async () => {
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
			new Request("http://localhost/api/reports/effect-ts/duplication", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			duplication: {
				duplicationPercentage: number;
				duplicatedLines: number;
				duplicateBlocksCount: number;
				mostDuplicatedFiles: Array<{ label: string; value: number }>;
			};
		};

		expect(body.duplication).toMatchObject({
			duplicationPercentage: 1.8,
			duplicatedLines: 910,
			duplicateBlocksCount: 2,
		});
		expect(body.duplication.mostDuplicatedFiles[0]).toMatchObject({
			label: "index.ts",
			value: 2,
		});
		expect(readReportDuplicationSummary).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
		);
	});

	test("returns dependencies summary for a connected report", async () => {
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
			new Request("http://localhost/api/reports/effect-ts/dependencies", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			dependencies: {
				sections: Array<{
					decompositionKey: string;
					linksCount: number;
					incoming: Array<{ label: string; value: number }>;
				}>;
			};
		};

		expect(body.dependencies.sections[0]).toMatchObject({
			decompositionKey: "components",
			linksCount: 2,
		});
		expect(body.dependencies.sections[0]?.incoming[0]).toMatchObject({
			label: "runtime",
			value: 9,
		});
		expect(readReportDependenciesSummary).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
		);
	});

	test("returns controls summary for a connected report", async () => {
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
			new Request("http://localhost/api/reports/effect-ts/controls", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			controls: {
				totalControls: number;
				statusCounts: { failed: number; tolerant: number; ok: number };
				goals: Array<{ goal: string; total: number }>;
			};
		};

		expect(body.controls.totalControls).toBe(3);
		expect(body.controls.statusCounts).toMatchObject({
			failed: 1,
			tolerant: 1,
			ok: 1,
		});
		expect(body.controls.goals[0]).toMatchObject({
			goal: "Maintainability",
			total: 2,
		});
		expect(readReportControlsSummary).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
		);
	});

	test("returns impact summary for a connected report", async () => {
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
			new Request("http://localhost/api/reports/effect-ts/impact", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			impact: {
				title: string;
				visibleActivity: { commits: number; contributors: number };
				structuralImpact: { overallScore: number; dominantDimension: string };
				topOpportunities: Array<{ name: string; impactScore: number }>;
			};
		};

		expect(body.impact.title).toBe("Impact Report");
		expect(body.impact.visibleActivity).toMatchObject({
			commits: 48,
			contributors: 6,
		});
		expect(body.impact.structuralImpact).toMatchObject({
			overallScore: 7.4,
			dominantDimension: "coordination_relief",
		});
		expect(body.impact.topOpportunities[0]).toMatchObject({
			name: "Runtime auth boundary",
			impactScore: 8.8,
		});
		expect(readReportImpactSummary).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
		);
	});

	test("returns file size summary for a connected report", async () => {
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
			new Request("http://localhost/api/reports/effect-ts/files/size", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			files: {
				view: string;
				headline: { fileCount: number; totalLinesOfCode: number };
				largestFiles: Array<{ label: string; value: number }>;
			};
		};

		expect(body.files.view).toBe("size");
		expect(body.files.headline).toMatchObject({
			fileCount: 3,
			totalLinesOfCode: 1460,
		});
		expect(body.files.largestFiles[0]).toMatchObject({
			label: "index.ts",
			value: 1100,
		});
		expect(readReportFilesView).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
			"size",
		);
	});

	test("returns unit size summary for a connected report", async () => {
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
			new Request("http://localhost/api/reports/effect-ts/units/size", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			units: {
				view: string;
				headline: { unitCount: number; totalLinesOfCode: number };
				rows: Array<{ shortName: string; linesOfCode: number }>;
			};
		};

		expect(body.units.view).toBe("size");
		expect(body.units.headline).toMatchObject({
			unitCount: 3,
			totalLinesOfCode: 220,
		});
		expect(body.units.rows[0]).toMatchObject({
			shortName: "createRuntimeReport",
			linesOfCode: 180,
		});
		expect(readReportUnitsView).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
			"size",
		);
	});

	test("returns hotspot summary for a connected report", async () => {
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
			new Request("http://localhost/api/reports/effect-ts/hotspots", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			hotspots: {
				totalHotspots: number;
				severityCounts: { critical: number; high: number };
				topHotspots: Array<{ name: string; score: number }>;
			};
		};

		expect(body.hotspots.totalHotspots).toBe(3);
		expect(body.hotspots.severityCounts).toMatchObject({
			critical: 1,
			high: 1,
		});
		expect(body.hotspots.topHotspots[0]).toMatchObject({
			name: "src/runtime/index.ts",
			score: 8.8,
		});
		expect(readReportHotspotsSummary).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
		);
	});

	test("returns commit summary for a connected report", async () => {
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
			new Request("http://localhost/api/reports/effect-ts/commits", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			commits: {
				totalCommits: number;
				totalContributors: number;
				activeContributors: { days30: number; days90: number };
				timeline: Array<{ timeSlot: string; commits: number }>;
			};
		};

		expect(body.commits.totalCommits).toBe(64);
		expect(body.commits.totalContributors).toBe(3);
		expect(body.commits.activeContributors).toMatchObject({
			days30: 2,
			days90: 3,
		});
		expect(body.commits.timeline[0]).toMatchObject({
			timeSlot: "2024",
			commits: 18,
		});
		expect(readReportCommitsSummary).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
		);
	});

	test("returns trends availability summary for a connected report", async () => {
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
			new Request("http://localhost/api/reports/effect-ts/trends", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			trends: {
				available: boolean;
				message: string;
				hint: string;
			};
		};

		expect(body.trends).toEqual({
			available: false,
			message: "Trend data requires multiple analysis snapshots over time.",
			hint: "Run planetnik generateReports periodically. Each run adds a snapshot to the trend baseline.",
		});
		expect(readReportTrendsSummary).toHaveBeenCalledWith(
			"/datasets/effect-ts/data",
		);
	});

	test("returns landscape security summary for a connected landscape report", async () => {
		storedReports = [
			{
				id: "report-2",
				workspaceId: personalWorkspace.id,
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request("http://localhost/api/reports/platform-landscape/security", {
				headers: {
					cookie: "better-auth.session_token=test",
				},
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			security: {
				totalRepos: number;
				totalOpenAlerts: number;
				supplyChainExposureScore: number;
				repoHealth: Array<{ repo: string; repoKey: string | null; openAlerts: number }>;
			};
		};

		expect(body.security.totalRepos).toBe(3);
		expect(body.security.totalOpenAlerts).toBe(5);
		expect(body.security.supplyChainExposureScore).toBe(0.67);
		expect(body.security.repoHealth[0]).toMatchObject({
			repo: "web-app",
			repoKey: "acme__web-app",
			openAlerts: 3,
		});
		expect(readReportSecuritySummary).toHaveBeenCalledWith(
			"/datasets/platform-landscape/data",
		);
	});

	test("returns a landscape repository dashboard summary for a connected report", async () => {
		storedReports = [
			{
				id: "report-2",
				workspaceId: personalWorkspace.id,
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request(
				"http://localhost/api/reports/platform-landscape/repositories/acme__web-app",
				{
					headers: {
						cookie: "better-auth.session_token=test",
					},
				},
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			repository: {
				repoKey: string;
				name: string;
				linesOfCode: number;
				topContributors: Array<{ displayName: string; signal: string }>;
			};
		};

		expect(body.repository).toMatchObject({
			repoKey: "acme__web-app",
			name: "web-app",
			linesOfCode: 18450,
		});
		expect(body.repository.topContributors[0]).toMatchObject({
			displayName: "Alan Currie",
			signal: "Glue",
		});
		expect(readReportLandscapeRepositorySummary).toHaveBeenCalledWith(
			"/datasets/platform-landscape/data",
			"acme__web-app",
		);
	});

	test("returns landscape repository metrics for a connected report", async () => {
		storedReports = [
			{
				id: "report-2",
				workspaceId: personalWorkspace.id,
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request(
				"http://localhost/api/reports/platform-landscape/repositories/acme__web-app/metrics",
				{
					headers: {
						cookie: "better-auth.session_token=test",
					},
				},
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			metrics: {
				totalMetrics: number;
				headlineMetrics: { mainLinesOfCode: number; duplicatedLines: number };
			};
		};

		expect(body.metrics.totalMetrics).toBe(6);
		expect(body.metrics.headlineMetrics).toMatchObject({
			mainLinesOfCode: 18450,
			duplicatedLines: 442,
		});
		expect(readReportLandscapeRepositoryMetricsSummary).toHaveBeenCalledWith(
			"/datasets/platform-landscape/data",
			"acme__web-app",
		);
	});

	test("returns landscape repository commits for a connected report", async () => {
		storedReports = [
			{
				id: "report-2",
				workspaceId: personalWorkspace.id,
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request(
				"http://localhost/api/reports/platform-landscape/repositories/acme__web-app/commits",
				{
					headers: {
						cookie: "better-auth.session_token=test",
					},
				},
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			commits: {
				totalCommits: number;
				totalContributors: number;
				activeContributors: { days30: number; days90: number };
			};
		};

		expect(body.commits.totalCommits).toBe(40);
		expect(body.commits.totalContributors).toBe(3);
		expect(body.commits.activeContributors).toMatchObject({
			days30: 2,
			days90: 3,
		});
		expect(readReportLandscapeRepositoryCommitsSummary).toHaveBeenCalledWith(
			"/datasets/platform-landscape/data",
			"acme__web-app",
		);
	});

	test("returns landscape repository dependencies for a connected report", async () => {
		storedReports = [
			{
				id: "report-1",
				workspaceId: personalWorkspace.id,
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request(
				"http://localhost/api/reports/platform-landscape/repositories/acme__web-app/dependencies",
				{
					headers: {
						cookie: "better-auth.session_token=test",
					},
				},
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			dependencies: {
				sections: Array<{
					decompositionKey: string;
					linksCount: number;
					incoming: Array<{ label: string; value: number }>;
				}>;
			};
		};

		expect(body.dependencies.sections[0]).toMatchObject({
			decompositionKey: "components",
			linksCount: 2,
		});
		expect(body.dependencies.sections[0]?.incoming[0]).toMatchObject({
			label: "runtime",
			value: 8,
		});
		expect(readReportLandscapeRepositoryDependenciesSummary).toHaveBeenCalledWith(
			"/datasets/platform-landscape/data",
			"acme__web-app",
		);
	});

	test("returns landscape repository duplication for a connected report", async () => {
		storedReports = [
			{
				id: "report-1",
				workspaceId: personalWorkspace.id,
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request(
				"http://localhost/api/reports/platform-landscape/repositories/acme__web-app/duplication",
				{
					headers: {
						cookie: "better-auth.session_token=test",
					},
				},
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			duplication: {
				duplicationPercentage: number;
				duplicatedLines: number;
				duplicateBlocksCount: number;
			};
		};

		expect(body.duplication).toMatchObject({
			duplicationPercentage: 2.4,
			duplicatedLines: 442,
			duplicateBlocksCount: 2,
		});
		expect(readReportLandscapeRepositoryDuplicationSummary).toHaveBeenCalledWith(
			"/datasets/platform-landscape/data",
			"acme__web-app",
		);
	});

	test("returns landscape repository file size summary for a connected report", async () => {
		storedReports = [
			{
				id: "report-1",
				workspaceId: personalWorkspace.id,
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request(
				"http://localhost/api/reports/platform-landscape/repositories/acme__web-app/files/size",
				{
					headers: {
						cookie: "better-auth.session_token=test",
					},
				},
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			files: {
				view: string;
				headline: { fileCount: number; totalLinesOfCode: number };
			};
		};

		expect(body.files.view).toBe("size");
		expect(body.files.headline).toMatchObject({
			fileCount: 3,
			totalLinesOfCode: 1460,
		});
		expect(readReportLandscapeRepositoryFilesView).toHaveBeenCalledWith(
			"/datasets/platform-landscape/data",
			"acme__web-app",
			"size",
		);
	});

	test("returns landscape repository unit size summary for a connected report", async () => {
		storedReports = [
			{
				id: "report-1",
				workspaceId: personalWorkspace.id,
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request(
				"http://localhost/api/reports/platform-landscape/repositories/acme__web-app/units/size",
				{
					headers: {
						cookie: "better-auth.session_token=test",
					},
				},
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			units: {
				view: string;
				headline: { unitCount: number; totalLinesOfCode: number };
				rows: Array<{ shortName: string; linesOfCode: number }>;
			};
		};

		expect(body.units.view).toBe("size");
		expect(body.units.headline).toMatchObject({
			unitCount: 3,
			totalLinesOfCode: 220,
		});
		expect(body.units.rows[0]).toMatchObject({
			shortName: "createRuntimeReport",
			linesOfCode: 180,
		});
		expect(readReportLandscapeRepositoryUnitsView).toHaveBeenCalledWith(
			"/datasets/platform-landscape/data",
			"acme__web-app",
			"size",
		);
	});

	test("returns landscape repository contributors for a connected report", async () => {
		storedReports = [
			{
				id: "report-1",
				workspaceId: personalWorkspace.id,
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request(
				"http://localhost/api/reports/platform-landscape/repositories/acme__web-app/contributors",
				{
					headers: {
						cookie: "better-auth.session_token=test",
					},
				},
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			contributors: Array<{
				displayName: string;
				status: string;
				commitsAllTime: number;
			}>;
		};

		expect(body.contributors[0]).toMatchObject({
			displayName: "Alan Currie",
			status: "Active",
			commitsAllTime: 18,
		});
		expect(readReportLandscapeRepositoryContributorsSummary).toHaveBeenCalledWith(
			"/datasets/platform-landscape/data",
			"acme__web-app",
		);
	});

	test("returns landscape repository contributor detail for a connected report", async () => {
		storedReports = [
			{
				id: "report-1",
				workspaceId: personalWorkspace.id,
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request(
				"http://localhost/api/reports/platform-landscape/repositories/acme__web-app/contributors/alan@example.com",
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
				displayName: string;
				commitsCount: number;
				topCollaboratorDisplayName: string | null;
			};
		};

		expect(body.contributor).toMatchObject({
			displayName: "Alan Currie",
			commitsCount: 18,
			topCollaboratorDisplayName: "Sam Example",
		});
		expect(readReportLandscapeRepositoryContributorDetail).toHaveBeenCalledWith(
			"/datasets/platform-landscape/data",
			"acme__web-app",
			"alan@example.com",
		);
	});

	test("returns landscape repository topology for a connected report", async () => {
		storedReports = [
			{
				id: "report-1",
				workspaceId: personalWorkspace.id,
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: new Date("2026-04-02T17:20:19.145Z"),
				updatedAt: new Date("2026-04-02T17:20:19.145Z"),
				lastSyncedAt: new Date("2026-04-02T17:20:19.145Z"),
			},
		];
		const app = createApp();

		const response = await app.fetch(
			new Request(
				"http://localhost/api/reports/platform-landscape/repositories/acme__web-app/topology",
				{
					headers: {
						cookie: "better-auth.session_token=test",
					},
				},
			),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			topology: {
				availablePeriods: string[];
				strongestConnections: Array<{ from: string; to: string; sharedCommits: number }>;
			};
		};

		expect(body.topology.availablePeriods).toEqual(["All Time", "Quarter"]);
		expect(body.topology.strongestConnections[0]).toMatchObject({
			from: "alan@example.com",
			to: "sam@example.com",
			sharedCommits: 12,
		});
		expect(readReportLandscapeRepositoryTopologySummary).toHaveBeenCalledWith(
			"/datasets/platform-landscape/data",
			"acme__web-app",
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
