import { defineCollection } from "astro:content"
import { z } from "astro/zod"
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
  temporalDepsLoader,
  unitsLoader,
} from "./loaders/planetnik-loader"

const fileSchema = z.object({
  id: z.string().optional(),
  relativePath: z.string(),
  extension: z.string(),
  linesOfCode: z.number(),
  components: z.array(z.string()),
  concerns: z.array(z.string()),
  commitsCount: z.number().optional(),
  contributorsCount: z.number().optional(),
  daysSinceFirstUpdate: z.number().optional(),
  daysSinceLatestUpdate: z.number().optional(),
  firstDate: z.string().optional(),
  latestDate: z.string().optional(),
  contributors: z.array(z.string()).optional(),
})

const duplicateFileBlockSchema = z.object({
  file: fileSchema,
  sourceFileCleanedLinesOfCode: z.number(),
  startLine: z.number(),
  endLine: z.number(),
  cleanedStartLine: z.number(),
  cleanedEndLine: z.number(),
})

const contributorFootprintSchema = z.object({
  name: z.string(),
  files: z.number(),
  linesOfCode: z.number(),
})

const impactDimensionKeySchema = z.enum([
  "complexity_reduction",
  "boundary_shaping",
  "knowledge_spread",
  "coordination_relief",
  "change_enablement",
])

const reportContextSchema = z.object({
  mode: z.enum(["single_repository", "landscape"]),
  reportMode: z.enum(["single_repository", "landscape"]),
  title: z.string(),
  rootRoute: z.string(),
  dataVersion: z.number(),
  repositoryId: z.string().optional(),
  snapshotId: z.string().optional(),
  generatedAt: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  canonicalShards: z.record(z.string(), z.string()).optional(),
  compatibilityProjections: z.record(z.string(), z.string()).optional(),
  entityIdPolicy: z.record(z.string(), z.string()).optional(),
  source: z.string(),
  hasLandscape: z.boolean(),
  hasSingleRepositoryAnalysis: z.boolean(),
  primaryNavigation: z.array(z.string()),
})

const landscapeRepositorySummarySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  repoKey: z.string(),
  mainLinesOfCode: z.number(),
  contributors: z.number(),
  latestCommitDate: z.string(),
  analysisResultsPath: z.string(),
})

const landscapeContributorRepositorySchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string(),
  analysisResultsPath: z.string(),
  repoKey: z.string(),
  firstCommitDate: z.string(),
  latestCommitDate: z.string(),
  commitsCount: z.number(),
  commits30Days: z.number(),
  commits90Days: z.number(),
  commits180Days: z.number(),
  commits365Days: z.number(),
  commitDates: z.array(z.string()),
})

const landscapeContributorSchema = z.object({
  id: z.string().optional(),
  email: z.string(),
  displayName: z.string(),
  name: z.string(),
  commitsCount: z.number(),
  commitsCount30Days: z.number(),
  commitsCount90Days: z.number(),
  commitsCount180Days: z.number(),
  commitsCount365Days: z.number(),
  commits30d: z.number(),
  commits90d: z.number(),
  commits180d: z.number(),
  commits365d: z.number(),
  firstCommitDate: z.string(),
  latestCommitDate: z.string(),
  isBot: z.boolean(),
  repositoryCount: z.number(),
  repositories: z.array(landscapeContributorRepositorySchema),
})

const landscapeTopologyPeriodSchema = z.object({
  periodKey: z.string(),
  periodLabel: z.string(),
  contributorCount: z.number(),
  connectionCount: z.number(),
  cIndex: z.number(),
  cMedian: z.number(),
  cMean: z.number(),
  mostConnectedContributor: z
    .object({
      email: z.string(),
      displayName: z.string(),
      connectionCount: z.number(),
    })
    .nullable(),
  contributors: z.array(
    z.object({
      email: z.string(),
      displayName: z.string(),
      isBot: z.boolean(),
      commitsCount: z.number(),
      repositoryCount: z.number(),
      repositories: z.array(
        z.object({
          name: z.string(),
          commitsCount: z.number(),
        }),
      ),
      connectionCount: z.number(),
      sharedFilesCount: z.number(),
    }),
  ),
  strongestConnections: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      sharedFilesCount: z.number(),
      sharedFiles: z.array(z.string()),
    }),
  ),
  connections: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      sharedFilesCount: z.number(),
      sharedFiles: z.array(z.string()),
    }),
  ),
})

export const collections = {
  reportContext: defineCollection({
    loader: reportContextLoader(),
    schema: reportContextSchema,
  }),

  analysis: defineCollection({
    loader: analysisLoader(),
    schema: z.object({
      metadata: z.object({
        name: z.string(),
        description: z.string(),
        tooltip: z.string(),
        logoLink: z.string(),
        links: z.array(
          z.object({
            label: z.string().optional(),
            href: z.string().optional(),
          }),
        ),
      }),
      filesCount: z.number(),
      linesOfCode: z.number(),
      duplication: z.object({
        percentage: z.number(),
        duplicatedLines: z.number(),
        cleanedLines: z.number(),
      }),
    }),
  }),

  filesMain: defineCollection({
    loader: filesLoader("main"),
    schema: fileSchema,
  }),

  filesTest: defineCollection({
    loader: filesLoader("test"),
    schema: fileSchema,
  }),

  units: defineCollection({
    loader: unitsLoader(),
    schema: z.object({
      id: z.string().optional(),
      shortName: z.string(),
      longName: z.string(),
      relativeFileName: z.string(),
      linesOfCode: z.number(),
      mcCabeIndex: z.number(),
      numberOfParameters: z.number(),
      startLine: z.number(),
      endLine: z.number(),
      components: z.array(z.string()),
    }),
  }),

  duplicates: defineCollection({
    loader: duplicatesLoader(),
    schema: z.object({
      blockSize: z.number(),
      duplicatedFileBlocks: z.array(duplicateFileBlockSchema),
    }),
  }),

  dependencies: defineCollection({
    loader: dependenciesLoader(),
    schema: z.object({
      fromComponentId: z.string().optional(),
      toComponentId: z.string().optional(),
      decompositionKey: z.string(),
      fromComponent: z.string(),
      toComponent: z.string(),
      count: z.number(),
      locFrom: z.number(),
      evidenceCount: z.number(),
      color: z.string(),
    }),
  }),

  metrics: defineCollection({
    loader: metricsLoader(),
    schema: z.object({
      id: z.string(),
      value: z.number(),
    }),
  }),

  controls: defineCollection({
    loader: controlsLoader(),
    schema: z.object({
      goal: z.string(),
      goalDescription: z.string(),
      metricId: z.string(),
      metricValue: z.number().nullable(),
      metricDescription: z.string(),
      desiredRange: z.object({
        min: z.string(),
        max: z.string(),
        tolerance: z.string(),
      }),
      desiredRangeText: z.string(),
      status: z.string(),
      controlDescription: z.string(),
    }),
  }),

  findings: defineCollection({
    loader: findingsLoader(),
    schema: z.object({
      summary: z.string(),
      bodyMarkdown: z.string().optional(),
      bodyHtml: z.string(),
      bodyText: z.string(),
    }),
  }),

  hotspots: defineCollection({
    loader: hotspotsLoader(),
    schema: z.object({
      id: z.string().optional(),
      kind: z.enum(["file", "unit", "component"]),
      name: z.string(),
      parent: z.string(),
      route: z.string(),
      score: z.number(),
      severity: z.enum(["Low", "Medium", "High", "Critical"]),
      size: z.number(),
      commitsCount: z.number(),
      contributorsCount: z.number(),
      temporalLinks: z.number(),
      complexity: z.number(),
      dimensions: z.object({
        structuralRisk: z.number(),
        changePressure: z.number(),
        coordinationCost: z.number(),
        knowledgeRisk: z.number(),
      }),
      dominantDimension: z.enum(["structuralRisk", "changePressure", "coordinationCost", "knowledgeRisk"]),
      suggestedAction: z.string(),
      reasons: z.array(z.string()),
    }),
  }),

  impact: defineCollection({
    loader: impactLoader(),
    schema: z.object({
      title: z.string(),
      timestamp: z.string(),
      visible_activity: z.object({
        commits: z.number(),
        contributors: z.number(),
        changed_files: z.number(),
        changed_units: z.number(),
      }),
      structural_impact: z.object({
        summary: z.object({
          overall_score: z.number(),
          dominant_dimension: impactDimensionKeySchema,
        }),
        dimensions: z.object({
          complexity_reduction: z.number(),
          boundary_shaping: z.number(),
          knowledge_spread: z.number(),
          coordination_relief: z.number(),
          change_enablement: z.number(),
        }),
      }),
      impact_dimensions: z.array(
        z.object({
          id: impactDimensionKeySchema,
          label: z.string(),
          score: z.number(),
          reasons: z.array(z.string()),
        }),
      ),
      impact_opportunities: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(["file", "unit", "component"]),
          name: z.string(),
          parent: z.string(),
          route: z.string(),
          impact_score: z.number(),
          visible_activity_score: z.number(),
          structural_impact_score: z.number(),
          dominant_dimension: impactDimensionKeySchema,
          dimensions: z.object({
            complexity_reduction: z.number(),
            boundary_shaping: z.number(),
            knowledge_spread: z.number(),
            coordination_relief: z.number(),
            change_enablement: z.number(),
          }),
          reasons: z.array(z.string()),
          suggested_action: z.string(),
        }),
      ),
      concept_mappings: z.array(
        z.object({
          concept: z.string(),
          dimension: impactDimensionKeySchema,
          evidence_count: z.number(),
          example_ids: z.array(z.string()),
        }),
      ),
      snacking_candidates: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(["file", "unit", "component"]),
          name: z.string(),
          route: z.string(),
          visible_activity_score: z.number(),
          structural_impact_score: z.number(),
          reason: z.string(),
        }),
      ),
    }),
  }),

  contributors: defineCollection({
    loader: contributorsLoader(),
    schema: z.object({
      id: z.string().optional(),
      email: z.string(),
      commitsAllTime: z.number(),
      commits30Days: z.number(),
      commits90Days: z.number(),
      commits180Days: z.number(),
      commits365Days: z.number(),
      firstCommit: z.string(),
      lastCommit: z.string(),
      percentage: z.string(),
      userName: z.string().optional(),
      isRookie: z.boolean().optional(),
      isActive: z.boolean().optional(),
    }),
  }),

  contributorDetails: defineCollection({
    loader: contributorDetailsLoader(),
    schema: z.object({
      id: z.string().optional(),
      email: z.string(),
      userName: z.string(),
      commitsCount: z.number(),
      commitsCount30Days: z.number(),
      commitsCount90Days: z.number(),
      commitsCount180Days: z.number(),
      commitsCount365Days: z.number(),
      firstCommitDate: z.string(),
      latestCommitDate: z.string(),
      isActive: z.boolean(),
      isRookie: z.boolean(),
      dailyActivity: z.array(
        z.object({
          date: z.string(),
          commits: z.number(),
        }),
      ),
      files: z.array(
        z.object({
          relativePath: z.string(),
          extension: z.string(),
          commits: z.number(),
          logicalComponents: z.array(z.string()),
          concerns: z.array(z.string()),
        }),
      ),
      extensions: z.array(
        z.object({
          extension: z.string(),
          commits: z.number(),
          files: z.number(),
        }),
      ),
      logicalComponents: z.array(contributorFootprintSchema),
      concerns: z.array(contributorFootprintSchema),
      collaborators: z.array(
        z.object({
          email: z.string(),
          sharedFiles: z.number(),
        }),
      ),
    }),
  }),

  contributorImpact: defineCollection({
    loader: contributorImpactLoader(),
    schema: z.object({
      email: z.string(),
      display_name: z.string(),
      glue_score: z.number(),
      snacking_score: z.number(),
      structural_impact_score: z.number(),
      visible_activity_score: z.number(),
      collaborator_count: z.number(),
      shared_files_count: z.number(),
      commits_count: z.number(),
      files_touched: z.number(),
      components_touched: z.number(),
      dominant_dimension: impactDimensionKeySchema,
      dimensions: z.object({
        complexity_reduction: z.number(),
        boundary_shaping: z.number(),
        knowledge_spread: z.number(),
        coordination_relief: z.number(),
        change_enablement: z.number(),
      }),
      top_components: z.array(
        z.object({
          name: z.string(),
          files: z.number(),
          commits: z.number(),
        }),
      ),
      top_routes: z.array(z.string()),
      reasons: z.array(z.string()),
      is_glue: z.boolean(),
      is_snacking: z.boolean(),
    }),
  }),

  temporalDeps: defineCollection({
    loader: temporalDepsLoader(),
    schema: z.object({
      periodKey: z.string(),
      periodLabel: z.string(),
      periodDays: z.number(),
      file1: z.string(),
      file2: z.string(),
      sameCommits: z.number(),
      commitsFile1: z.number(),
      commitsFile2: z.number(),
      latestCommit: z.string(),
    }),
  }),

  peopleDeps: defineCollection({
    loader: peopleDependenciesLoader(),
    schema: z.object({
      from: z.string(),
      to: z.string(),
      count: z.number(),
      files: z.array(z.string()),
    }),
  }),

  contributorTimeline: defineCollection({
    loader: contributorTimelineLoader(),
    schema: z.object({
      timeSlot: z.string(),
      contributors: z.number(),
      commits: z.number(),
      granularity: z.enum(["year", "month"]),
    }),
  }),

  commitsPerExtension: defineCollection({
    loader: commitsPerExtensionLoader(),
    schema: z.object({
      extension: z.string(),
      commitsCount: z.number(),
      committersCount: z.number(),
      filesCount: z.number(),
      commitsCount30Days: z.number(),
      committersCount30Days: z.number(),
      filesCount30Days: z.number(),
      commitsCount90Days: z.number(),
      committersCount90Days: z.number(),
      filesCount90Days: z.number(),
    }),
  }),

  landscapeOverview: defineCollection({
    loader: landscapeOverviewLoader(),
    schema: z.object({
      title: z.string(),
      landscapeName: z.string(),
      repositoryCount: z.number(),
      contributorCount: z.number(),
      totals: z.object({
        mainLinesOfCode: z.number(),
        testLinesOfCode: z.number(),
        generatedLinesOfCode: z.number(),
        buildAndDeployLinesOfCode: z.number(),
        otherLinesOfCode: z.number(),
        totalLinesOfCode: z.number(),
        mainFilesCount: z.number(),
        contributorCount30Days: z.number(),
        contributorCount90Days: z.number(),
        contributorCount180Days: z.number(),
        contributorCount365Days: z.number(),
        repositoryCount30Days: z.number(),
        repositoryCount90Days: z.number(),
        commits30d: z.number(),
        commits90d: z.number(),
      }),
      firstCommitDate: z.string(),
      latestCommitDate: z.string(),
      languages: z.array(
        z.object({
          extension: z.string(),
          linesOfCode: z.number(),
          repositories: z.number(),
        }),
      ),
      topRepositories: z.array(landscapeRepositorySummarySchema),
    }),
  }),

  landscapeRepositories: defineCollection({
    loader: landscapeRepositoriesLoader(),
    schema: z.object({
      metadata: z.object({
        name: z.string(),
        description: z.string(),
        tooltip: z.string(),
        logoLink: z.string(),
        links: z.array(
          z.object({
            label: z.string().optional(),
            href: z.string().optional(),
          }),
        ),
      }),
      latestCommitDate: z.string(),
      commitsCount: z.number(),
      commitsCount30Days: z.number(),
      commitsCount90Days: z.number(),
      contributors: z.array(z.string()),
      contributors30Days: z.array(z.string()),
      contributors90Days: z.array(z.string()),
      analysisResultsPath: z.string(),
      repoKey: z.string(),
      mainFilesCount: z.number(),
      mainLinesOfCode: z.number(),
      testFilesCount: z.number(),
      testLinesOfCode: z.number(),
      generatedLinesOfCode: z.number(),
      buildAndDeployLinesOfCode: z.number(),
      otherLinesOfCode: z.number(),
      name: z.string(),
      description: z.string(),
      commits30d: z.number(),
      commits90d: z.number(),
      contributorsCount: z.number(),
      contributors30d: z.number(),
      contributors90d: z.number(),
      contributorEmails: z.array(z.string()),
      contributorEmails30d: z.array(z.string()),
      contributorEmails90d: z.array(z.string()),
      tags: z.array(
        z.object({
          key: z.string(),
          group: z.string(),
          name: z.string(),
        }),
      ),
    }),
  }),

  landscapeContributors: defineCollection({
    loader: landscapeContributorsLoader(),
    schema: landscapeContributorSchema,
  }),

  landscapeTeams: defineCollection({
    loader: landscapeTeamsLoader(),
    schema: z.object({
      name: z.string(),
      description: z.string(),
      commitsCount: z.number(),
      commitsCount30Days: z.number(),
      commitsCount90Days: z.number(),
      commitsCount180Days: z.number(),
      commitsCount365Days: z.number(),
      commits30d: z.number(),
      commits90d: z.number(),
      commits180d: z.number(),
      commits365d: z.number(),
      firstCommitDate: z.string(),
      latestCommitDate: z.string(),
      repositoryCount: z.number(),
      memberCount: z.number(),
      members: z.array(z.string()),
      repositories: z.array(landscapeContributorRepositorySchema),
    }),
  }),

  landscapeTopology: defineCollection({
    loader: landscapeTopologyLoader(),
    schema: z.object({
      title: z.string(),
      contributorCount: z.number(),
      periods: z.array(landscapeTopologyPeriodSchema),
      periodsByKey: z.record(z.string(), landscapeTopologyPeriodSchema),
    }),
  }),

  landscapeTags: defineCollection({
    loader: landscapeTagsLoader(),
    schema: z.object({
      title: z.string(),
      groupCount: z.number(),
      tagCount: z.number(),
      untaggedRepositoryCount: z.number(),
      groups: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          color: z.string(),
          tagCount: z.number(),
          repositoryCount: z.number(),
          tags: z.array(
            z.object({
              key: z.string(),
              name: z.string(),
              imageLink: z.string(),
              repositoryCount: z.number(),
              totalMainLinesOfCode: z.number(),
              repositories: z.array(
                z.object({
                  name: z.string(),
                  repoKey: z.string(),
                  analysisResultsPath: z.string(),
                  mainLinesOfCode: z.number(),
                  contributors: z.number(),
                  latestCommitDate: z.string(),
                }),
              ),
            }),
          ),
        }),
      ),
      untaggedRepositories: z.array(
        z.object({
          name: z.string(),
          repoKey: z.string(),
          analysisResultsPath: z.string(),
          mainLinesOfCode: z.number(),
          contributors: z.number(),
          latestCommitDate: z.string(),
        }),
      ),
    }),
  }),

  landscapeDependencyAlerts: defineCollection({
    loader: landscapeDependencyAlertsLoader(),
    schema: z.object({
      repo: z.string(),
      alertCount: z.number(),
      alerts: z.array(
        z.object({
          number: z.number(),
          state: z.string(),
          dependency: z.object({
            package: z.object({
              ecosystem: z.string(),
              name: z.string(),
            }),
            manifest_path: z.string().optional(),
            scope: z.string().nullable().optional(),
          }),
          security_advisory: z.object({
            ghsa_id: z.string(),
            cve_id: z.string().nullable().optional(),
            summary: z.string().optional(),
            severity: z.string(),
            published_at: z.string().optional(),
          }),
          security_vulnerability: z.object({
            severity: z.string(),
            vulnerable_version_range: z.string().optional(),
            first_patched_version: z.object({ identifier: z.string() }).nullable().optional(),
          }),
          created_at: z.string(),
          fixed_at: z.string().nullable().optional(),
        }),
      ),
    }),
  }),

  landscapeDependencyHealth: defineCollection({
    loader: landscapeDependencyHealthLoader(),
    schema: z.object({
      totalRepos: z.number(),
      reposWithAlerts: z.number(),
      totalAlerts: z.number(),
      totalOpenAlerts: z.number(),
      severityCounts: z.object({
        critical: z.number(),
        high: z.number(),
        medium: z.number(),
        low: z.number(),
      }),
      meanTimeToResolveDays: z.number().nullable(),
      supplyChainExposureScore: z.number(),
      sharedVulnerablePackages: z.array(
        z.object({
          ecosystem: z.string(),
          name: z.string(),
          severity: z.string(),
          affectedRepos: z.array(z.string()),
        }),
      ),
      repoHealth: z.array(
        z.object({
          owner: z.string(),
          repo: z.string(),
          totalAlerts: z.number(),
          openAlerts: z.number(),
          fixedAlerts: z.number(),
          severityCounts: z.object({
            critical: z.number(),
            high: z.number(),
            medium: z.number(),
            low: z.number(),
          }),
          meanTimeToResolveDays: z.number().nullable(),
          oldestOpenAlertDays: z.number().nullable(),
        }),
      ),
      enrichmentSummary: z
        .object({
          enrichedAt: z.string().nullable(),
          latestAlertOpenedAt: z.string().nullable(),
          latestAdvisoryPublishedAt: z.string().nullable(),
          uniqueCveCount: z.number(),
          epssCoverageCount: z.number(),
          knownExploitedCount: z.number(),
          epssAvailable: z.boolean(),
          kevAvailable: z.boolean(),
        })
        .optional(),
      topActionableVulnerabilities: z
        .array(
          z.object({
            repo: z.string(),
            package: z.string(),
            ecosystem: z.string(),
            manifestPath: z.string(),
            advisoryId: z.string(),
            cveId: z.string().nullable(),
            ghsaId: z.string(),
            severity: z.string(),
            summary: z.string(),
            state: z.string(),
            openedAt: z.string(),
            publishedAt: z.string().nullable(),
            ageDays: z.number(),
            sharedRepoCount: z.number(),
            vulnerableVersionRange: z.string(),
            firstPatchedVersion: z.string().nullable(),
            recommendedAction: z.string(),
            epssScore: z.number().nullable(),
            epssPercentile: z.number().nullable(),
            knownExploited: z.boolean(),
            priorityScore: z.number(),
          }),
        )
        .optional(),
    }),
  }),

  landscapeTagMatrix: defineCollection({
    loader: landscapeTagMatrixLoader(),
    schema: z.object({
      title: z.string(),
      repositoryCount: z.number(),
      repositories: z.array(
        z.object({
          name: z.string(),
          repoKey: z.string(),
          analysisResultsPath: z.string(),
          mainLinesOfCode: z.number(),
          tags: z.array(
            z.object({
              key: z.string(),
              group: z.string(),
              name: z.string(),
            }),
          ),
          isUntagged: z.boolean(),
        }),
      ),
    }),
  }),
}
