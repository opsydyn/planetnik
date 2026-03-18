import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CodeAnalyzer } from "../analysis/CodeAnalyzer.js"
import { CodeAnalyzerSettings } from "../core/CodeAnalyzerSettings.js"
import { CodeConfiguration } from "../core/CodeConfiguration.js"
import { DateUtils } from "../filehistory/FileHistoryUtils.js"

const WORKSPACE = join(import.meta.dir, "__smoke_workspace__")
const CONFIG_DIR = join(WORKSPACE, "_planetnik")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")

const JAVA_FILE = `package com.example;

public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }

    public int subtract(int a, int b) {
        return a - b;
    }

    public int multiply(int a, int b) {
        int result = 0;
        for (int i = 0; i < b; i++) {
            result += a;
        }
        return result;
    }
}
`

const TS_FILE = `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export function sum(numbers: number[]): number {
  let total = 0
  for (const n of numbers) {
    total += n
  }
  return total
}

export class StringUtils {
  static capitalize(s: string): string {
    if (s.length === 0) return s
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
}
`

const PY_FILE = `def hello(name):
    """Say hello"""
    return f"Hello, {name}!"

def add(a, b):
    return a + b

class Calculator:
    def multiply(self, a, b):
        result = 0
        for i in range(b):
            result += a
        return result
`

const TEST_FILE = `import { describe, test, expect } from "bun:test"
import { greet } from "../src/utils"

describe("Utils", () => {
  test("greet", () => {
    expect(greet("World")).toBe("Hello, World!")
  })
})
`

const GIT_HISTORY = `2024-01-10 alice@example.com c1 src/Calculator.java
2024-02-15 bob@example.com c2 src/Calculator.java
2024-02-15 bob@example.com c2 src/utils.ts
2024-03-20 alice@example.com c3 src/utils.ts
2024-03-20 alice@example.com c3 src/calc.py
2024-05-10 charlie@example.com c4 src/calc.py
2024-07-01 alice@example.com c5 src/Calculator.java
2024-07-01 alice@example.com c5 src/utils.ts
2024-09-15 bob@example.com c6 test/utils.test.ts
2024-11-01 alice@example.com c7 src/Calculator.java
2024-11-01 alice@example.com c7 src/calc.py
2024-11-01 alice@example.com c7 src/utils.ts
`

beforeEach(() => {
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true })
  mkdirSync(join(WORKSPACE, "src"), { recursive: true })
  mkdirSync(join(WORKSPACE, "test"), { recursive: true })
  mkdirSync(CONFIG_DIR, { recursive: true })

  writeFileSync(join(WORKSPACE, "src", "Calculator.java"), JAVA_FILE)
  writeFileSync(join(WORKSPACE, "src", "utils.ts"), TS_FILE)
  writeFileSync(join(WORKSPACE, "src", "calc.py"), PY_FILE)
  writeFileSync(join(WORKSPACE, "test", "utils.test.ts"), TEST_FILE)
  writeFileSync(join(WORKSPACE, "git-history.txt"), GIT_HISTORY)

  DateUtils.setDateParam("2025-01-01")
})

afterEach(() => {
  DateUtils.reset()
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true })
})

describe("Smoke Test: Full Pipeline on Multi-Language Project", () => {
  test("runs all analyzers end-to-end", () => {
    const config = new CodeConfiguration()
    config.metadata.name = "SmokeProject"
    config.extensions = ["java", "ts", "py"]
    config.srcRoot = WORKSPACE

    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")

    const settings = CodeAnalyzerSettings.selectAll()
    const analyzer = new CodeAnalyzer(settings, config, CONFIG_FILE)
    const results = analyzer.analyze()

    // --- BasicsAnalyzer ---
    expect(results.mainAspectAnalysisResults.filesCount).toBeGreaterThan(0)
    expect(results.mainAspectAnalysisResults.linesOfCode).toBeGreaterThan(0)
    expect(results.totalNumberOfFilesInScope).toBeGreaterThan(0)

    // --- FileSizeAnalyzer ---
    expect(results.filesAnalysisResults.overallFileSizeDistribution).not.toBeNull()

    // --- UnitsAnalyzer ---
    expect(results.unitsAnalysisResults.totalNumberOfUnits).toBeGreaterThan(0)
    // Java: add, subtract, multiply; TS: greet, sum, capitalize; Python: hello, add, multiply
    expect(results.unitsAnalysisResults.allUnits.length).toBeGreaterThanOrEqual(3)

    // --- DuplicationAnalyzer ---
    expect(results.duplicationAnalysisResults.overallDuplication).toBeDefined()

    // --- FileHistoryAnalyzer ---
    const histResults = results.filesHistoryAnalysisResults
    expect(histResults.history.length).toBeGreaterThan(0)
    expect(histResults.firstDate).toBe("2024-01-10")
    expect(histResults.latestDate).toBe("2024-11-01")
    expect(histResults.activeDays).toBe(7)
    expect(histResults.ageRiskDistribution).not.toBeNull()
    expect(histResults.oldestFiles.length).toBeGreaterThan(0)
    expect(histResults.mostChangedFiles.length).toBeGreaterThan(0)

    // --- ContributorsAnalyzer ---
    const contribResults = results.contributorsAnalysisResults
    expect(contribResults.contributors.length).toBe(3) // alice, bob, charlie
    expect(contribResults.latestCommitDate).toBe("2024-11-01")
    expect(contribResults.contributorsPerYear.length).toBe(1) // all in 2024
    expect(contribResults.contributorsPerMonth.length).toBeGreaterThan(0)

    // alice has the most commits
    expect(contribResults.contributors[0]!.email).toBe("alice@example.com")

    // --- ControlsAnalyzer ---
    // No controls configured, so no goal results, but no crash
    expect(results.controlResults).toBeDefined()

    // --- Metrics ---
    const metrics = results.metricsList.metrics
    expect(metrics.length).toBeGreaterThan(10)

    const totalFiles = metrics.find((m) => m.id.includes("TOTAL_NUMBER_OF_FILES"))
    expect(totalFiles).toBeDefined()

    const ageDays = metrics.find((m) => m.id.includes("FILE_CHANGE_HISTORY_TOTAL_AGE_DAYS"))
    expect(ageDays).toBeDefined()
    expect(ageDays!.value).toBeGreaterThan(0)

    const contributorCount = metrics.find((m) => m.id.includes("NUMBER_OF_CONTRIBUTORS"))
    expect(contributorCount).toBeDefined()
    expect(contributorCount!.value).toBe(3)

    const analysisTime = metrics.find((m) => m.id.includes("TOTAL_ANALYSIS_TIME"))
    expect(analysisTime).toBeDefined()
    expect(analysisTime!.value).toBeGreaterThan(0)
  })
})
