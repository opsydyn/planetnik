import { describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

process.env.NODE_ENV ??= "test"
process.env.PORT ??= "1337"
process.env.CORS_ORIGIN ??= "http://localhost:4321"
process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/planetnik?sslmode=disable"
process.env.BETTER_AUTH_SECRET ??= "test-secret-with-at-least-32-characters"
process.env.BETTER_AUTH_URL ??= "http://localhost:1337"

const {
  readReportArtifactSummary,
  readReportComponentsSummary,
  readReportContextSummary,
  readReportContributorDetail,
  readReportContributorsSummary,
  readReportControlsSummary,
  readReportCouplingSummary,
  readReportDependenciesSummary,
  readReportDuplicationSummary,
  readReportFilesView,
  readReportHotspotsSummary,
  readReportImpactSummary,
  readReportLandscapeContributorsSummary,
  readReportLandscapeOverviewSummary,
  readReportLandscapeRepositoriesSummary,
  readReportLandscapeRepositoryComponentsSummary,
  readReportLandscapeRepositoryContributorDetail,
  readReportLandscapeRepositoryContributorsSummary,
  readReportLandscapeRepositoryControlsSummary,
  readReportLandscapeRepositoryCouplingSummary,
  readReportLandscapeRepositoryCommitsSummary,
  readReportLandscapeRepositoryDependenciesSummary,
  readReportLandscapeRepositoryDuplicationSummary,
  readReportLandscapeRepositoryFilesView,
  readReportLandscapeRepositoryHotspotsSummary,
  readReportLandscapeRepositoryImpactSummary,
  readReportLandscapeRepositoryMetricsSummary,
  readReportLandscapeRepositorySummary,
  readReportLandscapeRepositoryTopologySummary,
  readReportLandscapeRepositoryUnitsView,
  readReportLandscapeTagsSummary,
  readReportLandscapeTeamsSummary,
  readReportLandscapeTopologySummary,
  readReportMetricsSummary,
  readReportCommitsSummary,
  readReportSecuritySummary,
  readReportTopologySummary,
  readReportUnitsView,
} = await import("../report-datasets.js")

const SNAPSHOT_ID = "8d2d9f6f-2246-4c4d-a89a-4ca3cbbce4c3"
const GENERATED_AT = "2026-08-05T10:00:00.000Z"
const CONTRIBUTOR_EMAIL = "alan@example.com"
const REPOSITORY_KEY = "acme__web-app"

const ENTITY_ID_POLICY = {
  repository: "repo:<normalised repository key>",
  file: "file:<normalised relative path>",
  unit: "unit:<normalised relative path>:<start line>",
  component: "component:<decomposition key>:<component name>",
  contributor: "contributor:<lowercase trimmed email>",
}

const CONTRIBUTOR = {
  id: "contributor:alan@example.com",
  email: CONTRIBUTOR_EMAIL,
  userName: "Alan Currie",
  commitsCount: 42,
  commitsCount30Days: 8,
  commitsCount90Days: 16,
  commitsCount180Days: 24,
  commitsCount365Days: 32,
  firstCommitDate: "2024-01-03",
  latestCommitDate: "2026-03-31",
  percentage: "100%",
  isRookie: false,
  isActive: true,
  isBot: false,
}

const CONTRIBUTOR_IMPACT = {
  email: CONTRIBUTOR_EMAIL,
  display_name: "Alan Currie",
  glue_score: 8.8,
  snacking_score: 2.1,
  structural_impact_score: 7.2,
  visible_activity_score: 6.4,
  dominant_dimension: "coordination_relief",
  collaborator_count: 1,
  shared_files_count: 2,
  commits_count: 42,
  files_touched: 1,
  components_touched: 1,
  dimensions: { coordination_relief: 7.2 },
  top_components: [{ name: "runtime", files: 1, commits: 42 }],
  top_routes: ["/api/reports/:slug"],
  reasons: ["Coordinates the runtime boundary"],
  is_glue: true,
  is_snacking: false,
}

const ANALYSIS_RESULTS = {
  metadata: { name: "Snapshot Repo", description: "JSON-only compatibility fixture" },
  filesCount: 1,
  linesOfCode: 320,
  duplication: { percentage: 1.8, duplicatedLines: 24 },
}

const METRICS = {
  metrics: [
    { id: "LINES_OF_CODE_MAIN", value: 320 },
    { id: "LINES_OF_CODE_TEST", value: 80 },
    { id: "DUPLICATION_NUMBER_OF_DUPLICATED_LINES", value: 24 },
    { id: "TEST_VS_MAIN_LINES_OF_CODE_PERCENTAGE", value: 25 },
    { id: "TOTAL_ANALYSIS_TIME_IN_MILLIS", value: 1200 },
    { id: "FILE_CHANGE_HISTORY_TOTAL_AGE_DAYS", value: 500 },
    { id: "FILE_CHANGE_HISTORY_ACTIVE_DAYS", value: 30 },
    { id: "FILE_CHANGE_HISTORY_WEEKS", value: 12 },
    { id: "FILE_CHANGE_HISTORY_ESTIMATED_WORKING_DAYS", value: 20 },
    { id: "FILE_AGE_LOW_RISK_COUNT", value: 1 },
  ],
}

const FILES_MAIN = {
  files: [
    {
      id: "file:src/index.ts",
      relativePath: "src/index.ts",
      extension: "ts",
      linesOfCode: 320,
      components: ["runtime"],
      concerns: ["api"],
      commitsCount: 18,
      contributorsCount: 1,
      firstDate: "2024-01-03",
      latestDate: "2026-03-31",
      contributors: [CONTRIBUTOR_EMAIL],
    },
  ],
}

const UNITS = {
  units: [
    {
      id: "unit:src/index.ts:1",
      shortName: "main",
      relativeFileName: "src/index.ts",
      linesOfCode: 24,
      mcCabeIndex: 6,
      numberOfParameters: 1,
      startLine: 1,
      endLine: 24,
    },
  ],
}

const DUPLICATES = {
  duplicates: [
    {
      blockSize: 12,
      duplicatedFileBlocks: [{ file: { relativePath: "src/index.ts" }, startLine: 1, endLine: 12 }],
    },
  ],
}

const COMPONENT_DEPENDENCIES = {
  dependencies: [
    {
      decompositionKey: "primary",
      fromComponent: "runtime",
      toComponent: "reports",
      count: 5,
      locFrom: 320,
      evidenceCount: 1,
    },
  ],
}

const TEMPORAL_DEPENDENCIES = {
  dependencies: [
    {
      periodKey: "quarter",
      periodLabel: "Quarter",
      periodDays: 90,
      file1: "src/index.ts",
      file2: "src/other.ts",
      sameCommits: 4,
    },
  ],
}

const HOTSPOTS = {
  componentHotspots: [
    {
      id: "component:primary:runtime",
      kind: "component",
      name: "runtime",
      parent: "primary",
      score: 8.2,
      severity: "High",
      dominantDimension: "coordinationCost",
      size: 320,
      commitsCount: 18,
      contributorsCount: 1,
      complexity: 6,
      temporalLinks: 2,
      dimensions: {
        structuralRisk: 7.8,
        changePressure: 6.2,
        coordinationCost: 8.1,
        knowledgeRisk: 9.4,
      },
      suggestedAction: "Add a second owner",
      reasons: ["Single-owner knowledge exposure"],
    },
  ],
}

const CONTROLS = {
  goals: [
    {
      goal: "Maintainability",
      controls: [
        {
          metricId: "LINES_OF_CODE_MAIN",
          metricValue: 320,
          metricDescription: "Main LOC",
          desiredRangeText: "< 500",
          status: "OK",
          controlDescription: "Keep main LOC manageable",
        },
      ],
    },
  ],
}

const IMPACT = {
  title: "Impact Report",
  timestamp: GENERATED_AT,
  visible_activity: { commits: 42, contributors: 1, changed_files: 1, changed_units: 1 },
  structural_impact: {
    summary: { overall_score: 7.4, dominant_dimension: "coordination_relief" },
  },
  impact_dimensions: [{ label: "Coordination relief", score: 7.4 }],
  impact_opportunities: [
    {
      name: "Runtime boundary",
      kind: "component",
      parent: "runtime",
      impact_score: 8.8,
      dominant_dimension: "coordination_relief",
      suggested_action: "Stabilise the boundary",
    },
  ],
}

const CONTRIBUTOR_DETAIL = {
  email: CONTRIBUTOR_EMAIL,
  userName: "Alan Currie",
  commitsCount: 42,
  commitsCount30Days: 8,
  commitsCount90Days: 16,
  commitsCount180Days: 24,
  commitsCount365Days: 32,
  firstCommitDate: "2024-01-03",
  latestCommitDate: "2026-03-31",
  percentage: "100%",
  isRookie: false,
  isActive: true,
  dailyActivity: [{ date: "2026-03-31", commits: 2 }],
  files: [
    {
      relativePath: "src/index.ts",
      extension: "ts",
      commits: 12,
      logicalComponents: ["runtime"],
      concerns: ["api"],
    },
  ],
  extensions: [{ extension: "ts", commits: 42, files: 1 }],
  logicalComponents: [{ name: "runtime", files: 1, linesOfCode: 320 }],
  collaborators: [{ email: "sam@example.com", sharedFiles: 2 }],
}

const PEOPLE_DEPENDENCIES = [{ from: CONTRIBUTOR_EMAIL, to: "sam@example.com", count: 4, files: ["src/index.ts"] }]

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2))
}

function findTextProjections(directory: string): string[] {
  const projections: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      projections.push(...findTextProjections(path))
    } else if (entry.name.endsWith(".txt")) {
      projections.push(path)
    }
  }
  return projections
}

function writeRepositoryShards(dataDir: string): void {
  mkdirSync(join(dataDir, "contributor_details"), { recursive: true })
  const jsonShards: Record<string, unknown> = {
    "analysisResults.json": ANALYSIS_RESULTS,
    "files_main.json": FILES_MAIN,
    "files_test.json": { files: [] },
    "metrics.json": METRICS,
    "controls.json": CONTROLS,
    "findings.json": { items: [{ id: "finding-1", summary: "A finding", bodyText: "Evidence" }] },
    "hotspots.json": HOTSPOTS,
    "impact.json": IMPACT,
    "contributor_impact.json": { periods: [{ period_key: "all_time", contributors: [CONTRIBUTOR_IMPACT] }] },
    "contributors.json": { contributors: [CONTRIBUTOR] },
    "duplicates.json": DUPLICATES,
    "unit_duplicates.json": { duplicates: [] },
    "units.json": UNITS,
    "dependencies.json": { links: [] },
    "component_dependencies.json": COMPONENT_DEPENDENCIES,
    "temporal_dependencies.json": TEMPORAL_DEPENDENCIES,
    "people_dependencies.json": PEOPLE_DEPENDENCIES,
    "people_dependencies_30d.json": PEOPLE_DEPENDENCIES,
    "people_dependencies_90d.json": PEOPLE_DEPENDENCIES,
    "people_dependencies_180d.json": PEOPLE_DEPENDENCIES,
    "people_dependencies_365d.json": PEOPLE_DEPENDENCIES,
    "commits_per_extension.json": [
      {
        extension: "ts",
        commitsCount: 42,
        committersCount: 1,
        filesCount: 1,
        commitsCount30Days: 8,
        commitsCount90Days: 16,
      },
    ],
    "contributor_timeline.json": {
      perYear: [{ timeSlot: "2026", commits: 42, contributors: 1 }],
      perMonth: [{ timeSlot: "2026-03", commits: 8, contributors: 1 }],
    },
  }

  for (const [fileName, value] of Object.entries(jsonShards)) {
    writeJson(join(dataDir, fileName), value)
  }

  writeJson(join(dataDir, "contributor_details", `${encodeURIComponent(CONTRIBUTOR_EMAIL)}.json`), CONTRIBUTOR_DETAIL)
}

function writeSingleRepositoryFixture(dataDir: string): void {
  mkdirSync(dataDir, { recursive: true })
  writeRepositoryShards(dataDir)

  const canonicalShards = {
    summary: "analysisResults.json",
    filesMain: "files_main.json",
    filesTest: "files_test.json",
    metrics: "metrics.json",
    controls: "controls.json",
    findings: "findings.json",
    hotspots: "hotspots.json",
    impact: "impact.json",
    contributorImpact: "contributor_impact.json",
    contributors: "contributors.json",
    duplicates: "duplicates.json",
    unitDuplicates: "unit_duplicates.json",
    units: "units.json",
    dependencies: "dependencies.json",
    componentDependencies: "component_dependencies.json",
    temporalDependencies: "temporal_dependencies.json",
    peopleDependencies: "people_dependencies.json",
    peopleDependencies30d: "people_dependencies_30d.json",
    peopleDependencies90d: "people_dependencies_90d.json",
    peopleDependencies180d: "people_dependencies_180d.json",
    peopleDependencies365d: "people_dependencies_365d.json",
    commitsPerExtension: "commits_per_extension.json",
    contributorTimeline: "contributor_timeline.json",
  }

  writeJson(join(dataDir, "report_context.json"), {
    mode: "single_repository",
    reportMode: "single_repository",
    title: "Snapshot Repo",
    rootRoute: "/",
    dataVersion: 2,
    source: "generateReports",
    hasLandscape: false,
    hasSingleRepositoryAnalysis: true,
    primaryNavigation: ["overview", "files", "units", "contributors"],
    repositoryId: "repo:snapshot-repo",
    snapshotId: SNAPSHOT_ID,
    generatedAt: GENERATED_AT,
    capabilities: Object.keys(canonicalShards),
    canonicalShards,
    compatibilityProjections: {},
    entityIdPolicy: ENTITY_ID_POLICY,
  })
}

function writeLandscapeFixture(root: string): { dataDir: string; repoDataDir: string } {
  const dataDir = join(root, "data")
  const repoDataDir = join(root, REPOSITORY_KEY, "data")
  mkdirSync(dataDir, { recursive: true })
  writeRepositoryShards(repoDataDir)

  writeJson(join(dataDir, "landscape_overview.json"), {
    title: "Acme Landscape",
    landscapeName: "Acme",
    repositoryCount: 1,
    contributorCount: 1,
    totals: {
      mainLinesOfCode: 320,
      totalLinesOfCode: 320,
      contributorCount30Days: 1,
      commits30d: 8,
      commits90d: 16,
    },
    languages: [{ extension: "ts", linesOfCode: 320, repositories: 1 }],
    topRepositories: [{ name: "Acme Web", repoKey: REPOSITORY_KEY, mainLinesOfCode: 320 }],
  })
  writeJson(join(dataDir, "landscape_repositories.json"), {
    repositories: [
      {
        id: "repo:acme__web-app",
        name: "Acme Web",
        repoKey: REPOSITORY_KEY,
        description: "The web repository",
        mainLinesOfCode: 320,
        mainFilesCount: 1,
        commits30d: 8,
        commits90d: 16,
        contributorsCount: 1,
        contributors30d: 1,
        latestCommitDate: "2026-03-31",
        tags: [{ name: "web" }],
      },
    ],
  })
  writeJson(join(dataDir, "landscape_contributors.json"), {
    contributors: [
      {
        id: "contributor:alan@example.com",
        email: CONTRIBUTOR_EMAIL,
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
        repositoryCount: 1,
        repositories: [{ name: "Acme Web", repoKey: REPOSITORY_KEY }],
      },
    ],
  })
  writeJson(join(dataDir, "landscape_teams.json"), {
    teamCount: 1,
    teams: [{ id: "team-acme", name: "Acme Team", members: [CONTRIBUTOR_EMAIL], repositories: [{ name: "Acme Web" }] }],
  })
  writeJson(join(dataDir, "landscape_topology.json"), {
    periods: [
      {
        periodLabel: "All Time",
        strongestConnections: [
          { from: CONTRIBUTOR_EMAIL, to: "sam@example.com", sharedFilesCount: 1, sharedFiles: ["src/index.ts"] },
        ],
        contributors: [
          { email: CONTRIBUTOR_EMAIL, displayName: "Alan Currie", connectionCount: 1, sharedFilesCount: 1 },
        ],
      },
    ],
  })
  writeJson(join(dataDir, "landscape_tags.json"), {
    groupCount: 1,
    tagCount: 1,
    untaggedRepositoryCount: 0,
    groups: [
      {
        name: "Product",
        tags: [
          {
            key: "web",
            name: "Web",
            repositoryCount: 1,
            totalMainLinesOfCode: 320,
            repositories: [{ name: "Acme Web" }],
          },
        ],
      },
    ],
  })
  writeJson(join(dataDir, "landscape_tag_matrix.json"), { repositories: [{ name: "Acme Web", isUntagged: false }] })
  writeJson(join(dataDir, "landscape_dependency_health.json"), {
    totalRepos: 1,
    reposWithAlerts: 1,
    totalAlerts: 1,
    totalOpenAlerts: 1,
    severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
    meanTimeToResolveDays: null,
    supplyChainExposureScore: 2,
    repoHealth: [
      {
        owner: "acme",
        repo: "Acme Web",
        totalAlerts: 1,
        openAlerts: 1,
        fixedAlerts: 0,
        severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
      },
    ],
    sharedVulnerablePackages: [],
  })
  writeJson(join(dataDir, "landscape_dependency_alerts.json"), { "Acme Web": [{ severity: "high" }] })

  const canonicalShards = {
    analysis: "landscape_overview.json",
    overview: "landscape_overview.json",
    repositories: "landscape_repositories.json",
    contributors: "landscape_contributors.json",
    teams: "landscape_teams.json",
    topology: "landscape_topology.json",
    tags: "landscape_tags.json",
    tagMatrix: "landscape_tag_matrix.json",
    dependencyHealth: "landscape_dependency_health.json",
    dependencyAlerts: "landscape_dependency_alerts.json",
  }
  writeJson(join(dataDir, "report_context.json"), {
    mode: "landscape",
    reportMode: "landscape",
    title: "Acme Landscape",
    rootRoute: "/landscape",
    dataVersion: 2,
    source: "analyzeLandscape",
    hasLandscape: true,
    hasSingleRepositoryAnalysis: false,
    primaryNavigation: ["overview", "repositories", "contributors", "teams", "topology", "tags", "security"],
    snapshotId: SNAPSHOT_ID,
    generatedAt: GENERATED_AT,
    capabilities: Object.keys(canonicalShards),
    canonicalShards,
    compatibilityProjections: {},
    entityIdPolicy: ENTITY_ID_POLICY,
  })

  return { dataDir, repoDataDir }
}

function expectRouteMatrix(rows: ReadonlyArray<readonly [route: string, read: () => unknown]>): void {
  for (const [route, read] of rows) {
    const result = read()
    if (result === null || result === undefined) {
      throw new Error(`${route} returned no canonical data`)
    }
  }
}

describe("compatibility projection removal fixture", () => {
  test("keeps every single-repository hosted reader functional without compatibility projections", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-compatibility-matrix-"))
    const dataDir = join(root, "reports", "data")
    writeSingleRepositoryFixture(dataDir)

    try {
      expect(findTextProjections(dataDir)).toEqual([])
      expect(existsSync(join(dataDir, "metrics.txt"))).toBe(false)
      expect(existsSync(join(dataDir, "contributors.txt"))).toBe(false)

      const context = readReportContextSummary(dataDir)
      expect(context).not.toBeNull()
      expectRouteMatrix([
        ["/", () => readReportArtifactSummary(dataDir, context)],
        ["/contributors", () => readReportContributorsSummary(dataDir)],
        ["/contributors/:email", () => readReportContributorDetail(dataDir, CONTRIBUTOR_EMAIL)],
        ["/topology", () => readReportTopologySummary(dataDir)],
        ["/metrics", () => readReportMetricsSummary(dataDir)],
        ["/duplication", () => readReportDuplicationSummary(dataDir)],
        ["/dependencies", () => readReportDependenciesSummary(dataDir)],
        ["/controls", () => readReportControlsSummary(dataDir)],
        ["/impact", () => readReportImpactSummary(dataDir)],
        ["/hotspots", () => readReportHotspotsSummary(dataDir)],
        ["/commits", () => readReportCommitsSummary(dataDir)],
        ["/files/size", () => readReportFilesView(dataDir, "size")],
        ["/files/age", () => readReportFilesView(dataDir, "age")],
        ["/files/churn", () => readReportFilesView(dataDir, "churn")],
        ["/files/temporal", () => readReportFilesView(dataDir, "temporal")],
        ["/units/size", () => readReportUnitsView(dataDir, "size")],
        ["/units/complexity", () => readReportUnitsView(dataDir, "complexity")],
        ["/components", () => readReportComponentsSummary(dataDir)],
        ["/coupling", () => readReportCouplingSummary(dataDir)],
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("keeps every landscape root and repository reader functional without compatibility projections", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-landscape-compatibility-matrix-"))
    const { dataDir, repoDataDir } = writeLandscapeFixture(root)

    try {
      expect(findTextProjections(root)).toEqual([])
      expect(existsSync(join(dataDir, "contributors.txt"))).toBe(false)
      expect(existsSync(join(repoDataDir, "metrics.txt"))).toBe(false)
      expect(existsSync(join(repoDataDir, "contributors.txt"))).toBe(false)

      expectRouteMatrix([
        ["/landscape", () => readReportArtifactSummary(dataDir, readReportContextSummary(dataDir))],
        ["/landscape/overview", () => readReportLandscapeOverviewSummary(dataDir)],
        ["/landscape/repositories", () => readReportLandscapeRepositoriesSummary(dataDir)],
        ["/landscape/contributors", () => readReportLandscapeContributorsSummary(dataDir)],
        ["/landscape/teams", () => readReportLandscapeTeamsSummary(dataDir)],
        ["/landscape/topology", () => readReportLandscapeTopologySummary(dataDir)],
        ["/landscape/tags", () => readReportLandscapeTagsSummary(dataDir)],
        ["/landscape/security", () => readReportSecuritySummary(dataDir)],
        ["/landscape/repositories/:repo", () => readReportLandscapeRepositorySummary(dataDir, REPOSITORY_KEY)],
        [
          "/landscape/repositories/:repo/metrics",
          () => readReportLandscapeRepositoryMetricsSummary(dataDir, REPOSITORY_KEY),
        ],
        [
          "/landscape/repositories/:repo/commits",
          () => readReportLandscapeRepositoryCommitsSummary(dataDir, REPOSITORY_KEY),
        ],
        [
          "/landscape/repositories/:repo/dependencies",
          () => readReportLandscapeRepositoryDependenciesSummary(dataDir, REPOSITORY_KEY),
        ],
        [
          "/landscape/repositories/:repo/duplication",
          () => readReportLandscapeRepositoryDuplicationSummary(dataDir, REPOSITORY_KEY),
        ],
        [
          "/landscape/repositories/:repo/hotspots",
          () => readReportLandscapeRepositoryHotspotsSummary(dataDir, REPOSITORY_KEY),
        ],
        [
          "/landscape/repositories/:repo/files/size",
          () => readReportLandscapeRepositoryFilesView(dataDir, REPOSITORY_KEY, "size"),
        ],
        [
          "/landscape/repositories/:repo/files/age",
          () => readReportLandscapeRepositoryFilesView(dataDir, REPOSITORY_KEY, "age"),
        ],
        [
          "/landscape/repositories/:repo/files/churn",
          () => readReportLandscapeRepositoryFilesView(dataDir, REPOSITORY_KEY, "churn"),
        ],
        [
          "/landscape/repositories/:repo/files/temporal",
          () => readReportLandscapeRepositoryFilesView(dataDir, REPOSITORY_KEY, "temporal"),
        ],
        [
          "/landscape/repositories/:repo/units/size",
          () => readReportLandscapeRepositoryUnitsView(dataDir, REPOSITORY_KEY, "size"),
        ],
        [
          "/landscape/repositories/:repo/units/complexity",
          () => readReportLandscapeRepositoryUnitsView(dataDir, REPOSITORY_KEY, "complexity"),
        ],
        [
          "/landscape/repositories/:repo/contributors",
          () => readReportLandscapeRepositoryContributorsSummary(dataDir, REPOSITORY_KEY),
        ],
        [
          "/landscape/repositories/:repo/contributors/:email",
          () => readReportLandscapeRepositoryContributorDetail(dataDir, REPOSITORY_KEY, CONTRIBUTOR_EMAIL),
        ],
        [
          "/landscape/repositories/:repo/topology",
          () => readReportLandscapeRepositoryTopologySummary(dataDir, REPOSITORY_KEY),
        ],
        [
          "/landscape/repositories/:repo/impact",
          () => readReportLandscapeRepositoryImpactSummary(dataDir, REPOSITORY_KEY),
        ],
        [
          "/landscape/repositories/:repo/controls",
          () => readReportLandscapeRepositoryControlsSummary(dataDir, REPOSITORY_KEY),
        ],
        [
          "/landscape/repositories/:repo/components",
          () => readReportLandscapeRepositoryComponentsSummary(dataDir, REPOSITORY_KEY),
        ],
        [
          "/landscape/repositories/:repo/coupling",
          () => readReportLandscapeRepositoryCouplingSummary(dataDir, REPOSITORY_KEY),
        ],
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
