# Roadmap: Effect Structured Concurrency (ADR-0010)

**Status:** In progress — Phases 1–5 complete (2026-09-04)
**ADR:** [0010-adopt-effect-structured-concurrency-for-landscape-analysis](../adr/0010-adopt-effect-structured-concurrency-for-landscape-analysis.md)

## Current State

Phases 1–5 are complete. The `analyzeRepo` async function has been replaced
with an Effect-native `analyzeRepoWorker` using `Effect.scoped` and
`Effect.acquireRelease` for temp directory lifecycle. The landscape command now
builds one task list, uses `Effect.forEach` for bounded traversal, and records
concurrent progress in an Effect `Ref`; the nested `Effect.runPromise` call and
manual analysis/security batches are gone.

### Resolved foundations (Phases 1–5)

| Area | Before | After |
|---|---|---|
| **Temp dir cleanup** | `try/finally` + `rmSync` in a plain `async function` | `Effect.acquireRelease` — guaranteed cleanup on success, failure, or interruption |
| **Resource lifecycle** | `analyzeRepo` is a plain `async function` calling `Effect.runPromise` inside an existing Effect runtime | `analyzeRepoWorker` is an `Effect.Effect` — scoped, composable, observable by the parent fibre |
| **Batch concurrency** | `Promise.all` | `Effect.forEach(tasks, worker, { concurrency })` |
| **Run state** | Local mutable counters and ad hoc failure accumulation | Atomic `Ref` summary for progress/counts; ordered tagged outcomes remain the detailed failure source |
| **External resilience** | No retry or abort policy around network edges | Bounded, transient-only retry for discovery/clone; abort signals and scoped cleanup preserve interruption safety |
| **Packaging** | Source-driven CLI only | Standalone Bun executable plus a deterministic local compile/report smoke |

### Remaining follow-ons

| Area | Pattern | Risk |
|---|---|---|
| **analyzeRemote lifecycle** | Imperative `try/finally` cleanup remains | The same scoped worker/retry boundary has not yet been applied to the single-repository remote command |
| **CI handoff** | Workflows still invoke TypeScript directly | Switching deployment to the validated executable needs an explicit rollout and hosted-run proof |

## Target State

After implementing ADR-0010, the command should use:

```
Effect.forEach(allRepos, analyzeRepoWorker, { concurrency: args.concurrency })
```

Each `analyzeRepoWorker` should be a scoped Effect:

```typescript
const analyzeRepoWorker = (repo: GitHubRepo) =>
  Effect.scoped(
    Effect.gen(function* () {
      const cloneDir = yield* Effect.acquireRelease(
        createTempDir(`planetnik-${repo.name}`),
        (dir) => Effect.sync(() => rmSync(dir, { recursive: true, force: true }))
      )

      yield* cloneWithRetry(repo.cloneUrl, cloneDir)
      yield* createScope(cloneDir, repo)
      yield* extractHistory(cloneDir)
      yield* runAnalysis(cloneDir, outputDir)

      yield* Ref.update(runSummary, (summary) => ({ ...summary, analyzed: summary.analyzed + 1 }))
    })
  )
```

## Implementation Phases

### Phase 1: Scoped temp directory cleanup — DONE (2026-03-22)

**Effort:** Small
**Impact:** Eliminates resource leak risk on interruption

- [x] Replace `analyzeRepo` async function with Effect-native `analyzeRepoWorker`
- [x] Use `Effect.acquireRelease` for temp clone dirs (`acquireTempDir`)
- [x] Remove nested `Effect.runPromise` call
- [x] Replace `Promise.all` with `Effect.all` for batch concurrency
- [x] Unit tests: 4 tests in `AnalyzeRepoWorker.test.ts`
- [x] Property tests: 4 fast-check tests in `AnalyzeRepoWorker.property.test.ts` (ADR-0012)

**Verification:**
- [x] Scoped cleanup verified — finalizer removes temp dir on success, failure, and concurrent use
- [x] Existing behaviour unchanged for successful runs (typecheck passes)

### Phase 2: Effect.forEach with bounded concurrency — DONE (2026-09-04)

**Effort:** Medium
**Impact:** Better utilisation, cleaner code, no batch stalling

- [x] Replace `slice` + `Effect.all` loops with one `Effect.forEach` traversal
- [x] Remove manual batch index arithmetic from analysis and security paths
- [x] `--concurrency` and `--skipExisting` behaviour preserved
- [x] Add the `LandscapeRepoWorker` layer boundary while keeping per-repo scopes
- [x] Reject non-positive concurrency before discovery or worker startup

**Verification:**
- [x] `--concurrency 4` still bounds parallel work
- [x] `--skipExisting` still skips repos with existing results
- [x] Per-org context remains attached to worker logs

Focused coverage lives in `apps/cli/src/__tests__/LandscapeConcurrency.test.ts`:
it proves the active-worker ceiling, ordered outcomes, skip preservation,
invalid-limit rejection, and atomic analyzed/skipped/failed summary updates
with a supplied test layer. The repository-root CLI suite passes 147 tests,
including the retry and interruption fixtures.

### Phase 3: Ref-based state tracking — DONE (2026-09-04)

**Effort:** Small
**Impact:** Correct concurrent state; cleaner summary

- [x] Create a `Ref` summary with total, completed, analyzed, skipped, and failed counts
- [x] Update the summary atomically as each tagged worker outcome completes
- [x] Read final state with `Ref.get` after `Effect.forEach` completes
- [x] Keep ordered outcomes as the single detailed failure-evidence collection

**Verification:**
- [x] Final counts match actual results for done, skipped, and failed fixtures
- [x] `_failures.json` remains derived from tagged outcomes and keeps its existing shape

The summary `Ref` deliberately contains counts, not a second failure list. This
keeps live progress state concurrency-safe while preserving one canonical source
for per-repository failure details and deterministic output ordering.

### Phase 4: Retry policies — DONE (2026-09-04)

**Effort:** Medium
**Impact:** Resilience to transient network failures

- [x] Add bounded exponential `Effect.retry` for git clones
- [x] Add the same targeted policy for GitHub API discovery calls
- [x] Do not retry deterministic analysis failures
- [x] Pass Effect abort signals into GitHub fetches and simple-git so interruption can cancel active external work
- [x] Recreate a partial clone directory before a retry, while retaining the outer scoped finalizer

**Verification:**
- [x] Transient external failure retries and succeeds under a bounded fixture schedule
- [x] Permanent failure still fails on its first attempt
- [x] Transient failure exhausts after the bounded schedule
- [x] Interrupted scoped work releases its temporary clone directory

### Phase 5: Compile-friendly CLI packaging path — DONE (2026-09-04)

**Effort:** Small
**Impact:** A stable, self-contained CI invocation

- [x] verify the CLI entrypoint under `bun build --compile`
- [x] record the executable invocation and output-contract smoke path
- [x] preserve static Tree-sitter asset loading by running a temporary Python
  report through the compiled executable
- [x] keep the proof reproducible with `bun run --cwd apps/cli compile:smoke`
- [ ] decide whether the shared scoped clone/retry boundary should then be applied to `analyzeRemote.ts`

## Dependencies

- None — all changes are internal to `apps/cli/src/commands/`
- No changes to analysis output contracts
- No changes to the Astro site or report generation

## Related

- [ADR-0001: Effect TS with Bun Runtime](../adr/0001-effect-ts-with-bun-runtime.md)
- [ADR-0002: TDD Approach](../adr/0002-tdd-approach.md)
- [ADR-0010: Structured Concurrency](../adr/0010-adopt-effect-structured-concurrency-for-landscape-analysis.md)
