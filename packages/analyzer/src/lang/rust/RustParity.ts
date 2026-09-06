export type RustParityDomain = "unit" | "dependency"
export type RustParityDirection = "added" | "removed"
export type RustParityClassification = "intended-improvement" | "neutral-difference" | "regression"

export interface RustParitySnapshot {
  readonly unitNames: readonly string[]
  readonly dependencyPaths: readonly string[]
}

export interface RustParityDifferenceExpectation {
  readonly domain: RustParityDomain
  readonly direction: RustParityDirection
  readonly value: string
}

export interface RustParityPolicy {
  readonly intendedImprovements?: readonly RustParityDifferenceExpectation[]
  readonly neutralDifferences?: readonly RustParityDifferenceExpectation[]
}

export interface RustParityDifference extends RustParityDifferenceExpectation {
  readonly classification: RustParityClassification
}

export interface RustParityComparison {
  readonly passed: boolean
  readonly differences: readonly RustParityDifference[]
  readonly regressions: readonly RustParityDifference[]
}

export function compareRustParitySnapshots(
  legacy: RustParitySnapshot,
  current: RustParitySnapshot,
  policy: RustParityPolicy,
): RustParityComparison {
  const differences = [
    ...collectDifferences("unit", "removed", legacy.unitNames, current.unitNames),
    ...collectDifferences("unit", "added", current.unitNames, legacy.unitNames),
    ...collectDifferences("dependency", "removed", legacy.dependencyPaths, current.dependencyPaths),
    ...collectDifferences("dependency", "added", current.dependencyPaths, legacy.dependencyPaths),
  ].map((difference) => ({
    ...difference,
    classification: classifyDifference(difference, policy),
  }))

  const regressions = differences.filter((difference) => difference.classification === "regression")

  return {
    passed: regressions.length === 0,
    differences,
    regressions,
  }
}

function collectDifferences(
  domain: RustParityDomain,
  direction: RustParityDirection,
  values: readonly string[],
  otherValues: readonly string[],
): RustParityDifferenceExpectation[] {
  const remaining = countValues(otherValues)
  const differences: RustParityDifferenceExpectation[] = []

  for (const value of [...values].sort()) {
    const count = remaining.get(value) ?? 0
    if (count > 0) {
      remaining.set(value, count - 1)
      continue
    }

    differences.push({ domain, direction, value })
  }

  return differences
}

function countValues(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

function classifyDifference(
  difference: RustParityDifferenceExpectation,
  policy: RustParityPolicy,
): RustParityClassification {
  if (matches(policy.intendedImprovements, difference)) {
    return "intended-improvement"
  }

  if (matches(policy.neutralDifferences, difference)) {
    return "neutral-difference"
  }

  return "regression"
}

function matches(
  expectations: readonly RustParityDifferenceExpectation[] | undefined,
  difference: RustParityDifferenceExpectation,
): boolean {
  return (
    expectations?.some(
      (expected) =>
        expected.domain === difference.domain &&
        expected.direction === difference.direction &&
        expected.value === difference.value,
    ) ?? false
  )
}
