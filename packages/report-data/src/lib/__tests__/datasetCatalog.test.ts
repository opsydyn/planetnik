import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildDatasetCatalog, parseDatasetCatalogSeeds, readDatasetCatalogSeeds } from "../datasets/datasetCatalog.js"

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2))
}

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "planetnik-dataset-catalog-"))
  temporaryRoots.push(root)
  return root
}

function writeV2Dataset(
  root: string,
  name: string,
  options: { valid?: boolean; mode?: "single_repository" | "landscape" } = {},
): void {
  const dataDir = join(root, name, "data")
  mkdirSync(dataDir, { recursive: true })
  const mode = options.mode ?? "single_repository"
  const canonicalShards =
    mode === "single_repository"
      ? {
          summary: "analysisResults.json",
          filesMain: "files_main.json",
          metrics: "metrics.json",
          contributors: "contributors.json",
          dependencies: "dependencies.json",
        }
      : {
          analysis: "analysisResults.json",
          overview: "landscape_overview.json",
        }
  const context = {
    mode,
    reportMode: mode,
    title: `${name} title`,
    rootRoute: "/",
    dataVersion: options.valid === false ? 1 : 2,
    repositoryId: mode === "single_repository" ? `repo:${name}` : undefined,
    snapshotId: "3d611736-9df1-4d22-a93e-00d06b13e767",
    generatedAt: "2026-09-03T21:08:09.001Z",
    source: "test",
    hasLandscape: mode === "landscape",
    hasSingleRepositoryAnalysis: mode === "single_repository",
    primaryNavigation: [],
    capabilities: Object.keys(canonicalShards),
    canonicalShards,
    compatibilityProjections: {},
    entityIdPolicy: {
      repository: "repo:<normalised repository key>",
      file: "file:<normalised relative path>",
      unit: "unit:<normalised relative path>:<start line>",
      component: "component:<decomposition key>:<component name>",
      contributor: "contributor:<lowercase trimmed email>",
    },
  }
  writeJson(join(dataDir, "report_context.json"), context)
  if (options.valid === false) return

  if (mode === "single_repository") {
    writeJson(join(dataDir, "analysisResults.json"), {
      metadata: {
        name: `${name} title`,
        description: "Generated fixture",
        logoLink: "",
      },
      filesCount: 2,
      linesOfCode: 120,
    })
    writeJson(join(dataDir, "files_main.json"), {
      files: [
        { extension: "ts", linesOfCode: 80 },
        { extension: "py", linesOfCode: 40 },
      ],
    })
    writeJson(join(dataDir, "metrics.json"), { metrics: [] })
    writeJson(join(dataDir, "contributors.json"), {
      contributors: [
        { email: "a@example.test", commitsAllTime: 5 },
        { email: "b@example.test", commitsAllTime: 3 },
      ],
    })
    writeJson(join(dataDir, "dependencies.json"), {
      links: [{}, {}, {}],
    })
    return
  }

  writeJson(join(dataDir, "analysisResults.json"), {
    metadata: { name: `${name} title`, description: "Landscape fixture" },
  })
  writeJson(join(dataDir, "landscape_overview.json"), {
    landscapeName: `${name} title`,
    repositoryCount: 4,
    totals: { mainFilesCount: 20, totalLinesOfCode: 2400 },
  })
}

describe("buildDatasetCatalog", () => {
  test("parses an imported curation manifest without depending on its runtime file path", () => {
    expect(
      parseDatasetCatalogSeeds({
        catalogVersion: 1,
        entries: [{ id: "openai-openai-python", availability: "planned" }],
      }),
    ).toEqual([{ id: "openai-openai-python", availability: "planned" }])
  })

  test("reads a versioned curation manifest", () => {
    const root = createRoot()
    const manifest = join(root, "dataset-catalog.json")
    writeJson(manifest, {
      catalogVersion: 1,
      entries: [
        {
          id: "openai-oss-landscape",
          title: "OpenAI OSS Landscape",
          availability: "planned",
          mode: "landscape",
          shelf: "Coming soon",
          order: 100,
        },
      ],
    })

    expect(readDatasetCatalogSeeds(manifest)).toEqual([
      {
        id: "openai-oss-landscape",
        title: "OpenAI OSS Landscape",
        availability: "planned",
        mode: "landscape",
        shelf: "Coming soon",
        order: 100,
      },
    ])
  })

  test("rejects an unversioned or malformed curation manifest", () => {
    const root = createRoot()
    const manifest = join(root, "dataset-catalog.json")
    writeJson(manifest, { catalogVersion: 2, entries: [] })

    expect(() => readDatasetCatalogSeeds(manifest)).toThrow(/catalogVersion/i)
  })

  test("builds a ready descriptor from canonical JSON and curation metadata", () => {
    const root = createRoot()
    writeV2Dataset(root, "requests-python-pilot")

    const result = buildDatasetCatalog({
      datasetsRoot: root,
      curation: [
        {
          id: "requests-python-pilot",
          description: "Python pilot",
          sourceUrl: "https://github.com/psf/requests",
          sourceRef: "main",
          license: "Apache-2.0",
          tags: ["python", "pilot"],
          featured: true,
          shelf: "Repository pilots",
          order: 10,
        },
      ],
    })

    expect(result.diagnostics).toEqual([])
    expect(result.catalog.datasets).toHaveLength(1)
    expect(result.catalog.datasets[0]).toMatchObject({
      id: "requests-python-pilot",
      title: "requests-python-pilot title",
      availability: "ready",
      description: "Python pilot",
      provenance: {
        sourceUrl: "https://github.com/psf/requests",
        sourceRef: "main",
        license: "Apache-2.0",
      },
      stats: {
        repositories: 1,
        files: 2,
        loc: 120,
        contributors: 2,
        commits: 8,
        dependencies: 3,
      },
      languages: [
        { key: "ts", label: "TypeScript", loc: 80, share: 66.7 },
        { key: "py", label: "Python", loc: 40, share: 33.3 },
      ],
    })
  })

  test("reports invalid snapshots and excludes them from the catalogue", () => {
    const root = createRoot()
    writeV2Dataset(root, "invalid", { valid: false })

    const result = buildDatasetCatalog({ datasetsRoot: root })

    expect(result.catalog.datasets).toEqual([])
    expect(result.diagnostics).toEqual([{ datasetId: "invalid", severity: "error", reason: expect.any(String) }])
  })

  test("keeps planned recommendations without a local snapshot", () => {
    const result = buildDatasetCatalog({
      datasetsRoot: createRoot(),
      curation: [
        {
          id: "openai-oss-landscape",
          title: "OpenAI OSS Landscape",
          description: "A planned cross-repository OpenAI example set.",
          mode: "landscape",
          availability: "planned",
          tags: ["ai", "landscape"],
          featured: false,
          shelf: "Coming soon",
          order: 100,
        },
      ],
    })

    expect(result.diagnostics).toEqual([])
    expect(result.catalog.datasets[0]).toMatchObject({
      id: "openai-oss-landscape",
      mode: "landscape",
      availability: "planned",
      stats: {},
    })
    expect(result.catalog.datasets[0]?.snapshot).toBeUndefined()
  })

  test("orders local and planned entries by curation order then ID", () => {
    const root = createRoot()
    writeV2Dataset(root, "beta")
    writeV2Dataset(root, "alpha")

    const result = buildDatasetCatalog({
      datasetsRoot: root,
      curation: [
        { id: "beta", shelf: "Examples", order: 20 },
        { id: "alpha", shelf: "Examples", order: 20 },
      ],
    })

    expect(result.catalog.datasets.map((entry) => entry.id)).toEqual(["alpha", "beta"])
  })
})
