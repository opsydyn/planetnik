import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { appConfig } from "../config.js";
import {
	getFlexibleDataDirCandidates,
	isRecognizedDataDir,
	resolveNamedDatasetDataDir,
	resolveRecognizedDataDir,
} from "./data-directories.js";

const runtimeRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const workspaceRoot = join(runtimeRoot, "../..");
const defaultDatasetsRoot = join(workspaceRoot, "datasets");

export type RuntimeDataset = {
	readonly name: string;
	readonly dataDir: string;
	readonly title: string;
	readonly reportMode: string | null;
};

export type ReportContextSummary = {
	readonly mode: "single_repository" | "landscape";
	readonly reportMode: "single_repository" | "landscape";
	readonly title: string;
	readonly rootRoute: string;
	readonly dataVersion: number;
	readonly source: string;
	readonly hasLandscape: boolean;
	readonly hasSingleRepositoryAnalysis: boolean;
	readonly primaryNavigation: ReadonlyArray<string>;
};

export type SingleRepositoryArtifactSummary = {
	readonly kind: "single_repository";
	readonly projectName: string;
	readonly filesCount: number;
	readonly linesOfCode: number;
	readonly duplicatedLines: number;
	readonly duplicationPercentage: number;
};

export type LandscapeArtifactSummary = {
	readonly kind: "landscape";
	readonly title: string;
	readonly landscapeName: string;
	readonly repositoryCount: number;
	readonly contributorCount: number;
	readonly totalLinesOfCode: number;
	readonly commits30d: number;
	readonly commits90d: number;
};

export type ReportArtifactSummary =
	| SingleRepositoryArtifactSummary
	| LandscapeArtifactSummary;

export type ReportContributorSummary = {
	readonly email: string;
	readonly userName: string;
	readonly displayName: string;
	readonly status: "Rookie" | "Active" | "Inactive";
	readonly commitsAllTime: number;
	readonly commits30Days: number;
	readonly commits90Days: number;
	readonly commits180Days: number;
	readonly commits365Days: number;
	readonly firstCommit: string;
	readonly lastCommit: string;
	readonly percentage: string;
	readonly filesTouched: number | null;
	readonly componentsTouched: number | null;
	readonly primaryComponent: string;
	readonly knowledgeSignal: string;
};

export type ReportContributorDetail = {
	readonly email: string;
	readonly userName: string;
	readonly displayName: string;
	readonly status: "Rookie" | "Active" | "Inactive";
	readonly commitsCount: number;
	readonly commitsCount30Days: number;
	readonly commitsCount90Days: number;
	readonly commitsCount180Days: number;
	readonly commitsCount365Days: number;
	readonly firstCommitDate: string;
	readonly latestCommitDate: string;
	readonly percentage: string;
	readonly activeDays: number;
	readonly filesCount: number;
	readonly collaboratorsCount: number;
	readonly topCollaboratorEmail: string | null;
	readonly topCollaboratorDisplayName: string | null;
	readonly extensions: ReadonlyArray<{
		readonly extension: string;
		readonly commits: number;
		readonly files: number;
	}>;
	readonly logicalComponents: ReadonlyArray<{
		readonly name: string;
		readonly files: number;
		readonly linesOfCode: number;
	}>;
	readonly collaborators: ReadonlyArray<{
		readonly email: string;
		readonly displayName: string;
		readonly sharedFiles: number;
	}>;
	readonly topFiles: ReadonlyArray<{
		readonly relativePath: string;
		readonly extension: string;
		readonly commits: number;
		readonly logicalComponents: ReadonlyArray<string>;
		readonly concerns: ReadonlyArray<string>;
	}>;
};

export type ReportTopologySummary = {
	readonly availablePeriods: ReadonlyArray<string>;
	readonly strongestConnections: ReadonlyArray<{
		readonly periodLabel: string;
		readonly from: string;
		readonly fromDisplayName: string;
		readonly to: string;
		readonly toDisplayName: string;
		readonly sharedCommits: number;
		readonly filesCount: number;
	}>;
	readonly topGlueContributors: ReadonlyArray<{
		readonly email: string;
		readonly displayName: string;
		readonly glueScore: number;
		readonly dominantDimension: string;
	}>;
	readonly topSnackingContributors: ReadonlyArray<{
		readonly email: string;
		readonly displayName: string;
		readonly snackingScore: number;
		readonly dominantDimension: string;
	}>;
};

type ReportTopologyConnection = ReportTopologySummary["strongestConnections"][number];

export type ReportMetricsSummary = {
	readonly totalMetrics: number;
	readonly headlineMetrics: {
		readonly mainLinesOfCode: number;
		readonly testLinesOfCode: number;
		readonly duplicatedLines: number;
		readonly testVsMainPercentage: number;
		readonly totalAnalysisTimeInMillis: number;
	};
	readonly groupSummaries: ReadonlyArray<{
		readonly groupId: string;
		readonly label: string;
		readonly metrics: ReadonlyArray<{
			readonly id: string;
			readonly value: number;
		}>;
	}>;
};

export type ResolvedReportDataSource = {
	readonly dataDir: string;
	readonly datasetName?: string;
	readonly title: string;
	readonly reportMode: string | null;
};

function readReportContext(dataDir: string): Record<string, unknown> | null {
	const contextPath = join(dataDir, "report_context.json");
	if (!existsSync(contextPath)) {
		return null;
	}

	try {
		return JSON.parse(readFileSync(contextPath, "utf-8")) as Record<
			string,
			unknown
		>;
	} catch {
		return null;
	}
}

function readJsonRecord(
	dataDir: string,
	fileName: string,
): Record<string, unknown> | null {
	const filePath = join(dataDir, fileName);
	if (!existsSync(filePath)) {
		return null;
	}

	try {
		return JSON.parse(readFileSync(filePath, "utf-8")) as Record<
			string,
			unknown
		>;
	} catch {
		return null;
	}
}

function readTextFile(dataDir: string, fileName: string): string | null {
	const filePath = join(dataDir, fileName);
	if (!existsSync(filePath)) {
		return null;
	}

	try {
		return readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

function readContributorDetailsByEmail(
	dataDir: string,
): Map<string, Record<string, unknown>> {
	const detailsDir = join(dataDir, "contributor_details");
	if (!existsSync(detailsDir)) {
		return new Map();
	}

	try {
		const detailsByEmail = new Map<string, Record<string, unknown>>();
		for (const fileName of readdirSync(detailsDir)) {
			if (!fileName.endsWith(".json")) {
				continue;
			}

			const record = readJsonRecord(detailsDir, fileName);
			const email = record?.email;
			if (!record || typeof email !== "string") {
				continue;
			}

			detailsByEmail.set(email, record);
		}

		return detailsByEmail;
	} catch {
		return new Map();
	}
}

function getContributorStatus(input: {
	readonly isRookie: boolean;
	readonly isActive: boolean;
}): "Rookie" | "Active" | "Inactive" {
	if (input.isRookie) {
		return "Rookie";
	}

	return input.isActive ? "Active" : "Inactive";
}

function getContributorDisplayName(input: {
	readonly email: string;
	readonly userName: string;
}): string {
	return input.userName.trim().length > 0 ? input.userName : input.email;
}

function getPrimaryComponent(
	detail: Record<string, unknown> | undefined,
): string {
	const logicalComponents = detail?.logicalComponents;
	if (!Array.isArray(logicalComponents)) {
		return "";
	}

	const best = logicalComponents
		.filter(
			(component): component is Record<string, unknown> =>
				typeof component === "object" && component !== null,
		)
		.sort((left, right) => {
			const leftLoc =
				typeof left.linesOfCode === "number" ? left.linesOfCode : -1;
			const rightLoc =
				typeof right.linesOfCode === "number" ? right.linesOfCode : -1;
			return rightLoc - leftLoc;
		})[0];

	return typeof best?.name === "string" ? best.name : "";
}

function getKnowledgeSignal(componentsTouched: number | null): string {
	if (componentsTouched === 1) {
		return "Single-component specialist";
	}

	if (componentsTouched !== null && componentsTouched >= 5) {
		return "Cross-context knowledge";
	}

	return "";
}

function groupMetricId(id: string): string {
	if (id === "TOTAL_NUMBER_OF_FILES" || id.startsWith("NUMBER_OF_FILES_")) {
		return "NUMBER_OF_FILES";
	}
	if (
		id.startsWith("LINES_OF_CODE_") ||
		id.startsWith("TEST_VS_MAIN_LINES_OF_CODE")
	) {
		return "LINES_OF_CODE";
	}
	if (
		id.startsWith("NUMBER_OF_UNITS") ||
		id.startsWith("LINES_OF_CODE_IN_UNITS") ||
		id.startsWith("LINES_OF_CODE_OUTSIDE_UNITS")
	) {
		return "UNITS";
	}
	if (id.includes("_RISK_FILE_SIZE_")) return "FILE_SIZE_RISK";
	if (id.startsWith("CONDITIONAL_COMPLEXITY_")) return "CONDITIONAL_COMPLEXITY";
	if (id.startsWith("FILE_CHANGE_HISTORY_")) return "FILE_CHANGE_HISTORY";
	if (id.startsWith("FILE_AGE_")) return "FILE_AGE";
	if (
		id.startsWith("NUMBER_OF_DEPENDENCIES_") ||
		id.startsWith("NUMBER_OF_PLACES_WITH_CYCLIC_DEPENDENCIES_")
	) {
		return "DEPENDENCIES";
	}
	if (id.startsWith("DUPLICATION_") || id.startsWith("UNIT_DUPLICATES_")) {
		return "DUPLICATION";
	}
	if (id.startsWith("NUMBER_OF_CONTRIBUTORS")) return "TEAM";
	if (id.startsWith("TOTAL_ANALYSIS_TIME_")) return "ANALYSIS";

	const parts = id.split("_");
	return parts.slice(0, Math.min(3, parts.length)).join("_");
}

function formatMetricGroupLabel(group: string): string {
	const labels: Record<string, string> = {
		NUMBER_OF_FILES: "Files",
		LINES_OF_CODE: "Lines of Code",
		UNITS: "Units",
		FILE_SIZE_RISK: "File Size Risk",
		CONDITIONAL_COMPLEXITY: "Conditional Complexity",
		FILE_CHANGE_HISTORY: "File Change History",
		FILE_AGE: "File Age",
		DEPENDENCIES: "Dependencies",
		DUPLICATION: "Duplication",
		TEAM: "Team",
		ANALYSIS: "Analysis",
	};

	return labels[group] ?? group.replaceAll("_", " ").toLowerCase();
}

function sortMetricGroups(left: string, right: string): number {
	const groupOrder = [
		"LINES_OF_CODE",
		"NUMBER_OF_FILES",
		"UNITS",
		"CONDITIONAL_COMPLEXITY",
		"FILE_SIZE_RISK",
		"FILE_AGE",
		"DEPENDENCIES",
		"FILE_CHANGE_HISTORY",
		"TEAM",
		"DUPLICATION",
		"ANALYSIS",
	];
	const leftIndex = groupOrder.indexOf(left);
	const rightIndex = groupOrder.indexOf(right);
	const resolvedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
	const resolvedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

	if (resolvedLeft !== resolvedRight) {
		return resolvedLeft - resolvedRight;
	}

	return left.localeCompare(right);
}

function isReportMode(
	value: unknown,
): value is "single_repository" | "landscape" {
	return value === "single_repository" || value === "landscape";
}

export function readReportContextSummary(
	dataDir: string,
): ReportContextSummary | null {
	const context = readReportContext(dataDir);
	if (!context) {
		return null;
	}

	const mode = context.mode;
	const reportMode = context.reportMode;
	const title = context.title;
	const rootRoute = context.rootRoute;
	const dataVersion = context.dataVersion;
	const source = context.source;
	const hasLandscape = context.hasLandscape;
	const hasSingleRepositoryAnalysis = context.hasSingleRepositoryAnalysis;
	const primaryNavigation = context.primaryNavigation;

	if (
		!isReportMode(mode) ||
		!isReportMode(reportMode) ||
		typeof title !== "string" ||
		typeof rootRoute !== "string" ||
		typeof dataVersion !== "number" ||
		typeof source !== "string" ||
		typeof hasLandscape !== "boolean" ||
		typeof hasSingleRepositoryAnalysis !== "boolean" ||
		!Array.isArray(primaryNavigation) ||
		!primaryNavigation.every((item) => typeof item === "string")
	) {
		return null;
	}

	return {
		mode,
		reportMode,
		title,
		rootRoute,
		dataVersion,
		source,
		hasLandscape,
		hasSingleRepositoryAnalysis,
		primaryNavigation,
	};
}

export function readReportArtifactSummary(
	dataDir: string,
	context: ReportContextSummary | null,
): ReportArtifactSummary | null {
	if (context?.reportMode === "landscape") {
		const overview = readJsonRecord(dataDir, "landscape_overview.json");
		const title = overview?.title;
		const landscapeName = overview?.landscapeName;
		const repositoryCount = overview?.repositoryCount;
		const contributorCount = overview?.contributorCount;
		const totals =
			overview?.totals && typeof overview.totals === "object"
				? (overview.totals as Record<string, unknown>)
				: null;
		const totalLinesOfCode = totals?.totalLinesOfCode;
		const commits30d = totals?.commits30d;
		const commits90d = totals?.commits90d;

		if (
			typeof title !== "string" ||
			typeof landscapeName !== "string" ||
			typeof repositoryCount !== "number" ||
			typeof contributorCount !== "number" ||
			typeof totalLinesOfCode !== "number" ||
			typeof commits30d !== "number" ||
			typeof commits90d !== "number"
		) {
			return null;
		}

		return {
			kind: "landscape",
			title,
			landscapeName,
			repositoryCount,
			contributorCount,
			totalLinesOfCode,
			commits30d,
			commits90d,
		};
	}

	const analysis = readJsonRecord(dataDir, "analysisResults.json");
	const metadata =
		analysis?.metadata && typeof analysis.metadata === "object"
			? (analysis.metadata as Record<string, unknown>)
			: null;
	const duplication =
		analysis?.duplication && typeof analysis.duplication === "object"
			? (analysis.duplication as Record<string, unknown>)
			: null;
	const projectName = metadata?.name;
	const filesCount = analysis?.filesCount;
	const linesOfCode = analysis?.linesOfCode;
	const duplicatedLines = duplication?.duplicatedLines;
	const duplicationPercentage = duplication?.percentage;

	if (
		typeof projectName !== "string" ||
		typeof filesCount !== "number" ||
		typeof linesOfCode !== "number" ||
		typeof duplicatedLines !== "number" ||
		typeof duplicationPercentage !== "number"
	) {
		return null;
	}

	return {
		kind: "single_repository",
		projectName,
		filesCount,
		linesOfCode,
		duplicatedLines,
		duplicationPercentage,
	};
}

export function readReportContributorsSummary(
	dataDir: string,
): ReadonlyArray<ReportContributorSummary> {
	const text = readTextFile(dataDir, "contributors.txt");
	if (!text) {
		return [];
	}

	const contributorDetailsByEmail = readContributorDetailsByEmail(dataDir);
	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	if (lines.length < 2) {
		return [];
	}

	return lines
		.slice(1)
		.map((line) => {
			const cols = line.split("\t");
			if (cols.length < 8) {
				return null;
			}

			const email = cols[0]?.trim() ?? "";
			if (email.length === 0) {
				return null;
			}

			const userName = cols[9]?.trim() ?? "";
			const isRookie = cols[10]?.trim() === "true";
			const isActive = cols[11]?.trim() === "true";
			const detail = contributorDetailsByEmail.get(email);
			const files = detail?.files;
			const logicalComponents = detail?.logicalComponents;
			const filesTouched = Array.isArray(files) ? files.length : null;
			const componentsTouched = Array.isArray(logicalComponents)
				? logicalComponents.length
				: null;

			return {
				email,
				userName,
				displayName: getContributorDisplayName({ email, userName }),
				status: getContributorStatus({ isRookie, isActive }),
				commitsAllTime: parseInt(cols[1] ?? "", 10) || 0,
				commits30Days: parseInt(cols[2] ?? "", 10) || 0,
				commits90Days: parseInt(cols[3] ?? "", 10) || 0,
				commits180Days: parseInt(cols[4] ?? "", 10) || 0,
				commits365Days: parseInt(cols[5] ?? "", 10) || 0,
				firstCommit: cols[6]?.trim() ?? "",
				lastCommit: cols[7]?.trim() ?? "",
				percentage: cols[8]?.trim() ?? "",
				filesTouched,
				componentsTouched,
				primaryComponent: getPrimaryComponent(detail),
				knowledgeSignal: getKnowledgeSignal(componentsTouched),
			} satisfies ReportContributorSummary;
		})
		.filter(
			(
				contributor,
			): contributor is ReportContributorSummary => contributor !== null,
		)
		.sort((left, right) => right.commitsAllTime - left.commitsAllTime);
}

export function readReportContributorDetail(
	dataDir: string,
	email: string,
): ReportContributorDetail | null {
	const contributorDetailsByEmail = readContributorDetailsByEmail(dataDir);
	const detail = contributorDetailsByEmail.get(email);
	if (!detail) {
		return null;
	}

	const summaries = readReportContributorsSummary(dataDir);
	const summaryByEmail = new Map(
		summaries.map((summary) => [summary.email, summary] as const),
	);
	const summary = summaryByEmail.get(email);
	const collaborators = Array.isArray(detail.collaborators)
		? detail.collaborators
				.filter(
					(collaborator): collaborator is Record<string, unknown> =>
						typeof collaborator === "object" && collaborator !== null,
				)
				.map((collaborator) => {
					const collaboratorEmail =
						typeof collaborator.email === "string" ? collaborator.email : "";
					const summaryMatch = summaryByEmail.get(collaboratorEmail);

					return {
						email: collaboratorEmail,
						displayName:
							summaryMatch?.displayName ?? getContributorDisplayName({
								email: collaboratorEmail,
								userName: "",
							}),
						sharedFiles:
							typeof collaborator.sharedFiles === "number"
								? collaborator.sharedFiles
								: 0,
					};
				})
		: [];
	const topCollaborator = collaborators[0] ?? null;

	return {
		email,
		userName: typeof detail.userName === "string" ? detail.userName : "",
		displayName:
			summary?.displayName ??
			getContributorDisplayName({
				email,
				userName: typeof detail.userName === "string" ? detail.userName : "",
			}),
		status:
			summary?.status ??
			getContributorStatus({
				isRookie: detail.isRookie === true,
				isActive: detail.isActive === true,
			}),
		commitsCount:
			typeof detail.commitsCount === "number" ? detail.commitsCount : 0,
		commitsCount30Days:
			typeof detail.commitsCount30Days === "number"
				? detail.commitsCount30Days
				: 0,
		commitsCount90Days:
			typeof detail.commitsCount90Days === "number"
				? detail.commitsCount90Days
				: 0,
		commitsCount180Days:
			typeof detail.commitsCount180Days === "number"
				? detail.commitsCount180Days
				: 0,
		commitsCount365Days:
			typeof detail.commitsCount365Days === "number"
				? detail.commitsCount365Days
				: 0,
		firstCommitDate:
			typeof detail.firstCommitDate === "string" ? detail.firstCommitDate : "",
		latestCommitDate:
			typeof detail.latestCommitDate === "string" ? detail.latestCommitDate : "",
		percentage: summary?.percentage ?? "",
		activeDays: Array.isArray(detail.dailyActivity) ? detail.dailyActivity.length : 0,
		filesCount: Array.isArray(detail.files) ? detail.files.length : 0,
		collaboratorsCount: collaborators.length,
		topCollaboratorEmail: topCollaborator?.email ?? null,
		topCollaboratorDisplayName: topCollaborator?.displayName ?? null,
		extensions: Array.isArray(detail.extensions)
			? detail.extensions
					.filter(
						(entry): entry is Record<string, unknown> =>
							typeof entry === "object" && entry !== null,
					)
					.map((entry) => ({
						extension: typeof entry.extension === "string" ? entry.extension : "",
						commits: typeof entry.commits === "number" ? entry.commits : 0,
						files: typeof entry.files === "number" ? entry.files : 0,
					}))
			: [],
		logicalComponents: Array.isArray(detail.logicalComponents)
			? detail.logicalComponents
					.filter(
						(entry): entry is Record<string, unknown> =>
							typeof entry === "object" && entry !== null,
					)
					.map((entry) => ({
						name: typeof entry.name === "string" ? entry.name : "",
						files: typeof entry.files === "number" ? entry.files : 0,
						linesOfCode:
							typeof entry.linesOfCode === "number" ? entry.linesOfCode : 0,
					}))
					.sort((left, right) => right.linesOfCode - left.linesOfCode)
			: [],
		collaborators: collaborators.sort(
			(left, right) => right.sharedFiles - left.sharedFiles,
		),
		topFiles: Array.isArray(detail.files)
			? detail.files
					.filter(
						(file): file is Record<string, unknown> =>
							typeof file === "object" && file !== null,
					)
					.map((file) => ({
						relativePath:
							typeof file.relativePath === "string" ? file.relativePath : "",
						extension: typeof file.extension === "string" ? file.extension : "",
						commits: typeof file.commits === "number" ? file.commits : 0,
						logicalComponents: Array.isArray(file.logicalComponents)
							? file.logicalComponents.filter(
									(item): item is string => typeof item === "string",
								)
							: [],
						concerns: Array.isArray(file.concerns)
							? file.concerns.filter((item): item is string => typeof item === "string")
							: [],
					}))
					.sort((left, right) => right.commits - left.commits)
					.slice(0, 10)
			: [],
	};
}

export function readReportTopologySummary(
	dataDir: string,
): ReportTopologySummary | null {
	const periodFiles = [
		["All Time", "people_dependencies.json"],
		["1 Year", "people_dependencies_365d.json"],
		["6 Months", "people_dependencies_180d.json"],
		["Quarter", "people_dependencies_90d.json"],
		["Month", "people_dependencies_30d.json"],
	] as const;

	const contributorNames = new Map<string, string>();
	const impact = readJsonRecord(dataDir, "contributor_impact.json");
	const periods = Array.isArray(impact?.periods) ? impact.periods : [];
	const allTimePeriod = periods.find(
		(period) =>
			typeof period === "object" &&
			period !== null &&
			(period as Record<string, unknown>).period_key === "all_time",
	) as Record<string, unknown> | undefined;
	const contributors = Array.isArray(allTimePeriod?.contributors)
		? allTimePeriod.contributors
				.filter(
					(entry): entry is Record<string, unknown> =>
						typeof entry === "object" && entry !== null,
				)
		: [];
	for (const contributor of contributors) {
		if (
			typeof contributor.email === "string" &&
			typeof contributor.display_name === "string"
		) {
			contributorNames.set(contributor.email, contributor.display_name);
		}
	}

	const strongestConnections: ReportTopologyConnection[] = [];
	for (const [periodLabel, fileName] of periodFiles) {
		const filePath = join(dataDir, fileName);
		if (!existsSync(filePath)) {
			continue;
		}

		let best: ReportTopologyConnection | undefined;
		try {
			const raw = JSON.parse(readFileSync(filePath, "utf-8")) as unknown;
			if (!Array.isArray(raw) || raw.length === 0) {
				continue;
			}

			best = raw
				.filter(
					(edge): edge is Record<string, unknown> =>
						typeof edge === "object" && edge !== null,
				)
				.map((edge) => ({
					periodLabel,
					from: typeof edge.from === "string" ? edge.from : "",
					fromDisplayName:
						typeof edge.from === "string"
							? (contributorNames.get(edge.from) ?? edge.from)
							: "",
					to: typeof edge.to === "string" ? edge.to : "",
					toDisplayName:
						typeof edge.to === "string"
							? (contributorNames.get(edge.to) ?? edge.to)
							: "",
					sharedCommits: typeof edge.count === "number" ? edge.count : 0,
					filesCount: Array.isArray(edge.files) ? edge.files.length : 0,
				}))
				.filter((edge) => edge.from.length > 0 && edge.to.length > 0)
				.sort((left, right) => right.sharedCommits - left.sharedCommits)[0];
		} catch {
			continue;
		}

		if (best) {
			strongestConnections.push(best);
		}
	}

	const topGlueContributors = contributors
		.filter((entry) => typeof entry.glue_score === "number")
		.map((entry) => ({
			email: typeof entry.email === "string" ? entry.email : "",
			displayName:
				typeof entry.display_name === "string" ? entry.display_name : "",
			glueScore: entry.glue_score as number,
			dominantDimension:
				typeof entry.dominant_dimension === "string"
					? entry.dominant_dimension
					: "",
		}))
		.filter((entry) => entry.email.length > 0)
		.sort((left, right) => right.glueScore - left.glueScore)
		.slice(0, 5);

	const topSnackingContributors = contributors
		.filter((entry) => typeof entry.snacking_score === "number")
		.map((entry) => ({
			email: typeof entry.email === "string" ? entry.email : "",
			displayName:
				typeof entry.display_name === "string" ? entry.display_name : "",
			snackingScore: entry.snacking_score as number,
			dominantDimension:
				typeof entry.dominant_dimension === "string"
					? entry.dominant_dimension
					: "",
		}))
		.filter((entry) => entry.email.length > 0)
		.sort((left, right) => right.snackingScore - left.snackingScore)
		.slice(0, 5);

	if (
		strongestConnections.length === 0 &&
		topGlueContributors.length === 0 &&
		topSnackingContributors.length === 0
	) {
		return null;
	}

	return {
		availablePeriods: strongestConnections.map((edge) => edge.periodLabel),
		strongestConnections,
		topGlueContributors,
		topSnackingContributors,
	};
}

export function readReportMetricsSummary(
	dataDir: string,
): ReportMetricsSummary | null {
	const text = readTextFile(dataDir, "metrics.txt");
	if (!text) {
		return null;
	}

	const metrics = text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const colonIdx = line.indexOf(":");
			if (colonIdx < 0) {
				return null;
			}

			const id = line.substring(0, colonIdx).trim();
			const value = parseFloat(line.substring(colonIdx + 1).trim());
			if (id.length === 0 || Number.isNaN(value)) {
				return null;
			}

			return { id, value };
		})
		.filter(
			(metric): metric is { readonly id: string; readonly value: number } =>
				metric !== null,
		);

	if (metrics.length === 0) {
		return null;
	}

	const metricById = new Map(metrics.map((metric) => [metric.id, metric.value] as const));
	const groups = new Map<string, Array<{ id: string; value: number }>>();
	for (const metric of metrics) {
		const groupId = groupMetricId(metric.id);
		const list = groups.get(groupId) ?? [];
		list.push(metric);
		groups.set(groupId, list);
	}

	return {
		totalMetrics: metrics.length,
		headlineMetrics: {
			mainLinesOfCode: metricById.get("LINES_OF_CODE_MAIN") ?? 0,
			testLinesOfCode: metricById.get("LINES_OF_CODE_TEST") ?? 0,
			duplicatedLines:
				metricById.get("DUPLICATION_NUMBER_OF_DUPLICATED_LINES") ?? 0,
			testVsMainPercentage:
				metricById.get("TEST_VS_MAIN_LINES_OF_CODE_PERCENTAGE") ?? 0,
			totalAnalysisTimeInMillis:
				metricById.get("TOTAL_ANALYSIS_TIME_IN_MILLIS") ?? 0,
		},
		groupSummaries: [...groups.entries()]
			.map(([groupId, groupMetrics]) => ({
				groupId,
				label: formatMetricGroupLabel(groupId),
				metrics: [...groupMetrics].sort((left, right) =>
					left.id.localeCompare(right.id),
				),
			}))
			.sort((left, right) => sortMetricGroups(left.groupId, right.groupId)),
	};
}

function getDatasetTitle(
	context: Record<string, unknown> | null,
	fallback: string,
): string {
	const title = context?.title;
	return typeof title === "string" && title.trim().length > 0
		? title
		: fallback;
}

function getReportMode(context: Record<string, unknown> | null): string | null {
	const reportMode = context?.reportMode;
	return typeof reportMode === "string" && reportMode.trim().length > 0
		? reportMode
		: null;
}

export function getConfiguredDatasetsRoot(): string {
	return appConfig.datasetsRoot ?? defaultDatasetsRoot;
}

export function listAvailableDatasets(): RuntimeDataset[] {
	const datasetsRoot = getConfiguredDatasetsRoot();
	if (!existsSync(datasetsRoot)) {
		return [];
	}

	return readdirSync(datasetsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => {
			const dataDir = resolveNamedDatasetDataDir(entry.name, datasetsRoot);
			if (!dataDir) {
				return null;
			}

			const context = readReportContext(dataDir);
			return {
				name: entry.name,
				dataDir,
				title: getDatasetTitle(context, entry.name),
				reportMode: getReportMode(context),
			} satisfies RuntimeDataset;
		})
		.filter((dataset): dataset is RuntimeDataset => dataset !== null)
		.sort((left, right) => left.title.localeCompare(right.title));
}

export function resolveReportDataSource(input: {
	readonly datasetName?: string | null;
	readonly analysisRoot?: string | null;
}): ResolvedReportDataSource | null {
	const datasetName = input.datasetName?.trim();
	if (datasetName) {
		const dataDir = resolveNamedDatasetDataDir(
			datasetName,
			getConfiguredDatasetsRoot(),
		);
		if (!dataDir) {
			return null;
		}

		const context = readReportContext(dataDir);
		return {
			dataDir,
			datasetName,
			title: getDatasetTitle(context, datasetName),
			reportMode: getReportMode(context),
		};
	}

	const analysisRoot = input.analysisRoot?.trim();
	if (!analysisRoot) {
		return null;
	}

	const resolvedPath = resolve(analysisRoot);
	const dataDir = resolveRecognizedDataDir(
		getFlexibleDataDirCandidates(resolvedPath),
	);
	if (!dataDir || !isRecognizedDataDir(dataDir)) {
		return null;
	}

	const context = readReportContext(dataDir);
	return {
		dataDir,
		title: getDatasetTitle(context, resolvedPath),
		reportMode: getReportMode(context),
	};
}
