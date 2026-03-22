# ADR-0012: Adopt Fast-Check Property-Based Testing via Effect

## Status

Accepted

## Context

Planetnik's test suite (439 tests, 1038 assertions) uses example-based unit tests exclusively. These tests verify known inputs produce expected outputs — they are good at catching specific regressions but weak at discovering edge cases the developer did not anticipate.

As the codebase moves toward Effect-native structured concurrency (ADR-0010), the orchestration logic becomes harder to cover with example tests alone. Concurrent resource lifecycle, retry boundaries, and state accumulation under parallel execution are categories where unexpected inputs and timing are more revealing than hand-picked scenarios.

Property-based testing addresses this by generating many random inputs and asserting that invariants hold across all of them. Rather than testing "does this specific input produce this specific output?", property tests ask "does this property hold for every valid input?"

Effect bundles `fast-check` (>= 3.23.1) as a dependency and re-exports it as `effect/FastCheck`. Effect also provides `@effect/schema` Arbitrary integration, which generates valid test data directly from existing Zod-like schemas. This means property-based testing is available without adding any new dependency.

## Decision

We will adopt `fast-check` via Effect's bundled re-export for property-based testing alongside existing `bun:test` example-based tests.

### Core policy

- Property-based tests augment, not replace, existing unit tests.
- Import fast-check from `effect/FastCheck`, not from `fast-check` directly, to stay within the Effect dependency graph.
- Use `@effect/schema` Arbitrary generation where schemas already exist for the data under test.
- Property tests run as part of the standard `bun test` suite — no separate runner or configuration.
- Property test files are named `{Feature}.property.test.ts` to distinguish them from example-based tests.

### Where to use property tests

Property-based testing is most valuable for:

- **Invariant verification** — properties that must hold regardless of input (e.g., "temp directories are always cleaned up", "analyzed + skipped + failed = total")
- **Roundtrip correctness** — encode/decode, serialize/deserialize, parse/format cycles
- **Boundary discovery** — finding edge cases in string parsing, path handling, numeric ranges
- **Concurrency contracts** — verifying that concurrent operations maintain state invariants under arbitrary interleaving
- **Schema compliance** — verifying that arbitrary valid schema instances are handled correctly

Property-based testing is less valuable for:

- Integration tests with real filesystem or network I/O
- UI component rendering
- Tests where the expected output is a specific known value

### Test structure

```typescript
import { describe, test, expect } from "bun:test"
import { FastCheck } from "effect"

describe("FeatureName — properties", () => {
  test("invariant description", () => {
    FastCheck.assert(
      FastCheck.property(
        FastCheck.string(),
        (input) => {
          // Assert invariant holds for all generated inputs
          return someFunction(input).length >= 0
        }
      )
    )
  })
})
```

### Schema-driven arbitrary generation

```typescript
import { Arbitrary, Schema } from "effect"

const repoArbitrary = Arbitrary.make(
  Schema.Struct({
    name: Schema.String,
    description: Schema.optional(Schema.String),
  })
)
```

## Why this option

- **Zero dependency cost** — fast-check is already bundled with Effect, which is the project's core framework.
- **Schema integration** — existing `@effect/schema` definitions double as test data generators, reducing boilerplate.
- **Complementary coverage** — property tests find edge cases that example tests miss, especially in orchestration and data transformation logic.
- **Low adoption friction** — tests run with `bun test` like everything else. No new tooling or CI changes.
- **Proven in the Effect ecosystem** — fast-check is Effect's own choice for internal testing.

## Alternatives Considered

### Continue with example-based tests only

This keeps the test suite simpler and avoids learning a new testing style.

We are not choosing this because the structured concurrency refactor introduces orchestration logic where example tests are insufficient to cover the state space — concurrent cleanup, retry boundaries, and accumulation invariants need broader input coverage.

### Use fast-check directly (not via Effect)

This would give access to the latest fast-check API without going through Effect's re-export.

We are not choosing this because it adds a direct dependency that duplicates what Effect already provides, and it misses the `@effect/schema` Arbitrary integration which is the main productivity advantage.

### Use a different property testing library

Libraries like `jsverify` or `testcheck` exist but are less maintained and lack Effect integration.

We are not choosing them because fast-check is the most actively maintained property testing library in the JS ecosystem and is already in the dependency tree.

## Consequences

- Property tests will appear alongside example tests in `__tests__/` directories.
- Developers will need to understand property-based testing concepts (generators, shrinking, invariants).
- CI run times may increase slightly due to default 100-iteration property runs (configurable).
- The naming convention `*.property.test.ts` makes it easy to run or skip property tests selectively.
- Schema definitions gain a dual purpose: runtime validation and test data generation.

## First application

The first property tests will target the `analyzeLandscape` structured concurrency refactor (ADR-0010 Phase 1):

- Temp directory lifecycle invariant: directories are always cleaned up regardless of success or failure
- State accumulation invariant: analyzed + skipped + failed always equals total input count
- Worker isolation: concurrent workers never share temp directories

These tests will demonstrate the pattern for future adoption across the codebase.

## Related ADRs

- ADR-0001: Effect TS with Bun Runtime
- ADR-0002: TDD Approach
- ADR-0010: Adopt Effect Structured Concurrency for Landscape Analysis
