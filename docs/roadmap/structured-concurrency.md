# Roadmap: Effect Structured Concurrency (ADR-0010)

**Status:** Parked — assessed 2026-03-22, not yet started
**ADR:** [0010-adopt-effect-structured-concurrency-for-landscape-analysis](../adr/0010-adopt-effect-structured-concurrency-for-landscape-analysis.md)

## Current State

`analyzeLandscape.ts` uses none of the Effect structured concurrency primitives prescribed by ADR-0010. The command works — it successfully analyses multi-repo landscapes (e.g. Effect-TS, 17 repos in 53s) — but its internals are imperative and fragile under edge conditions.

### What exists today

| Area | Pattern | Risk |
|---|---|---|
| **Temp dir cleanup** | `try/finally` + `rmSync` in a plain `async function` | Not interruption-safe — Effect fiber cancellation does not guarantee JS `finally` runs |
| **Concurrency** | Manual `repos.slice(i, i + concurrency)` + `Promise.all` | Uneven batch utilisation; no work-stealing; a slow repo blocks the entire batch |
| **State tracking** | `let analyzed = 0; analyzed++` from concurrent branches | Mutation from inside `Promise.all` — safe only because JS is single-threaded, but semantically wrong and will break if moved to true parallel fibres |
| **Retry policy** | None | A single transient `git clone` or GitHub API failure fails the entire repo with no retry |
| **Resource lifecycle** | `analyzeRepo` is a plain `async function` calling `Effect.runPromise` inside an existing Effect runtime | Nested runtime; opaque to the parent fibre; cannot be interrupted or observed |

### Key anti-patterns (with locations)

- `analyzeLandscape.ts:44-74` — `analyzeRepo` is `async function` outside Effect
- `analyzeLandscape.ts:49-50` — temp dir created with `randomBytes` + `tmpdir()`, no scope
- `analyzeLandscape.ts:54` — `git.clone` with no retry
- `analyzeLandscape.ts:66` — `Effect.runPromise(runAnalysis(...))` nested runtime
- `analyzeLandscape.ts:71-72` — `rmSync` in JS `finally`, not an Effect finalizer
- `analyzeLandscape.ts:114-117` — mutable `let` counters and `failures` array
- `analyzeLandscape.ts:126-146` — manual batch slicing + `Promise.all`

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

### Phase 1: Scoped temp directory cleanup

**Effort:** Small
**Impact:** Eliminates resource leak risk on interruption

- Replace `analyzeRepo` async function with an Effect-native worker
- Use `Effect.acquireRelease` for temp clone dirs
- Remove nested `Effect.runPromise` call
- Keep manual batching temporarily

**Verification:**
- [ ] Interrupted run leaves no temp directories behind
- [ ] Existing behaviour unchanged for successful runs

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
