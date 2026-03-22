# Roadmap: Effect Structured Concurrency (ADR-0010)

**Status:** In progress — Phase 1 complete (2026-03-22)
**ADR:** [0010-adopt-effect-structured-concurrency-for-landscape-analysis](../adr/0010-adopt-effect-structured-concurrency-for-landscape-analysis.md)

## Current State

Phase 1 is complete. The `analyzeRepo` async function has been replaced with an Effect-native `analyzeRepoWorker` using `Effect.scoped` and `Effect.acquireRelease` for temp directory lifecycle. The nested `Effect.runPromise` call has been removed, and batch concurrency uses `Effect.all` instead of `Promise.all`.

### Resolved (Phase 1)

| Area | Before | After |
|---|---|---|
| **Temp dir cleanup** | `try/finally` + `rmSync` in a plain `async function` | `Effect.acquireRelease` — guaranteed cleanup on success, failure, or interruption |
| **Resource lifecycle** | `analyzeRepo` is a plain `async function` calling `Effect.runPromise` inside an existing Effect runtime | `analyzeRepoWorker` is an `Effect.Effect` — scoped, composable, observable by the parent fibre |
| **Batch concurrency** | `Promise.all` | `Effect.all(batchEffects, { concurrency: "unbounded" })` |

### Remaining anti-patterns

| Area | Pattern | Risk |
|---|---|---|
| **Concurrency** | Manual `repos.slice(i, i + concurrency)` batching | Uneven batch utilisation; no work-stealing; a slow repo blocks the entire batch |
| **State tracking** | `let analyzed = 0; analyzed++` from concurrent branches | Mutation from concurrent fibres — safe only because JS is single-threaded, but semantically wrong |
| **Retry policy** | None | A single transient `git clone` or GitHub API failure fails the entire repo with no retry |

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

      yield* Ref.update(counters, (c) => ({ ...c, analyzed: c.analyzed + 1 }))
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

### Phase 2: Effect.forEach with bounded concurrency

**Effort:** Medium
**Impact:** Better utilisation, cleaner code, no batch stalling

- Replace `slice` + `Promise.all` loop with `Effect.forEach(repos, worker, { concurrency })`
- Remove manual batch index arithmetic
- `--concurrency` and `--skipExisting` behaviour preserved

**Verification:**
- [ ] `--concurrency 4` still bounds parallel work
- [ ] `--skipExisting` still skips repos with existing results
- [ ] Per-org log grouping preserved

### Phase 3: Ref-based state tracking

**Effort:** Small
**Impact:** Correct concurrent state; cleaner summary

- Replace `let analyzed/skipped/failed` with `Ref.make({ analyzed: 0, skipped: 0, failed: 0, failures: [] })`
- Update via `Ref.update` from each worker
- Read final state with `Ref.get` after `Effect.forEach` completes

**Verification:**
- [ ] Final counts match actual results
- [ ] `_failures.json` still written correctly

### Phase 4: Retry policies

**Effort:** Medium
**Impact:** Resilience to transient network failures

- Add `Effect.retry(cloneEffect, Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(3))))` for git clones
- Add similar retry for GitHub API discovery calls
- Do not retry deterministic analysis failures

**Verification:**
- [ ] Transient clone failure retries and succeeds
- [ ] Permanent failure still fails after bounded retries
- [ ] Discovery API retries on rate-limit / network error

### Phase 5: Apply to analyzeRemote

**Effort:** Small
**Impact:** Consistency across CLI commands

- `analyzeRemote.ts` has the same `try/finally` + `rmSync` pattern
- Apply `Effect.acquireRelease` for its temp dir
- Add clone retry policy

## Dependencies

- None — all changes are internal to `apps/cli/src/commands/`
- No changes to analysis output contracts
- No changes to the Astro site or report generation

## Related

- [ADR-0001: Effect TS with Bun Runtime](../adr/0001-effect-ts-with-bun-runtime.md)
- [ADR-0002: TDD Approach](../adr/0002-tdd-approach.md)
- [ADR-0010: Structured Concurrency](../adr/0010-adopt-effect-structured-concurrency-for-landscape-analysis.md)
