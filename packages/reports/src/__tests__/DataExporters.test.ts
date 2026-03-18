import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  AnalysisConfig,
  CodeAnalysisResults,
  CodeConfiguration,
  CommitInfo,
  ComponentDependency,
  Contributor,
  Dependency,
  DependencyAnchor,
  DuplicatedFileBlock,
  DuplicationInstance,
  FileModificationHistory,
  LogicalDecompositionAnalysisResults,
  NamedSourceCodeAspect,
  SourceFile,
  SourceFileDependency,
} from "@planetnik/analyzer"
import { DataExportUtils } from "../exporters/DataExportUtils"
import { DataExporter } from "../exporters/DataExporter"
import { DependenciesExporter } from "../exporters/DependenciesExportInfo"
import { DuplicationExporter } from "../exporters/DuplicationExportInfo"
import { fileExportInfoFromSourceFile } from "../exporters/FileExportInfo"
import { FileListExporter } from "../exporters/FilesExportInfo"
import { MetricsTrendExporter } from "../exporters/MetricsTrendExporter"
import { UnitListExporter } from "../exporters/UnitsExportInfo"

describe("DataExportUtils", () => {
  test("getComponentFileName sanitizes names", () => {
    expect(DataExportUtils.getComponentFileName("prefix_", "my/component")).toBe("prefix_my_component")
    expect(DataExportUtils.getComponentFileName("", "valid-name.txt")).toBe("valid-name.txt")
  })

  test("getAspectFileName sanitizes names", () => {
    expect(DataExportUtils.getAspectFileName("prefix_", "my aspect")).toBe("prefix_my_aspect")
  })
})

describe("fileExportInfoFromSourceFile", () => {
  test("exports basic fields without history", () => {
    const file = new SourceFile("src/main.ts")
    file.linesOfCode = 100

    const info = fileExportInfoFromSourceFile(file)

    expect(info.relativePath).toBe("src/main.ts")
    expect(info.linesOfCode).toBe(100)
    expect(info.commitsCount).toBeUndefined()
    expect(info.contributorsCount).toBeUndefined()
    expect(info.contributors).toBeUndefined()
  })

  test("exports history fields when FileModificationHistory is present", () => {
    const file = new SourceFile("src/main.ts")
    file.linesOfCode = 100

    const history = new FileModificationHistory("src/main.ts")
    history.commits.push(new CommitInfo("abc1", "2024-01-10", "alice@test.com"))
    history.commits.push(new CommitInfo("abc2", "2024-03-15", "bob@test.com"))
    history.commits.push(new CommitInfo("abc3", "2024-06-20", "alice@test.com"))
    history.dates.push("2024-01-10", "2024-03-15", "2024-06-20")
    file.fileModificationHistory = history

    const info = fileExportInfoFromSourceFile(file)

    expect(info.commitsCount).toBe(3)
    expect(info.contributorsCount).toBe(2)
    expect(info.firstDate).toBe("2024-01-10")
    expect(info.latestDate).toBe("2024-06-20")
    expect(info.contributors).toContain("alice@test.com")
    expect(info.contributors).toContain("bob@test.com")
    expect(info.contributors).toHaveLength(2)
    expect(info.daysSinceFirstUpdate).toBeGreaterThan(0)
    expect(info.daysSinceLatestUpdate).toBeGreaterThan(0)
  })
})

describe("FileListExporter", () => {
  test("exports files with metadata", () => {
    const file1 = new SourceFile("src/main.ts")
    file1.linesOfCode = 100

    const file2 = new SourceFile("src/utils.ts")
    file2.linesOfCode = 50

    const result = FileListExporter.exportFiles([file1, file2], "Main", "/root", "2024-01-01T00:00:00Z")

    expect(result.title).toBe("Main")
    expect(result.srcRoot).toBe("/root")
    expect(result.timestamp).toBe("2024-01-01T00:00:00Z")
    expect(result.totalFilesCount).toBe(2)
    expect(result.totalLinesOfCode).toBe(150)
    expect(result.files).toHaveLength(2)
    expect(result.files[0]!.relativePath).toBe("src/main.ts")
  })
})

describe("UnitListExporter", () => {
  test("exports units with metadata", () => {
    const file = new SourceFile("src/main.ts")

    const unit = {
      shortName: "doStuff",
      longName: "doStuff()",
      linesOfCode: 20,
      mcCabeIndex: 3,
      numberOfParameters: 2,
      startLine: 10,
      endLine: 30,
      sourceFile: file,
      cleanedBody: "",
      body: "",
      children: [],
    }

    const result = UnitListExporter.exportUnits([unit], "All Units", "/root", "2024-01-01T00:00:00Z")

    expect(result.totalUnitsCount).toBe(1)
    expect(result.totalLinesOfCode).toBe(20)
    expect(result.units[0]!.shortName).toBe("doStuff")
    expect(result.units[0]!.mcCabeIndex).toBe(3)
    expect(result.units[0]!.numberOfParameters).toBe(2)
    expect(result.units[0]!.relativeFileName).toBe("src/main.ts")
  })

  test("filters units without source files", () => {
    const unit = {
      shortName: "orphan",
      longName: undefined,
      linesOfCode: 5,
      mcCabeIndex: 1,
      numberOfParameters: 0,
      startLine: 1,
      endLine: 5,
      sourceFile: undefined,
      cleanedBody: "",
      body: "",
    }

    const result = UnitListExporter.exportUnits([unit as any], "Units", "/root", "2024-01-01")

    expect(result.totalUnitsCount).toBe(0)
    expect(result.units).toHaveLength(0)
  })
})

describe("DependenciesExporter", () => {
  test("exports dependencies with anchors and source files", () => {
    const sourceFile = new SourceFile("src/app.ts")
    sourceFile.linesOfCode = 200

    const fromAnchor = new DependencyAnchor()
    fromAnchor.anchor = "ComponentA"
    fromAnchor.codeFragment = "import { B } from './b'"
    fromAnchor.dependencyPatterns = ["import.*from"]
    fromAnchor.sourceFiles = [sourceFile]

    const toAnchor = new DependencyAnchor()
    toAnchor.anchor = "ComponentB"
    toAnchor.codeFragment = ""

    const fromFile = new SourceFileDependency(sourceFile)
    fromFile.codeFragment = "import { B } from './b'"

    const dep = new Dependency(fromAnchor, toAnchor)
    dep.fromFiles = [fromFile]

    const exporter = new DependenciesExporter([dep])
    const result = exporter.getDependenciesExportInfo()

    expect(result).toHaveLength(1)
    expect(result[0]!.from.anchor).toBe("ComponentA")
    expect(result[0]!.to.anchor).toBe("ComponentB")
    expect(result[0]!.from.dependencyPatterns).toEqual(["import.*from"])
    expect(result[0]!.from.files).toHaveLength(1)
    expect(result[0]!.from.files[0]!.relativePath).toBe("src/app.ts")
    expect(result[0]!.fromFiles).toHaveLength(1)
    expect(result[0]!.fromFiles[0]!.codeFragment).toBe("import { B } from './b'")
  })

  test("static exportDependencies wraps with metadata", () => {
    const result = DependenciesExporter.exportDependencies([], "Test Deps", "2024-01-01")

    expect(result.title).toBe("Test Deps")
    expect(result.timestamp).toBe("2024-01-01")
    expect(result.links).toHaveLength(0)
  })
})

describe("DuplicationExporter", () => {
  test("exports duplication instances", () => {
    const file = new SourceFile("src/a.ts")
    file.linesOfCode = 100

    const block = new DuplicatedFileBlock()
    block.sourceFile = file
    block.sourceFileCleanedLinesOfCode = 80
    block.startLine = 10
    block.endLine = 20
    block.cleanedStartLine = 8
    block.cleanedEndLine = 18

    const instance = new DuplicationInstance()
    instance.blockSize = 10
    instance.duplicatedFileBlocks = [block]

    const exporter = new DuplicationExporter([instance])
    const result = exporter.getDuplicatesExportInfo()

    expect(result).toHaveLength(1)
    expect(result[0]!.blockSize).toBe(10)
    expect(result[0]!.duplicatedFileBlocks).toHaveLength(1)
    expect(result[0]!.duplicatedFileBlocks[0]!.startLine).toBe(10)
    expect(result[0]!.duplicatedFileBlocks[0]!.endLine).toBe(20)
    expect(result[0]!.duplicatedFileBlocks[0]!.sourceFileCleanedLinesOfCode).toBe(80)
    expect(result[0]!.duplicatedFileBlocks[0]!.file.relativePath).toBe("src/a.ts")
  })

  test("static exportDuplication wraps with metadata", () => {
    const result = DuplicationExporter.exportDuplication([], "Duplication", "2024-01-01")

    expect(result.title).toBe("Duplication")
    expect(result.timestamp).toBe("2024-01-01")
    expect(result.duplicates).toHaveLength(0)
  })
})

describe("MetricsTrendExporter", () => {
  function makeResults(metrics: Array<{ id: string; value: number }>): CodeAnalysisResults {
    const results = new CodeAnalysisResults()
    for (const m of metrics) {
      results.metricsList.addMetric().setId(m.id).setValue(m.value)
    }
    return results
  }

  test("getMetricTrends returns trends across snapshots", () => {
    const current = makeResults([
      { id: "LOC", value: 1000 },
      { id: "FILES", value: 50 },
    ])
    const ref1 = makeResults([
      { id: "LOC", value: 800 },
      { id: "FILES", value: 40 },
    ])

    const exporter = new MetricsTrendExporter(current, [{ label: "v1.0", results: ref1 }])
    const trends = exporter.getMetricTrends()

    expect(trends).toHaveLength(2)
    expect(trends[0]!.id).toBe("LOC")
    expect(trends[0]!.values).toHaveLength(2)
    expect(trends[0]!.values[0]!.snapshot).toBe("Current")
    expect(trends[0]!.values[0]!.value).toBe(1000)
    expect(trends[0]!.values[1]!.snapshot).toBe("v1.0")
    expect(trends[0]!.values[1]!.value).toBe(800)
  })

  test("getMetricTrends filters by regex", () => {
    const current = makeResults([
      { id: "LOC_MAIN", value: 1000 },
      { id: "LOC_TEST", value: 200 },
      { id: "FILES", value: 50 },
    ])

    const exporter = new MetricsTrendExporter(current)
    const trends = exporter.getMetricTrends("LOC_.*")

    expect(trends).toHaveLength(2)
    expect(trends[0]!.id).toBe("LOC_MAIN")
    expect(trends[1]!.id).toBe("LOC_TEST")
  })

  test("getMetricTrends supports exclude regex", () => {
    const current = makeResults([
      { id: "LOC_MAIN", value: 1000 },
      { id: "LOC_TEST", value: 200 },
    ])

    const exporter = new MetricsTrendExporter(current)
    const trends = exporter.getMetricTrends("LOC_.*", ".*TEST.*")

    expect(trends).toHaveLength(1)
    expect(trends[0]!.id).toBe("LOC_MAIN")
  })

  test("shouldIncludeId handles empty filters", () => {
    expect(MetricsTrendExporter.shouldIncludeId(undefined, undefined, "anything")).toBe(true)
    expect(MetricsTrendExporter.shouldIncludeId("LOC.*", undefined, "LOC_MAIN")).toBe(true)
    expect(MetricsTrendExporter.shouldIncludeId("LOC.*", undefined, "FILES")).toBe(false)
  })

  test("getText produces tab-separated output", () => {
    const current = makeResults([{ id: "LOC", value: 1000 }])
    const ref = makeResults([{ id: "LOC", value: 800 }])

    const exporter = new MetricsTrendExporter(current, [{ label: "v1.0", results: ref }])
    const text = exporter.getText()

    expect(text).toContain("Metric\tCurrent\tv1.0")
    expect(text).toContain("LOC\t1000\t800")
  })

  test("getText returns empty string when no trends", () => {
    const current = makeResults([])
    const exporter = new MetricsTrendExporter(current)

    expect(exporter.getText()).toBe("")
  })

  test("handles missing metrics in reference results", () => {
    const current = makeResults([{ id: "LOC", value: 1000 }])
    const ref = makeResults([]) // LOC not present

    const exporter = new MetricsTrendExporter(current, [{ label: "v1.0", results: ref }])
    const trends = exporter.getMetricTrends()

    expect(trends[0]!.values[1]!.value).toBe(0) // defaults to 0
  })
})

describe("DataExporter", () => {
  test("exportData writes period-aware temporal dependency JSON and text files", () => {
    const results = new CodeAnalysisResults()
    const config = new CodeConfiguration()
    config.analysis = AnalysisConfig.make({ maxTemporalDependenciesDepthDays: 180 })
    results.codeConfiguration = config

    const makePair = (
      file1: string,
      file2: string,
      sharedCommits: number,
      latestCommit: string,
    ) => ({
      sourceFile1Path: file1,
      sourceFile2Path: file2,
      commitsCountFile1: sharedCommits + 2,
      commitsCountFile2: sharedCommits + 1,
      commits: Array.from({ length: sharedCommits }, (_, index) => `commit-${index}`),
      latestCommit,
    })

    results.filesHistoryAnalysisResults.filePairsChangedTogether30Days = [
      makePair("src/App.java", "src/utils.ts", 2, "2025-01-12"),
    ]
    results.filesHistoryAnalysisResults.filePairsChangedTogether90Days = [
      makePair("src/App.java", "src/service.ts", 3, "2025-01-10"),
    ]
    results.filesHistoryAnalysisResults.filePairsChangedTogether180Days = [
      makePair("src/App.java", "src/helpers.ts", 4, "2024-12-30"),
    ]

    const reportsFolder = mkdtempSync(join(tmpdir(), "planetnik-temporal-deps-"))

    try {
      new DataExporter(results, reportsFolder).exportData()

      const jsonPath = join(reportsFolder, "data", "temporal_dependencies.json")
      expect(existsSync(jsonPath)).toBe(true)

      const exported = JSON.parse(readFileSync(jsonPath, "utf-8")) as {
        title: string
        timestamp: string
        dependencies: Array<{
          periodKey: string
          periodLabel: string
          periodDays: number
          file1: string
          file2: string
          sameCommits: number
          commitsFile1: number
          commitsFile2: number
          latestCommit: string
        }>
      }

      expect(exported.title).toBe("Temporal Dependencies")
      expect(exported.dependencies.map((dependency) => dependency.periodKey)).toEqual([
        "30_days",
        "90_days",
        "180_days",
      ])
      expect(exported.dependencies[0]).toEqual({
        periodKey: "30_days",
        periodLabel: "Past 30 Days",
        periodDays: 30,
        file1: "src/App.java",
        file2: "src/utils.ts",
        sameCommits: 2,
        commitsFile1: 4,
        commitsFile2: 3,
        latestCommit: "2025-01-12",
      })

      expect(existsSync(join(reportsFolder, "data", "temporal_dependencies_30_days.txt"))).toBe(true)
      expect(existsSync(join(reportsFolder, "data", "temporal_dependencies_90_days.txt"))).toBe(true)
      expect(existsSync(join(reportsFolder, "data", "temporal_dependencies_180_days.txt"))).toBe(true)
    } finally {
      rmSync(reportsFolder, { recursive: true, force: true })
    }
  })

  test("exportData writes decomposition-aware component dependency JSON", () => {
    const results = new CodeAnalysisResults()

    const primary = new LogicalDecompositionAnalysisResults("primary")
    const codeanalyzerToCommon = new ComponentDependency("codeanalyzer", "common")
    codeanalyzerToCommon.count = 2
    codeanalyzerToCommon.locFrom = 500

    const reportsToCodeanalyzer = new ComponentDependency("reports", "codeanalyzer")
    reportsToCodeanalyzer.count = 1
    reportsToCodeanalyzer.locFrom = 150

    primary.componentDependencies = [codeanalyzerToCommon, reportsToCodeanalyzer]
    results.logicalDecompositionsAnalysisResults = [primary]

    const reportsFolder = mkdtempSync(join(tmpdir(), "planetnik-component-deps-"))

    try {
      new DataExporter(results, reportsFolder).exportData()

      const exportPath = join(reportsFolder, "data", "component_dependencies.json")
      expect(existsSync(exportPath)).toBe(true)

      const exported = JSON.parse(readFileSync(exportPath, "utf-8")) as {
        title: string
        timestamp: string
        dependencies: Array<{
          decompositionKey: string
          fromComponent: string
          toComponent: string
          count: number
          locFrom: number
          evidenceCount: number
          color?: string
        }>
      }

      expect(exported.title).toBe("Static Component Dependencies")
      expect(exported.dependencies).toEqual([
        {
          decompositionKey: "primary",
          fromComponent: "codeanalyzer",
          toComponent: "common",
          count: 2,
          locFrom: 500,
          evidenceCount: 0,
          color: "",
        },
        {
          decompositionKey: "primary",
          fromComponent: "reports",
          toComponent: "codeanalyzer",
          count: 1,
          locFrom: 150,
          evidenceCount: 0,
          color: "",
        },
      ])
    } finally {
      rmSync(reportsFolder, { recursive: true, force: true })
    }
  })

  test("exportData writes per-contributor detail files with deduplicated activity and structure footprint", () => {
    const results = new CodeAnalysisResults()
    const config = new CodeConfiguration()
    config.srcRoot = "/repo/src"

    const billing = new NamedSourceCodeAspect("Billing")
    const checkout = new NamedSourceCodeAspect("Checkout")
    const payments = new NamedSourceCodeAspect("Payments")

    const orderService = new SourceFile("src/orders/OrderService.java")
    orderService.linesOfCode = 120
    orderService.logicalComponents = [billing]
    orderService.concerns = [payments]
    orderService.fileModificationHistory = new FileModificationHistory(orderService.relativePath)
    orderService.fileModificationHistory.commits.push(
      new CommitInfo("c1", "2025-01-10", "alice@example.com"),
      new CommitInfo("c2", "2025-01-12", "alice@example.com"),
      new CommitInfo("c3", "2025-01-13", "bob@example.com"),
    )
    orderService.fileModificationHistory.dates.push("2025-01-10", "2025-01-12", "2025-01-13")

    const cartService = new SourceFile("src/cart/cart.js")
    cartService.linesOfCode = 40
    cartService.logicalComponents = [checkout]
    cartService.concerns = [payments]
    cartService.fileModificationHistory = new FileModificationHistory(cartService.relativePath)
    cartService.fileModificationHistory.commits.push(
      new CommitInfo("c2", "2025-01-12", "alice@example.com"),
      new CommitInfo("c4", "2025-01-14", "alice@example.com"),
    )
    cartService.fileModificationHistory.dates.push("2025-01-12", "2025-01-14")

    config.main.sourceFiles = [orderService, cartService]
    results.codeConfiguration = config

    const alice = new Contributor("alice@example.com")
    alice.userName = "Alice"
    alice.commitsCount = 3
    alice.firstCommitDate = "2025-01-10"
    alice.latestCommitDate = "2025-01-14"
    alice.activeYears = ["2025"]
    alice.commitDates = ["2025-01-10", "2025-01-12", "2025-01-14"]
    results.contributorsAnalysisResults.contributors = [alice]

    const sharedWithBob = new ComponentDependency("alice@example.com", "bob@example.com")
    sharedWithBob.count = 2
    sharedWithBob.data = [orderService.relativePath, cartService.relativePath]
    results.contributorsAnalysisResults.peopleDependenciesAllTime = [sharedWithBob]

    const reportsFolder = mkdtempSync(join(tmpdir(), "planetnik-data-export-"))

    try {
      new DataExporter(results, reportsFolder).exportData()

      const contributorFile = join(
        reportsFolder,
        "data",
        "contributor_details",
        `${encodeURIComponent("alice@example.com")}.json`,
      )

      expect(existsSync(contributorFile)).toBe(true)

      const exported = JSON.parse(readFileSync(contributorFile, "utf-8")) as {
        email: string
        userName: string
        dailyActivity: Array<{ date: string; commits: number }>
        files: Array<{
          relativePath: string
          extension: string
          commits: number
          logicalComponents: string[]
          concerns: string[]
        }>
        extensions: Array<{ extension: string; commits: number; files: number }>
        logicalComponents: Array<{ name: string; files: number; linesOfCode: number }>
        concerns: Array<{ name: string; files: number; linesOfCode: number }>
        collaborators: Array<{ email: string; sharedFiles: number }>
      }

      expect(exported.email).toBe("alice@example.com")
      expect(exported.userName).toBe("Alice")
      expect(exported.dailyActivity).toEqual([
        { date: "2025-01-10", commits: 1 },
        { date: "2025-01-12", commits: 1 },
        { date: "2025-01-14", commits: 1 },
      ])
      expect(exported.files).toHaveLength(2)
      expect(exported.files[0]).toEqual({
        relativePath: "src/cart/cart.js",
        extension: "js",
        commits: 2,
        logicalComponents: ["Checkout"],
        concerns: ["Payments"],
      })
      expect(exported.files[1]).toEqual({
        relativePath: "src/orders/OrderService.java",
        extension: "java",
        commits: 2,
        logicalComponents: ["Billing"],
        concerns: ["Payments"],
      })
      expect(exported.extensions).toEqual([
        { extension: "java", commits: 2, files: 1 },
        { extension: "js", commits: 2, files: 1 },
      ])
      expect(exported.logicalComponents).toEqual([
        { name: "Billing", files: 1, linesOfCode: 120 },
        { name: "Checkout", files: 1, linesOfCode: 40 },
      ])
      expect(exported.concerns).toEqual([{ name: "Payments", files: 2, linesOfCode: 160 }])
      expect(exported.collaborators).toEqual([{ email: "bob@example.com", sharedFiles: 2 }])
    } finally {
      rmSync(reportsFolder, { recursive: true, force: true })
    }
  })
})
