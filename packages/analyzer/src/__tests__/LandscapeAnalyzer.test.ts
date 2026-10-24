import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { DateUtils } from "../filehistory/FileHistoryUtils.js"
import { LandscapeAnalyzer } from "../landscape/LandscapeAnalyzer.js"
import { LandscapeConfiguration } from "../landscape/LandscapeConfiguration.js"
import { RepositoryLink } from "../landscape/RepositoryLink.js"

const WORKSPACE = join(import.meta.dir, "__landscape_workspace__")

function makeRepoResults(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    metadata: {
      name: "RepoA",
      description: "",
      tooltip: "",
      logoLink: "",
      links: [],
    },
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
    filesHistoryAnalysisResults: {
      firstDate: "2023-01-01",
      latestDate: "2024-06-01",
    },
    duplicationAnalysisResults: { overallDuplication: 5.5 },
    ...overrides,
  }
}

beforeEach(() => {
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true })
  mkdirSync(WORKSPACE, { recursive: true })
})

afterEach(() => {
  DateUtils.reset()
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
          metadata: {
            name: "RepoB",
            description: "",
            tooltip: "",
            logoLink: "",
            links: [],
          },
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
          filesHistoryAnalysisResults: {
            firstDate: "2023-09-01",
            latestDate: "2024-09-01",
          },
        }),
      ),
    )

    const config = new LandscapeConfiguration()
    config.metadata.name = "TestLandscape"
    config.analysisRoot = "repos"
    config.repositories = [new RepositoryLink("repoA/results.json"), new RepositoryLink("repoB/results.json")]

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
    config.repositories = [new RepositoryLink("repoA/results.json"), new RepositoryLink("repoB/results.json")]

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
    config.repositories = [new RepositoryLink("repoA/results.json"), new RepositoryLink("repoB/results.json")]

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
        makeRepoResults({
          filesHistoryAnalysisResults: {
            firstDate: "2022-06-01",
            latestDate: "2024-12-01",
          },
        }),
      ),
    )

    const config = new LandscapeConfiguration()
    config.analysisRoot = "repos"
    config.repositories = [new RepositoryLink("repoA/results.json"), new RepositoryLink("repoB/results.json")]

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
        makeRepoResults({
          mainAspectAnalysisResults: {
            linesOfCode: 10,
            filesCount: 1,
            linesOfCodePerExtension: [],
          },
        }),
      ),
    )

    const config = new LandscapeConfiguration()
    config.analysisRoot = "repos"
    config.repositoryThresholdLocMain = 100
    config.repositories = [new RepositoryLink("repoA/results.json"), new RepositoryLink("repoB/results.json")]

    const results = new LandscapeAnalyzer(config, WORKSPACE).analyze()
    expect(results.getRepositoryCount()).toBe(1) // Only repoA passes threshold
  })

  test("handles missing result files gracefully", () => {
    const config = new LandscapeConfiguration()
    config.analysisRoot = "."
    config.repositories = [new RepositoryLink("nonexistent.json")]

    const results = new LandscapeAnalyzer(config, WORKSPACE).analyze()
    expect(results.getRepositoryCount()).toBe(0)
  })

  test("loads split repository contracts when monolithic analysis results are summary-only", () => {
    mkdirSync(join(WORKSPACE, "repos", "repoSplit", "data"), {
      recursive: true,
    })

    writeFileSync(
      join(WORKSPACE, "repos", "repoSplit", "data", "analysisResults.json"),
      JSON.stringify({
        metadata: {
          name: "repo-split",
          description: "",
          tooltip: "",
          logoLink: "",
          links: [],
        },
        filesCount: 2,
        linesOfCode: 100,
        duplication: { percentage: 3.5 },
      }),
    )
    writeFileSync(
      join(WORKSPACE, "repos", "repoSplit", "data", "files_main.json"),
      JSON.stringify({
        totalFilesCount: 2,
        totalLinesOfCode: 100,
        files: [
          {
            relativePath: "src/a.ts",
            extension: "ts",
            linesOfCode: 60,
            firstDate: "2024-06-01",
            latestDate: "2024-06-12",
          },
          {
            relativePath: "src/b.ts",
            extension: "ts",
            linesOfCode: 40,
            firstDate: "2024-06-03",
            latestDate: "2024-06-15",
          },
        ],
      }),
    )
    writeFileSync(
      join(WORKSPACE, "repos", "repoSplit", "data", "files_test.json"),
      JSON.stringify({
        totalFilesCount: 1,
        totalLinesOfCode: 20,
        files: [{ relativePath: "test/a.test.ts", extension: "ts", linesOfCode: 20 }],
      }),
    )
    writeFileSync(
      join(WORKSPACE, "repos", "repoSplit", "data", "contributors.json"),
      JSON.stringify({
        contributors: [
          {
            email: "alice@example.com",
            commitsCount: 4,
            commitsCount30Days: 2,
            commitsCount90Days: 4,
            commitsCount180Days: 4,
            commitsCount365Days: 4,
            firstCommitDate: "2024-06-01",
            latestCommitDate: "2024-06-15",
            userName: "Alice",
            isBot: false,
          },
          {
            email: "bob@example.com",
            commitsCount: 2,
            commitsCount30Days: 1,
            commitsCount90Days: 2,
            commitsCount180Days: 2,
            commitsCount365Days: 2,
            firstCommitDate: "2024-06-05",
            latestCommitDate: "2024-06-12",
            userName: "Bob",
            isBot: false,
          },
        ],
      }),
    )
    writeFileSync(
      join(WORKSPACE, "repos", "repoSplit", "data", "contributors.txt"),
      "Contributor\t#commits\nalice@example.com\t999\n",
    )
    writeFileSync(
      join(WORKSPACE, "repos", "repoSplit", "data", "people_dependencies.json"),
      JSON.stringify([
        {
          from: "alice@example.com",
          to: "bob@example.com",
          count: 1,
          files: ["src/a.ts"],
        },
      ]),
    )
    writeFileSync(
      join(WORKSPACE, "repos", "repoSplit", "data", "people_dependencies_30d.json"),
      JSON.stringify([
        {
          from: "alice@example.com",
          to: "bob@example.com",
          count: 1,
          files: ["src/a.ts"],
        },
      ]),
    )

    const config = new LandscapeConfiguration()
    config.analysisRoot = "repos"
    config.repositories = [new RepositoryLink("repoSplit/data/analysisResults.json")]

    const results = new LandscapeAnalyzer(config, WORKSPACE).analyze()

    expect(results.getRepositoryCount()).toBe(1)
    expect(results.totalMainLoc).toBe(100)
    expect(results.totalTestLoc).toBe(20)
    expect(results.totalMainFilesCount).toBe(2)
    expect(results.firstCommitDate).toBe("2024-06-01")
    expect(results.latestCommitDate).toBe("2024-06-15")
    expect(results.allContributors).toHaveLength(2)
    expect(results.peopleDependenciesAllTime).toEqual([
      expect.objectContaining({
        fromComponent: "alice@example.com",
        toComponent: "bob@example.com",
        count: 1,
        data: ["repo-split/src/a.ts"],
      }),
    ])
    expect(results.peopleDependencies30Days).toEqual([
      expect.objectContaining({
        fromComponent: "alice@example.com",
        toComponent: "bob@example.com",
        count: 1,
        data: ["repo-split/src/a.ts"],
      }),
    ])
  })

  test("aggregates real cross-repo people dependencies from namespaced file histories", () => {
    DateUtils.setDateParam("2024-07-01")

    mkdirSync(join(WORKSPACE, "repos", "repoA"), { recursive: true })
    mkdirSync(join(WORKSPACE, "repos", "repoB"), { recursive: true })

    writeFileSync(
      join(WORKSPACE, "repos", "repoA", "results.json"),
      JSON.stringify(
        makeRepoResults({
          metadata: {
            name: "repo-a",
            description: "",
            tooltip: "",
            logoLink: "",
            links: [],
          },
          contributorsAnalysisResults: {
            latestCommitDate: "2024-06-21",
            contributors: [
              {
                email: "alice@example.com",
                commitsCount: 2,
                firstCommitDate: "2024-06-20",
                latestCommitDate: "2024-06-21",
                commitsCount30Days: 2,
                commitsCount90Days: 2,
                commitsCount180Days: 2,
                commitsCount365Days: 2,
                isBot: false,
              },
              {
                email: "bob@example.com",
                commitsCount: 1,
                firstCommitDate: "2024-06-21",
                latestCommitDate: "2024-06-21",
                commitsCount30Days: 1,
                commitsCount90Days: 1,
                commitsCount180Days: 1,
                commitsCount365Days: 1,
                isBot: false,
              },
            ],
          },
          filesHistoryAnalysisResults: {
            firstDate: "2024-06-20",
            latestDate: "2024-06-21",
            history: [
              {
                path: "src/shared.ts",
                dates: ["2024-06-20", "2024-06-21"],
                commits: [
                  { id: "a1", date: "2024-06-20", email: "alice@example.com" },
                  { id: "a2", date: "2024-06-21", email: "bob@example.com" },
                ],
              },
            ],
          },
        }),
      ),
    )

    writeFileSync(
      join(WORKSPACE, "repos", "repoB", "results.json"),
      JSON.stringify(
        makeRepoResults({
          metadata: {
            name: "repo-b",
            description: "",
            tooltip: "",
            logoLink: "",
            links: [],
          },
          contributorsAnalysisResults: {
            latestCommitDate: "2024-06-24",
            contributors: [
              {
                email: "charlie@example.com",
                commitsCount: 1,
                firstCommitDate: "2024-06-23",
                latestCommitDate: "2024-06-23",
                commitsCount30Days: 1,
                commitsCount90Days: 1,
                commitsCount180Days: 1,
                commitsCount365Days: 1,
                isBot: false,
              },
              {
                email: "dana@example.com",
                commitsCount: 1,
                firstCommitDate: "2024-06-24",
                latestCommitDate: "2024-06-24",
                commitsCount30Days: 1,
                commitsCount90Days: 1,
                commitsCount180Days: 1,
                commitsCount365Days: 1,
                isBot: false,
              },
            ],
          },
          filesHistoryAnalysisResults: {
            firstDate: "2024-06-23",
            latestDate: "2024-06-24",
            history: [
              {
                path: "src/shared.ts",
                dates: ["2024-06-23", "2024-06-24"],
                commits: [
                  {
                    id: "b1",
                    date: "2024-06-23",
                    email: "charlie@example.com",
                  },
                  { id: "b2", date: "2024-06-24", email: "dana@example.com" },
                ],
              },
            ],
          },
        }),
      ),
    )

    const config = new LandscapeConfiguration()
    config.analysisRoot = "repos"
    config.repositories = [new RepositoryLink("repoA/results.json"), new RepositoryLink("repoB/results.json")]

    const results = new LandscapeAnalyzer(config, WORKSPACE).analyze()

    expect(results.peopleDependenciesAllTime).toHaveLength(2)
    expect(results.peopleDependencies30Days).toHaveLength(2)
    expect(results.peopleDependencies).toEqual(results.peopleDependenciesAllTime)

    expect(results.peopleDependenciesAllTime).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromComponent: "alice@example.com",
          toComponent: "bob@example.com",
          count: 1,
          data: ["repo-a/src/shared.ts"],
        }),
        expect.objectContaining({
          fromComponent: "charlie@example.com",
          toComponent: "dana@example.com",
          count: 1,
          data: ["repo-b/src/shared.ts"],
        }),
      ]),
    )

    expect(
      results.peopleDependenciesAllTime.some(
        (dependency) =>
          (dependency.fromComponent === "alice@example.com" && dependency.toComponent === "charlie@example.com") ||
          (dependency.fromComponent === "charlie@example.com" && dependency.toComponent === "alice@example.com"),
      ),
    ).toBe(false)
  })
})
