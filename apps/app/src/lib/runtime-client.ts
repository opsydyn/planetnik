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
  readonly groupSummaries: ReadonlyArray<{
    readonly groupId: string;
    readonly label: string;
    readonly metrics: ReadonlyArray<{
      readonly id: string;
      readonly value: number;
    }>;
  }>;
};

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
