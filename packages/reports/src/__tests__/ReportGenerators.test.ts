import { describe, expect, test } from "bun:test"
import {
  type CodeAnalysisResults,
  type FilePairChangedTogether,
  FilesHistoryAnalysisResults,
  HistoryPerExtension,
  type MergeExtension,
  RiskDistributionStats,
  SourceFile,
} from "@planetnik/analyzer"
import { RichTextReport } from "../core/RichTextReport.js"
import { FileChurnReportGenerator } from "../generators/FileChurnReportGenerator.js"
import { FileTemporalDependenciesReportGenerator } from "../generators/FileTemporalDependenciesReportGenerator.js"
import { HistoryPerLanguageGenerator } from "../generators/HistoryPerLanguageGenerator.js"

function makeResults(overrides: Partial<FilesHistoryAnalysisResults> = {}): CodeAnalysisResults {
  const hist = new FilesHistoryAnalysisResults()
  Object.assign(hist, overrides)

  return {
    filesHistoryAnalysisResults: hist,
    mainAspectAnalysisResults: { filesCount: 10, linesOfCode: 1000 },
  } as CodeAnalysisResults
}

function makeDistribution(): RiskDistributionStats {
  const dist = new RiskDistributionStats(10, 20, 50, 100)
  dist.key = "test"
  dist.negligibleRiskCount = 10
  dist.negligibleRiskValue = 50
  dist.lowRiskCount = 5
  dist.lowRiskValue = 100
  dist.mediumRiskCount = 3
  dist.mediumRiskValue = 200
  dist.highRiskCount = 2
  dist.highRiskValue = 300
  dist.veryHighRiskCount = 1
  dist.veryHighRiskValue = 400
  return dist
}

describe("FileChurnReportGenerator", () => {
  test("renders change frequency section", () => {
    const report = new RichTextReport("test", "test.html")
    const results = makeResults({ changeDistribution: makeDistribution() })

    FileChurnReportGenerator.addFileChurnToReport(report, results)

    const html = report.renderToString()
    expect(html).toContain("File Change Frequency Overall")
    expect(html).toContain("File change frequency (churn)")
  })

  test("renders contributors count frequency section", () => {
    const report = new RichTextReport("test", "test.html")
    const results = makeResults({ contributorsCountDistribution: makeDistribution() })

    FileChurnReportGenerator.addFileChurnToReport(report, results)

    const html = report.renderToString()
    expect(html).toContain("Contributors Count Frequency Overall")
  })

  test("renders most changed files list", () => {
    const report = new RichTextReport("test", "test.html")
    const results = makeResults({
      mostChangedFiles: [Object.assign(new SourceFile("src/app.ts"), { linesOfCode: 100 })],
    })

    FileChurnReportGenerator.addFileChurnToReport(report, results)

    const html = report.renderToString()
    expect(html).toContain("Most Frequently Changed Files")
    expect(html).toContain("src/app.ts")
  })

  test("renders files with most and least contributors", () => {
    const report = new RichTextReport("test", "test.html")
    const results = makeResults({
      filesWithMostContributors: [Object.assign(new SourceFile("src/main.ts"), { linesOfCode: 200 })],
      filesWithLeastContributors: [Object.assign(new SourceFile("src/util.ts"), { linesOfCode: 50 })],
    })

    FileChurnReportGenerator.addFileChurnToReport(report, results)

    const html = report.renderToString()
    expect(html).toContain("Files With Most Contributors")
    expect(html).toContain("src/main.ts")
    expect(html).toContain("Files With Least Contributors")
    expect(html).toContain("src/util.ts")
  })

  test("handles empty data gracefully", () => {
    const report = new RichTextReport("test", "test.html")
    const results = makeResults()

    FileChurnReportGenerator.addFileChurnToReport(report, results)

    const html = report.renderToString()
    expect(html).toContain("File change frequency")
    expect(html).not.toContain("File Change Frequency Overall")
  })
})

describe("FileTemporalDependenciesReportGenerator", () => {
  const makePair = (file1: string, file2: string, commits: number): FilePairChangedTogether => ({
    sourceFile1Path: file1,
    sourceFile2Path: file2,
    commitsCountFile1: commits + 5,
    commitsCountFile2: commits + 3,
    commits: Array.from({ length: commits }, (_, i) => `commit-${i}`),
    latestCommit: "2024-01-15",
  })

  test("renders tab groups", () => {
    const report = new RichTextReport("test", "test.html")
    const results = makeResults({
      filePairsChangedTogether: [makePair("a.ts", "b.ts", 5)],
      filePairsChangedTogether30Days: [makePair("a.ts", "b.ts", 2)],
      filePairsChangedTogether90Days: [],
      filePairsChangedTogether180Days: [],
    })

    FileTemporalDependenciesReportGenerator.addTemporalDependenciesToReport(report, results)

    const html = report.renderToString()
    expect(html).toContain("Past 30 Days")
    expect(html).toContain("Past 3 Months")
    expect(html).toContain("Past 6 Months")
    expect(html).toContain("All Time")
    expect(html).toContain("30_days")
    expect(html).toContain("all_time")
  })

  test("renders file pair table with percentages", () => {
    const report = new RichTextReport("test", "test.html")
    const results = makeResults({
      filePairsChangedTogether: [makePair("src/a.ts", "src/b.ts", 5)],
      filePairsChangedTogether30Days: [],
      filePairsChangedTogether90Days: [],
      filePairsChangedTogether180Days: [],
    })

    FileTemporalDependenciesReportGenerator.addTemporalDependenciesToReport(report, results)

    const html = report.renderToString()
    expect(html).toContain("src/a.ts")
    expect(html).toContain("src/b.ts")
    expect(html).toContain("# Same Commits")
  })

  test("shows empty message when no pairs", () => {
    const report = new RichTextReport("test", "test.html")
    const results = makeResults({
      filePairsChangedTogether: [],
      filePairsChangedTogether30Days: [],
      filePairsChangedTogether90Days: [],
      filePairsChangedTogether180Days: [],
    })

    FileTemporalDependenciesReportGenerator.addTemporalDependenciesToReport(report, results)

    const html = report.renderToString()
    expect(html).toContain("No file pairs changed together")
  })
})

describe("HistoryPerLanguageGenerator", () => {
  function makeHistory(): HistoryPerExtension[] {
    const h1 = new HistoryPerExtension("java", "2024", 50)
    h1.contributors = new Set(["alice", "bob"])
    const h2 = new HistoryPerExtension("java", "2023", 30)
    h2.contributors = new Set(["alice"])
    const h3 = new HistoryPerExtension("ts", "2024", 80)
    h3.contributors = new Set(["alice", "bob", "charlie"])
    const h4 = new HistoryPerExtension("ts", "2023", 20)
    h4.contributors = new Set(["bob"])
    return [h1, h2, h3, h4]
  }

  test("creates commits mode generator", () => {
    const gen = HistoryPerLanguageGenerator.createCommits(makeHistory())
    const report = new RichTextReport("test", "test.html")
    gen.addHistoryPerLanguage(report)

    const html = report.renderToString()
    expect(html).toContain("2024")
    expect(html).toContain("2023")
    // Commits mode uses dark background
    expect(html).toContain("#343434")
  })

  test("creates contributors mode generator", () => {
    const gen = HistoryPerLanguageGenerator.createContributors(makeHistory())
    const report = new RichTextReport("test", "test.html")
    gen.addHistoryPerLanguage(report)

    const html = report.renderToString()
    // Contributors mode uses skyblue
    expect(html).toContain("skyblue")
  })

  test("respects extension filter", () => {
    const gen = HistoryPerLanguageGenerator.createCommits(makeHistory(), ["java"])
    const report = new RichTextReport("test", "test.html")
    gen.addHistoryPerLanguage(report)

    const html = report.renderToString()
    expect(html).toContain("java")
  })

  test("merges extensions via mergeExtensions", () => {
    const gen = HistoryPerLanguageGenerator.createCommits(makeHistory())
    gen.setMergeExtensions([{ primary: "ts", secondary: "java" } as MergeExtension])
    const report = new RichTextReport("test", "test.html")
    gen.addHistoryPerLanguage(report)

    const html = report.renderToString()
    // After merging java into ts, we should see combined counts
    expect(html).toContain("ts")
  })

  test("addHistoryPerComponent renders component rows", () => {
    const gen = HistoryPerLanguageGenerator.createCommits(makeHistory())
    const report = new RichTextReport("test", "test.html")
    gen.addHistoryPerComponent(report)

    const html = report.renderToString()
    expect(html).toContain("2024")
  })
})

describe("HistoryPerExtension", () => {
  test("initializes with defaults", () => {
    const h = new HistoryPerExtension()
    expect(h.extension).toBe("")
    expect(h.year).toBe("")
    expect(h.commitsCount).toBe(0)
    expect(h.contributors.size).toBe(0)
  })

  test("initializes with values", () => {
    const h = new HistoryPerExtension("java", "2024", 42)
    expect(h.extension).toBe("java")
    expect(h.year).toBe("2024")
    expect(h.commitsCount).toBe(42)
  })
})
