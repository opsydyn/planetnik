import { defineCollection } from "astro:content"
import { z } from "astro/zod"
import {
  analysisLoader,
  commitsPerExtensionLoader,
  contributorDetailsLoader,
  contributorTimelineLoader,
  contributorsLoader,
  dependenciesLoader,
  duplicatesLoader,
  filesLoader,
  metricsLoader,
  peopleDependenciesLoader,
  temporalDepsLoader,
  unitsLoader,
} from "./loaders/planetnik-loader"

const fileSchema = z.object({
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

export const collections = {
  analysis: defineCollection({
    loader: analysisLoader(),
    schema: z.object({
      metadata: z.object({
        name: z.string(),
        description: z.string(),
        tooltip: z.string(),
        logoLink: z.string(),
        links: z.array(z.object({ label: z.string().optional(), href: z.string().optional() })),
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

  contributors: defineCollection({
    loader: contributorsLoader(),
    schema: z.object({
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
}
