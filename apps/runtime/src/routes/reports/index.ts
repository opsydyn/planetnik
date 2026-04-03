import { Schema } from "@effect/schema";
import { Elysia, t } from "elysia";
import { auth } from "../../lib/auth.js";
import {
	createWorkspaceReport,
	ensurePersonalWorkspace,
	findWorkspaceReportBySlug,
	listWorkspaceReports,
} from "../../lib/personal-workspace.js";
import {
	listAvailableDatasets,
	readReportArtifactSummary,
	readReportContributorDetail,
	readReportContributorsSummary,
	readReportContextSummary,
	readReportControlsSummary,
	readReportDependenciesSummary,
	readReportFilesView,
	readReportHotspotsSummary,
	readReportCommitsSummary,
	readReportDuplicationSummary,
	readReportImpactSummary,
	readReportMetricsSummary,
	readReportTopologySummary,
	readReportUnitsView,
	resolveReportDataSource,
} from "../../lib/report-datasets.js";

const ReportSchema = Schema.Struct({
	id: Schema.String,
	workspaceId: Schema.String,
	slug: Schema.String,
	name: Schema.String,
	kind: Schema.String,
	status: Schema.String,
	analysisRoot: Schema.NullOr(Schema.String),
	createdAt: Schema.String,
	updatedAt: Schema.String,
	lastSyncedAt: Schema.NullOr(Schema.String),
});

const ReportsResponseSchema = Schema.Struct({
	reports: Schema.Array(ReportSchema),
});

const DatasetSchema = Schema.Struct({
	name: Schema.String,
	dataDir: Schema.String,
	title: Schema.String,
	reportMode: Schema.NullOr(Schema.String),
});

const DatasetsResponseSchema = Schema.Struct({
	datasets: Schema.Array(DatasetSchema),
});

const ReportContextSummarySchema = Schema.Struct({
	mode: Schema.Literal("single_repository", "landscape"),
	reportMode: Schema.Literal("single_repository", "landscape"),
	title: Schema.String,
	rootRoute: Schema.String,
	dataVersion: Schema.Number,
	source: Schema.String,
	hasLandscape: Schema.Boolean,
	hasSingleRepositoryAnalysis: Schema.Boolean,
	primaryNavigation: Schema.Array(Schema.String),
});

const SingleRepositoryArtifactSummarySchema = Schema.Struct({
	kind: Schema.Literal("single_repository"),
	projectName: Schema.String,
	filesCount: Schema.Number,
	linesOfCode: Schema.Number,
	duplicatedLines: Schema.Number,
	duplicationPercentage: Schema.Number,
});

const LandscapeArtifactSummarySchema = Schema.Struct({
	kind: Schema.Literal("landscape"),
	title: Schema.String,
	landscapeName: Schema.String,
	repositoryCount: Schema.Number,
	contributorCount: Schema.Number,
	totalLinesOfCode: Schema.Number,
	commits30d: Schema.Number,
	commits90d: Schema.Number,
});

const CreateReportBodySchema = t.Object({
	name: t.Optional(
		t.String({
			minLength: 1,
			maxLength: 120,
		}),
	),
	datasetName: t.Optional(
		t.String({
			minLength: 1,
			maxLength: 120,
		}),
	),
	analysisRoot: t.Optional(
		t.String({
			minLength: 1,
			maxLength: 4096,
		}),
	),
});

const CreateReportResponseSchema = Schema.Struct({
	report: ReportSchema,
});

const ReportDetailResponseSchema = Schema.Struct({
	report: ReportSchema,
	context: Schema.NullOr(ReportContextSummarySchema),
	artifact: Schema.NullOr(
		Schema.Union(
			SingleRepositoryArtifactSummarySchema,
			LandscapeArtifactSummarySchema,
		),
	),
});

const ReportContributorSchema = Schema.Struct({
	email: Schema.String,
	userName: Schema.String,
	displayName: Schema.String,
	status: Schema.Literal("Rookie", "Active", "Inactive"),
	commitsAllTime: Schema.Number,
	commits30Days: Schema.Number,
	commits90Days: Schema.Number,
	commits180Days: Schema.Number,
	commits365Days: Schema.Number,
	firstCommit: Schema.String,
	lastCommit: Schema.String,
	percentage: Schema.String,
	filesTouched: Schema.NullOr(Schema.Number),
	componentsTouched: Schema.NullOr(Schema.Number),
	primaryComponent: Schema.String,
	knowledgeSignal: Schema.String,
});

const ReportContributorsResponseSchema = Schema.Struct({
	contributors: Schema.Array(ReportContributorSchema),
});

const ReportContributorDetailSchema = Schema.Struct({
	email: Schema.String,
	userName: Schema.String,
	displayName: Schema.String,
	status: Schema.Literal("Rookie", "Active", "Inactive"),
	commitsCount: Schema.Number,
	commitsCount30Days: Schema.Number,
	commitsCount90Days: Schema.Number,
	commitsCount180Days: Schema.Number,
	commitsCount365Days: Schema.Number,
	firstCommitDate: Schema.String,
	latestCommitDate: Schema.String,
	percentage: Schema.String,
	activeDays: Schema.Number,
	filesCount: Schema.Number,
	collaboratorsCount: Schema.Number,
	topCollaboratorEmail: Schema.NullOr(Schema.String),
	topCollaboratorDisplayName: Schema.NullOr(Schema.String),
	extensions: Schema.Array(
		Schema.Struct({
			extension: Schema.String,
			commits: Schema.Number,
			files: Schema.Number,
		}),
	),
	logicalComponents: Schema.Array(
		Schema.Struct({
			name: Schema.String,
			files: Schema.Number,
			linesOfCode: Schema.Number,
		}),
	),
	collaborators: Schema.Array(
		Schema.Struct({
			email: Schema.String,
			displayName: Schema.String,
			sharedFiles: Schema.Number,
		}),
	),
	topFiles: Schema.Array(
		Schema.Struct({
			relativePath: Schema.String,
			extension: Schema.String,
			commits: Schema.Number,
			logicalComponents: Schema.Array(Schema.String),
			concerns: Schema.Array(Schema.String),
		}),
	),
});

const ReportContributorDetailResponseSchema = Schema.Struct({
	contributor: ReportContributorDetailSchema,
});

const ReportTopologySummarySchema = Schema.Struct({
	availablePeriods: Schema.Array(Schema.String),
	strongestConnections: Schema.Array(
		Schema.Struct({
			periodLabel: Schema.String,
			from: Schema.String,
			fromDisplayName: Schema.String,
			to: Schema.String,
			toDisplayName: Schema.String,
			sharedCommits: Schema.Number,
			filesCount: Schema.Number,
		}),
	),
	topGlueContributors: Schema.Array(
		Schema.Struct({
			email: Schema.String,
			displayName: Schema.String,
			glueScore: Schema.Number,
			dominantDimension: Schema.String,
		}),
	),
	topSnackingContributors: Schema.Array(
		Schema.Struct({
			email: Schema.String,
			displayName: Schema.String,
			snackingScore: Schema.Number,
			dominantDimension: Schema.String,
		}),
	),
});

const ReportTopologyResponseSchema = Schema.Struct({
	topology: ReportTopologySummarySchema,
});

const ReportMetricsSummarySchema = Schema.Struct({
	totalMetrics: Schema.Number,
	headlineMetrics: Schema.Struct({
		mainLinesOfCode: Schema.Number,
		testLinesOfCode: Schema.Number,
		duplicatedLines: Schema.Number,
		testVsMainPercentage: Schema.Number,
		totalAnalysisTimeInMillis: Schema.Number,
	}),
	groupSummaries: Schema.Array(
		Schema.Struct({
			groupId: Schema.String,
			label: Schema.String,
			metrics: Schema.Array(
				Schema.Struct({
					id: Schema.String,
					value: Schema.Number,
				}),
			),
		}),
	),
});

const ReportMetricsResponseSchema = Schema.Struct({
	metrics: ReportMetricsSummarySchema,
});

const ReportDuplicationSummarySchema = Schema.Struct({
	duplicationPercentage: Schema.Number,
	duplicatedLines: Schema.Number,
	duplicateBlocksCount: Schema.Number,
	blockSizeDistribution: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			value: Schema.Number,
			detail: Schema.String,
		}),
	),
	mostDuplicatedFiles: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			value: Schema.Number,
		}),
	),
	largestDuplicateBlocks: Schema.Array(
		Schema.Struct({
			blockSize: Schema.Number,
			files: Schema.Number,
			locations: Schema.Array(Schema.String),
		}),
	),
});

const ReportDuplicationResponseSchema = Schema.Struct({
	duplication: ReportDuplicationSummarySchema,
});

const ReportDependenciesSummarySchema = Schema.Struct({
	sections: Schema.Array(
		Schema.Struct({
			decompositionKey: Schema.String,
			linksCount: Schema.Number,
			incoming: Schema.Array(
				Schema.Struct({
					label: Schema.String,
					value: Schema.Number,
				}),
			),
			outgoing: Schema.Array(
				Schema.Struct({
					label: Schema.String,
					value: Schema.Number,
				}),
			),
			links: Schema.Array(
				Schema.Struct({
					fromComponent: Schema.String,
					toComponent: Schema.String,
					count: Schema.Number,
					evidenceCount: Schema.Number,
					locFrom: Schema.Number,
				}),
			),
		}),
	),
});

const ReportDependenciesResponseSchema = Schema.Struct({
	dependencies: ReportDependenciesSummarySchema,
});

const ReportControlsSummarySchema = Schema.Struct({
	totalControls: Schema.Number,
	statusCounts: Schema.Struct({
		failed: Schema.Number,
		tolerant: Schema.Number,
		ok: Schema.Number,
		ignored: Schema.Number,
	}),
	goals: Schema.Array(
		Schema.Struct({
			goal: Schema.String,
			total: Schema.Number,
			failed: Schema.Number,
			tolerant: Schema.Number,
			ok: Schema.Number,
			ignored: Schema.Number,
		}),
	),
	controls: Schema.Array(
		Schema.Struct({
			id: Schema.String,
			goal: Schema.String,
			metricId: Schema.String,
			metricValue: Schema.NullOr(Schema.Number),
			desiredRangeText: Schema.String,
			status: Schema.String,
			description: Schema.String,
		}),
	),
});

const ReportControlsResponseSchema = Schema.Struct({
	controls: ReportControlsSummarySchema,
});

const ReportImpactSummarySchema = Schema.Struct({
	title: Schema.String,
	timestamp: Schema.String,
	visibleActivity: Schema.Struct({
		commits: Schema.Number,
		contributors: Schema.Number,
		changedFiles: Schema.Number,
		changedUnits: Schema.Number,
	}),
	structuralImpact: Schema.Struct({
		overallScore: Schema.Number,
		dominantDimension: Schema.String,
	}),
	impactDimensions: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			score: Schema.Number,
		}),
	),
	topOpportunities: Schema.Array(
		Schema.Struct({
			name: Schema.String,
			kind: Schema.String,
			parent: Schema.String,
			impactScore: Schema.Number,
			dominantDimension: Schema.String,
			suggestedAction: Schema.String,
		}),
	),
	snackingCandidates: Schema.Array(
		Schema.Struct({
			name: Schema.String,
			kind: Schema.String,
			visibleActivityScore: Schema.Number,
			structuralImpactScore: Schema.Number,
			reason: Schema.String,
		}),
	),
});

const ReportImpactResponseSchema = Schema.Struct({
	impact: ReportImpactSummarySchema,
});

const ReportHotspotsSummarySchema = Schema.Struct({
	totalHotspots: Schema.Number,
	severityCounts: Schema.Struct({
		critical: Schema.Number,
		high: Schema.Number,
		medium: Schema.Number,
		low: Schema.Number,
	}),
	kindCounts: Schema.Struct({
		files: Schema.Number,
		units: Schema.Number,
		components: Schema.Number,
	}),
	dominantCounts: Schema.Struct({
		structuralRisk: Schema.Number,
		changePressure: Schema.Number,
		coordinationCost: Schema.Number,
		knowledgeRisk: Schema.Number,
	}),
	topHotspots: Schema.Array(
		Schema.Struct({
			name: Schema.String,
			score: Schema.Number,
			severity: Schema.String,
			kind: Schema.String,
			dominantDimension: Schema.String,
			suggestedAction: Schema.String,
		}),
	),
	rows: Schema.Array(
		Schema.Struct({
			name: Schema.String,
			route: Schema.String,
			kind: Schema.String,
			parent: Schema.String,
			score: Schema.Number,
			severity: Schema.String,
			dominantDimension: Schema.String,
			size: Schema.Number,
			commitsCount: Schema.Number,
			contributorsCount: Schema.Number,
			temporalLinks: Schema.Number,
			complexity: Schema.Number,
			structuralRisk: Schema.Number,
			changePressure: Schema.Number,
			coordinationCost: Schema.Number,
			knowledgeRisk: Schema.Number,
			suggestedAction: Schema.String,
			reasons: Schema.Array(Schema.String),
		}),
	),
});

const ReportHotspotsResponseSchema = Schema.Struct({
	hotspots: ReportHotspotsSummarySchema,
});

const ReportCommitsSummarySchema = Schema.Struct({
	totalCommits: Schema.Number,
	totalContributors: Schema.Number,
	activeContributors: Schema.Struct({
		days30: Schema.Number,
		days90: Schema.Number,
		days365: Schema.Number,
	}),
	repoAgeDays: Schema.NullOr(Schema.Number),
	activeDays: Schema.NullOr(Schema.Number),
	rookieCount: Schema.Number,
	activity: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			value: Schema.Number,
			detail: Schema.String,
		}),
	),
	timeline: Schema.Array(
		Schema.Struct({
			timeSlot: Schema.String,
			commits: Schema.Number,
			contributors: Schema.Number,
		}),
	),
	extensions: Schema.Array(
		Schema.Struct({
			extension: Schema.String,
			commitsCount: Schema.Number,
			committersCount: Schema.Number,
			filesCount: Schema.Number,
			commitsCount30Days: Schema.Number,
			commitsCount90Days: Schema.Number,
		}),
	),
});

const ReportCommitsResponseSchema = Schema.Struct({
	commits: ReportCommitsSummarySchema,
});

const ReportFileInventoryRowSchema = Schema.Struct({
	relativePath: Schema.String,
	extension: Schema.String,
	linesOfCode: Schema.Number,
	commitsCount: Schema.NullOr(Schema.Number),
	contributorsCount: Schema.NullOr(Schema.Number),
	firstDate: Schema.NullOr(Schema.String),
	latestDate: Schema.NullOr(Schema.String),
});

const ReportFilesSizeViewSchema = Schema.Struct({
	view: Schema.Literal("size"),
	headline: Schema.Struct({
		fileCount: Schema.Number,
		totalLinesOfCode: Schema.Number,
	}),
	sizeDistribution: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			value: Schema.Number,
			detail: Schema.String,
		}),
	),
	largestFiles: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			value: Schema.Number,
		}),
	),
	rows: Schema.Array(ReportFileInventoryRowSchema),
});

const ReportFilesAgeViewSchema = Schema.Struct({
	view: Schema.Literal("age"),
	headline: Schema.Struct({
		ageInDays: Schema.NullOr(Schema.Number),
		activeDays: Schema.NullOr(Schema.Number),
		weeks: Schema.NullOr(Schema.Number),
	}),
	categories: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			value: Schema.Number,
		}),
	),
});

const ReportFilesChurnViewSchema = Schema.Struct({
	view: Schema.Literal("churn"),
	headline: Schema.Struct({
		activeDays: Schema.NullOr(Schema.Number),
		weeks: Schema.NullOr(Schema.Number),
		estimatedWorkingDays: Schema.NullOr(Schema.Number),
		filesWithHistoryCount: Schema.Number,
	}),
	mostChangedFiles: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			value: Schema.Number,
		}),
	),
	rows: Schema.Array(ReportFileInventoryRowSchema),
});

const ReportFilesTemporalViewSchema = Schema.Struct({
	view: Schema.Literal("temporal"),
	sections: Schema.Array(
		Schema.Struct({
			periodKey: Schema.String,
			periodLabel: Schema.String,
			periodDays: Schema.Number,
			dependencies: Schema.Array(
				Schema.Struct({
					file1: Schema.String,
					file2: Schema.String,
					sameCommits: Schema.Number,
					commitsFile1: Schema.Number,
					commitsFile2: Schema.Number,
					latestCommit: Schema.String,
				}),
			),
		}),
	),
});

const ReportFilesViewResponseSchema = Schema.Struct({
	files: Schema.Union(
		ReportFilesSizeViewSchema,
		ReportFilesAgeViewSchema,
		ReportFilesChurnViewSchema,
		ReportFilesTemporalViewSchema,
	),
});

const ReportUnitInventoryRowSchema = Schema.Struct({
	shortName: Schema.String,
	relativeFileName: Schema.String,
	linesOfCode: Schema.Number,
	mcCabeIndex: Schema.Number,
	numberOfParameters: Schema.Number,
	startLine: Schema.Number,
	endLine: Schema.Number,
});

const ReportUnitsSizeViewSchema = Schema.Struct({
	view: Schema.Literal("size"),
	headline: Schema.Struct({
		unitCount: Schema.Number,
		totalLinesOfCode: Schema.Number,
	}),
	sizeRisk: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			value: Schema.Number,
		}),
	),
	sizeDistribution: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			value: Schema.Number,
			detail: Schema.String,
		}),
	),
	rows: Schema.Array(ReportUnitInventoryRowSchema),
});

const ReportUnitsComplexityViewSchema = Schema.Struct({
	view: Schema.Literal("complexity"),
	headline: Schema.Struct({
		unitCount: Schema.Number,
	}),
	complexityRisk: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			value: Schema.Number,
		}),
	),
	complexityDistribution: Schema.Array(
		Schema.Struct({
			label: Schema.String,
			value: Schema.Number,
			detail: Schema.String,
		}),
	),
	rows: Schema.Array(ReportUnitInventoryRowSchema),
});

const ReportUnitsViewResponseSchema = Schema.Struct({
	units: Schema.Union(
		ReportUnitsSizeViewSchema,
		ReportUnitsComplexityViewSchema,
	),
});

const decodeReportsResponse = Schema.decodeUnknownSync(ReportsResponseSchema);
const decodeDatasetsResponse = Schema.decodeUnknownSync(DatasetsResponseSchema);
const decodeCreateReportResponse = Schema.decodeUnknownSync(
	CreateReportResponseSchema,
);
const decodeReportDetailResponse = Schema.decodeUnknownSync(
	ReportDetailResponseSchema,
);
const decodeReportContributorsResponse = Schema.decodeUnknownSync(
	ReportContributorsResponseSchema,
);
const decodeReportContributorDetailResponse = Schema.decodeUnknownSync(
	ReportContributorDetailResponseSchema,
);
const decodeReportTopologyResponse = Schema.decodeUnknownSync(
	ReportTopologyResponseSchema,
);
const decodeReportMetricsResponse = Schema.decodeUnknownSync(
	ReportMetricsResponseSchema,
);
const decodeReportDuplicationResponse = Schema.decodeUnknownSync(
	ReportDuplicationResponseSchema,
);
const decodeReportDependenciesResponse = Schema.decodeUnknownSync(
	ReportDependenciesResponseSchema,
);
const decodeReportControlsResponse = Schema.decodeUnknownSync(
	ReportControlsResponseSchema,
);
const decodeReportImpactResponse = Schema.decodeUnknownSync(
	ReportImpactResponseSchema,
);
const decodeReportHotspotsResponse = Schema.decodeUnknownSync(
	ReportHotspotsResponseSchema,
);
const decodeReportCommitsResponse = Schema.decodeUnknownSync(
	ReportCommitsResponseSchema,
);
const decodeReportFilesViewResponse = Schema.decodeUnknownSync(
	ReportFilesViewResponseSchema,
);
const decodeReportUnitsViewResponse = Schema.decodeUnknownSync(
	ReportUnitsViewResponseSchema,
);

export const reportRoutes = new Elysia({ name: "reports" })
	.get("/api/reports", async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const reports = await listWorkspaceReports(personalWorkspace.id);

		return decodeReportsResponse({
			reports: reports.map((item) => ({
				id: item.id,
				workspaceId: item.workspaceId,
				slug: item.slug,
				name: item.name,
				kind: item.kind,
				status: item.status,
				analysisRoot: item.analysisRoot ?? null,
				createdAt: item.createdAt.toISOString(),
				updatedAt: item.updatedAt.toISOString(),
				lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
			})),
		});
	})
	.get("/api/datasets", () => {
		return decodeDatasetsResponse({
			datasets: listAvailableDatasets().map((dataset) => ({
				name: dataset.name,
				dataDir: dataset.dataDir,
				title: dataset.title,
				reportMode: dataset.reportMode,
			})),
		});
	})
	.get("/api/reports/:slug", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const context = found.analysisRoot
			? readReportContextSummary(found.analysisRoot)
			: null;
		const artifact =
			found.analysisRoot && context
				? readReportArtifactSummary(found.analysisRoot, context)
				: null;

		return decodeReportDetailResponse({
			report: {
				id: found.id,
				workspaceId: found.workspaceId,
				slug: found.slug,
				name: found.name,
				kind: found.kind,
				status: found.status,
				analysisRoot: found.analysisRoot ?? null,
				createdAt: found.createdAt.toISOString(),
				updatedAt: found.updatedAt.toISOString(),
				lastSyncedAt: found.lastSyncedAt?.toISOString() ?? null,
			},
			context,
			artifact,
		});
	})
	.get("/api/reports/:slug/contributors", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		return decodeReportContributorsResponse({
			contributors: found.analysisRoot
				? [...readReportContributorsSummary(found.analysisRoot)]
				: [],
		});
	})
	.get(
		"/api/reports/:slug/contributors/:email",
		async ({ request, params }) => {
			const session = await auth.api.getSession({
				headers: request.headers,
			});

			if (!session?.session || !session.user) {
				return new Response(
					JSON.stringify({
						error: "unauthorized",
					}),
					{
						status: 401,
						headers: {
							"content-type": "application/json",
						},
					},
				);
			}

			const personalWorkspace = await ensurePersonalWorkspace(session);
			const found = await findWorkspaceReportBySlug(
				personalWorkspace.id,
				params.slug,
			);

			if (!found) {
				return new Response(
					JSON.stringify({
						error: "not_found",
					}),
					{
						status: 404,
						headers: {
							"content-type": "application/json",
						},
					},
				);
			}

			if (!found.analysisRoot) {
				return new Response(
					JSON.stringify({
						error: "not_found",
					}),
					{
						status: 404,
						headers: {
							"content-type": "application/json",
						},
					},
				);
			}

			const contributor = readReportContributorDetail(
				found.analysisRoot,
				params.email,
			);
			if (!contributor) {
				return new Response(
					JSON.stringify({
						error: "not_found",
					}),
					{
						status: 404,
						headers: {
							"content-type": "application/json",
						},
					},
				);
			}

			return decodeReportContributorDetailResponse({
				contributor,
			});
		},
	)
	.get("/api/reports/:slug/topology", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found || !found.analysisRoot) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const topology = readReportTopologySummary(found.analysisRoot);
		if (!topology) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		return decodeReportTopologyResponse({
			topology,
		});
	})
	.get("/api/reports/:slug/metrics", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found || !found.analysisRoot) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const metrics = readReportMetricsSummary(found.analysisRoot);
		if (!metrics) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		return decodeReportMetricsResponse({
			metrics,
		});
	})
	.get("/api/reports/:slug/duplication", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found || !found.analysisRoot) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const duplication = readReportDuplicationSummary(found.analysisRoot);
		if (!duplication) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		return decodeReportDuplicationResponse({
			duplication,
		});
	})
	.get("/api/reports/:slug/dependencies", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found || !found.analysisRoot) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const dependencies = readReportDependenciesSummary(found.analysisRoot);
		if (!dependencies) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		return decodeReportDependenciesResponse({
			dependencies,
		});
	})
	.get("/api/reports/:slug/controls", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found || !found.analysisRoot) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const controls = readReportControlsSummary(found.analysisRoot);
		if (!controls) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		return decodeReportControlsResponse({
			controls,
		});
	})
	.get("/api/reports/:slug/impact", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found || !found.analysisRoot) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const impact = readReportImpactSummary(found.analysisRoot);
		if (!impact) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		return decodeReportImpactResponse({
			impact,
		});
	})
	.get("/api/reports/:slug/hotspots", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found || !found.analysisRoot) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const hotspots = readReportHotspotsSummary(found.analysisRoot);
		if (!hotspots) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		return decodeReportHotspotsResponse({
			hotspots,
		});
	})
	.get("/api/reports/:slug/commits", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found || !found.analysisRoot) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const commits = readReportCommitsSummary(found.analysisRoot);
		if (!commits) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		return decodeReportCommitsResponse({
			commits,
		});
	})
	.get("/api/reports/:slug/files/:view", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		if (
			params.view !== "size" &&
			params.view !== "age" &&
			params.view !== "churn" &&
			params.view !== "temporal"
		) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found || !found.analysisRoot) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const files = readReportFilesView(found.analysisRoot, params.view);
		if (!files) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		return decodeReportFilesViewResponse({
			files,
		});
	})
	.get("/api/reports/:slug/units/:view", async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		if (params.view !== "size" && params.view !== "complexity") {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const found = await findWorkspaceReportBySlug(
			personalWorkspace.id,
			params.slug,
		);

		if (!found || !found.analysisRoot) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const units = readReportUnitsView(found.analysisRoot, params.view);
		if (!units) {
			return new Response(
				JSON.stringify({
					error: "not_found",
				}),
				{
					status: 404,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		return decodeReportUnitsViewResponse({
			units,
		});
	})
	.post(
		"/api/reports",
		async ({ request, body }) => {
			const session = await auth.api.getSession({
				headers: request.headers,
			});

			if (!session?.session || !session.user) {
				return new Response(
					JSON.stringify({
						error: "unauthorized",
					}),
					{
						status: 401,
						headers: {
							"content-type": "application/json",
						},
					},
				);
			}

			const personalWorkspace = await ensurePersonalWorkspace(session);
			const resolvedSource = resolveReportDataSource({
				...(body.datasetName ? { datasetName: body.datasetName } : {}),
				...(body.analysisRoot ? { analysisRoot: body.analysisRoot } : {}),
			});
			const reportName =
				body.name?.trim() || resolvedSource?.title || "Imported report";

			if ((body.datasetName || body.analysisRoot) && !resolvedSource) {
				return new Response(
					JSON.stringify({
						error: "invalid_dataset_source",
					}),
					{
						status: 400,
						headers: {
							"content-type": "application/json",
						},
					},
				);
			}

			const created = await createWorkspaceReport({
				workspaceId: personalWorkspace.id,
				name: reportName,
				datasetName: body.datasetName?.trim() || null,
				analysisRoot: resolvedSource?.dataDir ?? null,
			});

			return decodeCreateReportResponse({
				report: {
					id: created.id,
					workspaceId: created.workspaceId,
					slug: created.slug,
					name: created.name,
					kind: created.kind,
					status: created.status,
					analysisRoot: created.analysisRoot ?? null,
					createdAt: created.createdAt.toISOString(),
					updatedAt: created.updatedAt.toISOString(),
					lastSyncedAt: created.lastSyncedAt?.toISOString() ?? null,
				},
			});
		},
		{
			body: CreateReportBodySchema,
		},
	);
