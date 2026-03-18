import { describe, expect, test } from "bun:test"
import {
  CodeAnalysisResults,
  CommitInfo,
  Dependency,
  DependencyAnchor,
  DuplicatedFileBlock,
  DuplicationInstance,
  FileModificationHistory,
  SourceFile,
  SourceFileDependency,
} from "@planetnik/analyzer"
import { DataExportUtils } from "../exporters/DataExportUtils"
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

    const dep = new Dependency()
    dep.from = fromAnchor
    dep.to = toAnchor
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
