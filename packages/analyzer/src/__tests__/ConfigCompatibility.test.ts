import { describe, expect, test } from "bun:test"
import { CodeConfiguration } from "../core/CodeConfiguration.js"
import { FileHistoryAnalysisConfig } from "../core/FileHistoryAnalysisConfig.js"
import { TrendAnalysisConfig } from "../core/TrendAnalysisConfig.js"

describe("FileHistoryAnalysisConfig", () => {
  test("has correct defaults", () => {
    const config = new FileHistoryAnalysisConfig()
    expect(config.importPath).toBe("../git-history.txt")
    expect(config.ignoreContributors).toEqual([])
    expect(config.bots).toEqual([".*\\[bot\\].*", ".*[-]bot[@].*"])
    expect(config.anonymizeContributors).toBe(false)
    expect(config.transformContributorEmails).toEqual([])
  })

  test("can be deserialized from JSON", () => {
    const json = {
      importPath: "../custom-history.txt",
      ignoreContributors: ["noreply@github.com"],
      bots: [".*\\[bot\\].*", "dependabot.*"],
      anonymizeContributors: true,
      transformContributorEmails: [{ op: "replace", params: ["@company.com", ""] }],
    }
    const config = Object.assign(new FileHistoryAnalysisConfig(), json)
    expect(config.importPath).toBe("../custom-history.txt")
    expect(config.ignoreContributors).toEqual(["noreply@github.com"])
    expect(config.bots).toHaveLength(2)
    expect(config.anonymizeContributors).toBe(true)
    expect(config.transformContributorEmails).toHaveLength(1)
    expect(config.transformContributorEmails[0]!.op).toBe("replace")
  })
})

describe("TrendAnalysisConfig", () => {
  test("has correct defaults", () => {
    const config = new TrendAnalysisConfig()
    expect(config.referenceAnalysesFolder).toBe("history")
    expect(config.saveHistory).toBe(false)
    expect(config.frequency).toBe("weekly")
    expect(config.maxReferencePointsForAnalysis).toBe(20)
  })

  test("getSnapshotFolderName returns weekly format by default", () => {
    const config = new TrendAnalysisConfig()
    const folder = config.getSnapshotFolderName()
    expect(folder).toMatch(/^snapshots\/\d{4}-\d{2}$/)
  })

  test("getSnapshotFolderName returns monthly format", () => {
    const config = new TrendAnalysisConfig()
    config.frequency = "monthly"
    const folder = config.getSnapshotFolderName()
    expect(folder).toMatch(/^snapshots\/\d{4}-\d{2}$/)
  })

  test("getSnapshotFolderName returns daily format", () => {
    const config = new TrendAnalysisConfig()
    config.frequency = "daily"
    const folder = config.getSnapshotFolderName()
    expect(folder).toMatch(/^snapshots\/\d{4}-\d{2}-\d{2}$/)
  })

  test("can be deserialized from JSON", () => {
    const json = {
      referenceAnalysesFolder: "custom-history",
      saveHistory: true,
      frequency: "monthly",
      maxReferencePointsForAnalysis: 10,
    }
    const config = Object.assign(new TrendAnalysisConfig(), json)
    expect(config.referenceAnalysesFolder).toBe("custom-history")
    expect(config.saveHistory).toBe(true)
    expect(config.frequency).toBe("monthly")
    expect(config.maxReferencePointsForAnalysis).toBe(10)
  })
})

describe("CodeConfiguration config compatibility", () => {
  test("has fileHistoryAnalysis and trendAnalysis with defaults", () => {
    const config = new CodeConfiguration()
    expect(config.fileHistoryAnalysis).toBeInstanceOf(FileHistoryAnalysisConfig)
    expect(config.trendAnalysis).toBeInstanceOf(TrendAnalysisConfig)
    expect(config.fileHistoryAnalysis.importPath).toBe("../git-history.txt")
    expect(config.trendAnalysis.frequency).toBe("weekly")
  })

  test("can parse Java-generated sokrates.json with config sections", () => {
    const javaJson = {
      metadata: {
        name: "TestProject",
        description: "",
        tooltip: "",
        logoLink: "",
        links: [],
      },
      srcRoot: "..",
      extensions: ["java"],
      ignore: [],
      summary: [],
      main: { name: "main", sourceFileFilters: [] },
      test: { name: "test", sourceFileFilters: [] },
      generated: { name: "generated", sourceFileFilters: [] },
      buildAndDeployment: { name: "buildAndDeployment", sourceFileFilters: [] },
      other: { name: "other", sourceFileFilters: [] },
      logicalDecompositions: [],
      concernGroups: [],
      goalsAndControls: [],
      tagRules: [],
      analysis: {},
      fileHistoryAnalysis: {
        importPath: "../git-history.txt",
        ignoreContributors: ["noreply@github.com"],
        bots: [".*\\[bot\\].*", ".*[-]bot[@].*"],
        anonymizeContributors: false,
        transformContributorEmails: [],
      },
      trendAnalysis: {
        referenceAnalysesFolder: "history",
        saveHistory: true,
        frequency: "weekly",
        maxReferencePointsForAnalysis: 15,
      },
    }

    const config = Object.assign(new CodeConfiguration(), javaJson)
    config.fileHistoryAnalysis = Object.assign(new FileHistoryAnalysisConfig(), javaJson.fileHistoryAnalysis)
    config.trendAnalysis = Object.assign(new TrendAnalysisConfig(), javaJson.trendAnalysis)

    expect(config.fileHistoryAnalysis.ignoreContributors).toEqual(["noreply@github.com"])
    expect(config.trendAnalysis.saveHistory).toBe(true)
    expect(config.trendAnalysis.maxReferencePointsForAnalysis).toBe(15)
  })
})
