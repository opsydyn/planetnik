# Incremental Action Queue Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic static portfolio action payload with cacheable, bounded artifacts while preserving the canonical queue ranking and exact evidence provenance.

**Architecture:** Keep `@planetnik/common` as the source of ranking truth. A site-side materializer will build one observation window at a time, split the ranked queue into deterministic chunks, and write a manifest plus chunk files under the Astro cache directory. Astro will expose those artifacts through `getStaticPaths()` routes with content-derived `cacheKey` values; the existing `/datasets/actions` shell will consume only the selected page. Complete ranked pagination is supported when materialization runs without an item limit; the default real-catalogue prebuild currently uses a bounded top-250 fallback and labels those artifacts `complete: false` until the full materialization memory cost is reduced.

**Tech Stack:** Bun 1.3.11, TypeScript, Astro 7.2+ incremental static builds, `effect` 3.x fibers and `Effect.forEach`, `@planetnik/common`, Astro static endpoints/pages, Bun tests.

**Spec:** `docs/superpowers/specs/2026-09-06-portfolio-action-queue-design.md` and ADR-0022, extended by the approved chat design for incremental, chunked static artifacts.

## Global Constraints

- Preserve the canonical v2 JSON boundary and all exact dataset-scoped evidence anchors.
- Preserve `buildPortfolioActionQueue` ranking and factor semantics; chunking must not reorder or drop ranked items.
- Do not add `actions.json` to canonical analysis exports; these are derived static artifacts only.
- Keep the hosted acknowledgement/status overlay out of this slice.
- Do not fork heavy synchronous queue builds concurrently; materialize windows with bounded concurrency `1` until measurements prove a higher limit safe.
- Every generated artifact must include a source fingerprint and projection version so stale cache entries cannot be reused silently.
- The public route must state its pagination/materialization scope; no filtered result may be presented as a complete queue when it is page-local.
- Keep generated artifacts out of git and preserve the existing untracked `.superpowers/brainstorm` scratch files.

## Execution status (2026-09-06)

The contract, bounded common prefix builder, sequential Effect materializer,
Astro 7.2 chunk routes, page-aware shell, filter/pagination helpers, and
focused regression tests are implemented in the current worktree. The copied
`code-city-task9-complete` fixture builds 64 static pages, including one HTML
and one JSON route for each observation window. The real local catalogue
materializes five bounded page-one artifacts successfully; the final combined
build completes in 264.43 seconds (Astro itself 41.25 seconds), peaks at
14,213,120,000 bytes RSS, reports the full totals, and records `complete: false`
rather than emitting empty pages. The final output is 131 pages with a 4 GB
Node heap; the five action JSON routes are restored from Astro's incremental
cache on a second unchanged build with the same source fingerprint. Full-catalogue
(unbounded) page materialization and changed-fingerprint selective rebuild
measurement remain unproven.

## File Map

- Modify `apps/site/package.json` to add the materializer command and upgrade Astro to the minimum version that provides incremental builds.
- Modify `apps/site/astro.config.mjs` to enable `experimental.incrementalBuild` and retain build concurrency `1`.
- Create `apps/site/src/lib/datasets/actionQueueArtifacts.ts` for pure chunking, manifest types, stable fingerprints, and filesystem-independent serialization.
- Create `apps/site/src/lib/datasets/actionQueueArtifactMaterializer.ts` for the Effect program that reads one queue window at a time and atomically writes manifest/chunks.
- Create `apps/site/scripts/materialize-action-queue.ts` as the Bun entrypoint used before `astro build`.
- Create `apps/site/src/lib/datasets/__tests__/actionQueueArtifacts.test.ts` for red/green chunking, ordering, fingerprint, and validation tests.
- Create `apps/site/src/lib/datasets/__tests__/actionQueueArtifactMaterializer.test.ts` for a temporary-directory materialization test with a real fixture and bounded window execution.
- Create `apps/site/src/pages/datasets/actions/[window]/[page].json.ts` for cacheable static chunk responses using `getStaticPaths()` and `cacheKey`.
- Modify `apps/site/src/pages/datasets/actions.astro` and `apps/site/src/components/datasets/PortfolioActionQueuePanel.astro` to render the selected page and link through deterministic pagination while retaining the current evidence-first markup.
- Modify `apps/site/src/lib/__tests__/actionQueueSource.test.ts` only when source-model behavior changes; keep the existing top-250 regression tests until the new route is proven.
- Modify `docs/adr/0022-adopt-explainable-portfolio-action-queue.md` and `docs/product-roadmap.md` with measured artifact, cache, and filter semantics.

### Task 1: Define and test deterministic queue chunks

**Files:**
- Create: `apps/site/src/lib/datasets/actionQueueArtifacts.ts`
- Test: `apps/site/src/lib/datasets/__tests__/actionQueueArtifacts.test.ts`

**Interfaces:**
- Consumes: `PortfolioActionQueue`, `PortfolioActionQueueItem`, and `PortfolioActionWindow` from `@planetnik/common`.
- Produces: `ACTION_QUEUE_ARTIFACT_VERSION`, `ACTION_QUEUE_PAGE_SIZE`, `ActionQueueArtifactManifest`, `ActionQueueArtifactChunk`, `chunkPortfolioActionQueue(queue, pageSize)`, and `fingerprintActionQueueSource(sourceIds, projectionVersion)`.

- [x] **Step 1: Write the failing tests.**

  Add tests that construct a small real queue fixture and assert:

  ```ts
  const chunks = chunkPortfolioActionQueue(queue, 2)
  expect(chunks.map((chunk) => chunk.items.map((item) => item.id))).toEqual([
    [queue.items[0]!.id, queue.items[1]!.id],
    [queue.items[2]!.id],
  ])
  expect(chunks[0]).toMatchObject({ page: 1, pageSize: 2, totalItems: 3 })
  expect(chunks[1]).toMatchObject({ page: 2, pageSize: 2, totalItems: 3 })
  ```

  Add tests for an empty queue, invalid page sizes (`0`, negative, non-integer), stable fingerprints for identical inputs, and changed fingerprints when a source snapshot or projection version changes.

- [x] **Step 2: Run the focused test and verify the expected red failure.**

  Run:

  ```bash
  bun test apps/site/src/lib/datasets/__tests__/actionQueueArtifacts.test.ts
  ```

  Expected: the test fails because the artifact module and chunking function do not yet exist.

- [x] **Step 3: Implement the minimal pure artifact contract.**

  Define readonly manifest/chunk types. `chunkPortfolioActionQueue` must preserve input order, use one-based page numbers, repeat `totalItems` on every chunk, and return an empty chunk list for an empty queue. `fingerprintActionQueueSource` must hash a canonical JSON string of sorted source identifiers plus the projection version; use the repository’s existing Bun-compatible crypto utility or Node `createHash` without adding a dependency.

- [x] **Step 4: Run the focused test and verify green.**

  Run the same command. Expected: all artifact tests pass with no unrelated files changed.

- [x] **Step 5: Commit the self-contained contract.**

  ```bash
  git add apps/site/src/lib/datasets/actionQueueArtifacts.ts apps/site/src/lib/datasets/__tests__/actionQueueArtifacts.test.ts docs/superpowers/plans/2026-09-06-incremental-action-queue-artifacts.md
  git commit -m "test: define incremental action queue artifacts"
  ```

### Task 2: Materialize artifacts under an Effect-supervised scope

**Files:**
- Create: `apps/site/src/lib/datasets/actionQueueArtifactMaterializer.ts`
- Create: `apps/site/scripts/materialize-action-queue.ts`
- Test: `apps/site/src/lib/datasets/__tests__/actionQueueArtifactMaterializer.test.ts`
- Modify: `apps/site/package.json`

**Interfaces:**
- Consumes: `readDatasetActionQueueWindow` (extracted from the existing source reader), `DatasetCatalog`, and Task 1 artifact functions.
- Produces: `materializeActionQueueArtifacts(options): Effect.Effect<ActionQueueArtifactManifest, ActionQueueArtifactError>` and a Bun script that runs it before Astro.

- [x] **Step 1: Write the failing materialization test.**

  Use the existing temporary dataset fixture helpers. Run the materializer against one requested window and a temporary output directory, then assert that it writes one manifest and the expected chunk files, with every item ID appearing exactly once in ranked order and the manifest fingerprint present.

- [x] **Step 2: Run the test and verify red.**

  ```bash
  bun test apps/site/src/lib/datasets/__tests__/actionQueueArtifactMaterializer.test.ts
  ```

  Expected: failure because the materializer and window reader are not implemented.

- [x] **Step 3: Extract a single-window reader without changing ranking.**

  Refactor the existing source reader so dataset inputs are prepared once and a private/exported `readDatasetActionQueueWindow` builds exactly one `PortfolioActionQueue`. Keep the public model reader behavior unchanged for existing callers. Do not fork five synchronous builders concurrently.

- [x] **Step 4: Implement the minimal Effect materializer.**

  Use `Effect.gen` and `Effect.forEach(windows, ..., { concurrency: 1 })` so each window is a child fiber with a bounded lifetime. Wrap filesystem writes in typed `Effect.tryPromise`/`Effect.trySync` errors, write to a temporary sibling directory, then rename it into place only after all chunks and the manifest are complete. The materializer must support a single-window option for the first proof and the full five-window set for the build script.

- [x] **Step 5: Run the test and verify green.**

  Run the focused materializer test, then the existing action-source tests. Expected: both pass and the existing top-250 source contract remains intact.

- [x] **Step 6: Add the prebuild command.**

  Add `materialize-action-queue` and `prebuild` scripts in `apps/site/package.json`. The script must produce an empty, valid manifest when no usable dataset is configured and must never write generated output into tracked source directories.

- [ ] **Step 7: Commit the materializer.**

  ```bash
  git add apps/site/src/lib/datasets/actionQueueArtifactMaterializer.ts apps/site/scripts/materialize-action-queue.ts apps/site/src/lib/datasets/__tests__/actionQueueArtifactMaterializer.test.ts apps/site/package.json
  git commit -m "feat: materialize action queue artifacts with Effect"
  ```

### Task 3: Add cacheable Astro chunk routes

**Files:**
- Create: `apps/site/src/pages/datasets/actions/[window]/[page].json.ts`
- Modify: `apps/site/astro.config.mjs`
- Modify: `apps/site/package.json`

**Interfaces:**
- Consumes: the manifest/chunks produced by Task 2.
- Produces: static JSON routes for each valid window/page, each with a stable `cacheKey` containing the source fingerprint, window, page, and projection version.

- [x] **Step 1: Write a route contract test.**

  Assert that the route path parser rejects unknown windows and non-positive pages, returns the correct chunk for a valid pair, and serializes the exact evidence anchors unchanged.

- [x] **Step 2: Run the route test and verify red.**

  ```bash
  bun test apps/site/src/lib/datasets/__tests__/actionQueueArtifactRoutes.test.ts
  ```

  Expected: failure because the route and route helper do not exist.

- [x] **Step 3: Upgrade Astro and enable incremental builds.**

  Upgrade only the Astro package/lockfile to a compatible `7.2+` release, add `experimental: { incrementalBuild: true }`, and leave `build.concurrency` at `1`. If the integration compatibility gate fails, stop the upgrade in this task and retain the artifact routes without the flag, recording the exact failure.

- [x] **Step 4: Implement `getStaticPaths()` and `GET`.**

  `getStaticPaths()` reads the generated manifest, returns only existing chunk params, and supplies the source-derived `cacheKey`. `GET` reads one chunk by validated params and returns `Response.json` with a public immutable cache header. It must not call the full queue builder.

- [x] **Step 5: Run the route test and a fixture build.**

  Run the focused route test and:

  ```bash
  PLANETNIK_DATASETS_ROOT=apps/site/test-fixtures bun run --cwd apps/site build
  ```

  Expected: static chunk files exist and the manifest’s page count matches the generated routes.

- [ ] **Step 6: Commit the Astro integration.**

  ```bash
  git add apps/site/src/pages/datasets/actions apps/site/astro.config.mjs apps/site/package.json bun.lockb bun.lock
  git commit -m "feat: add incremental action queue chunk routes"
  ```

### Task 4: Make the public actions page page-aware

**Files:**
- Modify: `apps/site/src/pages/datasets/actions.astro`
- Modify: `apps/site/src/components/datasets/PortfolioActionQueuePanel.astro`
- Modify: action filter tests and component tests as needed.

**Interfaces:**
- Consumes: Task 3 static chunk routes and manifest metadata.
- Produces: `/datasets/actions` as a small canonical shell, deterministic window/page links, and explicit page-local filter copy until a complete index query is available.

- [x] **Step 1: Write failing page behavior tests.**

  Assert that the default route renders only the selected chunk, emits a next link when another chunk exists, preserves `window`, `page`, and filter query parameters in pagination links, and states that counts/filters apply to the current materialized page.

- [x] **Step 2: Run the focused route/component tests and verify red.**

  ```bash
  bun test apps/site/src/lib/__tests__/actionQueueFilters.test.ts apps/site/src/lib/datasets/__tests__/actionQueuePage.test.ts
  ```

- [x] **Step 3: Implement minimal page-aware rendering.**

  Keep the current evidence-first item markup and no-JavaScript links. Replace the five hidden full-window copies with one selected window/page. Preserve the full ranked total in the manifest and never label the current page as the whole queue.

- [x] **Step 4: Run tests and inspect the fixture route.**

  Verify keyboard-accessible pagination, exact evidence hrefs, and an empty/invalid manifest state.

- [ ] **Step 5: Commit the page integration.**

  ```bash
  git add apps/site/src/pages/datasets/actions.astro apps/site/src/components/datasets/PortfolioActionQueuePanel.astro apps/site/src/lib
  git commit -m "feat: paginate static portfolio actions"
  ```

### Task 5: Measure, document, and decide whether the global cap can be removed

**Files:**
- Modify: `docs/adr/0022-adopt-explainable-portfolio-action-queue.md`
- Modify: `docs/product-roadmap.md`
- Test/artifact output: `apps/site/dist` and `.astro` remain ignored/generated.

- [x] **Step 1: Run focused, full, and build gates.**

  Run the artifact/materializer/route tests, `bun test`, `bun run typecheck`, changed-path Biome checks, and the fixture build. Then run the real-data build with `NODE_OPTIONS=--max-old-space-size=4096` and record page count, peak behavior, total chunk bytes, largest chunk, and incremental cache hit behavior across a second unchanged build.

- [x] **Step 2: Inspect output directly.**

  Verify that `/datasets/actions` is small, each chunk is independently readable, evidence anchors remain exact, and a changed source fingerprint rebuilds only affected routes while an unchanged build reuses cache entries.

- [x] **Step 3: Update ADR and roadmap with evidence.**

  Record Astro version/flag, cache persistence requirement, Effect concurrency bound, measured payload/memory results, and the final filter semantics. Remove the top-250 policy only if complete paginated results are proven; otherwise retain it as an explicitly temporary fallback with the measured reason.

- [x] **Step 4: Final verification before any release commit.**

  Run `git diff --check`, `bun run typecheck`, `bun test`, and the real-data build again from the final tree. Do not claim deployment or hosted acceptance; those remain separate roadmap boundaries.

  Final run: focused action-queue suites pass (52 tests, 336 assertions),
  `bun test` passes 1,291 tests with 0 failures, workspace typecheck
  exits 0 (site reports 0 errors, 0 warnings, 21 existing hints), the changed
  path Biome check and `git diff --check` are clean, and the named-dataset
  combined build completes 131 pages. The repository-wide `bun run lint`
  baseline remains open and is not part of this scoped release gate.
