# Lower-Memory Complete Action Queue Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize complete, deterministically ranked portfolio action queue pagination without constructing the full canonical shard/entity/queue object graph in one Bun process.

**Architecture:** Keep `@planetnik/common` as the source of signal, grouping, and factor-vector ranking truth. Add a record-level adapter boundary so the site can stream canonical JSON array records, normalize each actionable signal, and spill compact signal rows into deterministic hash partitions. Process one partition at a time, build items with the shared item builder, externally merge sorted item runs, and emit compact 250-item pages incrementally. The existing bounded materializer remains available for safe default builds; the new complete path is explicit and reports its memory/output gates.

**Tech Stack:** Bun 1.4.2, TypeScript, Node filesystem streams, Effect 3.x, `@planetnik/common`, Bun tests, Astro v7 artifact routes.

**Spec:** `docs/superpowers/specs/2026-09-06-portfolio-action-queue-design.md`, ADR-0022, and the approved lower-memory external-spool design from the 2026-09-06 implementation turn.

## Global Constraints

- Preserve canonical v2 JSON-only input, exact snapshot/shard/record provenance, safe dataset-scoped evidence links, and fail-closed invalid/missing coverage.
- Preserve `buildPortfolioActionQueue` signal candidate rules, primary/alternate action selection, factor-vector ordering, `contractVersion: 1`, and `rankingPolicyVersion: 1`.
- Do not add an `actions.json` canonical shard or hosted workflow state.
- Do not rely on TXT, HTML, machine-clock time, `jq`, shell `sort`, or a new runtime service; the materializer must run under the repository’s Bun toolchain on macOS and CI.
- Use deterministic partition hashing, run ordering, tie-breaking, page numbering, and manifest metadata; source input order must not affect output.
- Keep generated spools, runs, and artifacts outside git; preserve unrelated `.superpowers/brainstorm` scratch files.
- Keep the existing bounded materializer path and artifact schema readable while the complete path is introduced; use a new stream fingerprint salt so cache keys cannot collide with old materializations.
- Enforce a configurable partition count and page size as positive integers, defaulting to 64 partitions and the existing 250-item page size.
- Full-catalogue acceptance requires exact queue totals/order/provenance against a trusted reference on bounded fixtures and a real-catalogue run with RSS below 4 GiB; route count and artifact disk size must be reported separately from RSS.

---

### Task 1: Expose record-level common adapters and item construction

**Files:**
- Modify: `packages/common/src/action-queue/SignalAdapters.ts`
- Modify: `packages/common/src/action-queue/PortfolioActionQueue.ts`
- Modify: `packages/common/src/action-queue/index.ts`
- Test: `packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

**Interfaces:**
- Produces `adaptPortfolioActionSourceRecord(input, domain, record, extraEvidence?)`, returning either a normalized `PortfolioActionSignal`, an invalid-record diagnostic, or an explicit non-candidate result.
- Produces `adaptPortfolioActionTrendTargets(input, targetIds)`, the trend adapter equivalent that accepts a target-ID set instead of requiring a full actionable signal array.
- Produces `buildPortfolioActionQueueItem(repositoryTitle, signals, asOf)`, using the existing private `buildItem` implementation and returning `undefined` for trend-only groups.
- Produces `isPortfolioActionSignalInWindow(signal, window, asOf)`, the exported window predicate used by both batch and streamed materialization.
- Existing `adaptPortfolioActionSignals`, `adaptTrendSignals`, `buildPortfolioActionQueue`, and `buildPortfolioActionQueueWithStats` retain their public behavior by delegating to these helpers.

- [ ] **Step 1: Write failing tests for record-level parity.**

Add tests proving that a valid hotspot source record produces the same signal shape as the batch adapter, a non-candidate record produces no signal without a diagnostic, an invalid evidence anchor produces the existing diagnostic, a trend target set enriches only matching targets, and `buildPortfolioActionQueueItem` matches the item produced by the full queue builder.

- [ ] **Step 2: Run the focused common test and verify it fails for missing exports.**

Run: `bun test packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

Expected: FAIL because the new record-level and item-builder exports do not yet exist.

- [ ] **Step 3: Refactor the existing private helpers without changing rules.**

Move the current record validation/candidate/make-signal path behind `adaptPortfolioActionSourceRecord`. Move `buildItem` behind `buildPortfolioActionQueueItem`. Add a target-set trend helper and make `adaptTrendSignals` call it with the existing signal-derived set. Make `adaptCurrentDomain` call the record helper so batch diagnostics and signal order remain unchanged.

- [ ] **Step 4: Run the focused test and the action-queue common suite.**

Run: `bun test packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

Expected: PASS, including all existing ranking and provenance assertions.

- [ ] **Step 5: Commit the common boundary.**

Run:

```bash
git add packages/common/src/action-queue
git commit -m "refactor: expose streaming action queue boundaries"
```

### Task 2: Add a bounded incremental canonical JSON array reader

**Files:**
- Create: `apps/site/src/lib/datasets/streamJsonArray.ts`
- Test: `apps/site/src/lib/__tests__/streamJsonArray.test.ts`
- Modify: `apps/site/tsconfig.json` only if the test/runtime types require an explicit Node stream import.

**Interfaces:**
- Produces `streamJsonArrayObjects(path, key, options?)`, an async generator yielding `{ index: number; value: Record<string, unknown> }` for object elements in a named top-level array.
- Rejects malformed JSON, unsafe/non-object array elements, missing keys, duplicate key selection, and invalid UTF-8 framing with a descriptive `Error`.
- Never retains more than the current input chunk plus the current JSON object; no whole-file `readFileSync` or `JSON.parse` of the enclosing shard is permitted.

- [ ] **Step 1: Write parser tests first.**

Cover arrays whose objects cross 1-byte and 17-byte chunk boundaries, escaped braces/quotes inside strings, nested arrays/objects, empty arrays, a missing key, a scalar array element, and malformed/truncated JSON.

- [ ] **Step 2: Run the parser tests and verify the expected failures.**

Run: `bun test apps/site/src/lib/__tests__/streamJsonArray.test.ts`

Expected: FAIL because the module is not present.

- [ ] **Step 3: Implement the async generator with `createReadStream` and a streaming `TextDecoder`.**

Frame object boundaries with string/escape/depth state, preserve only an incomplete object between chunks, parse each completed object independently, and verify the named array closes before returning. Use an explicit `highWaterMark` option with a 1 MiB default.

- [ ] **Step 4: Run parser tests and a real giant-shard probe.**

Run: `bun test apps/site/src/lib/__tests__/streamJsonArray.test.ts`

Then run a temporary stdin Bun probe over `datasets/code-city-task9/data/hotspots.json` and `units.json` with `NODE_OPTIONS=--max-old-space-size=1024`; record record counts, elapsed time, and peak `process.memoryUsage().rss`.

Expected: focused tests pass; the real probe stays below 512 MiB RSS and yields 1,112,667 hotspot records and 680,820 unit records.

- [ ] **Step 5: Commit the parser.**

Run:

```bash
git add apps/site/src/lib/datasets/streamJsonArray.ts apps/site/src/lib/__tests__/streamJsonArray.test.ts apps/site/tsconfig.json
git commit -m "feat: stream canonical JSON array records"
```

### Task 3: Build streaming canonical signal extraction

**Files:**
- Create: `apps/site/src/lib/datasets/actionQueueStreamingSource.ts`
- Modify: `apps/site/src/lib/datasets/actionQueueSource.ts` to export the validated descriptor/context discovery needed by the stream source without changing the existing reader.
- Test: `apps/site/src/lib/__tests__/actionQueueStreamingSource.test.ts`

**Interfaces:**
- Produces `ActionQueueStreamingSource`:

  ```ts
  type ActionQueueStreamingSourceMetadata = {
    readonly asOf: string
    readonly coverage: PortfolioActionQueueCoverage
    readonly filterOptions: ActionQueueArtifactFilterOptions
  }
  type ActionQueueStreamingSource = {
    readonly sourceIds: readonly string[]
    readonly metadata: ActionQueueStreamingSourceMetadata
    readonly streamSignals: (
      emit: (row: { readonly key: string; readonly repositoryTitle: string; readonly signal: PortfolioActionSignal }) => void,
    ) => Promise<void>
  }
  ```

  `createStreamingActionQueueSource({ catalog, datasetsRoot? })` returns this source. `streamSignals` is called once per materialization and emits `{ key, repositoryTitle, signal }`; metadata contains the sorted coverage/filter values used for every window.
- Current-domain extraction streams `hotspots`, `controls`, `impact`, and declared security arrays; ownership is derived from hotspot records without retaining a second collection.
- Coupling extraction streams `filesMain`, `units`, and `componentDependencies` into bounded component accumulators matching `readSnapshotEntities` provenance selectors; component hotspot records are joined by stable component ID.
- History/trend extraction uses the existing validated history contract and the new target-set trend helper; trend signals are emitted only for targets that received actionable current signals.

- [ ] **Step 1: Write source parity tests.**

Using the existing temporary fixture helpers, assert that a streamed ready fixture emits the same signal IDs, target IDs, priority bands, facts, evidence anchors, coverage states, and diagnostics as `createDatasetActionQueueReader` for every window. Add partial, malformed, missing-shard, unsafe-route, duplicate-identity, and history fixtures.

- [ ] **Step 2: Run the source parity tests and verify failure.**

Run: `bun test apps/site/src/lib/__tests__/actionQueueStreamingSource.test.ts`

Expected: FAIL because the streaming source module is not present.

- [ ] **Step 3: Implement validated dataset metadata discovery.**

Read only `report_context.json` and small metadata shards up front. Build the same included/planned/excluded/unavailable dataset lists and `asOf` value as the batch reader. Do not call `readDatasetCurrentSnapshot(..., { includeEntities: true })` in this path.

- [ ] **Step 4: Implement hotspot/control/impact/security record streaming.**

Construct exact `SnapshotEntityRecord` provenance selectors (`fileHotspots[index=N]`, `goals[index=N].controls[index=M]`, `impact_opportunities[index=N]`, and `alerts[index=N]`), call the common record adapter, emit valid signals, and record domain diagnostics/counts without storing source arrays.

- [ ] **Step 5: Implement bounded component aggregation.**

Stream file/unit/dependency records into the existing component identity policy, retaining only per-component counters, index selectors, and scalar totals. Create component source records with the same shard selector pairs as `readSnapshotEntities`, merge component hotspots, and feed the coupling adapter. Release each dataset accumulator before moving to the next dataset.

- [ ] **Step 6: Implement target-set trend extraction and window predicates.**

Collect only stable target IDs for current actionable signals, invoke the target-set trend adapter, and emit all normalized signals once with their observed timestamps. Preserve the existing `current`, `latest-compatible`, `7d`, `30d`, and `90d` inclusion predicate exactly during downstream window reads.

- [ ] **Step 7: Run source parity tests and a real code-city stream measurement.**

Run: `bun test apps/site/src/lib/__tests__/actionQueueStreamingSource.test.ts apps/site/src/lib/__tests__/actionQueueSource.test.ts`

Then stream the real code-city fixture and compare emitted hotspot signal count (`1,112,667`) and current item total (`1,112,669`) against the batch reference on a high-memory reference process. Record RSS and elapsed time.

- [ ] **Step 8: Commit the streaming source.**

Run:

```bash
git add apps/site/src/lib/datasets/actionQueueStreamingSource.ts apps/site/src/lib/datasets/actionQueueSource.ts apps/site/src/lib/__tests__/actionQueueStreamingSource.test.ts
git commit -m "feat: stream canonical action queue signals"
```

### Task 4: Add deterministic partition, external merge, and incremental page emission

**Files:**
- Create: `apps/site/src/lib/datasets/actionQueueExternalMaterializer.ts`
- Modify: `apps/site/src/lib/datasets/actionQueueArtifacts.ts` for a stream-safe content fingerprint helper.
- Modify: `apps/site/src/lib/datasets/actionQueueArtifactRoutes.ts` only if validation needs to accept the stream fingerprint salt without relaxing existing shape checks.
- Test: `apps/site/src/lib/__tests__/actionQueueExternalMaterializer.test.ts`
- Test: `apps/site/src/lib/__tests__/actionQueueArtifacts.test.ts`

**Interfaces:**
- Produces `materializeStreamingActionQueueArtifacts({ source, outputDir, windows?, pageSize?, partitionCount? })` returning the existing `ActionQueueArtifactManifest`.
- Consumes the exact `ActionQueueStreamingSource` interface from Task 3 and writes temporary work under an adjacent `.action-queue-stream-*` directory, publishing atomically only after all windows complete.
- Partition files contain newline-delimited serialized normalized signals keyed by stable `repositoryId + NUL + targetId`; partition assignment is deterministic FNV-1a or SHA-256 and is covered by tests.
- A partition pass builds groups and calls `buildPortfolioActionQueueItem`; sorted item runs use `compareQueueItems`; a bounded k-way merge emits compact chunks via `compactActionQueueItems` without retaining the complete queue.
- `createActionQueueWindowStreamFingerprint({ sourceIds, projectionVersion, window, pageSize, totalItems, asOf, coverage })` returns `{ updateItem(item), digest() }`; it hashes canonical manifest metadata and each canonicalized item in rank order with an explicit stream fingerprint version, preserving 64-hex cache keys without colliding with the existing whole-queue helper.

- [ ] **Step 1: Write failing external-materializer tests.**

Use a synthetic streaming source with multiple repositories, repeated target signals, trend-only signals, ties, and a page size of 2. Assert exact item order across partition boundaries, full totals, `complete: true`, compact evidence refs, deterministic reruns, cleanup after success/failure, and stream fingerprint changes when one signal changes.

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `bun test apps/site/src/lib/__tests__/actionQueueExternalMaterializer.test.ts`

Expected: FAIL because the external materializer module is not present.

- [ ] **Step 3: Implement partition writers/readers.**

Create fixed-count partition files, buffer writes per partition, validate each parsed signal row, and close/remove all temporary resources through an Effect acquire/use/release scope. Reject malformed rows rather than silently dropping them.

- [ ] **Step 4: Implement per-partition grouping and sorted runs.**

Read one partition at a time, group by the exact item key, call the shared item builder, count complete items, sort bounded runs with `compareQueueItems`, and write newline-delimited full queue items. Keep coverage/filter metadata separate from item memory.

- [ ] **Step 5: Implement k-way merge and page writer.**

Open one cursor per run, maintain a min-heap ordered by `compareQueueItems`, update the stream fingerprint per emitted item, compact each 250-item page immediately, and write page files plus manifest metadata. Ensure the final page is emitted exactly once and `pageCount === ceil(totalItems / pageSize)`.

- [ ] **Step 6: Implement atomic publication and stream fingerprinting.**

Write all pages and the manifest in the staging directory, mark every window `complete: true`, then replace the destination directory with the existing atomic rename pattern. Include source IDs, projection version, window, page size, total, coverage, and canonical item sequence in the stream fingerprint.

- [ ] **Step 7: Run focused tests and a real one-window external probe.**

Run: `bun test apps/site/src/lib/__tests__/actionQueueExternalMaterializer.test.ts apps/site/src/lib/__tests__/actionQueueArtifacts.test.ts apps/site/src/lib/__tests__/actionQueueArtifactRoutes.test.ts`

Then run the complete external materializer for the real `code-city-task9` dataset and `current` window with `NODE_OPTIONS=--max-old-space-size=1024`; record total 1,112,669, page count 4,451, output bytes, elapsed time, and peak RSS.

- [ ] **Step 8: Commit the external materializer.**

Run:

```bash
git add apps/site/src/lib/datasets/actionQueueExternalMaterializer.ts apps/site/src/lib/datasets/actionQueueArtifacts.ts apps/site/src/lib/datasets/actionQueueArtifactRoutes.ts apps/site/src/lib/__tests__/actionQueueExternalMaterializer.test.ts apps/site/src/lib/__tests__/actionQueueArtifacts.test.ts apps/site/src/lib/__tests__/actionQueueArtifactRoutes.test.ts
git commit -m "feat: externally materialize complete action queue pages"
```

### Task 5: Wire the complete path behind an explicit build mode and document gates

**Files:**
- Modify: `apps/site/scripts/materialize-action-queue.ts`
- Modify: `apps/site/package.json` only if a named complete-materialization script is useful.
- Modify: `docs/adr/0022-adopt-explainable-portfolio-action-queue.md`
- Modify: `docs/product-roadmap.md`
- Modify: `docs/superpowers/plans/2026-09-06-incremental-action-queue-artifacts.md`
- Test: `apps/site/src/lib/__tests__/actionQueueMaterializeScript.test.ts` if script mode parsing is extracted.

**Interfaces:**
- Existing default `bun run --cwd apps/site materialize-action-queue` stays bounded at 250 items per window.
- `PLANETNIK_ACTION_QUEUE_COMPLETE=1 bun run --cwd apps/site materialize-action-queue` invokes the external complete path with `PLANETNIK_ACTION_QUEUE_PARTITIONS` (default `64`) and preserves the existing output directory override.
- The script prints mode, per-window totals/page counts, output bytes, elapsed time, and peak RSS when complete mode is selected; it never claims deployment or live acceptance.

- [ ] **Step 1: Write a failing mode-selection test or extract a pure parser.**

Assert that unset/false complete mode selects the existing bounded source and that `1` selects the streaming external source; invalid partition counts fail closed with a clear message.

- [ ] **Step 2: Run the focused script test and verify failure.**

Run: `bun test apps/site/src/lib/__tests__/actionQueueMaterializeScript.test.ts`

Expected: FAIL until mode parsing is extracted and wired.

- [ ] **Step 3: Implement explicit complete-mode selection.**

Keep the current bounded default unchanged. In complete mode, load the catalog metadata, create the streaming source, and call the external materializer. Do not use `STATIC_ACTION_QUEUE_ITEM_LIMIT` in complete mode.

- [ ] **Step 4: Run fixture build verification.**

Run the complete mode against a copied `code-city-task9-complete` fixture and assert five complete windows, 64 HTML/JSON pages, exact evidence links, and no temporary spool directory after publication.

- [ ] **Step 5: Update ADR/roadmap evidence.**

Record the streaming/parser measurements, real one-window probe, complete-mode invocation, explicit 4 GiB RSS gate, output-byte/page-count gate, and the fact that the default prebuild remains bounded pending a full five-window disk/build budget run.

- [ ] **Step 6: Run workspace verification before claiming completion.**

Run:

```bash
git diff --check
bun run typecheck
bun test
bun run --cwd apps/site build
```

Also run the complete mode on the real catalogue with a separate output directory and `NODE_OPTIONS=--max-old-space-size=4096`; capture all five totals, page counts, RSS, elapsed time, and output bytes. Report any route/build or disk budget blocker separately from the memory gate.

- [ ] **Step 7: Commit documentation and wiring.**

Run:

```bash
git add apps/site/scripts/materialize-action-queue.ts apps/site/package.json docs/adr/0022-adopt-explainable-portfolio-action-queue.md docs/product-roadmap.md docs/superpowers/plans/2026-09-06-incremental-action-queue-artifacts.md apps/site/src/lib/__tests__/actionQueueMaterializeScript.test.ts
git commit -m "docs: record complete action queue pagination gates"
```

## Review Checklist

- Every stream signal has the same evidence anchors and candidate/priority behavior as the batch reader.
- No source file is parsed with whole-file `JSON.parse` in the complete path.
- Grouping is exact by repository and stable target ID; equal labels never merge.
- External runs and k-way merge use the existing comparator and no composite score.
- Every complete page is compacted with exact evidence refs and is independently readable by existing routes.
- `complete: true`, total/page counts, coverage, filter options, fingerprints, and atomic cleanup are verified.
- The real-catalogue run stays below 4 GiB RSS, while output bytes and 24,949-route static cost remain explicit.
