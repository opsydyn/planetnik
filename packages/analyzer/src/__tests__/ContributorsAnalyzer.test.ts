import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ContributorsAnalyzer } from "../analysis/ContributorsAnalyzer.js"
import { FileHistoryAnalyzer } from "../analysis/FileHistoryAnalyzer.js"
import { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import { SourceFile } from "../aspects/SourceFile.js"
import { CodeConfiguration } from "../core/CodeConfiguration.js"
import { DateUtils } from "../filehistory/FileHistoryUtils.js"
import { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"

const WORKSPACE = join(import.meta.dir, "__contributors_workspace__")
const CONFIG_DIR = join(WORKSPACE, "_sokrates")
const CONFIG_FILE = join(CONFIG_DIR, "config.json")
const HISTORY_FILE = join(WORKSPACE, "git-history.txt")

// Multiple contributors, multiple dates across months/years
const GIT_HISTORY = `2023-06-10 alice@example.com c1 src/App.java
2023-06-10 alice@example.com c1 src/utils.ts
2023-09-15 bob@example.com c2 src/App.java
2023-09-15 bob@example.com c2 src/helpers.ts
2024-01-20 alice@example.com c3 src/utils.ts
2024-01-20 alice@example.com c3 src/helpers.ts
2024-03-05 charlie@example.com c4 src/App.java
2024-06-01 bob@example.com c5 src/utils.ts
2024-06-01 bob@example.com c5 src/App.java
2024-11-10 alice@example.com c6 src/App.java
2024-11-10 alice@example.com c6 src/utils.ts
2024-11-10 alice@example.com c6 src/helpers.ts
`

beforeEach(() => {
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true })
  mkdirSync(join(WORKSPACE, "src"), { recursive: true })
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(join(WORKSPACE, "src", "App.java"), "public class App {}")
  writeFileSync(join(WORKSPACE, "src", "utils.ts"), "export const x = 1")
  writeFileSync(join(WORKSPACE, "src", "helpers.ts"), "export const y = 2")
  writeFileSync(HISTORY_FILE, GIT_HISTORY)

  // Fix analysis date for deterministic tests
  DateUtils.setDateParam("2025-01-01")
})

afterEach(() => {
  DateUtils.reset()
  if (existsSync(WORKSPACE)) rmSync(WORKSPACE, { recursive: true })
})

function createResults(): CodeAnalysisResults {
  const config = new CodeConfiguration()
  config.extensions = ["java", "ts"]
  config.srcRoot = WORKSPACE

  const files = [
    new SourceFile("src/App.java", "public class App {}"),
    new SourceFile("src/utils.ts", "export const x = 1"),
    new SourceFile("src/helpers.ts", "export const y = 2"),
  ]
  for (const f of files) f.linesOfCode = 1

  config.main = new NamedSourceCodeAspect("main")
  config.main.sourceFiles = files

  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")

  const results = new CodeAnalysisResults()
  results.codeConfiguration = config

  // Run FileHistoryAnalyzer first to populate history
  new FileHistoryAnalyzer(results, CONFIG_FILE).analyze()

  return results
}

describe("ContributorsAnalyzer", () => {
  test("builds contributor list from git history", () => {
    const results = createResults()
    new ContributorsAnalyzer(results, CONFIG_FILE).analyze()

    const contributors = results.contributorsAnalysisResults.contributors
    expect(contributors.length).toBe(3) // alice, bob, charlie

    // Sorted by commit count desc: alice(3), bob(2), charlie(1)
    expect(contributors[0].email).toBe("alice@example.com")
    expect(contributors[0].commitsCount).toBe(3)
    expect(contributors[1].email).toBe("bob@example.com")
    expect(contributors[1].commitsCount).toBe(2)
    expect(contributors[2].email).toBe("charlie@example.com")
    expect(contributors[2].commitsCount).toBe(1)
  })

  test("tracks first and latest commit dates per contributor", () => {
    const results = createResults()
    new ContributorsAnalyzer(results, CONFIG_FILE).analyze()

    const alice = results.contributorsAnalysisResults.contributors.find((c) => c.email === "alice@example.com")!
    expect(alice.firstCommitDate).toBe("2023-06-10")
    expect(alice.latestCommitDate).toBe("2024-11-10")
  })

  test("sets latest commit date on results", () => {
    const results = createResults()
    new ContributorsAnalyzer(results, CONFIG_FILE).analyze()

    expect(results.contributorsAnalysisResults.latestCommitDate).toBe("2024-11-10")
  })

  test("computes contributors per year", () => {
    const results = createResults()
    new ContributorsAnalyzer(results, CONFIG_FILE).analyze()

    const perYear = results.contributorsAnalysisResults.contributorsPerYear
    expect(perYear.length).toBe(2) // 2023 and 2024

    const y2023 = perYear.find((s) => s.timeSlot === "2023")!
    expect(y2023.contributorsCount).toBe(2) // alice and bob in 2023

    const y2024 = perYear.find((s) => s.timeSlot === "2024")!
    expect(y2024.contributorsCount).toBe(3) // alice, bob, charlie in 2024
  })

  test("computes contributors per month", () => {
    const results = createResults()
    new ContributorsAnalyzer(results, CONFIG_FILE).analyze()

    const perMonth = results.contributorsAnalysisResults.contributorsPerMonth
    expect(perMonth.length).toBeGreaterThan(0)

    // June 2023 should have 1 contributor (alice)
    const jun23 = perMonth.find((s) => s.timeSlot === "2023-06")
    expect(jun23).toBeDefined()
    expect(jun23!.contributorsCount).toBe(1)
  })

  test("computes people dependencies", () => {
    const results = createResults()
    new ContributorsAnalyzer(results, CONFIG_FILE).analyze()

    // 365-day window from 2025-01-01 covers all of 2024
    // In 2024: alice touched App.java, utils.ts, helpers.ts
    //          bob touched utils.ts, App.java
    //          charlie touched App.java
    // So alice-bob share files, alice-charlie share files, bob-charlie share files
    const deps365 = results.contributorsAnalysisResults.peopleDependencies365Days
    expect(deps365.length).toBeGreaterThan(0)
  })

  test("adds contributor count metric", () => {
    const results = createResults()
    new ContributorsAnalyzer(results, CONFIG_FILE).analyze()

    const metric = results.metricsList.metrics.find((m) => m.id.includes("NUMBER_OF_CONTRIBUTORS"))
    expect(metric).toBeDefined()
    expect(metric!.value).toBe(3)
  })

  test("does nothing when no history file exists", () => {
    rmSync(HISTORY_FILE)
    const results = createResults()
    new ContributorsAnalyzer(results, CONFIG_FILE).analyze()

    expect(results.contributorsAnalysisResults.contributors.length).toBe(0)
  })
})
