// ADR-0021: report metrics follow real source-path semantics; see
// docs/adr/0021-define-rust-metric-parity-by-source-path-semantics.md.
export type SokratesRustSourcePathSemantics = "real-file-extension" | "extensionless-test-helper"
export type SokratesRustMetric = "linesOfCode"
export type SokratesRustMetricClassification = "neutral-difference" | "regression"

export interface SokratesRustMetricUnit {
  readonly unitName: string
  readonly linesOfCode: number
}

export interface SokratesRustMetricSnapshot {
  readonly sourcePathSemantics: SokratesRustSourcePathSemantics
  readonly units: readonly SokratesRustMetricUnit[]
}

export interface SokratesRustMetricDifferenceExpectation {
  readonly unitName: string
  readonly metric: SokratesRustMetric
  readonly referenceValue: number
  readonly authoritativeValue: number
  readonly referenceSourcePathSemantics: SokratesRustSourcePathSemantics
  readonly authoritativeSourcePathSemantics: SokratesRustSourcePathSemantics
  readonly classification: "neutral-difference"
  readonly reason: string
}

export interface SokratesRustMetricPolicy {
  readonly authoritativeSourcePathSemantics: SokratesRustSourcePathSemantics
  readonly historicalSourcePathSemantics: SokratesRustSourcePathSemantics
  readonly neutralDifferences: readonly SokratesRustMetricDifferenceExpectation[]
}

export interface SokratesRustMetricDifference {
  readonly unitName: string
  readonly metric: SokratesRustMetric
  readonly referenceValue: number | null
  readonly authoritativeValue: number | null
  readonly referenceSourcePathSemantics: SokratesRustSourcePathSemantics
  readonly authoritativeSourcePathSemantics: SokratesRustSourcePathSemantics
  readonly classification: SokratesRustMetricClassification
  readonly reason: string
}

export interface SokratesRustMetricComparison {
  readonly passed: boolean
  readonly differences: readonly SokratesRustMetricDifference[]
  readonly regressions: readonly SokratesRustMetricDifference[]
}

/**
 * Report-contract metrics use the path semantics of the actual source file.
 * The upstream JUnit fixture is retained as evidence, but its extensionless
 * SourceFile is a test-helper setup rather than the report input contract.
 */
export const SOKRATES_RUST_METRIC_POLICY: SokratesRustMetricPolicy = {
  authoritativeSourcePathSemantics: "real-file-extension",
  historicalSourcePathSemantics: "extensionless-test-helper",
  neutralDifferences: [
    {
      unitName: "main",
      metric: "linesOfCode",
      referenceValue: 4,
      authoritativeValue: 3,
      referenceSourcePathSemantics: "extensionless-test-helper",
      authoritativeSourcePathSemantics: "real-file-extension",
      classification: "neutral-difference",
      reason:
        "The extensionless upstream test SourceFile selects a generic cleaner; the real .rs report path selects the Rust cleaner and removes the comment line.",
    },
  ],
}

export function compareSokratesRustMetricSnapshots(
  reference: SokratesRustMetricSnapshot,
  authoritative: SokratesRustMetricSnapshot,
  policy: SokratesRustMetricPolicy = SOKRATES_RUST_METRIC_POLICY,
): SokratesRustMetricComparison {
  const referenceUnits = new Map(reference.units.map((unit) => [unit.unitName, unit]))
  const authoritativeUnits = new Map(authoritative.units.map((unit) => [unit.unitName, unit]))
  const unitNames = [...new Set([...referenceUnits.keys(), ...authoritativeUnits.keys()])].sort()

  const differences = unitNames.flatMap((unitName) => {
    const referenceUnit = referenceUnits.get(unitName)
    const authoritativeUnit = authoritativeUnits.get(unitName)
    const referenceValue = referenceUnit?.linesOfCode ?? null
    const authoritativeValue = authoritativeUnit?.linesOfCode ?? null

    if (referenceValue === authoritativeValue) {
      return []
    }

    const expected = policy.neutralDifferences.find(
      (difference) =>
        difference.unitName === unitName &&
        difference.metric === "linesOfCode" &&
        difference.referenceValue === referenceValue &&
        difference.authoritativeValue === authoritativeValue &&
        difference.referenceSourcePathSemantics === reference.sourcePathSemantics &&
        difference.authoritativeSourcePathSemantics === authoritative.sourcePathSemantics,
    )

    const classification: SokratesRustMetricClassification = expected?.classification ?? "regression"

    return [
      {
        unitName,
        metric: "linesOfCode" as const,
        referenceValue,
        authoritativeValue,
        referenceSourcePathSemantics: reference.sourcePathSemantics,
        authoritativeSourcePathSemantics: authoritative.sourcePathSemantics,
        classification,
        reason:
          expected?.reason ??
          "The path-sensitive metric difference is not explicitly classified by the Rust parity policy.",
      },
    ]
  })

  const regressions = differences.filter((difference) => difference.classification === "regression")

  return {
    passed: regressions.length === 0,
    differences,
    regressions,
  }
}
