import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

interface ProcessResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

const decoder = new TextDecoder()

function run(command: readonly string[], cwd: string): ProcessResult {
  const result = Bun.spawnSync([...command], { cwd, stdout: "pipe", stderr: "pipe" })
  const stdout = decoder.decode(result.stdout)
  const stderr = decoder.decode(result.stderr)
  if (result.exitCode !== 0) {
    throw new Error(`Command failed (${result.exitCode}): ${command.join(" ")}\n${stderr || stdout}`)
  }
  return { stdout, stderr, exitCode: result.exitCode }
}

function assertIncludes(value: string, expected: string, label: string): void {
  if (!value.includes(expected)) {
    throw new Error(`${label} did not include ${JSON.stringify(expected)}`)
  }
}

const cliRoot = resolve(import.meta.dir, "..")
const repositoryRoot = resolve(cliRoot, "../..")
const smokeRoot = mkdtempSync(join(tmpdir(), "planetnik-compile-smoke-"))
const executable = join(smokeRoot, "planetnik")
const sourceRoot = join(smokeRoot, "source")
// ScopeCreator emits srcRoot=".." for configs inside the source's config directory.
const configPath = join(sourceRoot, "_sokrates", "config.json")
const reportsRoot = join(smokeRoot, "reports")

try {
  mkdirSync(sourceRoot, { recursive: true })
  writeFileSync(
    join(sourceRoot, "main.py"),
    ["from typing import Iterable", "", "def total(values: Iterable[int]) -> int:", "    return sum(values)", ""].join(
      "\n",
    ),
    "utf-8",
  )

  run([process.execPath, "build", "--compile", "./src/index.ts", "--outfile", executable], cliRoot)

  const help = run([executable, "--help"], repositoryRoot)
  assertIncludes(help.stdout, "analyzeLandscape", "compiled CLI help")
  assertIncludes(help.stdout, "analyzeRemote", "compiled CLI help")

  run([executable, "init", "--srcRoot", sourceRoot, "--confFile", configPath], repositoryRoot)
  run([executable, "generateReports", "--confFile", configPath, "--outputFolder", reportsRoot], repositoryRoot)

  const analysisPath = join(reportsRoot, "data", "analysisResults.json")
  if (!existsSync(analysisPath)) {
    throw new Error(`Compiled CLI did not produce ${analysisPath}`)
  }

  const analysis = JSON.parse(readFileSync(analysisPath, "utf-8")) as {
    readonly filesCount?: unknown
    readonly linesOfCode?: unknown
  }
  if (typeof analysis.filesCount !== "number" || analysis.filesCount < 1) {
    throw new Error("Compiled CLI report did not contain a positive filesCount")
  }
  if (typeof analysis.linesOfCode !== "number" || analysis.linesOfCode < 1) {
    throw new Error("Compiled CLI report did not contain a positive linesOfCode")
  }

  console.log(`COMPILE_SMOKE passed: help=ok, report=ok, files=${analysis.filesCount}, loc=${analysis.linesOfCode}`)
} finally {
  rmSync(smokeRoot, { recursive: true, force: true })
}
