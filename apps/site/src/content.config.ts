import { defineCollection, z } from "astro:content"
import {
  analysisLoader,
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
})

const duplicateFileBlockSchema = z.object({
  file: fileSchema,
  sourceFileCleanedLinesOfCode: z.number(),
  startLine: z.number(),
  endLine: z.number(),
  cleanedStartLine: z.number(),
  cleanedEndLine: z.number(),
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
      fromComponent: z.string().optional(),
      toComponent: z.string().optional(),
      count: z.number().optional(),
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

  temporalDeps: defineCollection({
    loader: temporalDepsLoader(),
    schema: z.object({
      file1: z.string(),
      file2: z.string(),
      sameCommits: z.number(),
      commitsFile1: z.number(),
      commitsFile2: z.number(),
    }),
  }),
}
