import { beforeAll, describe, expect, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { CodeAnalyzerSettings } from "../../core/CodeAnalyzerSettings.js"
import { CodeConfiguration } from "../../core/CodeConfiguration.js"
import { SourceFileFilter } from "../../core/SourceFileFilter.js"
import { CodeAnalyzer } from "../CodeAnalyzer.js"

function createTempProject(): {
  root: string
  configPath: string
  config: CodeConfiguration
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "planetnik-test-"))
  const srcDir = path.join(root, "src")
  fs.mkdirSync(srcDir, { recursive: true })

  // Create some Java source files
  fs.writeFileSync(
    path.join(srcDir, "Hello.java"),
    `package com.example;

public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello");
    }

    public int add(int a, int b) {
        if (a > 0) {
            return a + b;
        }
        return b;
    }
}
`,
  )

  fs.writeFileSync(
    path.join(srcDir, "World.java"),
    `package com.example;

public class World {
    public String greet(String name) {
        return "Hello, " + name;
    }
}
`,
  )

  fs.writeFileSync(
    path.join(srcDir, "utils.js"),
    `function sum(a, b) {
  return a + b;
}

function multiply(a, b) {
  return a * b;
}
`,
  )

  // Create config
  const configPath = path.join(root, "_planetnik", "config.json")
  fs.mkdirSync(path.join(root, "_planetnik"), { recursive: true })
  fs.writeFileSync(configPath, "{}")

  const config = new CodeConfiguration()
  config.srcRoot = "../src"
  config.extensions = ["java", "js"]
  config.main.sourceFileFilters = [SourceFileFilter.make({ pathPattern: ".*" })]

  return { root, configPath, config }
}

describe("CodeAnalyzer", () => {
  let _root: string
  let configPath: string
  let config: CodeConfiguration

  beforeAll(() => {
    const project = createTempProject()
    _root = project.root
    configPath = project.configPath
    config = project.config
  })

  test("runs full analysis pipeline and returns results", () => {
    const settings = CodeAnalyzerSettings.selectAll()
    const analyzer = new CodeAnalyzer(settings, config, configPath)
    const results = analyzer.analyze()

    expect(results).toBeDefined()
    expect(results.codeConfiguration).toBe(config)
    expect(results.totalNumberOfFilesInScope).toBeGreaterThan(0)
  })

  test("discovers files in main scope", () => {
    const settings = CodeAnalyzerSettings.selectAll()
    const analyzer = new CodeAnalyzer(settings, config, configPath)
    const results = analyzer.analyze()

    // Should find 3 files (2 Java + 1 JS)
    expect(results.mainAspectAnalysisResults.filesCount).toBe(3)
    expect(results.mainAspectAnalysisResults.linesOfCode).toBeGreaterThan(0)
  })

  test("analyzes file size distribution", () => {
    const settings = CodeAnalyzerSettings.selectAll()
    const analyzer = new CodeAnalyzer(settings, config, configPath)
    const results = analyzer.analyze()

    expect(results.filesAnalysisResults.overallFileSizeDistribution).toBeDefined()
    expect(results.filesAnalysisResults.longestFiles.length).toBeGreaterThan(0)
  })

  test("extracts units from source files", () => {
    const settings = CodeAnalyzerSettings.selectAll()
    const analyzer = new CodeAnalyzer(settings, config, configPath)
    const results = analyzer.analyze()

    expect(results.unitsAnalysisResults.totalNumberOfUnits).toBeGreaterThan(0)
    expect(results.unitsAnalysisResults.linesOfCodeInUnits).toBeGreaterThan(0)
    expect(results.unitsAnalysisResults.allUnits.length).toBeGreaterThan(0)
  })

  test("generates metrics for file count and LOC", () => {
    const settings = CodeAnalyzerSettings.selectAll()
    const analyzer = new CodeAnalyzer(settings, config, configPath)
    const results = analyzer.analyze()

    const totalFiles = results.metricsList.getMetricById("TOTAL_NUMBER_OF_FILES")
    expect(totalFiles).toBeDefined()
    expect(totalFiles!.value).toBeGreaterThan(0)

    const analysisTime = results.metricsList.getMetricById("TOTAL_ANALYSIS_TIME_IN_MILLIS")
    expect(analysisTime).toBeDefined()
    expect(analysisTime!.value).toBeGreaterThanOrEqual(0)
  })

  test("generates duplication metrics", () => {
    const settings = CodeAnalyzerSettings.selectAll()
    const analyzer = new CodeAnalyzer(settings, config, configPath)
    const results = analyzer.analyze()

    const dupPercentage = results.metricsList.getMetricById("DUPLICATION_PERCENTAGE")
    expect(dupPercentage).toBeDefined()
  })

  test("respects settings to skip analyzers", () => {
    const settings = CodeAnalyzerSettings.make({
      analyzeFileSize: false,
      analyzeUnitSize: false,
      analyzeConditionalComplexity: false,
      analyzeDuplication: false,
      analyzeConcerns: false,
      analyzeLogicalDecomposition: false,
      analyzeControls: false,
      createMetricsList: false,
    })
    const analyzer = new CodeAnalyzer(settings, config, configPath)
    const results = analyzer.analyze()

    // Basics still runs
    expect(results.mainAspectAnalysisResults.filesCount).toBe(3)

    // But no units analysis
    expect(results.unitsAnalysisResults.totalNumberOfUnits).toBe(0)
    // And no file size distribution
    expect(results.filesAnalysisResults.overallFileSizeDistribution).toBeNull()
  })

  test("generates per-extension metrics", () => {
    const settings = CodeAnalyzerSettings.selectAll()
    const analyzer = new CodeAnalyzer(settings, config, configPath)
    const results = analyzer.analyze()

    // Should have per-extension breakdown
    expect(results.mainAspectAnalysisResults.fileCountPerExtension.length).toBeGreaterThan(0)
    expect(results.mainAspectAnalysisResults.linesOfCodePerExtension.length).toBeGreaterThan(0)
  })
})

describe("ControlsAnalyzer", () => {
  test("evaluates metric against goal range", () => {
    const project = createTempProject()
    const config = project.config
    config.goalsAndControls = [
      {
        goal: "Code quality",
        description: "Keep code clean",
        controls: [
          {
            metric: "TOTAL_NUMBER_OF_FILES",
            description: "Total files",
            desiredRange: { min: "0", max: "100", tolerance: "10" },
          },
        ],
      },
    ]

    const settings = CodeAnalyzerSettings.selectAll()
    const analyzer = new CodeAnalyzer(settings, config, project.configPath)
    const results = analyzer.analyze()

    expect(results.controlResults.goalsAnalysisResults.length).toBe(1)
    const goal = results.controlResults.goalsAnalysisResults[0]!
    expect(goal.controlStatuses.length).toBe(1)
    expect(goal.controlStatuses[0]!.status).toBe("OK")
  })

  test("reports FAILED when metric is out of range", () => {
    const project = createTempProject()
    const config = project.config
    config.goalsAndControls = [
      {
        goal: "Impossible",
        description: "Unreachable goal",
        controls: [
          {
            metric: "TOTAL_NUMBER_OF_FILES",
            description: "Must have 0 files",
            desiredRange: { min: "0", max: "0", tolerance: "0" },
          },
        ],
      },
    ]

    const settings = CodeAnalyzerSettings.selectAll()
    const analyzer = new CodeAnalyzer(settings, config, project.configPath)
    const results = analyzer.analyze()

    expect(results.controlResults.goalsAnalysisResults[0]!.controlStatuses[0]!.status).toBe("FAILED")
  })
})
