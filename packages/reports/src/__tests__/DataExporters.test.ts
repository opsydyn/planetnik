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
  ControlStatus,
  Contributor,
  Dependency,
  DependencyAnchor,
  DuplicatedFileBlock,
  DuplicationInstance,
  FileModificationHistory,
  GoalsAnalysisResults,
  LogicalDecompositionAnalysisResults,
  MetricRangeControl,
  MetricsWithGoal,
  NamedSourceCodeAspect,
  NumericMetric,
  Range,
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

    const makePair = (file1: string, file2: string, sharedCommits: number, latestCommit: string) => ({
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

  test("exportData writes structured controls JSON", () => {
    const results = new CodeAnalysisResults()

    const metric = results.metricsList
      .addMetric()
      .setId("VERY_HIGH_RISK_FILE_SIZE_COUNT")
      .setValue(7)
      .setDescription("Count of very high risk files")

    const goalResult = new GoalsAnalysisResults()
    goalResult.metricsWithGoal = MetricsWithGoal.make({
      goal: "Maintainability",
      description: "Keep structural risk within agreed bounds",
      controls: [
        MetricRangeControl.make({
          metric: "VERY_HIGH_RISK_FILE_SIZE_COUNT",
          description: "Very high risk file count should stay low",
          desiredRange: Range.make({ min: "0", max: "5", tolerance: "1" }),
        }),
      ],
    })

    const controlStatus = new ControlStatus()
    controlStatus.control = goalResult.metricsWithGoal.controls[0]!
    controlStatus.metric = metric
    controlStatus.status = "FAILED"
    goalResult.controlStatuses = [controlStatus]
    results.controlResults.goalsAnalysisResults = [goalResult]

    const reportsFolder = mkdtempSync(join(tmpdir(), "planetnik-controls-"))

    try {
      new DataExporter(results, reportsFolder).exportData()

      const exportPath = join(reportsFolder, "data", "controls.json")
      expect(existsSync(exportPath)).toBe(true)

      const exported = JSON.parse(readFileSync(exportPath, "utf-8")) as {
        title: string
        timestamp: string
        goals: Array<{
          goal: string
          description: string
          controls: Array<{
            metricId: string
            metricValue: number | null
            metricDescription: string
            desiredRange: { min: string; max: string; tolerance: string }
            desiredRangeText: string
            status: string
            controlDescription: string
          }>
        }>
      }

      expect(exported.title).toBe("Goals & Controls")
      expect(exported.goals).toEqual([
        {
          goal: "Maintainability",
          description: "Keep structural risk within agreed bounds",
          controls: [
            {
              metricId: "VERY_HIGH_RISK_FILE_SIZE_COUNT",
              metricValue: 7,
              metricDescription: "Count of very high risk files",
              desiredRange: {
                min: "0",
                max: "5",
                tolerance: "1",
              },
              desiredRangeText: "[0 - 5] ±1",
              status: "FAILED",
              controlDescription: "Very high risk file count should stay low",
            },
          ],
        },
      ])
    } finally {
      rmSync(reportsFolder, { recursive: true, force: true })
    }
  })

  test("exportData writes structured findings JSON from manual findings HTML", () => {
    const results = new CodeAnalysisResults()
    const reportsFolder = mkdtempSync(join(tmpdir(), "planetnik-findings-"))
    const findingsHtml = `
<finding>
  <summary>Risky payment shortcut</summary>
  <body><p>Checkout bypasses normal validation in one path.</p><p>Review the fallback branch.</p></body>
</finding>
<finding>
  <summary>Legacy retry loop</summary>
  <body><p>There is a retry loop with unclear backoff behavior.</p></body>
</finding>
`

    try {
      new DataExporter(results, reportsFolder, findingsHtml).exportData()

      const exportPath = join(reportsFolder, "data", "findings.json")
      expect(existsSync(exportPath)).toBe(true)

      const exported = JSON.parse(readFileSync(exportPath, "utf-8")) as {
        title: string
        items: Array<{ id: string; summary: string; bodyHtml: string; bodyText: string }>
      }

      expect(exported.title).toBe("Notes & Findings")
      expect(exported.items).toHaveLength(2)
      expect(exported.items[0]).toEqual(
        expect.objectContaining({
          id: "finding-1",
          summary: "Risky payment shortcut",
        }),
      )
      expect(exported.items[0]!.bodyHtml).toContain("Checkout bypasses normal validation")
      expect(exported.items[0]!.bodyText).toContain("Review the fallback branch.")
      expect(exported.items[1]!.summary).toBe("Legacy retry loop")
    } finally {
      rmSync(reportsFolder, { recursive: true, force: true })
    }
  })

  test("exportData writes hotspot rankings for files, units, and components", () => {
    const results = new CodeAnalysisResults()
    const config = new CodeConfiguration()

    const billing = new NamedSourceCodeAspect("Billing")
    billing.filtering = "primary"
    billing.sourceFiles = []

    const orderService = new SourceFile("src/orders/OrderService.java")
    orderService.linesOfCode = 620
    orderService.logicalComponents = [billing]
    orderService.fileModificationHistory = new FileModificationHistory(orderService.relativePath)
    orderService.fileModificationHistory.commits.push(
      new CommitInfo("c1", "2025-01-10", "alice@example.com"),
      new CommitInfo("c2", "2025-01-12", "alice@example.com"),
      new CommitInfo("c3", "2025-01-13", "alice@example.com"),
      new CommitInfo("c4", "2025-01-14", "alice@example.com"),
      new CommitInfo("c5", "2025-01-15", "alice@example.com"),
      new CommitInfo("c6", "2025-01-16", "alice@example.com"),
      new CommitInfo("c7", "2025-01-17", "alice@example.com"),
      new CommitInfo("c8", "2025-01-18", "alice@example.com"),
      new CommitInfo("c9", "2025-01-19", "alice@example.com"),
      new CommitInfo("c10", "2025-01-20", "alice@example.com"),
      new CommitInfo("c11", "2025-01-21", "alice@example.com"),
      new CommitInfo("c12", "2025-01-22", "alice@example.com"),
    )
    orderService.fileModificationHistory.dates.push(
      "2025-01-10",
      "2025-01-12",
      "2025-01-13",
      "2025-01-14",
      "2025-01-15",
      "2025-01-16",
      "2025-01-17",
      "2025-01-18",
      "2025-01-19",
      "2025-01-20",
      "2025-01-21",
      "2025-01-22",
    )

    const helper = new SourceFile("src/orders/Helper.java")
    helper.linesOfCode = 120
    helper.logicalComponents = [billing]
    helper.fileModificationHistory = new FileModificationHistory(helper.relativePath)
    helper.fileModificationHistory.commits.push(new CommitInfo("c13", "2025-01-11", "bob@example.com"))
    helper.fileModificationHistory.dates.push("2025-01-11")

    config.main.sourceFiles = [orderService, helper]
    results.codeConfiguration = config

    const unit = {
      shortName: "calculateTotals",
      longName: "calculateTotals(Order order)",
      linesOfCode: 70,
      mcCabeIndex: 14,
      numberOfParameters: 5,
      startLine: 20,
      endLine: 90,
      sourceFile: orderService,
      cleanedBody: "",
      body: "",
      children: [],
    }
    results.unitsAnalysisResults.allUnits = [unit as any]

    const duplicateBlock = new DuplicatedFileBlock()
    duplicateBlock.sourceFile = orderService
    duplicateBlock.startLine = 10
    duplicateBlock.endLine = 20
    duplicateBlock.cleanedStartLine = 10
    duplicateBlock.cleanedEndLine = 20
    duplicateBlock.sourceFileCleanedLinesOfCode = 50
    const duplicateInstance = new DuplicationInstance()
    duplicateInstance.blockSize = 10
    duplicateInstance.duplicatedFileBlocks = [duplicateBlock]
    results.duplicationAnalysisResults.allDuplicates = [duplicateInstance]

    results.filesHistoryAnalysisResults.filePairsChangedTogether180Days = [
      {
        sourceFile1Path: orderService.relativePath,
        sourceFile2Path: helper.relativePath,
        commitsCountFile1: 12,
        commitsCountFile2: 1,
        commits: ["c1", "c2", "c3", "c4"],
        latestCommit: "2025-01-22",
      },
    ]

    billing.sourceFiles = [orderService, helper]

    const decomposition = new LogicalDecompositionAnalysisResults("primary")
    decomposition.components = [
      {
        name: "Billing",
        filesCount: 2,
        linesOfCode: 740,
        aspect: billing,
      } as any,
    ]
    const dependency = new ComponentDependency("Billing", "Catalog")
    dependency.count = 3
    decomposition.componentDependencies = [dependency]
    results.logicalDecompositionsAnalysisResults = [decomposition]

    const reportsFolder = mkdtempSync(join(tmpdir(), "planetnik-hotspots-"))

    try {
      new DataExporter(results, reportsFolder).exportData()

      const exportPath = join(reportsFolder, "data", "hotspots.json")
      expect(existsSync(exportPath)).toBe(true)

      const exported = JSON.parse(readFileSync(exportPath, "utf-8")) as {
        title: string
        fileHotspots: Array<Record<string, unknown>>
        unitHotspots: Array<Record<string, unknown>>
        componentHotspots: Array<Record<string, unknown>>
      }

      expect(exported.title).toBe("Planetnik Hotspots")
      expect(exported.fileHotspots[0]!.id).toBe(`file:${orderService.relativePath}`)
      expect(exported.fileHotspots[0]!.reasons).toContain("single-contributor knowledge concentration")
      expect(exported.fileHotspots[0]!.dominantDimension).toBe("knowledgeRisk")
      expect(exported.fileHotspots[0]!.suggestedAction).toContain("Broaden ownership")
      expect((exported.fileHotspots[0]!.dimensions as Record<string, number>).knowledgeRisk ?? 0).toBeGreaterThan(
        (exported.fileHotspots[0]!.dimensions as Record<string, number>).coordinationCost ?? 0,
      )
      expect(exported.unitHotspots[0]!.id).toBe(`unit:${orderService.relativePath}:20`)
      expect(exported.unitHotspots[0]!.reasons).toContain("high conditional complexity (14)")
      expect(exported.unitHotspots[0]!.suggestedAction).toContain("Broaden ownership")
      expect(exported.componentHotspots[0]!.id).toBe("component:primary:Billing")
      expect(exported.componentHotspots[0]!.reasons).toContain("low contributor backup")
      expect(exported.componentHotspots[0]!.dominantDimension).toBe("knowledgeRisk")
    } finally {
      rmSync(reportsFolder, { recursive: true, force: true })
    }
  })

  test("exportData writes structured impact JSON with canonical dimensions and snacking candidates", () => {
    const results = new CodeAnalysisResults()
    const config = new CodeConfiguration()

    const billing = new NamedSourceCodeAspect("Billing")
    billing.filtering = "primary"
    billing.sourceFiles = []

    const catalog = new NamedSourceCodeAspect("Catalog")
    catalog.filtering = "primary"
    catalog.sourceFiles = []

    const orderService = new SourceFile("src/orders/OrderService.java")
    orderService.linesOfCode = 620
    orderService.logicalComponents = [billing]
    orderService.fileModificationHistory = new FileModificationHistory(orderService.relativePath)
    for (let index = 1; index <= 12; index += 1) {
      const day = `${9 + index}`.padStart(2, "0")
      orderService.fileModificationHistory.commits.push(
        new CommitInfo(`c${index}`, `2025-01-${day}`, "alice@example.com"),
      )
      orderService.fileModificationHistory.dates.push(`2025-01-${day}`)
    }

    const helper = new SourceFile("src/orders/Helper.java")
    helper.linesOfCode = 120
    helper.logicalComponents = [billing]
    helper.fileModificationHistory = new FileModificationHistory(helper.relativePath)
    helper.fileModificationHistory.commits.push(new CommitInfo("c13", "2025-01-11", "bob@example.com"))
    helper.fileModificationHistory.dates.push("2025-01-11")

    const statusFile = new SourceFile("src/orders/Status.java")
    statusFile.linesOfCode = 20
    statusFile.logicalComponents = [billing]
    statusFile.fileModificationHistory = new FileModificationHistory(statusFile.relativePath)
    const statusCommits = [
      new CommitInfo("s1", "2025-01-05", "alice@example.com"),
      new CommitInfo("s2", "2025-01-06", "bob@example.com"),
      new CommitInfo("s3", "2025-01-07", "carol@example.com"),
      new CommitInfo("s4", "2025-01-08", "alice@example.com"),
      new CommitInfo("s5", "2025-01-09", "bob@example.com"),
      new CommitInfo("s6", "2025-01-10", "carol@example.com"),
      new CommitInfo("s7", "2025-01-11", "alice@example.com"),
      new CommitInfo("s8", "2025-01-12", "bob@example.com"),
    ]
    statusFile.fileModificationHistory.commits.push(...statusCommits)
    statusFile.fileModificationHistory.dates.push(...statusCommits.map((commit) => commit.date))

    const catalogService = new SourceFile("src/catalog/CatalogService.java")
    catalogService.linesOfCode = 200
    catalogService.logicalComponents = [catalog]
    catalogService.fileModificationHistory = new FileModificationHistory(catalogService.relativePath)
    catalogService.fileModificationHistory.commits.push(
      new CommitInfo("k1", "2025-01-09", "carol@example.com"),
      new CommitInfo("k2", "2025-01-14", "carol@example.com"),
    )
    catalogService.fileModificationHistory.dates.push("2025-01-09", "2025-01-14")

    config.main.sourceFiles = [orderService, helper, statusFile, catalogService]
    results.codeConfiguration = config

    const unit = {
      shortName: "calculateTotals",
      longName: "calculateTotals(Order order)",
      linesOfCode: 70,
      mcCabeIndex: 14,
      numberOfParameters: 5,
      startLine: 20,
      endLine: 90,
      sourceFile: orderService,
      cleanedBody: "",
      body: "",
      children: [],
    }
    results.unitsAnalysisResults.allUnits = [unit as any]

    const duplicateBlock = new DuplicatedFileBlock()
    duplicateBlock.sourceFile = orderService
    duplicateBlock.startLine = 10
    duplicateBlock.endLine = 20
    duplicateBlock.cleanedStartLine = 10
    duplicateBlock.cleanedEndLine = 20
    duplicateBlock.sourceFileCleanedLinesOfCode = 50
    const duplicateInstance = new DuplicationInstance()
    duplicateInstance.blockSize = 10
    duplicateInstance.duplicatedFileBlocks = [duplicateBlock]
    results.duplicationAnalysisResults.allDuplicates = [duplicateInstance]

    results.filesHistoryAnalysisResults.filePairsChangedTogether180Days = [
      {
        sourceFile1Path: orderService.relativePath,
        sourceFile2Path: helper.relativePath,
        commitsCountFile1: 12,
        commitsCountFile2: 1,
        commits: ["c1", "c2", "c3", "c4"],
        latestCommit: "2025-01-20",
      },
      {
        sourceFile1Path: orderService.relativePath,
        sourceFile2Path: statusFile.relativePath,
        commitsCountFile1: 12,
        commitsCountFile2: 8,
        commits: ["c5", "c6", "c7"],
        latestCommit: "2025-01-19",
      },
    ]

    billing.sourceFiles = [orderService, helper, statusFile]
    catalog.sourceFiles = [catalogService]

    const decomposition = new LogicalDecompositionAnalysisResults("primary")
    decomposition.components = [
      {
        name: "Billing",
        filesCount: 3,
        linesOfCode: 760,
        aspect: billing,
      } as any,
      {
        name: "Catalog",
        filesCount: 1,
        linesOfCode: 200,
        aspect: catalog,
      } as any,
    ]

    const billingToCatalog = new ComponentDependency("Billing", "Catalog")
    billingToCatalog.count = 3
    const catalogToBilling = new ComponentDependency("Catalog", "Billing")
    catalogToBilling.count = 1
    decomposition.componentDependencies = [billingToCatalog, catalogToBilling]
    results.logicalDecompositionsAnalysisResults = [decomposition]

    const aliceToBob = new ComponentDependency("alice@example.com", "bob@example.com")
    aliceToBob.count = 4
    const bobToCarol = new ComponentDependency("bob@example.com", "carol@example.com")
    bobToCarol.count = 2
    results.contributorsAnalysisResults.peopleDependenciesAllTime = [aliceToBob, bobToCarol]

    const reportsFolder = mkdtempSync(join(tmpdir(), "planetnik-impact-"))

    try {
      new DataExporter(results, reportsFolder).exportData()

      const exportPath = join(reportsFolder, "data", "impact.json")
      expect(existsSync(exportPath)).toBe(true)

      const exported = JSON.parse(readFileSync(exportPath, "utf-8")) as {
        title: string
        visible_activity: {
          commits: number
          contributors: number
          changed_files: number
          changed_units: number
        }
        structural_impact: {
          summary: {
            overall_score: number
            dominant_dimension: string
          }
          dimensions: Record<string, number>
        }
        impact_dimensions: Array<{
          id: string
          label: string
          score: number
          reasons: string[]
        }>
        impact_opportunities: Array<{
          id: string
          kind: string
          dominant_dimension: string
          dimensions: Record<string, number>
          route: string
          reasons: string[]
        }>
        concept_mappings: Array<{
          concept: string
          dimension: string
          evidence_count: number
          example_ids: string[]
        }>
        snacking_candidates: Array<{
          id: string
          kind: string
          name: string
          visible_activity_score: number
          structural_impact_score: number
        }>
      }

      expect(exported.title).toBe("Work on What Matters")
      expect(exported.visible_activity).toEqual({
        commits: 23,
        contributors: 3,
        changed_files: 4,
        changed_units: 1,
      })

      expect(exported.structural_impact.summary.overall_score).toBeGreaterThan(0)
      expect([
        "complexity_reduction",
        "boundary_shaping",
        "knowledge_spread",
        "coordination_relief",
        "change_enablement",
      ]).toContain(exported.structural_impact.summary.dominant_dimension)
      expect(Object.keys(exported.structural_impact.dimensions)).toEqual([
        "complexity_reduction",
        "boundary_shaping",
        "knowledge_spread",
        "coordination_relief",
        "change_enablement",
      ])

      expect(exported.impact_dimensions.map((dimension) => dimension.id)).toEqual([
        "complexity_reduction",
        "boundary_shaping",
        "knowledge_spread",
        "coordination_relief",
        "change_enablement",
      ])
      expect(exported.impact_dimensions.every((dimension) => dimension.reasons.length > 0)).toBe(true)

      expect(exported.impact_opportunities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "component:primary:Billing",
            kind: "component",
            route: "/components",
          }),
          expect.objectContaining({
            id: `file:${orderService.relativePath}`,
            kind: "file",
            route: "/files/churn",
          }),
        ]),
      )

      const billingOpportunity = exported.impact_opportunities.find(
        (opportunity) => opportunity.id === "component:primary:Billing",
      )
      expect(billingOpportunity).toBeDefined()
      expect(billingOpportunity!.dimensions.change_enablement).toBeGreaterThan(0)
      expect(billingOpportunity!.reasons.length).toBeGreaterThan(0)

      expect(exported.concept_mappings.map((mapping) => mapping.dimension)).toEqual([
        "complexity_reduction",
        "boundary_shaping",
        "knowledge_spread",
        "coordination_relief",
        "change_enablement",
      ])

      expect(
        exported.snacking_candidates.every(
          (candidate) => candidate.visible_activity_score > candidate.structural_impact_score,
        ),
      ).toBe(true)
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

  test("exportData writes landscape-friendly analysis summary and structured contributors JSON", () => {
    const results = new CodeAnalysisResults()
    const config = new CodeConfiguration()
    config.metadata = {
      name: "RepoA",
      description: "Repository A",
      tooltip: "Example",
      logoLink: "",
      links: [],
    }
    results.codeConfiguration = config

    results.mainAspectAnalysisResults.filesCount = 1
    results.mainAspectAnalysisResults.linesOfCode = 120
    results.mainAspectAnalysisResults.linesOfCodePerExtension = [new NumericMetric("java", 120)]

    results.testAspectAnalysisResults.filesCount = 1
    results.testAspectAnalysisResults.linesOfCode = 40
    results.testAspectAnalysisResults.linesOfCodePerExtension = [new NumericMetric("java", 40)]

    results.generatedAspectAnalysisResults.filesCount = 0
    results.generatedAspectAnalysisResults.linesOfCode = 0
    results.buildAndDeployAspectAnalysisResults.filesCount = 1
    results.buildAndDeployAspectAnalysisResults.linesOfCode = 12
    results.otherAspectAnalysisResults.filesCount = 1
    results.otherAspectAnalysisResults.linesOfCode = 5

    results.filesHistoryAnalysisResults.firstDate = "2024-01-10"
    results.filesHistoryAnalysisResults.latestDate = "2024-06-20"

    const alice = new Contributor("alice@example.com")
    alice.userName = "Alice"
    alice.commitsCount = 7
    alice.commitsCount30Days = 2
    alice.commitsCount90Days = 4
    alice.commitsCount180Days = 6
    alice.commitsCount365Days = 7
    alice.firstCommitDate = "2024-01-10"
    alice.latestCommitDate = "2024-06-20"
    results.contributorsAnalysisResults.latestCommitDate = "2024-06-20"
    results.contributorsAnalysisResults.contributors = [alice]

    const reportsFolder = mkdtempSync(join(tmpdir(), "planetnik-data-export-"))

    try {
      new DataExporter(results, reportsFolder).exportData()

      const summary = JSON.parse(readFileSync(join(reportsFolder, "data", "analysisResults.json"), "utf-8")) as {
        metadata: { name: string }
        mainAspectAnalysisResults: {
          filesCount: number
          linesOfCode: number
          linesOfCodePerExtension: Array<{ extension: string; linesOfCode: number }>
        }
        testAspectAnalysisResults: { linesOfCode: number }
        buildAndDeployAspectAnalysisResults: { linesOfCode: number }
        otherAspectAnalysisResults: { linesOfCode: number }
        contributorsAnalysisResults: {
          latestCommitDate: string
          contributors: Array<{ email: string; commitsCount: number }>
        }
        filesHistoryAnalysisResults: { firstDate: string; latestDate: string }
      }
      const contributorsJson = JSON.parse(readFileSync(join(reportsFolder, "data", "contributors.json"), "utf-8")) as {
        contributorCount: number
        contributors: Array<{ email: string; userName: string; commitsCount: number }>
      }

      expect(summary.metadata.name).toBe("RepoA")
      expect(summary.mainAspectAnalysisResults).toEqual({
        filesCount: 1,
        linesOfCode: 120,
        linesOfCodePerExtension: [{ extension: "java", linesOfCode: 120 }],
      })
      expect(summary.testAspectAnalysisResults.linesOfCode).toBe(40)
      expect(summary.buildAndDeployAspectAnalysisResults.linesOfCode).toBe(12)
      expect(summary.otherAspectAnalysisResults.linesOfCode).toBe(5)
      expect(summary.contributorsAnalysisResults.latestCommitDate).toBe("2024-06-20")
      expect(summary.contributorsAnalysisResults.contributors).toEqual([
        expect.objectContaining({
          email: "alice@example.com",
          commitsCount: 7,
        }),
      ])
      expect(summary.filesHistoryAnalysisResults).toEqual({
        firstDate: "2024-01-10",
        latestDate: "2024-06-20",
      })

      expect(contributorsJson.contributorCount).toBe(1)
      expect(contributorsJson.contributors).toEqual([
        expect.objectContaining({
          email: "alice@example.com",
          userName: "Alice",
          commitsCount: 7,
        }),
      ])
    } finally {
      rmSync(reportsFolder, { recursive: true, force: true })
    }
  })

  test("exportData truncates duplicate JSON payloads to the maximum export size", () => {
    const results = new CodeAnalysisResults()
    const file = new SourceFile("src/a.ts")
    file.linesOfCode = 100

    const block = new DuplicatedFileBlock()
    block.sourceFile = file
    block.sourceFileCleanedLinesOfCode = 90
    block.startLine = 1
    block.endLine = 10
    block.cleanedStartLine = 1
    block.cleanedEndLine = 10

    const instance = new DuplicationInstance()
    instance.blockSize = 10
    instance.duplicatedFileBlocks = [block]
    results.duplicationAnalysisResults.allDuplicates = Array.from(
      { length: DataExporter.MAX_EXPORT_LIST_SIZE + 1 },
      () => instance,
    )

    const reportsFolder = mkdtempSync(join(tmpdir(), "planetnik-data-export-"))

    try {
      new DataExporter(results, reportsFolder).exportData()

      const duplicates = JSON.parse(readFileSync(join(reportsFolder, "data", "duplicates.json"), "utf-8")) as {
        duplicates: unknown[]
        totalDuplicatesCount: number
        truncated: boolean
      }

      expect(duplicates.totalDuplicatesCount).toBe(DataExporter.MAX_EXPORT_LIST_SIZE + 1)
      expect(duplicates.truncated).toBe(true)
      expect(duplicates.duplicates).toHaveLength(DataExporter.MAX_EXPORT_LIST_SIZE)
    } finally {
      rmSync(reportsFolder, { recursive: true, force: true })
    }
  })

  test("exportData writes contributor impact JSON with period summaries and glue/snacking flags", () => {
    const results = new CodeAnalysisResults()
    const config = new CodeConfiguration()
    config.srcRoot = "/repo/src"

    const core = new NamedSourceCodeAspect("Core")
    const checkout = new NamedSourceCodeAspect("Checkout")
    const docs = new NamedSourceCodeAspect("Docs")

    const serviceFile = new SourceFile("src/core/Service.java")
    serviceFile.linesOfCode = 180
    serviceFile.logicalComponents = [core]
    serviceFile.fileModificationHistory = new FileModificationHistory(serviceFile.relativePath)
    serviceFile.fileModificationHistory.commits.push(
      new CommitInfo("c1", "2026-03-10", "alice@example.com"),
      new CommitInfo("c2", "2026-03-11", "alice@example.com"),
      new CommitInfo("c3", "2026-03-11", "bob@example.com"),
    )
    serviceFile.fileModificationHistory.dates.push("2026-03-10", "2026-03-11", "2026-03-11")

    const checkoutFile = new SourceFile("src/checkout/Flow.java")
    checkoutFile.linesOfCode = 140
    checkoutFile.logicalComponents = [checkout]
    checkoutFile.fileModificationHistory = new FileModificationHistory(checkoutFile.relativePath)
    checkoutFile.fileModificationHistory.commits.push(
      new CommitInfo("c10", "2026-03-12", "alice@example.com"),
      new CommitInfo("c11", "2026-03-12", "carol@example.com"),
    )
    checkoutFile.fileModificationHistory.dates.push("2026-03-12", "2026-03-12")

    const docsFile = new SourceFile("src/docs/rename.js")
    docsFile.linesOfCode = 20
    docsFile.logicalComponents = [docs]
    docsFile.fileModificationHistory = new FileModificationHistory(docsFile.relativePath)
    docsFile.fileModificationHistory.commits.push(
      new CommitInfo("c4", "2026-03-12", "dave@example.com"),
      new CommitInfo("c5", "2026-03-13", "dave@example.com"),
      new CommitInfo("c6", "2026-03-14", "dave@example.com"),
      new CommitInfo("c7", "2026-03-15", "dave@example.com"),
      new CommitInfo("c8", "2026-03-16", "dave@example.com"),
      new CommitInfo("c9", "2026-03-17", "dave@example.com"),
      new CommitInfo("c12", "2026-03-18", "dave@example.com"),
      new CommitInfo("c13", "2026-03-18", "dave@example.com"),
      new CommitInfo("c14", "2026-03-19", "dave@example.com"),
      new CommitInfo("c15", "2026-03-19", "dave@example.com"),
      new CommitInfo("c16", "2026-03-19", "dave@example.com"),
      new CommitInfo("c17", "2026-03-19", "dave@example.com"),
    )
    docsFile.fileModificationHistory.dates.push(
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
      "2026-03-15",
      "2026-03-16",
      "2026-03-17",
      "2026-03-18",
      "2026-03-18",
      "2026-03-19",
      "2026-03-19",
      "2026-03-19",
      "2026-03-19",
    )

    config.main.sourceFiles = [serviceFile, checkoutFile, docsFile]
    results.codeConfiguration = config

    const alice = new Contributor("alice@example.com")
    alice.userName = "Alice"
    const bob = new Contributor("bob@example.com")
    bob.userName = "Bob"
    const carol = new Contributor("carol@example.com")
    carol.userName = "Carol"
    const dave = new Contributor("dave@example.com")
    dave.userName = "Dave"
    results.contributorsAnalysisResults.contributors = [alice, bob, carol, dave]

    const aliceBob = new ComponentDependency("alice@example.com", "bob@example.com")
    aliceBob.count = 3
    const aliceCarol = new ComponentDependency("alice@example.com", "carol@example.com")
    aliceCarol.count = 2
    results.contributorsAnalysisResults.peopleDependenciesAllTime = [aliceBob, aliceCarol]
    results.contributorsAnalysisResults.peopleDependencies30Days = [aliceBob, aliceCarol]

    const reportsFolder = mkdtempSync(join(tmpdir(), "planetnik-contributor-impact-"))

    try {
      new DataExporter(results, reportsFolder).exportData()

      const exportPath = join(reportsFolder, "data", "contributor_impact.json")
      expect(existsSync(exportPath)).toBe(true)

      const exported = JSON.parse(readFileSync(exportPath, "utf-8")) as {
        title: string
        periods: Array<{
          period_key: string
          period_label: string
          contributors: Array<{
            email: string
            display_name: string
            glue_score: number
            snacking_score: number
            is_glue: boolean
            is_snacking: boolean
            top_routes: string[]
          }>
        }>
      }

      expect(exported.title).toBe("Contributor Impact")
      expect(exported.periods.map((period) => period.period_key)).toEqual(["all_time", "30d", "90d", "180d", "365d"])

      const allTime = exported.periods[0]!
      const aliceImpact = allTime.contributors.find((contributor) => contributor.email === "alice@example.com")
      const daveImpact = allTime.contributors.find((contributor) => contributor.email === "dave@example.com")

      expect(aliceImpact?.is_glue).toBe(true)
      expect(aliceImpact?.top_routes).toContain("/topology")
      expect(daveImpact?.is_snacking).toBe(true)
      expect(daveImpact?.snacking_score).toBeGreaterThan(0)
    } finally {
      rmSync(reportsFolder, { recursive: true, force: true })
    }
  })
})
