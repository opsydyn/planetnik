import { treaty } from "@elysiajs/eden/treaty2";
import type { PlanetnikRuntimeApp } from "../../../runtime/src/app.js";
import { SERVER_BASE_URL } from "./constants.js";

const runtimeClient = treaty<PlanetnikRuntimeApp>(SERVER_BASE_URL);

export type RuntimeMe = {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string | null;
    readonly image: string | null;
    readonly emailVerified: boolean;
    readonly role: string | null;
  };
  readonly session: {
    readonly id: string;
    readonly userId: string;
    readonly expiresAt: string;
  };
};

export type RuntimeWorkspace = {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RuntimeReport = {
  readonly id: string;
  readonly workspaceId: string;
  readonly slug: string;
  readonly name: string;
  readonly kind: string;
  readonly status: string;
  readonly analysisRoot: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastSyncedAt: string | null;
};

export type RuntimeDataset = {
  readonly name: string;
  readonly dataDir: string;
  readonly title: string;
  readonly reportMode: string | null;
};

export type RuntimeReportContext = {
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

export type RuntimeSingleRepositoryArtifact = {
  readonly kind: "single_repository";
  readonly projectName: string;
  readonly filesCount: number;
  readonly linesOfCode: number;
  readonly duplicatedLines: number;
  readonly duplicationPercentage: number;
};

export type RuntimeLandscapeArtifact = {
  readonly kind: "landscape";
  readonly title: string;
  readonly landscapeName: string;
  readonly repositoryCount: number;
  readonly contributorCount: number;
  readonly totalLinesOfCode: number;
  readonly commits30d: number;
  readonly commits90d: number;
};

export type RuntimeReportArtifact =
  | RuntimeSingleRepositoryArtifact
  | RuntimeLandscapeArtifact;

export type RuntimeReportContributor = {
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
  readonly repositoryCount: number | null;
  readonly latestCommitDate: string;
  readonly isBot: boolean | null;
  readonly repositories: ReadonlyArray<{
    readonly name: string;
    readonly repoKey: string;
  }>;
};

export type RuntimeReportDetail = {
  readonly report: RuntimeReport;
  readonly context: RuntimeReportContext | null;
  readonly artifact: RuntimeReportArtifact | null;
};

export type RuntimeReportContributors = {
  readonly contributors: ReadonlyArray<RuntimeReportContributor>;
};

export type RuntimeReportContributorDetail = {
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

export type RuntimeTopologyPeopleDep = {
  readonly from: string;
  readonly to: string;
  readonly count: number;
  readonly files: ReadonlyArray<string>;
};

export type RuntimeTopologyContributorImpact = {
  readonly email: string;
  readonly display_name: string;
  readonly glue_score: number;
  readonly snacking_score: number;
  readonly structural_impact_score: number;
  readonly visible_activity_score: number;
  readonly collaborator_count: number;
  readonly shared_files_count: number;
  readonly commits_count: number;
  readonly files_touched: number;
  readonly components_touched: number;
  readonly dominant_dimension: string;
  readonly dimensions: Record<string, number>;
  readonly top_components: ReadonlyArray<{
    readonly name: string;
    readonly files: number;
    readonly commits: number;
  }>;
  readonly top_routes: ReadonlyArray<string>;
  readonly reasons: ReadonlyArray<string>;
  readonly is_glue: boolean;
  readonly is_snacking: boolean;
};

export type RuntimeReportTopology = {
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
  readonly periodsData: Record<string, ReadonlyArray<RuntimeTopologyPeopleDep>>;
  readonly impactPeriods: Record<string, ReadonlyArray<RuntimeTopologyContributorImpact>>;
};

export type RuntimeReportMetrics = {
  readonly totalMetrics: number;
  readonly headlineMetrics: {
    readonly mainLinesOfCode: number;
    readonly testLinesOfCode: number;
    readonly duplicatedLines: number;
    readonly testVsMainPercentage: number;
    readonly totalAnalysisTimeInMillis: number;
  };
  readonly locBreakdown: ReadonlyArray<{ readonly label: string; readonly value: number }>;
  readonly mainLocByExtension: ReadonlyArray<{ readonly label: string; readonly value: number }>;
  readonly groupSummaries: ReadonlyArray<{
    readonly groupId: string;
    readonly label: string;
    readonly metrics: ReadonlyArray<{
      readonly id: string;
      readonly value: number;
    }>;
  }>;
};

export type RuntimeReportDuplication = {
  readonly duplicationPercentage: number;
  readonly duplicatedLines: number;
  readonly duplicateBlocksCount: number;
  readonly blockSizeDistribution: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
    readonly detail: string;
  }>;
  readonly mostDuplicatedFiles: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
  }>;
  readonly largestDuplicateBlocks: ReadonlyArray<{
    readonly blockSize: number;
    readonly files: number;
    readonly locations: ReadonlyArray<string>;
  }>;
};

export type RuntimeReportDependencies = {
  readonly sections: ReadonlyArray<{
    readonly decompositionKey: string;
    readonly linksCount: number;
    readonly incoming: ReadonlyArray<{
      readonly label: string;
      readonly value: number;
    }>;
    readonly outgoing: ReadonlyArray<{
      readonly label: string;
      readonly value: number;
    }>;
    readonly links: ReadonlyArray<{
      readonly fromComponent: string;
      readonly toComponent: string;
      readonly count: number;
      readonly evidenceCount: number;
      readonly locFrom: number;
    }>;
  }>;
};

export type RuntimeReportControls = {
  readonly totalControls: number;
  readonly statusCounts: {
    readonly failed: number;
    readonly tolerant: number;
    readonly ok: number;
    readonly ignored: number;
  };
  readonly goals: ReadonlyArray<{
    readonly goal: string;
    readonly total: number;
    readonly failed: number;
    readonly tolerant: number;
    readonly ok: number;
    readonly ignored: number;
  }>;
  readonly controls: ReadonlyArray<{
    readonly id: string;
    readonly goal: string;
    readonly metricId: string;
    readonly metricValue: number | null;
    readonly desiredRangeText: string;
    readonly status: string;
    readonly description: string;
  }>;
};

export type RuntimeReportImpact = {
  readonly title: string;
  readonly timestamp: string;
  readonly visibleActivity: {
    readonly commits: number;
    readonly contributors: number;
    readonly changedFiles: number;
    readonly changedUnits: number;
  };
  readonly structuralImpact: {
    readonly overallScore: number;
    readonly dominantDimension: string;
  };
  readonly impactDimensions: ReadonlyArray<{
    readonly label: string;
    readonly score: number;
  }>;
  readonly topOpportunities: ReadonlyArray<{
    readonly name: string;
    readonly kind: string;
    readonly parent: string;
    readonly impactScore: number;
    readonly dominantDimension: string;
    readonly suggestedAction: string;
    readonly reasons: ReadonlyArray<string>;
    readonly complexityReduction: number;
    readonly boundaryShaping: number;
    readonly knowledgeSpread: number;
    readonly coordinationRelief: number;
    readonly changeEnablement: number;
  }>;
  readonly snackingCandidates: ReadonlyArray<{
    readonly name: string;
    readonly kind: string;
    readonly visibleActivityScore: number;
    readonly structuralImpactScore: number;
    readonly delta: number;
    readonly reason: string;
  }>;
  readonly conceptMappings: ReadonlyArray<{
    readonly concept: string;
    readonly dimension: string;
    readonly evidenceCount: number;
    readonly examples: ReadonlyArray<string>;
  }>;
};

export type RuntimeReportComponents = {
  readonly totalComponents: number;
  readonly singleOwnerComponents: number;
  readonly lowBackupComponents: number;
  readonly distributedComponents: number;
  readonly unassignedFiles: number;
  readonly topComponents: ReadonlyArray<{
    readonly name: string;
    readonly files: number;
    readonly linesOfCode: number;
    readonly contributors: number;
    readonly risk: string;
  }>;
  readonly inventory: ReadonlyArray<{
    readonly name: string;
    readonly files: number;
    readonly linesOfCode: number;
    readonly contributors: number | null;
    readonly risk: string;
  }>;
};

export type RuntimeReportCoupling = {
  readonly decompositionKey: string;
  readonly temporalWindowLabel: string | null;
  readonly aggregate: {
    readonly totalComponents: number;
    readonly overloadedComponents: number;
    readonly knowledgeExposedComponents: number;
    readonly averageLoad: number;
    readonly averageBalance: number;
    readonly averageRisk: number;
    readonly maxRisk: number;
    readonly topRiskComponent?: string;
  };
  readonly riskTierCounts: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
  readonly dimensionMix: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly value: number;
    readonly color: string;
  }>;
  readonly dominantBreakdown: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
    readonly detail: string;
    readonly color: string;
  }>;
  readonly topRiskComponents: ReadonlyArray<{
    readonly component: string;
    readonly systemicRisk: number;
    readonly riskTier: "Low" | "Medium" | "High" | "Critical";
    readonly dominantDimension: string;
    readonly explainability: ReadonlyArray<string>;
  }>;
  readonly inventory: ReadonlyArray<{
    readonly component: string;
    readonly systemicRisk: number;
    readonly overallLoad: number;
    readonly balanceScore: number;
    readonly riskTier: "Low" | "Medium" | "High" | "Critical";
    readonly dominantDimension: string;
    readonly files: number;
    readonly linesOfCode: number;
    readonly contributors: number;
    readonly incomingDependencies: number;
    readonly outgoingDependencies: number;
    readonly staticPartners: number;
    readonly temporalPartners: number;
    readonly contributorOverlap: number;
    readonly hotspotPressure: number;
    readonly staticCoupling: number;
    readonly temporalCoupling: number;
    readonly coordinationCoupling: number;
    readonly knowledgeRisk: number;
    readonly dominantDimensionId: string;
    readonly explainability: ReadonlyArray<string>;
  }>;
};

export type RuntimeReportHotspots = {
  readonly totalHotspots: number;
  readonly severityCounts: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
  readonly kindCounts: {
    readonly files: number;
    readonly units: number;
    readonly components: number;
  };
  readonly dominantCounts: {
    readonly structuralRisk: number;
    readonly changePressure: number;
    readonly coordinationCost: number;
    readonly knowledgeRisk: number;
  };
  readonly topHotspots: ReadonlyArray<{
    readonly name: string;
    readonly score: number;
    readonly severity: string;
    readonly kind: string;
    readonly dominantDimension: string;
    readonly suggestedAction: string;
  }>;
  readonly rows: ReadonlyArray<{
    readonly name: string;
    readonly route: string;
    readonly kind: string;
    readonly parent: string;
    readonly score: number;
    readonly severity: string;
    readonly dominantDimension: string;
    readonly size: number;
    readonly commitsCount: number;
    readonly contributorsCount: number;
    readonly temporalLinks: number;
    readonly complexity: number;
    readonly structuralRisk: number;
    readonly changePressure: number;
    readonly coordinationCost: number;
    readonly knowledgeRisk: number;
    readonly suggestedAction: string;
    readonly reasons: ReadonlyArray<string>;
  }>;
};

export type RuntimeReportCommits = {
  readonly totalCommits: number;
  readonly totalContributors: number;
  readonly activeContributors: {
    readonly days30: number;
    readonly days90: number;
    readonly days365: number;
  };
  readonly repoAgeDays: number | null;
  readonly activeDays: number | null;
  readonly rookieCount: number;
  readonly activity: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
    readonly detail: string;
  }>;
  readonly timeline: ReadonlyArray<{
    readonly timeSlot: string;
    readonly commits: number;
    readonly contributors: number;
  }>;
  readonly extensions: ReadonlyArray<{
    readonly extension: string;
    readonly commitsCount: number;
    readonly committersCount: number;
    readonly filesCount: number;
    readonly commitsCount30Days: number;
    readonly commitsCount90Days: number;
  }>;
};

export type RuntimeReportTrends = {
  readonly available: boolean;
  readonly message: string;
  readonly hint: string;
};

export type RuntimeReportSecurity = {
  readonly totalRepos: number;
  readonly reposWithAlerts: number;
  readonly totalAlerts: number;
  readonly totalOpenAlerts: number;
  readonly severityCounts: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
  readonly meanTimeToResolveDays: number | null;
  readonly supplyChainExposureScore: number;
  readonly sharedVulnerablePackages: ReadonlyArray<{
    readonly ecosystem: string;
    readonly name: string;
    readonly severity: string;
    readonly affectedRepos: ReadonlyArray<string>;
  }>;
  readonly repoHealth: ReadonlyArray<{
    readonly owner: string;
    readonly repo: string;
    readonly repoKey: string | null;
    readonly totalAlerts: number;
    readonly openAlerts: number;
    readonly fixedAlerts: number;
    readonly severityCounts: {
      readonly critical: number;
      readonly high: number;
      readonly medium: number;
      readonly low: number;
    };
    readonly meanTimeToResolveDays: number | null;
    readonly oldestOpenAlertDays: number | null;
  }>;
};

export type RuntimeReportLandscapeRepository = {
  readonly repoKey: string;
  readonly name: string;
  readonly description: string;
  readonly latestCommitDate: string;
  readonly commits30d: number;
  readonly commits90d: number;
  readonly contributorsCount: number;
  readonly filesCount: number;
  readonly linesOfCode: number;
  readonly duplicationPercentage: number | null;
  readonly links: ReadonlyArray<{
    readonly label: string;
    readonly href: string;
  }>;
  readonly contributors: ReadonlyArray<{
    readonly email: string;
    readonly displayName: string;
    readonly commitsCount: number;
    readonly commits30d: number;
    readonly commits90d: number;
    readonly firstCommitDate: string;
    readonly latestCommitDate: string;
    readonly type: "Human" | "Bot";
    readonly glueScore: string;
    readonly structuralImpact: string;
    readonly snackRisk: string;
    readonly signal: string;
  }>;
  readonly topContributors: ReadonlyArray<{
    readonly email: string;
    readonly displayName: string;
    readonly commitsCount: number;
    readonly commits30d: number;
    readonly commits90d: number;
    readonly firstCommitDate: string;
    readonly latestCommitDate: string;
    readonly type: "Human" | "Bot";
    readonly glueScore: string;
    readonly structuralImpact: string;
    readonly snackRisk: string;
    readonly signal: string;
  }>;
};

export type RuntimeReportLandscapeRepositories = {
  readonly totalRepositories: number;
  readonly active30d: number;
  readonly totalMainLoc: number;
  readonly averageMainLoc: number;
  readonly repositories: ReadonlyArray<{
    readonly repoKey: string;
    readonly name: string;
    readonly description: string;
    readonly mainLinesOfCode: number;
    readonly mainFilesCount: number;
    readonly commits30d: number;
    readonly commits90d: number;
    readonly contributorsCount: number;
    readonly contributors30d: number;
    readonly latestCommitDate: string;
    readonly tags: ReadonlyArray<string>;
  }>;
};

export type RuntimeReportLandscapeOverview = {
  readonly title: string;
  readonly landscapeName: string;
  readonly repositoryCount: number;
  readonly contributorCount: number;
  readonly teamCount: number;
  readonly tagCount: number;
  readonly totals: {
    readonly mainLinesOfCode: number;
    readonly totalLinesOfCode: number;
    readonly contributorCount30Days: number;
    readonly commits30d: number;
    readonly commits90d: number;
  };
  readonly languages: ReadonlyArray<{
    readonly extension: string;
    readonly linesOfCode: number;
    readonly repositories: number;
  }>;
  readonly topRepositories: ReadonlyArray<{
    readonly name: string;
    readonly repoKey: string;
    readonly mainLinesOfCode: number;
    readonly contributors: number;
    readonly latestCommitDate: string;
  }>;
};

export type RuntimeReportLandscapeTags = {
  readonly groupCount: number;
  readonly tagCount: number;
  readonly untaggedRepositoryCount: number;
  readonly tags: ReadonlyArray<{
    readonly id: string;
    readonly group: string;
    readonly tag: string;
    readonly repositoryCount: number;
    readonly totalMainLinesOfCode: number;
    readonly repositories: ReadonlyArray<string>;
  }>;
  readonly untaggedRepositories: ReadonlyArray<string>;
};

export type RuntimeReportLandscapeTeams = {
  readonly totalTeams: number;
  readonly totalMembers: number;
  readonly totalRepositoryTouches: number;
  readonly teams: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly commitsCount: number;
    readonly commits30d: number;
    readonly memberCount: number;
    readonly repositoryCount: number;
    readonly latestCommitDate: string;
    readonly members: ReadonlyArray<string>;
    readonly repositories: ReadonlyArray<string>;
  }>;
};

export type RuntimeReportFileInventoryRow = {
  readonly relativePath: string;
  readonly extension: string;
  readonly linesOfCode: number;
  readonly commitsCount: number | null;
  readonly contributorsCount: number | null;
  readonly firstDate: string | null;
  readonly latestDate: string | null;
};

export type RuntimeReportFilesSizeView = {
  readonly view: "size";
  readonly headline: {
    readonly fileCount: number;
    readonly totalLinesOfCode: number;
  };
  readonly sizeDistribution: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
    readonly detail: string;
  }>;
  readonly largestFiles: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
  }>;
  readonly rows: ReadonlyArray<RuntimeReportFileInventoryRow>;
};

export type RuntimeReportFilesAgeView = {
  readonly view: "age";
  readonly headline: {
    readonly ageInDays: number | null;
    readonly activeDays: number | null;
    readonly weeks: number | null;
  };
  readonly categories: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
  }>;
};

export type RuntimeReportFilesChurnView = {
  readonly view: "churn";
  readonly headline: {
    readonly activeDays: number | null;
    readonly weeks: number | null;
    readonly estimatedWorkingDays: number | null;
    readonly filesWithHistoryCount: number;
  };
  readonly mostChangedFiles: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
  }>;
  readonly rows: ReadonlyArray<RuntimeReportFileInventoryRow>;
};

export type RuntimeReportFilesTemporalView = {
  readonly view: "temporal";
  readonly sections: ReadonlyArray<{
    readonly periodKey: string;
    readonly periodLabel: string;
    readonly periodDays: number;
    readonly dependencies: ReadonlyArray<{
      readonly file1: string;
      readonly file2: string;
      readonly sameCommits: number;
      readonly commitsFile1: number;
      readonly commitsFile2: number;
      readonly latestCommit: string;
    }>;
  }>;
};

export type RuntimeReportFilesView =
  | RuntimeReportFilesSizeView
  | RuntimeReportFilesAgeView
  | RuntimeReportFilesChurnView
  | RuntimeReportFilesTemporalView;

export type RuntimeReportUnitInventoryRow = {
  readonly shortName: string;
  readonly relativeFileName: string;
  readonly linesOfCode: number;
  readonly mcCabeIndex: number;
  readonly numberOfParameters: number;
  readonly startLine: number;
  readonly endLine: number;
};

export type RuntimeReportUnitsSizeView = {
  readonly view: "size";
  readonly headline: {
    readonly unitCount: number;
    readonly totalLinesOfCode: number;
  };
  readonly sizeRisk: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
  }>;
  readonly sizeDistribution: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
    readonly detail: string;
  }>;
  readonly rows: ReadonlyArray<RuntimeReportUnitInventoryRow>;
};

export type RuntimeReportUnitsComplexityView = {
  readonly view: "complexity";
  readonly headline: {
    readonly unitCount: number;
  };
  readonly complexityRisk: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
  }>;
  readonly complexityDistribution: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
    readonly detail: string;
  }>;
  readonly rows: ReadonlyArray<RuntimeReportUnitInventoryRow>;
};

export type RuntimeReportUnitsView =
  | RuntimeReportUnitsSizeView
  | RuntimeReportUnitsComplexityView;

export type CreateRuntimeReportInput = {
  readonly name?: string;
  readonly datasetName?: string;
  readonly analysisRoot?: string;
};

type RuntimeHeaders = {
  readonly headers: {
    readonly cookie: string;
  };
};

function withRuntimeCookie(cookie: string): RuntimeHeaders {
  return {
    headers: {
      cookie,
    },
  };
}

function isTransportResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function encodeRuntimePathParam(value: string): string {
  return encodeURIComponent(value);
}

export async function getRuntimeMe(cookie: string): Promise<RuntimeMe | null> {
  const { data } = await runtimeClient.api.me.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data;
}

export async function getRuntimeWorkspaces(cookie: string): Promise<ReadonlyArray<RuntimeWorkspace>> {
  const { data } = await runtimeClient.api.workspaces.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return [];
  }

  return data.workspaces;
}

export async function getRuntimeReports(cookie: string): Promise<ReadonlyArray<RuntimeReport>> {
  const { data } = await runtimeClient.api.reports.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return [];
  }

  return data.reports;
}

export async function getRuntimeDatasets(): Promise<ReadonlyArray<RuntimeDataset>> {
  const { data } = await runtimeClient.api.datasets.get();
  if (!data || isTransportResponse(data)) {
    return [];
  }

  return data.datasets;
}

export async function getRuntimeReport(
  cookie: string,
  slug: string,
): Promise<RuntimeReportDetail | null> {
  const { data } = await runtimeClient.api.reports({ slug }).get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data;
}

export async function createRuntimeReport(
  cookie: string,
  input: CreateRuntimeReportInput,
): Promise<RuntimeReport | null> {
  const { data } = await runtimeClient.api.reports.post(
    input,
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.report;
}

export async function getRuntimeReportContributors(
  cookie: string,
  slug: string,
): Promise<ReadonlyArray<RuntimeReportContributor>> {
  const { data } = await runtimeClient.api.reports({ slug }).contributors.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return [];
  }

  return data.contributors;
}

export async function getRuntimeReportContributorDetail(
  cookie: string,
  slug: string,
  email: string,
): Promise<RuntimeReportContributorDetail | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .contributors({ email })
    .get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.contributor;
}

export async function getRuntimeReportTopology(
  cookie: string,
  slug: string,
): Promise<RuntimeReportTopology | null> {
  const { data } = await runtimeClient.api.reports({ slug }).topology.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.topology;
}

export async function getRuntimeReportMetrics(
  cookie: string,
  slug: string,
): Promise<RuntimeReportMetrics | null> {
  const { data } = await runtimeClient.api.reports({ slug }).metrics.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.metrics;
}

export async function getRuntimeReportDuplication(
  cookie: string,
  slug: string,
): Promise<RuntimeReportDuplication | null> {
  const { data } = await runtimeClient.api.reports({ slug }).duplication.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.duplication;
}

export async function getRuntimeReportDependencies(
  cookie: string,
  slug: string,
): Promise<RuntimeReportDependencies | null> {
  const { data } = await runtimeClient.api.reports({ slug }).dependencies.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.dependencies;
}

export async function getRuntimeReportControls(
  cookie: string,
  slug: string,
): Promise<RuntimeReportControls | null> {
  const { data } = await runtimeClient.api.reports({ slug }).controls.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.controls;
}

export async function getRuntimeReportImpact(
  cookie: string,
  slug: string,
): Promise<RuntimeReportImpact | null> {
  const { data } = await runtimeClient.api.reports({ slug }).impact.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.impact;
}

export async function getRuntimeReportHotspots(
  cookie: string,
  slug: string,
): Promise<RuntimeReportHotspots | null> {
  const { data } = await runtimeClient.api.reports({ slug }).hotspots.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.hotspots;
}

export async function getRuntimeReportCommits(
  cookie: string,
  slug: string,
): Promise<RuntimeReportCommits | null> {
  const { data } = await runtimeClient.api.reports({ slug }).commits.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.commits;
}

export async function getRuntimeReportTrends(
  cookie: string,
  slug: string,
): Promise<RuntimeReportTrends | null> {
  const { data } = await runtimeClient.api.reports({ slug }).trends.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.trends;
}

export async function getRuntimeReportSecurity(
  cookie: string,
  slug: string,
): Promise<RuntimeReportSecurity | null> {
  const { data } = await runtimeClient.api.reports({ slug }).security.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.security;
}

export async function getRuntimeReportLandscapeRepository(
  cookie: string,
  slug: string,
  repo: string,
): Promise<RuntimeReportLandscapeRepository | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.repository;
}

export async function getRuntimeReportLandscapeRepositories(
  cookie: string,
  slug: string,
): Promise<RuntimeReportLandscapeRepositories | null> {
  const { data } = await runtimeClient.api.reports({ slug }).repositories.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.repositories;
}

export async function getRuntimeReportLandscapeOverview(
  cookie: string,
  slug: string,
): Promise<RuntimeReportLandscapeOverview | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    ["landscape-overview"].get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.overview;
}

export async function getRuntimeReportLandscapeTags(
  cookie: string,
  slug: string,
): Promise<RuntimeReportLandscapeTags | null> {
  const { data } = await runtimeClient.api.reports({ slug }).tags.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.tags;
}

export async function getRuntimeReportLandscapeTeams(
  cookie: string,
  slug: string,
): Promise<RuntimeReportLandscapeTeams | null> {
  const { data } = await runtimeClient.api.reports({ slug }).teams.get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.teams;
}

export async function getRuntimeReportLandscapeRepositoryMetrics(
  cookie: string,
  slug: string,
  repo: string,
): Promise<RuntimeReportMetrics | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .metrics.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.metrics;
}

export async function getRuntimeReportLandscapeRepositoryCommits(
  cookie: string,
  slug: string,
  repo: string,
): Promise<RuntimeReportCommits | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .commits.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.commits;
}

export async function getRuntimeReportLandscapeRepositoryDependencies(
  cookie: string,
  slug: string,
  repo: string,
): Promise<RuntimeReportDependencies | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .dependencies.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.dependencies;
}

export async function getRuntimeReportLandscapeRepositoryDuplication(
  cookie: string,
  slug: string,
  repo: string,
): Promise<RuntimeReportDuplication | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .duplication.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.duplication;
}

export async function getRuntimeReportLandscapeRepositoryFilesView(
  cookie: string,
  slug: string,
  repo: string,
  view: "size" | "age" | "churn" | "temporal",
): Promise<RuntimeReportFilesView | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .files({ view })
    .get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.files;
}

export async function getRuntimeReportLandscapeRepositoryUnitsView(
  cookie: string,
  slug: string,
  repo: string,
  view: "size" | "complexity",
): Promise<RuntimeReportUnitsView | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .units({ view })
    .get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.units;
}

export async function getRuntimeReportLandscapeRepositoryContributors(
  cookie: string,
  slug: string,
  repo: string,
): Promise<ReadonlyArray<RuntimeReportContributor>> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .contributors.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return [];
  }

  return data.contributors;
}

export async function getRuntimeReportLandscapeRepositoryContributorDetail(
  cookie: string,
  slug: string,
  repo: string,
  email: string,
): Promise<RuntimeReportContributorDetail | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .contributors({ email: encodeRuntimePathParam(email) })
    .get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.contributor;
}

export async function getRuntimeReportLandscapeRepositoryTopology(
  cookie: string,
  slug: string,
  repo: string,
): Promise<RuntimeReportTopology | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .topology.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.topology;
}

export async function getRuntimeReportLandscapeRepositoryImpact(
  cookie: string,
  slug: string,
  repo: string,
): Promise<RuntimeReportImpact | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .impact.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.impact;
}

export async function getRuntimeReportLandscapeRepositoryHotspots(
  cookie: string,
  slug: string,
  repo: string,
): Promise<RuntimeReportHotspots | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .hotspots.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.hotspots;
}

export async function getRuntimeReportLandscapeRepositoryControls(
  cookie: string,
  slug: string,
  repo: string,
): Promise<RuntimeReportControls | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .controls.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.controls;
}

export async function getRuntimeReportLandscapeRepositoryComponents(
  cookie: string,
  slug: string,
  repo: string,
): Promise<RuntimeReportComponents | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .components.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.components;
}

export async function getRuntimeReportLandscapeRepositoryCoupling(
  cookie: string,
  slug: string,
  repo: string,
): Promise<RuntimeReportCoupling | null> {
  const { data } = await runtimeClient.api
    .reports({ slug })
    .repositories({ repo: encodeRuntimePathParam(repo) })
    .coupling.get(withRuntimeCookie(cookie));
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.coupling;
}

export async function getRuntimeReportFilesView(
  cookie: string,
  slug: string,
  view: "size" | "age" | "churn" | "temporal",
): Promise<RuntimeReportFilesView | null> {
  const { data } = await runtimeClient.api.reports({ slug }).files({ view }).get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.files;
}

export async function getRuntimeReportUnitsView(
  cookie: string,
  slug: string,
  view: "size" | "complexity",
): Promise<RuntimeReportUnitsView | null> {
  const { data } = await runtimeClient.api.reports({ slug }).units({ view }).get(
    withRuntimeCookie(cookie),
  );
  if (!data || isTransportResponse(data)) {
    return null;
  }

  return data.units;
}
