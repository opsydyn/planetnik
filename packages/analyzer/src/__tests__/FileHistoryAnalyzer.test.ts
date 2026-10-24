import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CodeAnalyzer } from "../analysis/CodeAnalyzer.js"
import { FileHistoryAnalyzer } from "../analysis/FileHistoryAnalyzer.js"
import { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import { SourceFile } from "../aspects/SourceFile.js"
import { CodeAnalyzerSettings } from "../core/CodeAnalyzerSettings.js"
import { CodeConfiguration } from "../core/CodeConfiguration.js"
import { DateUtils } from "../filehistory/FileHistoryUtils.js"
import { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"

const WORKSPACE = join(import.meta.dir, "__file_history_workspace__")
const CONFIG_DIR = join(WORKSPACE, "_planetnik")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")
const HISTORY_FILE = join(CONFIG_DIR, "..", "git-history.txt")

const JAVA_SOURCE = `public class App {
    public void run() {
        System.out.println("hello");
    }
}
`

const TS_SOURCE = `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
`

// Git history format: each line is "date email commitId filepath"
const GIT_HISTORY = `2024-01-15 alice@example.com abc123 src/App.java
2024-02-20 bob@example.com def456 src/App.java
2024-02-20 bob@example.com def456 src/utils.ts
2024-03-10 alice@example.com ghi789 src/utils.ts
2024-06-15 charlie@example.com jkl012 src/App.java
2024-09-01 alice@example.com mno345 src/utils.ts
2024-09-01 alice@example.com mno345 src/App.java
`

beforeEach(() => {
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true })
  mkdirSync(join(WORKSPACE, "src"), { recursive: true })
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(join(WORKSPACE, "src", "App.java"), JAVA_SOURCE)
  writeFileSync(join(WORKSPACE, "src", "utils.ts"), TS_SOURCE)
  writeFileSync(HISTORY_FILE, GIT_HISTORY)

  // Fix analysis date so tests are deterministic
  DateUtils.setDateParam("2025-01-01")
})

afterEach(() => {
  DateUtils.reset()
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true })
})

function createConfigAndResults(): {
  results: CodeAnalysisResults
  config: CodeConfiguration
} {
  const config = new CodeConfiguration()
  config.extensions = ["java", "ts"]
  config.srcRoot = WORKSPACE

  // Manually populate main source files (simulating BasicsAnalyzer)
  const javaFile = new SourceFile("src/App.java", JAVA_SOURCE)
  javaFile.linesOfCode = 5
  const tsFile = new SourceFile("src/utils.ts", TS_SOURCE)
  tsFile.linesOfCode = 3

  config.main = new NamedSourceCodeAspect("main")
  config.main.sourceFiles = [javaFile, tsFile]

  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")

  const results = new CodeAnalysisResults()
  results.codeConfiguration = config

  return { results, config }
}

describe("FileHistoryAnalyzer", () => {
  test("loads history and summarizes dates", () => {
    const { results } = createConfigAndResults()
    new FileHistoryAnalyzer(results, CONFIG_FILE).analyze()

    const hist = results.filesHistoryAnalysisResults
    expect(hist.history.length).toBeGreaterThan(0)
    expect(hist.firstDate).toBe("2024-01-15")
    expect(hist.latestDate).toBe("2024-09-01")
    expect(hist.activeDays).toBe(5)
    expect(hist.daysBetweenFirstAndLastDate).toBeGreaterThan(200)
  })

  test("enriches source files with modification history", () => {
    const { results, config } = createConfigAndResults()
    new FileHistoryAnalyzer(results, CONFIG_FILE).analyze()

    const javaFile = config.main.sourceFiles.find((f) => f.relativePath.includes("App.java"))
    expect(javaFile).toBeDefined()
    expect(javaFile!.fileModificationHistory).not.toBeNull()
    expect(javaFile!.fileModificationHistory!.dates.length).toBeGreaterThan(0)

    const tsFile = config.main.sourceFiles.find((f) => f.relativePath.includes("utils.ts"))
    expect(tsFile).toBeDefined()
    expect(tsFile!.fileModificationHistory).not.toBeNull()
  })

  test("computes age risk distributions", () => {
    const { results } = createConfigAndResults()
    new FileHistoryAnalyzer(results, CONFIG_FILE).analyze()

    const hist = results.filesHistoryAnalysisResults
    expect(hist.ageRiskDistribution).not.toBeNull()
    expect(hist.freshnesssRiskDistribution).not.toBeNull()
    expect(hist.changeDistribution).not.toBeNull()
    expect(hist.contributorsCountDistribution).not.toBeNull()

    // Both files have history so total count should be 2
    expect(hist.ageRiskDistribution!.getTotalCount()).toBe(2)
    expect(hist.freshnesssRiskDistribution!.getTotalCount()).toBe(2)
  })

  test("computes per-extension distributions", () => {
    const { results } = createConfigAndResults()
    new FileHistoryAnalyzer(results, CONFIG_FILE).analyze()

    const hist = results.filesHistoryAnalysisResults
    expect(hist.ageRiskDistributionPerExtension.length).toBe(2) // java and ts
    expect(hist.freshnesssRiskDistributionPerExtension.length).toBe(2)
  })

  test("generates top file lists", () => {
    const { results } = createConfigAndResults()
    new FileHistoryAnalyzer(results, CONFIG_FILE).analyze()

    const hist = results.filesHistoryAnalysisResults
    expect(hist.oldestFiles.length).toBe(2)
    expect(hist.youngestFiles.length).toBe(2)
    expect(hist.mostRecentlyChangedFiles.length).toBe(2)
    expect(hist.mostChangedFiles.length).toBe(2)
    expect(hist.filesWithMostContributors.length).toBe(2)

    // App.java was first committed 2024-01-15, utils.ts on 2024-02-20
    // So App.java should be oldest
    expect(hist.oldestFiles[0]!.relativePath).toContain("App.java")
    expect(hist.youngestFiles[0]!.relativePath).toContain("utils.ts")
  })

  test("finds files changed together", () => {
    const { results } = createConfigAndResults()
    new FileHistoryAnalyzer(results, CONFIG_FILE).analyze()

    const hist = results.filesHistoryAnalysisResults
    // App.java and utils.ts were changed together in commits def456 and mno345
    expect(hist.filePairsChangedTogether180Days.length).toBeGreaterThan(0)

    const pair = hist.filePairsChangedTogether180Days[0]
    expect(pair!.commits.length).toBeGreaterThanOrEqual(1)
  })

  test("uses the configured 180-day temporal dependency bucket instead of the all-time one", () => {
    const { results } = createConfigAndResults()
    new FileHistoryAnalyzer(results, CONFIG_FILE).analyze()

    const hist = results.filesHistoryAnalysisResults
    expect(hist.filePairsChangedTogether).toHaveLength(0)
    expect(hist.filePairsChangedTogether30Days).toHaveLength(0)
    expect(hist.filePairsChangedTogether90Days).toHaveLength(0)
    expect(hist.filePairsChangedTogether180Days.length).toBeGreaterThan(0)
  })

  test("adds metrics", () => {
    const { results } = createConfigAndResults()
    new FileHistoryAnalyzer(results, CONFIG_FILE).analyze()

    const metrics = results.metricsList.metrics
    const ageMetric = metrics.find((m) => m.id.includes("FILE_CHANGE_HISTORY_TOTAL_AGE_DAYS"))
    expect(ageMetric).toBeDefined()
    expect(ageMetric!.value).toBeGreaterThan(0)

    const activeDaysMetric = metrics.find((m) => m.id.includes("FILE_CHANGE_HISTORY_ACTIVE_DAYS"))
    expect(activeDaysMetric).toBeDefined()
    expect(activeDaysMetric!.value).toBe(5)
  })

  test("does nothing when no history file exists", () => {
    rmSync(HISTORY_FILE)
    const { results } = createConfigAndResults()
    new FileHistoryAnalyzer(results, CONFIG_FILE).analyze()

    expect(results.filesHistoryAnalysisResults.history.length).toBe(0)
    expect(results.filesHistoryAnalysisResults.firstDate).toBe("")
  })

  test("integrates with CodeAnalyzer pipeline", () => {
    const config = new CodeConfiguration()
    config.extensions = ["java", "ts"]
    config.srcRoot = WORKSPACE

    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")

    const settings = CodeAnalyzerSettings.make({ analyzeFileHistory: true })
    const analyzer = new CodeAnalyzer(settings, config, CONFIG_FILE)
    const results = analyzer.analyze()

    // The history should have been loaded and processed
    const hist = results.filesHistoryAnalysisResults
    expect(hist.history.length).toBeGreaterThan(0)
    expect(hist.firstDate).toBe("2024-01-15")
  })
})
