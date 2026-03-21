# Effect Structured Concurrency Plan for Landscape CLI

## Goal

Refactor `planetnik analyzeLandscape` to use Effect's first-class structured concurrency and scoped resource management so large multi-repository runs are more reliable, easier to cancel, and easier to extend.

Primary target:

- [analyzeLandscape.ts](/Users/alan/Projects/planetnik/apps/cli/src/commands/analyzeLandscape.ts)

Target operating model:

- a Bun single-file executable invoked in GitHub Actions as part of the static-site build path
- low orchestration overhead, predictable cleanup, and strong cancellation semantics under CI time and disk constraints

## Why This Matters

The current implementation already uses `Effect`, but the concurrency model is still mostly imperative:

- manual array batching
- `Promise.all`
- mutable counters
- ad hoc cleanup through `try/finally`

That works for modest runs, but a large landscape run amplifies the weaknesses:

- temp directories must always be cleaned up
- clone failures should be retried selectively
- cancellation should interrupt active work cleanly
- progress and failures should be reported structurally, not by mutating local variables

This is especially relevant for large OSS landscapes where repo count, clone cost, and git history extraction dominate runtime more than any single analysis.

It is also relevant for CI because the intended end state is not "run TypeScript source under Bun forever." The intended end state is:

- compile the CLI to a single Bun executable
- run that executable inside GitHub Actions
- feed its report/data output directly into the Astro site build

That means orchestration efficiency matters twice:

- in total repo analysis time
- in how much runtime setup the workflow needs before the analysis starts

## Current Constraints

These constraints shape the plan:

- `effect` is already a first-class dependency in the repo
- CLI entrypoint already uses `@effect/cli` and `NodeRuntime`
- repo analysis still depends on imperative libraries and sync operations:
  - `simple-git`
  - `extractGitHistory`
  - `ScopeCreator`
  - `DataExporter`
  - report generation
- the current GitHub Actions workflow still runs TypeScript source directly:
  - [analyze-and-deploy.yml](/Users/alan/Projects/planetnik/.github/workflows/analyze-and-deploy.yml)
- we should improve orchestration first, not rewrite analyzer internals

## Success Criteria

- no manual batching in `analyzeLandscape`
- temp clone directories are released by Effect finalizers tied to scope, even on interruption or failure
- repo analysis runs under explicit bounded concurrency
- retries exist for network-flaky stages such as GitHub discovery and clone
- progress and summary state are managed through structured state primitives
- CLI behavior and output contract remain compatible with current docs and workflows
- existing tests still pass, and new CLI tests cover interruption-safe cleanup and concurrency behavior where practical
- the refactor must remain compatible with a future `bun build --compile` packaging path
- the GitHub Actions flow should be able to swap from `bun run apps/cli/src/index.ts ...` to a compiled executable without redesigning the command contract

## Recommended Design

### 1. Make each repository analysis a scoped effect

Create a repo worker that owns:

- temporary clone directory lifecycle
- clone
- scope creation
- git history extraction
- per-repo analysis
- cleanup

Use `Effect.acquireRelease` or equivalent scoped construction so cleanup is deterministic through Effect finalizers.

### 2. Replace manual batching with bounded concurrent traversal

Use `Effect.forEach(repos, { concurrency })` rather than:

- slicing arrays into batches
- `Promise.all` inside a loop

This gives:

- simpler code
- first-class interruption
- clearer failure handling

### 3. Separate orchestration state from local mutable counters

Use Effect state primitives for:

- analyzed count
- skipped count
- failed count
- failure details
- progress events

Recommended primitives:

- `Ref` for counters and summary state
- `Queue` for ordered progress/log events if we want richer live reporting

### 4. Add retry policies only around unstable edges

Use retry schedules for:

- GitHub discovery
- repo clone

Do not retry:

- deterministic analysis failures
- malformed repo config generation

### 5. Preserve the current output contract

Do not change:

- output folder structure
- per-repo report generation contract
- `_discovery` and `_failures.json` conventions

This refactor is about orchestration reliability, not report semantics.

### 6. Design for the compiled CLI target

The refactor should assume that the desired deployment target is a compiled Bun executable, not a permanently source-driven runtime.

That means:

- avoid dynamic orchestration patterns that become awkward under `bun build --compile`
- keep command inputs and outputs file- and path-based
- avoid making the workflow depend on TS source layout after packaging
- keep the runtime contract stable enough that GitHub Actions can later invoke:
  - `./planetnik analyzeLandscape ...`
  - or `./planetnik analyzeRemote ...`

## Phased Plan

## Phase 1: Scoped Repo Worker

### Objective

Encapsulate one repo analysis as a single scoped `Effect`.

### Work

- extract `analyzeRepo` into an Effect-native worker
- introduce scoped temp dir creation and cleanup
- wrap clone and history extraction in `Effect.tryPromise`
- keep the rest of the analysis body behaviorally identical

### Affected Files

- [analyzeLandscape.ts](/Users/alan/Projects/planetnik/apps/cli/src/commands/analyzeLandscape.ts)

### Verification

- success path still produces the same output shape
- failed repo analysis still records failure details
- temp dir is removed after success and failure
- no packaging-hostile assumptions are introduced into the worker shape

### Size

- `S`

## Phase 2: Bounded Concurrent Traversal

### Objective

Replace manual batch orchestration with Effect concurrency primitives.

### Work

- replace the nested `for` + `Promise.all` batching logic
- run repo workers with `Effect.forEach(..., { concurrency })`
- keep `skipExisting` behavior unchanged

### Verification

- concurrency flag still controls parallel repo processing
- skipped repos still do not run analysis
- summary counts remain correct

### Size

- `M`

## Phase 3: Structured Progress and Failure State

### Objective

Stop mutating orchestration state ad hoc.

### Work

- move counters into `Ref`
- move failures into structured Effect-managed state
- optionally introduce `Queue` for ordered progress events

### Verification

- final summary matches actual run results
- `_failures.json` remains correct
- progress logging stays readable

### Size

- `M`

## Phase 4: Retry and Cancellation Semantics

### Objective

Make the command robust during long-running or flaky landscape runs.

### Work

- add retry schedules for discovery and clone
- keep analysis failures non-retriable
- ensure interruption stops active fibers and still releases clone dirs

### Verification

- clone retry works on transient failure fixtures or mocked failure
- cancellation does not leave clone temp dirs behind

### Size

- `M`

## Phase 5: Compile-Friendly CLI Packaging Path

### Objective

Prepare the command for invocation as a Bun single-file executable in CI.

### Work

- document the expected compiled entrypoint contract
- verify `analyzeLandscape` and `analyzeRemote` do not depend on source-relative imports or filesystem assumptions that break when compiled
- add a packaging spike command such as:
  - `bun build --compile apps/cli/src/index.ts --outfile dist/planetnik`
- record any compatibility blockers

### Verification

- a compiled executable can parse CLI args and run at least a smoke path
- the output contract remains identical to the source-run path

### Size

- `S`

## Phase 6: Optional Pipeline Enhancement

### Objective

Improve throughput on very large orgs without overcomplicating the first refactor.

### Optional Work

- separate clone concurrency from analysis concurrency
- introduce staged pipeline queues:
  - discovery
  - clone
  - analyze
  - aggregate

This should only happen after the simpler single-stage structured version is proven.

### Size

- `L`

## Non-Goals

- rewriting `generateReports` into a fully layered service model
- changing report or exporter semantics
- parallelizing the internal analyzer engine
- introducing worker threads or a distributed queue in the first pass
- replacing `simple-git`

## Recommended Order

1. scoped repo worker
2. bounded concurrent traversal
3. structured progress state
4. retry and cancellation
5. compile-friendly packaging path
6. optional pipeline split

## Definition of Done

- `analyzeLandscape` no longer uses manual batching
- temp clone dirs are scoped resources
- bounded concurrency is Effect-native
- retries are targeted and explicit
- summary/failure state is structured
- existing CLI behavior remains intact for users
- the command remains compatible with a future compiled Bun executable path

## Workflow Review Note

The current workflow is:

- [analyze-and-deploy.yml](/Users/alan/Projects/planetnik/.github/workflows/analyze-and-deploy.yml)

It currently:

- checks out the repo
- installs dependencies
- runs `bun run apps/cli/src/index.ts analyzeRemote ...`
- builds Astro from the generated data

That is acceptable now, but it is not the intended final operating model for performance-sensitive CI.

The likely future target is:

1. install dependencies needed for the site build
2. build or download the compiled `planetnik` executable
3. run the executable for analysis
4. build Astro from the generated data

This refactor should preserve that path rather than bind the command more tightly to source-driven execution.
