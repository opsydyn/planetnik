import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  compareSokratesRustMetricSnapshots,
  SOKRATES_RUST_METRIC_POLICY,
  type SokratesRustMetricPolicy,
  type SokratesRustMetricSnapshot,
} from "../SokratesRustMetricPolicy.js"

describe("Sokrates Rust path-sensitive metric policy", () => {
  test("makes real-file-extension semantics authoritative", () => {
    expect(SOKRATES_RUST_METRIC_POLICY).toMatchObject({
      authoritativeSourcePathSemantics: "real-file-extension",
      historicalSourcePathSemantics: "extensionless-test-helper",
    })
    expect(SOKRATES_RUST_METRIC_POLICY.neutralDifferences).toContainEqual(
      expect.objectContaining({
        unitName: "main",
        metric: "linesOfCode",
        referenceValue: 4,
        authoritativeValue: 3,
        classification: "neutral-difference",
      }),
    )
  })

  test("classifies the captured extension-sensitive difference as neutral", () => {
    const comparison = compareSokratesRustMetricSnapshots(
      {
        sourcePathSemantics: "extensionless-test-helper",
        units: [{ unitName: "main", linesOfCode: 4 }],
      },
      {
        sourcePathSemantics: "real-file-extension",
        units: [{ unitName: "main", linesOfCode: 3 }],
      },
    )

    expect(comparison.passed).toBe(true)
    expect(comparison.regressions).toHaveLength(0)
    expect(comparison.differences).toEqual([
      expect.objectContaining({
        unitName: "main",
        metric: "linesOfCode",
        referenceValue: 4,
        authoritativeValue: 3,
        classification: "neutral-difference",
      }),
    ])
  })

  test("fails closed for an unclassified metric difference", () => {
    const comparison = compareSokratesRustMetricSnapshots(
      {
        sourcePathSemantics: "real-file-extension",
        units: [{ unitName: "main", linesOfCode: 4 }],
      },
      {
        sourcePathSemantics: "real-file-extension",
        units: [{ unitName: "main", linesOfCode: 3 }],
      },
    )

    expect(comparison.passed).toBe(false)
    expect(comparison.regressions).toEqual([
      expect.objectContaining({
        unitName: "main",
        metric: "linesOfCode",
        classification: "regression",
      }),
    ])
  })

  test("connects the historical and runtime fixtures without promoting the wrong path semantics", () => {
    const historical = JSON.parse(
      readFileSync(resolve(import.meta.dir, "fixtures/sokrates-rust-fragment-1.json"), "utf8"),
    ) as {
      readonly reference: {
        readonly sourcePathSemantics: "extensionless-test-helper"
        readonly units: readonly { readonly shortName: string; readonly linesOfCode: number }[]
      }
    }
    const runtime = JSON.parse(
      readFileSync(resolve(import.meta.dir, "fixtures/sokrates-rust-fragment-1-runtime-v1.json"), "utf8"),
    ) as {
      readonly reference: {
        readonly sourcePathSemantics: "real-file-extension"
        readonly units: readonly { readonly shortName: string; readonly linesOfCode: number }[]
        readonly metricPolicy: SokratesRustMetricPolicy
      }
    }

    expect(runtime.reference.metricPolicy).toEqual(SOKRATES_RUST_METRIC_POLICY)

    const historicalSnapshot: SokratesRustMetricSnapshot = {
      sourcePathSemantics: historical.reference.sourcePathSemantics,
      units: historical.reference.units.map((unit) => ({
        unitName: unit.shortName.replace(/^fn |\(\)$/g, ""),
        linesOfCode: unit.linesOfCode,
      })),
    }
    const runtimeSnapshot: SokratesRustMetricSnapshot = {
      sourcePathSemantics: runtime.reference.sourcePathSemantics,
      units: runtime.reference.units.map((unit) => ({
        unitName: unit.shortName.replace(/^fn |\(\)$/g, ""),
        linesOfCode: unit.linesOfCode,
      })),
    }

    const comparison = compareSokratesRustMetricSnapshots(historicalSnapshot, runtimeSnapshot)

    expect(comparison.passed).toBe(true)
    expect(comparison.differences).toHaveLength(1)
    expect(comparison.differences[0]).toMatchObject({
      unitName: "main",
      classification: "neutral-difference",
    })
  })
})
