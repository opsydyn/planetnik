import { describe, expect, test } from "bun:test"
import { SourceFile } from "../../../aspects/SourceFile.js"
import { RustAnalyzer } from "../../RustAnalyzer.js"

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
})
