import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  buildSokratesRustCapturePlan,
  SOKRATES_CAPTURE_DOCKER_IMAGE,
  SOKRATES_RUST_REFERENCE,
} from "../SokratesRustCapture.js"
import { SOKRATES_RUST_METRIC_POLICY } from "../SokratesRustMetricPolicy.js"

describe("Sokrates Rust runtime capture contract", () => {
  test("plans a pinned Maven build and harness execution", () => {
    const plan = buildSokratesRustCapturePlan({
      sokratesRoot: "/tmp/sokrates",
      fixturePath: "/tmp/rust-fixture.json",
      outputPath: "/tmp/rust-capture.json",
    })

    expect(SOKRATES_RUST_REFERENCE.commit).toBe("f400eb7235a755146e854a1bf4bd90cbe1ee5086")
    expect(plan.buildCommand).toEqual(["mvn", "-q", "-DskipTests", "package"])
    expect(plan.harnessClassName).toBe("planetnik.capture.SokratesRustCapture")
    expect(plan.harnessMainClass).toBe("planetnik.capture.SokratesRustCapture")
    expect(plan.fixturePath).toBe("/tmp/rust-fixture.json")
    expect(plan.outputPath).toBe("/tmp/rust-capture.json")
    expect(plan.cliJarPath).toBe("/tmp/sokrates/cli/target/cli-1.0-jar-with-dependencies.jar")
  })

  test("fails closed when the checkout is not pinned", () => {
    expect(() => {
      buildSokratesRustCapturePlan({
        sokratesRoot: "/tmp/sokrates",
        fixturePath: "/tmp/rust-fixture.json",
        outputPath: "/tmp/rust-capture.json",
        actualCommit: "main",
      })
    }).toThrow(/pinned Sokrates commit/i)
  })

  test("fails closed at the command boundary when the checkout is absent", () => {
    const scriptPath = resolve(import.meta.dir, "../../../../scripts/capture-sokrates-rust.ts")
    const result = Bun.spawnSync(
      [
        process.execPath,
        "run",
        scriptPath,
        "--sokrates-root",
        "/private/tmp/planetnik-missing-sokrates-checkout",
        "--output",
        "/private/tmp/planetnik-missing-sokrates-capture.json",
      ],
      { stdout: "pipe", stderr: "pipe" },
    )
    const output = `${new TextDecoder().decode(result.stdout)}${new TextDecoder().decode(result.stderr)}`

    expect(result.exitCode).toBe(1)
    expect(output).toContain("Sokrates checkout not found")
    expect(output).toContain("runtime capture cannot run")
  })

  test("retains the first runtime-executed reference and its extension-sensitive evidence", () => {
    const fixture = JSON.parse(
      readFileSync(resolve(import.meta.dir, "fixtures/sokrates-rust-fragment-1-runtime-v1.json"), "utf8"),
    ) as {
      readonly fixtureVersion: number
      readonly reference: {
        readonly commit: string
        readonly runtimeExecuted: boolean
        readonly captureMethod: string
        readonly notes: string
        readonly sourcePathSemantics: string
        readonly runtime: { readonly dockerImage: string }
        readonly metricPolicy: typeof SOKRATES_RUST_METRIC_POLICY
        readonly units: readonly { readonly shortName: string; readonly linesOfCode: number }[]
        readonly normalizedSnapshot: {
          readonly unitNames: readonly string[]
          readonly dependencyPaths: readonly string[]
        }
      }
    }

    expect(fixture.fixtureVersion).toBe(1)
    expect(fixture.reference.commit).toBe(SOKRATES_RUST_REFERENCE.commit)
    expect(fixture.reference.runtimeExecuted).toBe(true)
    expect(fixture.reference.captureMethod).toBe("runtime-executed-java-harness")
    expect(fixture.reference.sourcePathSemantics).toBe("real-file-extension")
    expect(fixture.reference.runtime.dockerImage).toBe(SOKRATES_CAPTURE_DOCKER_IMAGE)
    expect(fixture.reference.metricPolicy).toEqual(SOKRATES_RUST_METRIC_POLICY)
    expect(fixture.reference.units.map((unit) => [unit.shortName, unit.linesOfCode])).toEqual([
      ["fn main()", 3],
      ["fn a()", 8],
      ["fn b()", 5],
    ])
    expect(fixture.reference.normalizedSnapshot).toEqual({
      unitNames: ["main", "a", "b"],
      dependencyPaths: [],
    })
    expect(fixture.reference.notes).toContain("no extension")
  })
})
