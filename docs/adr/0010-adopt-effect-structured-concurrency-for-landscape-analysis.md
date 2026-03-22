# ADR-0010: Adopt Effect Structured Concurrency for Landscape Analysis

## Status

Accepted — parked (assessed 2026-03-22, no primitives implemented yet; see [roadmap](../roadmap/structured-concurrency.md))

## Context

Planetnik already uses `Effect` and `@effect/cli` as the accepted CLI/runtime stack:

- [ADR-0001](/Users/alan/Projects/planetnik/docs/adr/0001-effect-ts-with-bun-runtime.md)

But the largest multi-repository CLI workflow, [analyzeLandscape.ts](/Users/alan/Projects/planetnik/apps/cli/src/commands/analyzeLandscape.ts), does not yet use Effect's concurrency model deeply.

Today it still relies on:

- manual batching with array slicing
- `Promise.all`
- mutable counters such as `analyzed`, `skipped`, and `failed`
- ad hoc cleanup in imperative async functions

That is acceptable for small or medium orgs, but it becomes a liability for large landscape runs:

- a run may analyze dozens or hundreds of repositories
- each repo allocates a temporary clone directory
- clone and GitHub discovery are network-flaky edges
- history extraction and report generation are long-running operations
- interruption should stop active work cleanly without leaking temp directories

This is now worth capturing as an ADR because:

- it defines how Planetnik will use Effect beyond simple command wrapping
- it changes the concurrency model of a major CLI workflow
- it affects reliability, cleanup, cancellation, and future scalability of landscape analysis
- it introduces a reusable orchestration pattern for future large-scale commands
- it needs to support the intended deployment target of a compiled Bun CLI executable running inside GitHub Actions

## Decision

We will refactor `planetnik analyzeLandscape` to use Effect-native structured concurrency and scoped resource management.

### Core policy

- Each repository analysis will become a scoped `Effect`.
- Temporary clone directories will be acquired within Effect scope and released by Effect finalizers bound to that scope.
- Repo processing will use Effect-bounded concurrency rather than manual batching.
- Retry behavior will be explicit and targeted to unstable external operations.
- Summary and failure state will be managed structurally rather than through mutable local variables.
- The refactor must remain compatible with a compiled Bun single-file executable target for CI usage.

### Scope of this ADR

This ADR applies first to:

- [analyzeLandscape.ts](/Users/alan/Projects/planetnik/apps/cli/src/commands/analyzeLandscape.ts)

It may later influence:

- [analyzeRemote.ts](/Users/alan/Projects/planetnik/apps/cli/src/commands/analyzeRemote.ts)
- other long-running CLI workflows

But the first implementation must stay focused on landscape analysis.

### Deployment target policy

The target operating model for this command is:

- a Bun single-file executable invoked from GitHub Actions
- as part of the report-generation path that feeds the static Astro site build

The current workflow still runs TypeScript source directly:

- [analyze-and-deploy.yml](/Users/alan/Projects/planetnik/.github/workflows/analyze-and-deploy.yml)

That is an implementation detail of the current pipeline, not the desired steady state.

## Why this option

- It aligns the CLI with the stack choice already made in ADR-0001 instead of using Effect only as a thin wrapper.
- It gives deterministic cleanup semantics for temp directories and other per-repo resources.
- It gives bounded concurrency without manual batch orchestration.
- It gives a cleaner path for interruption, retries, and progress reporting.
- It is a better foundation for very large multi-repo landscapes than imperative `Promise.all` orchestration.
- It keeps the orchestration model explicit and packaging-friendly for a future compiled executable path.

## Alternatives Considered

### Keep the current Promise-based batching

This keeps the command simple and avoids a refactor.

We are not choosing it because the current orchestration is already the most operationally complex CLI path in the repo. Large landscape runs amplify its weaknesses:

- cleanup is easy to get wrong
- retry policy is implicit or absent
- cancellation behavior is weak
- state is managed through mutable counters

### Use Effect only for logging and command wiring

This is effectively the current pattern in parts of the CLI.

We are not choosing it because it leaves the hardest parts of orchestration outside Effect, which gives us the ceremony but not the main benefit of the library.

### Introduce worker threads or a separate job runner

This could improve throughput for very large landscapes.

We are not choosing it because it is a much larger operational change and is not required to get most of the reliability gains. Structured concurrency should come first.

### Keep the current source-driven GitHub Actions execution model as the long-term target

This requires less immediate change to the workflow.

We are not choosing it because the desired end state is a faster, more self-contained CLI path that can be invoked as an executable in CI. The structured concurrency refactor should support that direction, not entrench the source-run path.

### Rewrite all CLI commands into a full service/layer architecture immediately

This would create a uniform Effect style across the CLI.

We are not choosing it because it is too broad. The refactor should prove its value on the command that needs it most.

## Consequences

- `analyzeLandscape` will become more explicitly Effect-native.
- Temp clone directory lifecycle will be managed by Effect finalizers attached to scope rather than only by imperative `finally`.
- Retry logic will become visible and testable.
- CLI progress and failure state will become easier to evolve.
- The refactor will introduce a reusable repo-worker orchestration pattern for future commands.
- Some code may become more abstract than the current imperative version, so naming and boundaries must stay clear.
- The command shape will be better prepared for packaging as a Bun executable.

## Non-goals

- No change to the landscape report output contract
- No change to the analyzer's semantic behavior
- No immediate rewrite of `generateReports` into a Layer-heavy service graph
- No worker-thread or distributed execution model in the first pass
- No replacement of `simple-git`
- No immediate rewrite of GitHub Actions to compiled CLI mode in the same change

## Related ADRs

- ADR-0001: Effect TS with Bun Runtime
- ADR-0002: TDD Approach

## Implementation Plan

- **Affected paths**:
  - [analyzeLandscape.ts](/Users/alan/Projects/planetnik/apps/cli/src/commands/analyzeLandscape.ts)
  - [analyzeRemote.ts](/Users/alan/Projects/planetnik/apps/cli/src/commands/analyzeRemote.ts) as a reference for temp-clone lifecycle
  - CLI tests under [apps/cli/src/__tests__](/Users/alan/Projects/planetnik/apps/cli/src/__tests__)
  - [analyze-and-deploy.yml](/Users/alan/Projects/planetnik/.github/workflows/analyze-and-deploy.yml) for the eventual compiled-CLI handoff path
  - optional shared CLI utility files if the repo-worker pattern is extracted

- Introduce a small repo-worker abstraction inside the landscape command or a nearby helper file.
  - it must encapsulate:
    - temp clone dir acquisition
    - clone
    - scope creation
    - git history extraction
    - per-repo analysis
    - release/cleanup

- Replace `analyzeRepo()` as an imperative async function with a scoped Effect-based worker.
  - cleanup must happen through `Effect.acquireRelease` or equivalent scoped finalizers, not just `finally`
  - success/failure result shape should remain compatible with current summary handling

- Replace manual array slicing and `Promise.all` with `Effect.forEach(..., { concurrency })`.
  - preserve `--concurrency`
  - preserve `--skipExisting`
  - keep per-org grouping in logs

- Introduce structured state for summary tracking.
  - use `Ref` for:
    - analyzed count
    - skipped count
    - failed count
  - use a structured collection for failures instead of mutating plain arrays from multiple concurrent branches

- Add targeted retry policy.
  - discovery:
    - GitHub API lookup in the discovery phase
  - clone:
    - retry transient clone failures with a bounded schedule
  - do not retry deterministic analysis failures

- Preserve current output behavior.
  - `_discovery/*.json`
  - per-repo reports
  - `_failures.json`
  - `_planetnik_landscape/reports/index.html`
  - `_planetnik_landscape/reports/data/landscapeAnalysisResults.json`

- Add tests for orchestration behavior.
  - keep existing CLI tests green
  - add focused tests for:
    - skipped repo behavior
    - failure collection behavior
    - retry policy boundaries where practical
    - interruption-safe cleanup where practical

- Keep the first refactor single-stage.
  - do not split clone and analysis into separate pipeline queues unless the first structured version proves insufficient

- Add a compile-friendly validation pass after the orchestration refactor.
  - verify the command does not depend on source-relative runtime assumptions that would block `bun build --compile`
  - document the intended future invocation contract for CI

## Verification

- [ ] `analyzeLandscape` no longer uses manual batching plus `Promise.all`
- [ ] Temporary clone directories are acquired in Effect scope and released by scoped finalizers
- [ ] `--concurrency` still bounds parallel repo processing
- [ ] `--skipExisting` behavior remains unchanged
- [ ] Discovery and clone retries are explicit and bounded
- [ ] Final analyzed/skipped/failed counts remain correct under concurrent execution
- [ ] `_failures.json` is still written correctly when failures occur
- [ ] Existing CLI and reports tests continue to pass
- [ ] A large interrupted run does not leave temp clone directories behind
- [ ] The command remains compatible with a future compiled Bun executable path

## References

- Effect TS: <https://effect.website/>
- Effect concurrency and fibers: <https://effect.website/docs/concurrency/basic-concurrency/>
- Effect resource management: <https://effect.website/docs/resource-management/introduction/>
