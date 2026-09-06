import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

interface BenchmarkResult {
  readonly benchmarkVersion: number
  readonly language: string
  readonly corpus: {
    readonly sourceFiles: number
    readonly sourceBytes: number
    readonly sourceLines: number
  }
  readonly parse: {
    readonly syntaxErrorFiles: number
    readonly parseFailures: number
  }
  readonly analysis: {
    readonly unitCount: number
    readonly dependencyLinkCount: number
    readonly dependencyErrorCount: number
  }
  readonly timings: {
    readonly adapterLoadMs: number
    readonly totalMs: number
    readonly parseMs: number
    readonly unitsMs: number
    readonly dependenciesMs: number
  }
  readonly memory: {
    readonly rssBeforeBytes: number
    readonly peakRssBytes: number
    readonly rssAfterBytes: number
  }
}

const benchmarkScript = resolve(import.meta.dir, "../../../../scripts/benchmark-tree-sitter.ts")

function runBenchmark(language: "rust" | "python", root: string): BenchmarkResult {
  const result = Bun.spawnSync([process.execPath, "run", benchmarkScript, "--language", language, "--root", root], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const stdout = new TextDecoder().decode(result.stdout)
  const stderr = new TextDecoder().decode(result.stderr)

  if (result.exitCode !== 0) {
    throw new Error(`Benchmark failed (${result.exitCode}): ${stderr || stdout}`)
  }

  return JSON.parse(stdout) as BenchmarkResult
}

describe("Tree-sitter benchmark command", () => {
  test("records Rust lifecycle and quality evidence without publishing a timing threshold", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-tree-sitter-benchmark-rust-"))

    try {
      writeFileSync(
        join(root, "main.rs"),
        `use crate::sync::oneshot::Receiver;

pub fn main() {
  let _receiver: Receiver;
}
`,
        "utf8",
      )
      writeFileSync(join(root, "invalid.rs"), "fn broken( {\n")

      const report = runBenchmark("rust", root)

      expect(report.benchmarkVersion).toBe(1)
      expect(report.language).toBe("rust")
      expect(report.corpus.sourceFiles).toBe(2)
      expect(report.corpus.sourceBytes).toBeGreaterThan(0)
      expect(report.corpus.sourceLines).toBeGreaterThan(0)
      expect(report.parse.syntaxErrorFiles).toBe(1)
      expect(report.parse.parseFailures).toBe(0)
      expect(report.analysis.unitCount).toBeGreaterThanOrEqual(1)
      expect(report.analysis.dependencyLinkCount).toBe(0)
      expect(report.analysis.dependencyErrorCount).toBe(0)
      expect(report.timings.adapterLoadMs).toBeGreaterThanOrEqual(0)
      expect(report.timings.totalMs).toBeGreaterThanOrEqual(report.timings.parseMs)
      expect(report.timings.totalMs).toBeGreaterThanOrEqual(report.timings.unitsMs)
      expect(report.timings.totalMs).toBeGreaterThanOrEqual(report.timings.dependenciesMs)
      expect(report.memory.peakRssBytes).toBeGreaterThanOrEqual(report.memory.rssBeforeBytes)
      expect(report.memory.peakRssBytes).toBeGreaterThanOrEqual(report.memory.rssAfterBytes)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test("records Python unit and dependency evidence through the same command", () => {
    const root = mkdtempSync(join(tmpdir(), "planetnik-tree-sitter-benchmark-python-"))

    try {
      const packageRoot = join(root, "app")
      mkdirSync(packageRoot, { recursive: true })
      writeFileSync(join(packageRoot, "__init__.py"), "", "utf8")
      writeFileSync(
        join(packageRoot, "service.py"),
        "from models import User\n\nclass Service:\n    def run(self):\n        return User\n",
        "utf8",
      )
      writeFileSync(join(packageRoot, "models.py"), "class User:\n    pass\n", "utf8")

      const report = runBenchmark("python", root)

      expect(report.benchmarkVersion).toBe(1)
      expect(report.language).toBe("python")
      expect(report.corpus.sourceFiles).toBe(3)
      expect(report.parse.syntaxErrorFiles).toBe(0)
      expect(report.parse.parseFailures).toBe(0)
      expect(report.analysis.unitCount).toBeGreaterThanOrEqual(3)
      expect(report.analysis.dependencyLinkCount).toBeGreaterThanOrEqual(1)
      expect(report.analysis.dependencyErrorCount).toBe(0)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
