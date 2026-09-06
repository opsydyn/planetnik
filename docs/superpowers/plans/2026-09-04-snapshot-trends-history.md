# Snapshot Trends History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the static Trends route consume an explicit JSON snapshot-history manifest and render a deterministic, provenance-linked comparison when at least two compatible snapshots are available.

**Architecture:** `@planetnik/common` remains filesystem-independent and selects the latest two canonical v2 snapshots deterministically before delegating to `compareCanonicalSnapshots`. `apps/site` reads a `snapshot-history.json` manifest from the selected report data directory, validates safe relative snapshot directories and v2 contexts, loads only declared canonical JSON shards, and passes the result to a presentational Trends panel. Missing history and incompatible snapshots remain first-class states.

**Tech Stack:** Bun, TypeScript, Astro, Astro content/static site, `@planetnik/common`, Bun test, Biome.

**Spec:** `docs/product-roadmap.md` Phase 3 and `docs/adr/0018-adopt-versioned-canonical-analysis-snapshots.md`.

## Global Constraints

- Keep canonical JSON as the only history input; do not add TXT or HTML parsing.
- Require `dataVersion: 2`, exact ISO timestamps, UUID v4 snapshot IDs, and the existing v2 manifest validation before comparison.
- Resolve snapshot directories only beneath the selected report data directory; reject absolute paths, backslashes, and `..` segments.
- Preserve explicit missing and incompatible result states; do not invent zero deltas for added or removed metrics.
- Keep the static site independent from `apps/runtime` and hosted persistence.
- Do not commit or push until separately approved.

---

### Task 1: Deterministic latest-snapshot pairing

**Files:**
- Modify: `packages/common/src/trends/SnapshotTrends.ts`
- Modify: `packages/common/src/trends/index.ts`
- Test: `packages/common/src/trends/__tests__/SnapshotTrends.test.ts`

**Interfaces:**
- Consumes: `CanonicalSnapshotInput` and `compareCanonicalSnapshots`.
- Produces: `compareLatestCanonicalSnapshots(snapshots: readonly CanonicalSnapshotInput[]): SnapshotComparison`.

- [x] **Step 1: Write the failing tests**

Add tests proving that an unsorted list selects the two newest `generatedAt` values, ties are ordered by `snapshotId`, fewer than two snapshots return `{ status: "missing", missing: "baseline" }`, and duplicate snapshot IDs return an explicit `snapshot_id` incompatibility.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `bun test packages/common/src/trends/__tests__/SnapshotTrends.test.ts`

Expected: FAIL because `compareLatestCanonicalSnapshots` is not exported.

- [x] **Step 3: Implement the minimal pairing function**

Validate each context with the existing internal context parser, reject duplicate IDs, sort by exact `generatedAt` then `snapshotId`, and call `compareCanonicalSnapshots(current, baseline)` for the final pair. Return the existing missing/incompatible union rather than throwing.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `bun test packages/common/src/trends/__tests__/SnapshotTrends.test.ts`

Expected: all pairing and comparator tests pass.

- [x] **Step 5: Run the package checks**

Run: `bunx biome check packages/common/src/trends && bun run --cwd packages/common typecheck`

Expected: no diagnostics and exit code 0.

---

### Task 2: JSON snapshot-history reader

**Files:**
- Create: `apps/site/src/lib/datasets/snapshotHistory.ts`
- Test: `apps/site/src/lib/__tests__/snapshotHistory.test.ts`

**Interfaces:**
- Consumes: a selected report `dataDir`, `isValidV2ReportContext`, and `compareLatestCanonicalSnapshots`.
- Produces: `readSnapshotHistory(dataDir)` returning a tagged `{ tag: "ready" | "missing" | "invalid" }` result with ordered entries, source manifest path, and comparison result.

The manifest contract is:

```json
{
  "historyVersion": 1,
  "snapshots": [
    { "dataDir": "history/2026-08-01" },
    { "dataDir": "." }
  ]
}
```

Each entry resolves beneath `dataDir`, reads `report_context.json`, validates the complete v2 context, follows `canonicalShards.metrics` when present, and never falls back to `metrics.txt`.

- [x] **Step 1: Write failing reader tests**

Use a temporary directory fixture containing valid v2 contexts, all declared required shard files, and `metrics.json`. Cover a ready history, absent manifest, malformed manifest version, unsafe traversal, missing context, and a missing metrics shard that remains an explicit comparator state.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `bun test apps/site/src/lib/__tests__/snapshotHistory.test.ts`

Expected: FAIL because the reader module does not exist.

- [x] **Step 3: Implement the reader**

Parse and validate the manifest, resolve safe directories with `join`, read canonical JSON, preserve the relative source directory for UI provenance, and call `compareLatestCanonicalSnapshots` over the loaded entries. Convert filesystem/JSON failures to tagged invalid results with concise messages.

- [x] **Step 4: Run the focused reader test**

Run: `bun test apps/site/src/lib/__tests__/snapshotHistory.test.ts`

Expected: all reader and safety cases pass.

- [x] **Step 5: Run the site typecheck**

Run: `bun run --cwd apps/site typecheck`

Expected: 0 errors; existing Astro hints may remain.

---

### Task 3: Trends presentation panel

**Files:**
- Create: `apps/site/src/components/trends/SnapshotTrendsPanel.astro`
- Modify: `apps/site/src/pages/trends.astro`

**Interfaces:**
- Consumes: the reader result, `SnapshotComparison`, and the current report title.
- Produces: an accessible static panel with `data-trends-status`, snapshot provenance anchors, a deterministic metric table, and explicit missing/incompatible copy.

- [x] **Step 1: Write the failing view-model assertions**

Extend the site test coverage with a view-model fixture assertion for compatible history: the model contains both snapshot IDs, metric IDs, direction labels, and exact record paths. Add assertions for missing and incompatible states; the Astro build and local HTTP smoke cover the final rendered markup.

- [x] **Step 2: Run the focused site tests to verify they fail**

Run: `bun test apps/site/src/lib/__tests__/snapshotHistory.test.ts`

Expected: FAIL because the page does not yet render a Trends panel.

- [x] **Step 3: Implement the panel and wire `/trends`**

Replace the generic placeholder with `readSnapshotHistory(resolveDataDir())`, render compatible deltas with baseline/current provenance and links to exact in-page snapshot/record anchors, and render the tagged missing/incompatible states without implying history exists.

- [x] **Step 4: Run focused and full verification**

Run: `bun test apps/site/src/lib/__tests__/snapshotHistory.test.ts packages/common/src/trends/__tests__/SnapshotTrends.test.ts && bun run typecheck && bun run build && git diff --check`

Expected: focused tests pass, full typecheck/build succeed, and the diff has no whitespace errors.

---

### Task 4: Contract documentation and roadmap reconciliation

**Files:**
- Modify: `docs/product-roadmap.md`
- Keep unchanged: `docs/adr/0018-adopt-versioned-canonical-analysis-snapshots.md` (the history manifest is a Phase 3 follow-on, not a rewrite of the accepted snapshot contract)

- [x] **Step 1: Document the `snapshot-history.json` v1 shape**

Record the manifest location, safe relative `dataDir` rule, canonical-shard-only policy, and the fact that fewer than two snapshots remains an honest missing-baseline state in the canonical roadmap and this plan.

- [x] **Step 2: Record the delivered boundary**

Mark the pairing/reader/UI slice as delivered, explicitly leaving long-term storage, hosted ingestion, entity-level deltas, and dataset-scoped history selection for later Phase 3 work.

- [x] **Step 3: Run the final repository gates**

Run: `bun test && bun run typecheck && bun run build && git diff --check`

Expected: all tests pass, typecheck has 0 errors, the static build completes, and no diff whitespace errors are reported.

---

Plan complete and saved to `docs/superpowers/plans/2026-09-04-snapshot-trends-history.md`. Executed inline in this session because the user approved the bounded move; stopped before commit/push.
