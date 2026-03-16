import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { LandscapeAnalyzer } from "../landscape/LandscapeAnalyzer.js"
import { LandscapeConfiguration } from "../landscape/LandscapeConfiguration.js"

const WORKSPACE = join(import.meta.dir, "__landscape_workspace__")

function makeRepoResults(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    metadata: { name: "RepoA", description: "", tooltip: "", logoLink: "", links: [] },
    mainAspectAnalysisResults: {
      linesOfCode: 1000,
      filesCount: 10,
      linesOfCodePerExtension: [
        { extension: "ts", linesOfCode: 800 },
        { extension: "java", linesOfCode: 200 },
      ],
    },
    testAspectAnalysisResults: { linesOfCode: 200, filesCount: 5 },
    generatedAspectAnalysisResults: { linesOfCode: 0, filesCount: 0 },
    buildAndDeployAspectAnalysisResults: { linesOfCode: 50, filesCount: 2 },
    otherAspectAnalysisResults: { linesOfCode: 0, filesCount: 0 },
    contributorsAnalysisResults: {
      latestCommitDate: "2024-06-01",
      contributors: [
        {
          email: "alice@example.com",
          commitsCount: 10,
          firstCommitDate: "2023-01-01",
          latestCommitDate: "2024-06-01",
          commitsCount30Days: 2,
          commitsCount90Days: 5,
          commitsCount180Days: 8,
          commitsCount365Days: 10,
          isBot: false,
        },
        {
          email: "bob@example.com",
          commitsCount: 5,
          firstCommitDate: "2023-06-01",
          latestCommitDate: "2024-03-01",
          commitsCount30Days: 0,
          commitsCount90Days: 1,
          commitsCount180Days: 3,
          commitsCount365Days: 5,
          isBot: false,
        },
      ],
    },
    filesHistoryAnalysisResults: { firstDate: "2023-01-01", latestDate: "2024-06-01" },
    duplicationAnalysisResults: { overallDuplication: 5.5 },
    ...overrides,
  }
}

beforeEach(() => {
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true })
  mkdirSync(WORKSPACE, { recursive: true })
})

afterEach(() => {
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true })
})

describe("LandscapeAnalyzer", () => {
  test("loads and aggregates multiple repositories", () => {
    // Create two repo result files
    mkdirSync(join(WORKSPACE, "repos", "repoA"), { recursive: true })
    mkdirSync(join(WORKSPACE, "repos", "repoB"), { recursive: true })

    writeFileSync(join(WORKSPACE, "repos", "repoA", "results.json"), JSON.stringify(makeRepoResults()))

    writeFileSync(
      join(WORKSPACE, "repos", "repoB", "results.json"),
      JSON.stringify(
        makeRepoResults({
          metadata: { name: "RepoB", description: "", tooltip: "", logoLink: "", links: [] },
          mainAspectAnalysisResults: {
            linesOfCode: 500,
            filesCount: 5,
            linesOfCodePerExtension: [{ extension: "ts", linesOfCode: 500 }],
          },
          testAspectAnalysisResults: { linesOfCode: 100, filesCount: 3 },
          contributorsAnalysisResults: {
            latestCommitDate: "2024-09-01",
            contributors: [
              {
                email: "alice@example.com",
                commitsCount: 3,
                firstCommitDate: "2024-01-01",
                latestCommitDate: "2024-09-01",
                commitsCount30Days: 1,
                commitsCount90Days: 2,
                commitsCount180Days: 3,
                commitsCount365Days: 3,
                isBot: false,
              },
              {
                email: "charlie@example.com",
                commitsCount: 7,
                firstCommitDate: "2023-09-01",
                latestCommitDate: "2024-09-01",
                commitsCount30Days: 3,
                commitsCount90Days: 5,
                commitsCount180Days: 7,
                commitsCount365Days: 7,
                isBot: false,
              },
            ],
          },
          filesHistoryAnalysisResults: { firstDate: "2023-09-01", latestDate: "2024-09-01" },
        }),
      ),
    )

    const config = new LandscapeConfiguration()
    config.metadata.name = "TestLandscape"
    config.analysisRoot = "repos"
    config.repositories = [
      { analysisResultsPath: "repoA/results.json", name: "RepoA" },
      { analysisResultsPath: "repoB/results.json", name: "RepoB" },
    ]

    const analyzer = new LandscapeAnalyzer(config, WORKSPACE)
    const results = analyzer.analyze()

    expect(results.getRepositoryCount()).toBe(2)
    expect(results.totalMainLoc).toBe(1500) // 1000 + 500
    expect(results.totalTestLoc).toBe(300) // 200 + 100
    expect(results.totalMainFilesCount).toBe(15) // 10 + 5
  })

  test("aggregates extensions across repos", () => {
    mkdirSync(join(WORKSPACE, "repos", "repoA"), { recursive: true })
    mkdirSync(join(WORKSPACE, "repos", "repoB"), { recursive: true })

    writeFileSync(join(WORKSPACE, "repos", "repoA", "results.json"), JSON.stringify(makeRepoResults()))
    writeFileSync(
      join(WORKSPACE, "repos", "repoB", "results.json"),
      JSON.stringify(
        makeRepoResults({
          mainAspectAnalysisResults: {
            linesOfCode: 500,
            filesCount: 5,
            linesOfCodePerExtension: [{ extension: "ts", linesOfCode: 500 }],
          },
        }),
      ),
    )

    const config = new LandscapeConfiguration()
    config.analysisRoot = "repos"
    config.repositories = [
      { analysisResultsPath: "repoA/results.json", name: "RepoA" },
      { analysisResultsPath: "repoB/results.json", name: "RepoB" },
    ]

    const results = new LandscapeAnalyzer(config, WORKSPACE).analyze()

    expect(results.linesOfCodePerExtension.get("ts")).toBe(1300) // 800 + 500
    expect(results.linesOfCodePerExtension.get("java")).toBe(200)
    expect(results.repositoriesPerExtension.get("ts")).toBe(2)
    expect(results.repositoriesPerExtension.get("java")).toBe(1)
  })

  test("aggregates contributors across repos", () => {
    mkdirSync(join(WORKSPACE, "repos", "repoA"), { recursive: true })
    mkdirSync(join(WORKSPACE, "repos", "repoB"), { recursive: true })

    writeFileSync(join(WORKSPACE, "repos", "repoA", "results.json"), JSON.stringify(makeRepoResults()))
    writeFileSync(
      join(WORKSPACE, "repos", "repoB", "results.json"),
      JSON.stringify(
        makeRepoResults({
          contributorsAnalysisResults: {
            latestCommitDate: "2024-09-01",
            contributors: [
              {
                email: "alice@example.com",
                commitsCount: 3,
                firstCommitDate: "2024-01-01",
                latestCommitDate: "2024-09-01",
                commitsCount30Days: 1,
                commitsCount90Days: 2,
                commitsCount180Days: 3,
                commitsCount365Days: 3,
                isBot: false,
              },
              {
                email: "charlie@example.com",
                commitsCount: 7,
                firstCommitDate: "2023-09-01",
                latestCommitDate: "2024-09-01",
                commitsCount30Days: 3,
                commitsCount90Days: 5,
                commitsCount180Days: 7,
                commitsCount365Days: 7,
                isBot: false,
              },
            ],
          },
        }),
      ),
    )

    const config = new LandscapeConfiguration()
    config.analysisRoot = "repos"
    config.repositories = [
      { analysisResultsPath: "repoA/results.json", name: "RepoA" },
      { analysisResultsPath: "repoB/results.json", name: "RepoB" },
    ]

    const results = new LandscapeAnalyzer(config, WORKSPACE).analyze()

    // 3 unique contributors: alice (in both), bob (repoA only), charlie (repoB only)
    expect(results.allContributors.length).toBe(3)

    const alice = results.allContributors.find((c) => c.email === "alice@example.com")!
    expect(alice.commitsCount).toBe(13) // 10 + 3
    expect(alice.firstCommitDate).toBe("2023-01-01") // earliest across repos
    expect(alice.latestCommitDate).toBe("2024-09-01") // latest across repos
  })

  test("computes date range across repos", () => {
    mkdirSync(join(WORKSPACE, "repos", "repoA"), { recursive: true })
    mkdirSync(join(WORKSPACE, "repos", "repoB"), { recursive: true })

    writeFileSync(join(WORKSPACE, "repos", "repoA", "results.json"), JSON.stringify(makeRepoResults()))
    writeFileSync(
      join(WORKSPACE, "repos", "repoB", "results.json"),
      JSON.stringify(
        makeRepoResults({ filesHistoryAnalysisResults: { firstDate: "2022-06-01", latestDate: "2024-12-01" } }),
      ),
    )

    const config = new LandscapeConfiguration()
    config.analysisRoot = "repos"
    config.repositories = [
      { analysisResultsPath: "repoA/results.json", name: "RepoA" },
      { analysisResultsPath: "repoB/results.json", name: "RepoB" },
    ]

    const results = new LandscapeAnalyzer(config, WORKSPACE).analyze()

    expect(results.firstCommitDate).toBe("2022-06-01")
    expect(results.latestCommitDate).toBe("2024-12-01")
  })

  test("filters repos by LOC threshold", () => {
    mkdirSync(join(WORKSPACE, "repos", "repoA"), { recursive: true })
    mkdirSync(join(WORKSPACE, "repos", "repoB"), { recursive: true })

    writeFileSync(join(WORKSPACE, "repos", "repoA", "results.json"), JSON.stringify(makeRepoResults()))
    writeFileSync(
      join(WORKSPACE, "repos", "repoB", "results.json"),
      JSON.stringify(
        makeRepoResults({ mainAspectAnalysisResults: { linesOfCode: 10, filesCount: 1, linesOfCodePerExtension: [] } }),
      ),
    )

    const config = new LandscapeConfiguration()
    config.analysisRoot = "repos"
    config.repositoryThresholdLocMain = 100
    config.repositories = [
      { analysisResultsPath: "repoA/results.json", name: "RepoA" },
      { analysisResultsPath: "repoB/results.json", name: "RepoB" },
    ]

    const results = new LandscapeAnalyzer(config, WORKSPACE).analyze()
    expect(results.getRepositoryCount()).toBe(1) // Only repoA passes threshold
  })

  test("handles missing result files gracefully", () => {
    const config = new LandscapeConfiguration()
    config.analysisRoot = "."
    config.repositories = [{ analysisResultsPath: "nonexistent.json", name: "Missing" }]

    const results = new LandscapeAnalyzer(config, WORKSPACE).analyze()
    expect(results.getRepositoryCount()).toBe(0)
  })
})
