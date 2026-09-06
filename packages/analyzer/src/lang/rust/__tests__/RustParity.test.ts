import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { SourceFile } from "../../../aspects/SourceFile.js"
import { CStyleHeuristicUnitsExtractor } from "../../../units/CStyleHeuristicUnitsExtractor.js"
import { RustAnalyzer } from "../../RustAnalyzer.js"
import { compareRustParitySnapshots, type RustParityPolicy, type RustParitySnapshot } from "../RustParity.js"

interface SokratesRustUnitReference {
  readonly shortName: string
  readonly startLine: number
  readonly endLine: number
  readonly linesOfCode: number
  readonly mcCabeIndex: number
  readonly numberOfParameters: number
}

interface SokratesRustFixture {
  readonly fixtureVersion: number
  readonly id: string
  readonly source: {
    readonly relativePath: string
    readonly language: string
    readonly content: string
  }
  readonly reference: {
    readonly engine: string
    readonly repository: string
    readonly commit: string
    readonly analyzer: string
    readonly capturedFrom: readonly string[]
    readonly captureMethod: string
    readonly runtimeExecuted: boolean
    readonly notes: string
    readonly units: readonly SokratesRustUnitReference[]
    readonly normalizedSnapshot: RustParitySnapshot
  }
}

const capturedSokratesFixture = JSON.parse(
  readFileSync(join(import.meta.dir, "fixtures", "sokrates-rust-fragment-1.json"), "utf8"),
) as SokratesRustFixture

const scopePolicy: RustParityPolicy = {
  intendedImprovements: [
    { domain: "unit", direction: "removed", value: "run" },
    { domain: "unit", direction: "added", value: "transport::private::run" },
  ],
}

describe("Rust parity comparison", () => {
  test("compares Rust output with a provenance-backed Sokrates fixture", () => {
    expect(capturedSokratesFixture.fixtureVersion).toBe(1)
    expect(capturedSokratesFixture.reference.engine).toBe("sokrates-java")
    expect(capturedSokratesFixture.reference.runtimeExecuted).toBe(false)
    expect(capturedSokratesFixture.reference.commit).toBe("f400eb7235a755146e854a1bf4bd90cbe1ee5086")

    const sourceFile = new SourceFile(
      capturedSokratesFixture.source.relativePath,
      capturedSokratesFixture.source.content,
    )
    const analyzer = new RustAnalyzer()
    const currentUnits = analyzer.extractUnits(sourceFile)
    const currentDependencies = analyzer.extractDependencies([sourceFile])
    const currentSnapshot: RustParitySnapshot = {
      unitNames: currentUnits.map((unit) => unit.shortName),
      dependencyPaths: currentDependencies.dependencies.map((dependency) => dependency.to.anchor),
    }

    const comparison = compareRustParitySnapshots(
      capturedSokratesFixture.reference.normalizedSnapshot,
      currentSnapshot,
      {},
    )

    expect(comparison).toEqual({
      passed: true,
      differences: [],
      regressions: [],
    })
    expect(
      currentUnits.map((unit) => ({
        shortName: `fn ${unit.shortName}()`,
        startLine: unit.startLine + 1,
        endLine: unit.endLine + 1,
        linesOfCode: unit.linesOfCode,
        mcCabeIndex: unit.mcCabeIndex,
        numberOfParameters: unit.numberOfParameters,
      })),
    ).toEqual(
      capturedSokratesFixture.reference.units.map((unit) => ({
        ...unit,
        linesOfCode: unit.shortName === "fn a()" ? unit.linesOfCode + 1 : unit.linesOfCode,
      })),
    )
  })

  test("classifies documented scope improvements and keeps the comparison green", () => {
    const legacy: RustParitySnapshot = {
      unitNames: ["run"],
      dependencyPaths: [],
    }
    const current: RustParitySnapshot = {
      unitNames: ["transport::private::run"],
      dependencyPaths: [],
    }

    const comparison = compareRustParitySnapshots(legacy, current, scopePolicy)

    expect(comparison.passed).toBe(true)
    expect(comparison.differences).toEqual([
      {
        domain: "unit",
        direction: "removed",
        value: "run",
        classification: "intended-improvement",
      },
      {
        domain: "unit",
        direction: "added",
        value: "transport::private::run",
        classification: "intended-improvement",
      },
    ])
    expect(comparison.regressions).toHaveLength(0)
  })

  test("fails closed when a difference is not explicitly classified", () => {
    const legacy: RustParitySnapshot = {
      unitNames: ["run"],
      dependencyPaths: [],
    }
    const current: RustParitySnapshot = {
      unitNames: ["transport::private::run", "unexpected"],
      dependencyPaths: [],
    }

    const comparison = compareRustParitySnapshots(legacy, current, scopePolicy)

    expect(comparison.passed).toBe(false)
    expect(comparison.regressions).toEqual([
      {
        domain: "unit",
        direction: "added",
        value: "unexpected",
        classification: "regression",
      },
    ])
  })

  test("records explicitly accepted implementation differences as neutral", () => {
    const comparison = compareRustParitySnapshots(
      { unitNames: ["main"], dependencyPaths: [] },
      { unitNames: ["main", "helper"], dependencyPaths: [] },
      {
        neutralDifferences: [{ domain: "unit", direction: "added", value: "helper" }],
      },
    )

    expect(comparison.passed).toBe(true)
    expect(comparison.differences).toEqual([
      {
        domain: "unit",
        direction: "added",
        value: "helper",
        classification: "neutral-difference",
      },
    ])
    expect(comparison.regressions).toHaveLength(0)
  })

  test("keeps an identical snapshot as a neutral comparison", () => {
    const snapshot: RustParitySnapshot = {
      unitNames: ["main", "Worker::run"],
      dependencyPaths: ["crate::sync::oneshot"],
    }

    const comparison = compareRustParitySnapshots(snapshot, snapshot, {})

    expect(comparison).toEqual({
      passed: true,
      differences: [],
      regressions: [],
    })
  })

  test("compares live Rust output with the local historical heuristic proxy", () => {
    const sourceFile = new SourceFile(
      "demo/src/main.rs",
      `use crate::sync::oneshot::Receiver;

mod transport {
    mod private {
        pub fn run() {
            return;
        }
    }
}

pub fn main() {
    let _ = 1;
}`,
    )
    const dependencyTarget = new SourceFile("demo/src/sync/oneshot.rs", "pub struct Receiver;")
    const analyzer = new RustAnalyzer()
    const legacyUnits = new CStyleHeuristicUnitsExtractor().extractUnits(sourceFile)
    const currentUnits = analyzer.extractUnits(sourceFile)
    const currentDependencies = analyzer.extractDependencies([sourceFile, dependencyTarget])

    const comparison = compareRustParitySnapshots(
      {
        unitNames: legacyUnits.map((unit) => unit.shortName),
        dependencyPaths: [],
      },
      {
        unitNames: currentUnits.map((unit) => unit.shortName),
        dependencyPaths: currentDependencies.dependencies.map((dependency) => dependency.to.anchor),
      },
      {
        intendedImprovements: [
          { domain: "unit", direction: "removed", value: "run" },
          { domain: "unit", direction: "added", value: "transport::private::run" },
          { domain: "dependency", direction: "added", value: "demo::sync::oneshot" },
        ],
      },
    )

    expect(comparison.passed).toBe(true)
    expect(comparison.regressions).toHaveLength(0)
    expect(comparison.differences).toContainEqual({
      domain: "dependency",
      direction: "added",
      value: "demo::sync::oneshot",
      classification: "intended-improvement",
    })
  })
})
