import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { SourceFile } from "../../../aspects/SourceFile.js"
import { RustAnalyzer } from "../../RustAnalyzer.js"

interface RustCoverageFixture {
  readonly fixtureVersion: number
  readonly id: string
  readonly source: {
    readonly relativePath: string
    readonly language: string
    readonly content: string
  }
  readonly syntaxCases: readonly string[]
  readonly expected: {
    readonly units: readonly {
      readonly shortName: string
      readonly startLine: number
      readonly endLine: number
      readonly numberOfParameters: number
      readonly mcCabeIndex: number
    }[]
    readonly excludedUnitNames: readonly string[]
  }
}

describe("RustAnalyzer unit extraction", () => {
  test("extracts top-level and impl methods with syntax-tree-backed names and parameters", () => {
    const source = `pub async fn top_level<T>(
    x: i32,
    y: T,
) -> Result<(), Box<dyn std::error::Error>>
where
    T: Send,
{
    if x > 0 && true {
        Ok(())
    } else {
        Ok(())
    }
}

impl Worker {
    pub async fn run(&self, jobs: usize) -> usize {
        for i in 0..jobs {
            if i % 2 == 0 {
                continue;
            }
        }

        jobs
    }
}`

    const analyzer = new RustAnalyzer()
    const sourceFile = new SourceFile("worker.rs", source)
    const units = analyzer.extractUnits(sourceFile)

    expect(units.map((unit) => unit.shortName)).toEqual(["top_level", "Worker::run"])

    const topLevelUnit = units[0]!
    expect(topLevelUnit.startLine).toBe(0)
    expect(topLevelUnit.endLine).toBe(12)
    expect(topLevelUnit.numberOfParameters).toBe(2)
    expect(topLevelUnit.longName).toContain("pub async fn top_level<T>( x: i32, y: T,")
    expect(topLevelUnit.mcCabeIndex).toBeGreaterThanOrEqual(3)

    const runUnit = units[1]!
    expect(runUnit.numberOfParameters).toBe(2)
    expect(runUnit.longName).toContain("pub async fn run(&self, jobs: usize) -> usize")
    expect(runUnit.mcCabeIndex).toBeGreaterThanOrEqual(3)
  })

  test("does not treat constructor-like expressions as standalone units", () => {
    const source = `impl LocalOwnedTasks {
    fn new() -> Self {
        Self {
            owned: UnsafeCell::new(VecDeque::with_capacity(1)),
            queue: Mutex::new(Some(VecDeque::new())),
        }
    }
}`

    const analyzer = new RustAnalyzer()
    const sourceFile = new SourceFile("local.rs", source)
    const units = analyzer.extractUnits(sourceFile)

    expect(units).toHaveLength(1)
    expect(units[0]?.shortName).toBe("LocalOwnedTasks::new")
    expect(units.some((unit) => unit.shortName === "UnsafeCell::new")).toBe(false)
    expect(units.some((unit) => unit.shortName === "Mutex::new")).toBe(false)
  })

  test("qualifies units inside nested modules and trait implementations", () => {
    const source = `
mod transport {
    pub trait Service {
        fn signature(&self);

        fn default(&self) {
            if true {
                return;
            }
        }
    }

    pub struct Worker;

    impl Service for Worker {
        fn default(&self) {}
    }

    mod private {
        pub fn run() {}
    }
}

macro_rules! generated {
    () => { fn not_a_unit() {} };
}
`

    const units = new RustAnalyzer().extractUnits(new SourceFile("transport.rs", source))

    expect(units.map((unit) => unit.shortName)).toEqual([
      "transport::Service::default",
      "transport::Worker::default",
      "transport::private::run",
    ])
    expect(units.some((unit) => unit.shortName === "signature")).toBe(false)
    expect(units.some((unit) => unit.shortName === "not_a_unit")).toBe(false)
  })

  test("counts match arms and boolean branches from syntax nodes", () => {
    const source = `fn classify(items: &[usize]) -> usize {
    let mut total = 0;
    for item in items {
        if *item > 0 && *item < 10 || *item == 42 {
            total += *item;
        }
    }
    match total {
        0 => 0,
        1..=3 => 1,
        _ => total,
    }
}`

    const unit = new RustAnalyzer().extractUnits(new SourceFile("classify.rs", source))[0]

    expect(unit?.mcCabeIndex).toBe(8)
  })

  test("covers the versioned Rust syntax matrix and conservative exclusions", () => {
    const coverageFixture = JSON.parse(
      readFileSync(join(import.meta.dir, "fixtures", "rust-tree-sitter-coverage-v1.json"), "utf8"),
    ) as RustCoverageFixture

    expect(coverageFixture.fixtureVersion).toBe(1)
    expect(coverageFixture.id).toBe("rust-tree-sitter-coverage-v1")
    expect(coverageFixture.source.language).toBe("rust")
    expect(coverageFixture.syntaxCases).toEqual([
      "cfg-gated-function",
      "trait-signature",
      "trait-default-method",
      "trait-impl-method",
      "inherent-method",
      "nested-module",
      "extern-declaration",
      "macro-token-tree",
      "if-let",
      "while-let",
      "boolean-branches",
      "match-arms",
    ])

    const units = new RustAnalyzer().extractUnits(
      new SourceFile(coverageFixture.source.relativePath, coverageFixture.source.content),
    )

    expect(
      units.map((unit) => ({
        shortName: unit.shortName,
        startLine: unit.startLine,
        endLine: unit.endLine,
        numberOfParameters: unit.numberOfParameters,
        mcCabeIndex: unit.mcCabeIndex,
      })),
    ).toEqual([...coverageFixture.expected.units])
    expect(units.map((unit) => unit.shortName)).not.toEqual(
      expect.arrayContaining(coverageFixture.expected.excludedUnitNames),
    )
  })
})
