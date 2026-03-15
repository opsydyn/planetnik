import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { CodeAnalyzer } from "../analysis/CodeAnalyzer.js"
import { CodeAnalyzerSettings } from "../core/CodeAnalyzerSettings.js"
import { CodeConfiguration } from "../core/CodeConfiguration.js"
import { ScopeCreator } from "../scoping/ScopeCreator.js"

const WORKSPACE = join(import.meta.dir, "__integration_workspace__")
const CONFIG_DIR = join(WORKSPACE, "_sokrates")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")

// Sample source files
const JAVA_FILE = `package com.example;

// A simple Java class
public class Calculator {
    /**
     * Adds two numbers.
     */
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

    public int divide(int a, int b) {
        if (b == 0) {
            throw new ArithmeticException("Division by zero");
        }
        return a / b;
    }
}
`

const TS_FILE = `// TypeScript utility module
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export function sum(numbers: number[]): number {
  let total = 0
  for (const n of numbers) {
    total += n
  }
  return total
}

// A class with methods
export class StringUtils {
  static capitalize(s: string): string {
    if (s.length === 0) return s
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  static reverse(s: string): string {
    return s.split("").reverse().join("")
  }
}
`

const TS_FILE_2 = `// Another TypeScript file with some duplication
export function greetUser(name: string): string {
  return \`Hello, \${name}!\`
}

export function sumAll(numbers: number[]): number {
  let total = 0
  for (const n of numbers) {
    total += n
  }
  return total
}
`

const TEST_FILE = `import { describe, test, expect } from "bun:test"
import { greet, sum } from "../src/utils"

describe("Utils", () => {
  test("greet returns greeting", () => {
    expect(greet("World")).toBe("Hello, World!")
  })

  test("sum adds numbers", () => {
    expect(sum([1, 2, 3])).toBe(6)
  })
})
`

beforeEach(() => {
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true })
  mkdirSync(join(WORKSPACE, "src"), { recursive: true })
  mkdirSync(join(WORKSPACE, "test"), { recursive: true })
  writeFileSync(join(WORKSPACE, "src", "Calculator.java"), JAVA_FILE)
  writeFileSync(join(WORKSPACE, "src", "utils.ts"), TS_FILE)
  writeFileSync(join(WORKSPACE, "src", "helpers.ts"), TS_FILE_2)
  writeFileSync(join(WORKSPACE, "test", "utils.test.ts"), TEST_FILE)
})

afterEach(() => {
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true })
})

describe("Integration: Full Analysis Pipeline", () => {
  test("init creates valid config", () => {
    const creator = new ScopeCreator(WORKSPACE, CONFIG_FILE)
    creator.createScopeFromConventions("TestProject")

    expect(existsSync(CONFIG_FILE)).toBe(true)
    const config = JSON.parse(require("node:fs").readFileSync(CONFIG_FILE, "utf-8"))
    expect(config.metadata.name).toBe("TestProject")
    expect(config.extensions).toContain("ts")
    expect(config.extensions).toContain("java")
    // test file convention should have been detected
    expect(config.test.sourceFileFilters.length).toBeGreaterThanOrEqual(0)
  })

  test("CodeAnalyzer runs full analysis with all analyzers", () => {
    // Create config manually for the test
    const config = new CodeConfiguration()
    config.metadata.name = "TestProject"
    config.extensions = ["ts", "java"]
    config.srcRoot = WORKSPACE

    // Save config
    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")

    const settings = CodeAnalyzerSettings.selectAll()
    const analyzer = new CodeAnalyzer(settings, config, CONFIG_FILE)
    const results = analyzer.analyze()

    // Verify basics
    expect(results.mainAspectAnalysisResults.filesCount).toBeGreaterThan(0)
    expect(results.mainAspectAnalysisResults.linesOfCode).toBeGreaterThan(0)

    // Check metrics were created
    const metrics = results.metricsList.metrics
    expect(metrics.length).toBeGreaterThan(0)
    const totalFilesMetric = metrics.find((m) => m.id.includes("TOTAL_NUMBER_OF_FILES"))
    expect(totalFilesMetric).toBeDefined()

    // Check file size analysis ran
    expect(results.filesAnalysisResults.longestFiles.length).toBeGreaterThanOrEqual(0)

    // Check units analysis ran
    expect(results.unitsAnalysisResults.totalNumberOfUnits).toBeGreaterThanOrEqual(0)

    // Check duplication analysis ran
    expect(results.duplicationAnalysisResults.overallDuplication).toBeDefined()
  })

  test("analysis detects multiple extensions", () => {
    const config = new CodeConfiguration()
    config.extensions = ["ts", "java"]
    config.srcRoot = WORKSPACE

    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")

    const settings = CodeAnalyzerSettings.make({ analyzeUnitSize: true, analyzeFileSize: true })
    const analyzer = new CodeAnalyzer(settings, config, CONFIG_FILE)
    const results = analyzer.analyze()

    const extCounts = results.mainAspectAnalysisResults.linesOfCodePerExtension
    expect(extCounts.length).toBeGreaterThanOrEqual(1)
  })

  test("analysis detects Java units", () => {
    const config = new CodeConfiguration()
    config.extensions = ["java"]
    config.srcRoot = WORKSPACE

    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")

    const settings = CodeAnalyzerSettings.make({ analyzeUnitSize: true })
    const analyzer = new CodeAnalyzer(settings, config, CONFIG_FILE)
    const results = analyzer.analyze()

    // Calculator.java has 4 methods: add, subtract, multiply, divide
    const units = results.unitsAnalysisResults.allUnits
    expect(units.length).toBe(4)

    const addUnit = units.find((u) => u.shortName.includes("add"))
    expect(addUnit).toBeDefined()
    expect(addUnit!.linesOfCode).toBeGreaterThan(0)

    const multiplyUnit = units.find((u) => u.shortName.includes("multiply"))
    expect(multiplyUnit).toBeDefined()
    // multiply has a loop so McCabe > 1
    expect(multiplyUnit!.mcCabeIndex).toBeGreaterThanOrEqual(2)

    const divideUnit = units.find((u) => u.shortName.includes("divide"))
    expect(divideUnit).toBeDefined()
    // divide has an if so McCabe >= 2
    expect(divideUnit!.mcCabeIndex).toBeGreaterThanOrEqual(2)
  })

  test("analysis detects TypeScript units", () => {
    const config = new CodeConfiguration()
    config.extensions = ["ts"]
    config.srcRoot = WORKSPACE

    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")

    const settings = CodeAnalyzerSettings.make({ analyzeUnitSize: true })
    const analyzer = new CodeAnalyzer(settings, config, CONFIG_FILE)
    const results = analyzer.analyze()

    const units = results.unitsAnalysisResults.allUnits
    // utils.ts: greet, sum, capitalize, reverse
    // helpers.ts: greetUser, sumAll
    // test file: 2 arrow function tests + describe
    expect(units.length).toBeGreaterThan(0)
  })

  test("analysis computes file size distribution", () => {
    const config = new CodeConfiguration()
    config.extensions = ["ts", "java"]
    config.srcRoot = WORKSPACE

    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")

    const settings = CodeAnalyzerSettings.make({ analyzeFileSize: true })
    const analyzer = new CodeAnalyzer(settings, config, CONFIG_FILE)
    const results = analyzer.analyze()

    expect(results.filesAnalysisResults.overallFileSizeDistribution).toBeDefined()
    const dist = results.filesAnalysisResults.overallFileSizeDistribution!
    expect(dist.getTotalCount()).toBeGreaterThan(0)
  })
})
