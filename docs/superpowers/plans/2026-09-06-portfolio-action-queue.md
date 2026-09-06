# Portfolio Action Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first static, evidence-backed portfolio action queue at `/datasets/actions` from validated canonical v2 repository snapshots, with deterministic explainable ranking and URL-addressable filters.

**Architecture:** Keep the analytical boundary route-neutral in `@planetnik/common`. Site-only readers validate catalogue entries, load declared JSON shards and compatible history, attach dataset-scoped evidence links, and pass serialisable source records to the common adapters. The static route pre-renders a queue variant for each supported time window and uses a small browser layer only to select a variant and hide filtered rows; no browser analysis or hosted workflow state is introduced.

**Tech Stack:** Bun `1.3.11`, TypeScript with `.js` import specifiers, `@planetnik/common`, Effect Schema where existing common contracts use it, Astro `7.0.7`, Astro static pages, and Bun tests. No new dependency is required.

**Spec:** [Portfolio action-queue design](../specs/2026-09-06-portfolio-action-queue-design.md) and [ADR-0022](../../adr/0022-adopt-explainable-portfolio-action-queue.md)

## Global Constraints

- Consume canonical v2 JSON snapshots and compatible history only; never parse TXT, HTML, or browser-fetched repositories.
- Keep `contractVersion: 1` and `rankingPolicyVersion: 1` exactly as specified.
- Do not create a canonical `actions.json` shard in this first slice.
- Do not add a composite numeric score or a learned ranking model; serialize visible priority, corroboration, trend, and freshness factors instead.
- Include only `ready` and `partial` single-repository catalogue entries in queue items; planned, invalid, and landscape entries remain coverage diagnostics.
- Require stable source target/entity IDs and valid snapshot/shard/record/href provenance; never use a display name as an identity fallback.
- Normalize an absent explicit team to the stable `unassigned` sentinel; do not infer teams from contributor email or ownership counts.
- Treat current landscape dependency alert/health shards as coverage-only until a repository-scoped join exists; do not fabricate repository security signals.
- Keep static items read-only with `status: "untracked"`; do not touch `apps/app` or `apps/runtime` for hosted acknowledgement in this slice.
- Preserve unrelated dirty work in the current checkout. Do not run `git reset`, `git checkout`, or destructive cleanup.
- Do not create a commit unless the user explicitly authorizes it after implementation and verification.

---

## File map and responsibility boundaries

Create the common model in focused files rather than placing source readers or Astro concerns in the common package:

- `packages/common/src/action-queue/PortfolioActionQueue.ts` — public serialisable types, source-input types, coverage shape, queue construction entry point, and filtered queue projection.
- `packages/common/src/action-queue/SignalAdapters.ts` — pure hotspot, control, security, impact, coupling, ownership, and trend adapters.
- `packages/common/src/action-queue/Ranking.ts` — factor-vector comparison, trend direction, freshness bands, and visible factor explanations.
- `packages/common/src/action-queue/index.ts` and `packages/common/src/index.ts` — barrel exports.
- `packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts` — adapter, grouping, ranking, window, provenance, and fail-closed fixtures.
- `apps/site/src/lib/datasets/actionQueueSource.ts` — site filesystem boundary; validates catalogue entries, reads declared shards/history, creates source records, and builds one queue per window.
- `apps/site/src/lib/datasets/actionQueueFilters.ts` — query parameter parsing, canonical serialization, and filter option ordering.
- `apps/site/src/lib/__tests__/actionQueueSource.test.ts` — ready/partial/planned/landscape/invalid dataset fixtures and exact route provenance.
- `apps/site/src/lib/__tests__/actionQueueFilters.test.ts` — URL round-trip and invalid-value tests.
- `apps/site/src/lib/datasets/snapshotHistory.ts` — extend `readDatasetCurrentSnapshot` with opt-in entity loading without changing its current default behavior.
- `apps/site/src/pages/datasets/actions.astro` — static route shell, catalogue loading, query parsing, and queue-panel composition.
- `apps/site/src/components/datasets/PortfolioActionQueuePanel.astro` — evidence-first queue/list markup, factor explanations, coverage diagnostics, filter controls, and minimal static filtering script.
- `apps/site/src/layouts/ExploreLayout.astro` — add the static Portfolio actions navigation link beside Portfolio trends.
- `docs/adr/0022-adopt-explainable-portfolio-action-queue.md` and `docs/product-roadmap.md` — update only after implementation gates and browser evidence are green.

The first implementation must not add a new exporter, canonical shard, database table, hosted route, or framework dependency.

## Common interfaces used by every task

The implementation must use these exact public names so the site layer and tests do not drift:

```ts
export type PortfolioActionWindow =
  | "current"
  | "latest-compatible"
  | "7d"
  | "30d"
  | "90d"

export type PortfolioActionDomainState = "present" | "missing" | "invalid"

export type PortfolioActionSourceRecord = {
  readonly id: string
  readonly targetId: string
  readonly targetLabel: string
  readonly team?: PortfolioActionTeam
  readonly observedAt: string | null
  readonly values: Readonly<Record<string, unknown>>
  readonly evidence: readonly PortfolioActionEvidence[]
}

export type PortfolioActionDomainInput = {
  readonly status: PortfolioActionDomainState
  readonly message?: string
  readonly records: readonly PortfolioActionSourceRecord[]
}

export type PortfolioActionTrendInput = {
  readonly targetId: string
  readonly targetLabel: string
  readonly baselineValues: Readonly<Record<string, unknown>>
  readonly currentValues: Readonly<Record<string, unknown>>
  readonly baselineEvidence: readonly PortfolioActionEvidence[]
  readonly currentEvidence: readonly PortfolioActionEvidence[]
  readonly observedAt: string | null
}

export type PortfolioActionDatasetInput = {
  readonly datasetId: string
  /** The canonical `report_context.json` repositoryId, not the display slug. */
  readonly repositoryId: string
  readonly repositoryTitle: string
  readonly mode: "single_repository" | "landscape"
  readonly availability: "ready" | "partial" | "planned" | "invalid"
  readonly current?: {
    readonly snapshotId: string
    readonly generatedAt: string
    readonly domains: Readonly<Partial<Record<PortfolioActionSignalDomain, PortfolioActionDomainInput>>>
  }
  readonly trendInputs: readonly PortfolioActionTrendInput[]
  readonly historyStatus: "compatible" | "missing" | "incompatible" | "invalid"
}

export function buildPortfolioActionQueue(
  datasets: readonly PortfolioActionDatasetInput[],
  options?: { readonly window?: PortfolioActionWindow },
): PortfolioActionQueue

export function filterPortfolioActionQueue(
  queue: PortfolioActionQueue,
  filters: PortfolioActionQueueFilters,
): PortfolioActionQueue
```

The queue item `repositoryId` is the canonical repository identity from the v2 context. Dataset slugs remain in each evidence anchor and in the generated href, so the route can navigate without weakening canonical identity.

## Task 1: Establish the serialisable common contract

**Files:**

- Create: `packages/common/src/action-queue/PortfolioActionQueue.ts`
- Create: `packages/common/src/action-queue/index.ts`
- Modify: `packages/common/src/index.ts`
- Test: `packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

**Interfaces:**

- Produces all public queue, signal, team, evidence, filter, source-input, coverage, and diagnostic types used by Tasks 2–6.
- Produces `emptyPortfolioActionCoverage()` and `defaultPortfolioActionQueueFilters()` helpers so empty/diagnostic-only catalogues never need a fabricated signal.

- [ ] **Step 1: Write the serialization and contract test.**

  Add a minimal structural fixture with one `PortfolioActionQueueItem`, one `PortfolioActionSignal`, one `PortfolioActionEvidence`, explicit `teams: [{ id: "unassigned", label: "Unassigned" }]`, and both version fields. Assert that `JSON.parse(JSON.stringify(queue))` deep-equals the original and that no `score` key exists anywhere in the queue object.

  ```ts
  test("keeps the public queue JSON-serialisable and versioned", () => {
    const queue: PortfolioActionQueue = fixtureQueue()
    expect(JSON.parse(JSON.stringify(queue))).toEqual(queue)
    expect(queue.contractVersion).toBe(1)
    expect(queue.rankingPolicyVersion).toBe(1)
    expect("score" in queue).toBe(false)
  })
  ```

  Add a separate `HostedActionStatus` fixture from the approved spec and
  serialize `{ queue, status }` together. Assert the status is an external
  value keyed by `itemId`/`snapshotId` and does not add fields to, mutate, or
  change the evidence/factors of the queue. This is a boundary test only; do
  not add hosted persistence or a status writer in the static slice.

- [ ] **Step 2: Run the focused test to verify the missing contract fails.**

  Run: `bun test packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

  Expected: FAIL because the new module and its exported types/helpers do not exist yet.

- [ ] **Step 3: Implement the public types and explicit coverage shape.**

  Define `PortfolioActionEvidence`, `PortfolioActionSignal`, `PortfolioActionFactor`, `PortfolioActionQueueItem`, `PortfolioActionQueue`, and `PortfolioActionQueueFilters` exactly as the approved spec describes, adding the approved `PortfolioActionTeam` and `teams` fields. Define coverage as serialisable records rather than implicit counters:

  ```ts
  export type PortfolioActionQueueCoverage = {
    readonly datasets: {
      readonly included: readonly { readonly datasetId: string; readonly repositoryId: string }[]
      readonly planned: readonly { readonly datasetId: string; readonly reason: string }[]
      readonly excluded: readonly { readonly datasetId: string; readonly reason: string }[]
      readonly unavailable: readonly { readonly datasetId: string; readonly reason: string }[]
    }
    readonly domains: Readonly<Record<PortfolioActionSignalDomain, {
      readonly status: PortfolioActionDomainState
      readonly datasetCount: number
      readonly signalCount: number
      readonly message?: string
    }>>
    readonly diagnostics: readonly {
      readonly datasetId: string
      readonly severity: "warning" | "error"
      readonly reason: string
    }[]
  }
  ```

  Keep source input records separate from final signals so raw canonical values remain available to adapters while the final model stays framework-free. Use `team.id === "unassigned"` only for the explicit missing-team sentinel; never derive a team from an email address.

- [ ] **Step 4: Export the module through both barrels.**

  `packages/common/src/action-queue/index.ts` must re-export the named values/types from `PortfolioActionQueue.js`. `packages/common/src/index.ts` must add `export * from "./action-queue/index.js";` alongside the existing trends and dataset-catalog exports.

- [ ] **Step 5: Run the focused test and common typecheck.**

  Run: `bun test packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

  Expected: PASS for the serialization/version assertions.

  Run: `bun run --cwd packages/common typecheck`

  Expected: exit 0 with the new barrel exports type-safe.

No commit is allowed at this checkpoint without explicit user authorization.

## Task 2: Add pure source signal adapters

**Files:**

- Create: `packages/common/src/action-queue/SignalAdapters.ts`
- Modify: `packages/common/src/action-queue/PortfolioActionQueue.ts`
- Modify: `packages/common/src/action-queue/index.ts`
- Test: `packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

**Interfaces:**

- Consumes `PortfolioActionDatasetInput.current.domains` and each source record's exact evidence.
- Produces `adaptPortfolioActionSignals(input): PortfolioActionSignalBuildResult`, where the result contains `signals`, per-domain coverage updates, and fail-closed diagnostics.
- Exposes adapter functions for focused tests: `adaptHotspotSignals`, `adaptControlSignals`, `adaptSecuritySignals`, `adaptImpactSignals`, `adaptCouplingSignals`, `adaptOwnershipSignals`, and `adaptTrendSignals`.

- [ ] **Step 1: Add red fixtures for every candidate and skip rule.**

  Use source records whose values mirror current canonical JSON shapes and whose evidence names exact shard/record selectors. Cover at least:

  - hotspot with `severity: "Critical"`, stable `id`, `name`, `kind`, and `route`;
  - control with `status: "FAILED"` and another with `status: "TOLERATED"`;
  - security alert with `open: true`, `severity: "high"`, and a repository-scoped evidence href;
  - impact opportunity with `impact_score` values at 75, 55, 35, and below 35;
  - coupling component with explicit `riskTier`, `dependencyEdges`, `inboundEdges`, or `outboundEdges` pressure;
  - ownership hotspot whose `reasons` explicitly contains “knowledge”, “ownership”, “backup”, or “contributor”;
  - trend input with a known risk field that worsens, improves, stays stable, and changes only a non-risk field;
  - unknown severity, ignored/OK control, absent optional domain, missing stable target ID, missing provenance href, and missing team.
  - duplicate source record IDs in one domain, which must invalidate that domain rather than silently double-counting it.

  Assert that missing team becomes `{ id: "unassigned", label: "Unassigned" }`, while missing target identity or missing evidence drops the candidate and records a diagnostic.

- [ ] **Step 2: Run the adapter test to verify it fails.**

  Run: `bun test packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

  Expected: FAIL with the adapter exports undefined or absent.

- [ ] **Step 3: Implement the source-preserving adapter dispatcher.**

  Normalize only the source fields defined in the approved policy. Every emitted signal must copy the source `id`, `targetId`, `targetLabel`, team sentinel/explicit team, observed time, facts, action, explanation, and all valid evidence anchors. Preserve unknown source severity as `"unrated"` rather than upgrading it.

  Use explicit action keys and priority mappings:

  ```ts
  const actionByDomain = {
    security: { key: "patch-dependency", label: "Patch the vulnerable dependency" },
    control: { key: "restore-control", label: "Restore the failed quality control" },
    hotspot: { key: "stabilize-hotspot", label: "Stabilize the hotspot" },
    coupling: { key: "reduce-coupling", label: "Reduce the coupling pressure" },
    ownership: { key: "broaden-ownership", label: "Broaden ownership" },
    impact: { key: "prioritise-impact", label: "Prioritise this high-impact intervention" },
    trend: { key: "review-trend", label: "Review the recent movement" },
  } as const
  ```

  Hotspots emit one signal per valid file/unit/component record. Controls emit only exact `FAILED` and `TOLERATED` statuses. Security emits only open repository-scoped alerts. Impact uses the approved score bands. Coupling emits only when a component record exposes explicit risk-tier, dependency, coordination, or temporal pressure; dependency records may add evidence but never create a target by themselves. Ownership requires an explicit knowledge/ownership reason and never promotes a raw contributor count. Trend is emitted only for a known risk-field direction and never creates an item without another actionable domain.

- [ ] **Step 4: Implement exact provenance and validation checks.**

  Reject a source record when `id`, `targetId`, or target label is empty, when evidence has no dataset/repository/snapshot identity, when a shard or record selector is blank, or when an href is not a safe dataset-scoped relative route. Mark a declared malformed domain `invalid`, a missing optional domain `missing`, and a valid domain with zero candidates `present` with zero signals.

- [ ] **Step 5: Run the adapter suite and common typecheck.**

  Run: `bun test packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

  Expected: PASS for all adapter candidate/skip fixtures and exact provenance assertions.

  Run: `bun run --cwd packages/common typecheck`

  Expected: exit 0.

No commit is allowed at this checkpoint without explicit user authorization.

## Task 3: Implement grouping, trend direction, factor ranking, and time windows

**Files:**

- Create: `packages/common/src/action-queue/Ranking.ts`
- Modify: `packages/common/src/action-queue/PortfolioActionQueue.ts`
- Modify: `packages/common/src/action-queue/index.ts`
- Test: `packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

**Interfaces:**

- Consumes `PortfolioActionSignalBuildResult` from Task 2 and `PortfolioActionTrendInput` history records.
- Produces `buildPortfolioActionQueue(datasets, { window })` and `filterPortfolioActionQueue(queue, filters)`.
- Produces visible `factors`, `corroboration`, `trend`, `freshness`, `primaryAction`, `alternateActions`, and coverage without ever adding a `score` field.

- [ ] **Step 1: Write red tests for deterministic grouping and factor order.**

  Assert that:

  - signals with the same canonical repository and target identity produce one item;
  - equal display names with different target IDs remain separate;
  - `priority band` outranks corroboration, corroboration outranks trend, trend outranks freshness, and stable item ID breaks the final tie;
  - duplicate records in one domain count once toward corroboration;
  - primary action follows source order `security`, `control`, `hotspot`, `coupling`, `ownership`, `impact`, `trend` after priority selection, and alternate action keys are deduplicated in that order;
  - `teams` are sorted and deduplicated across corroborating signals;
  - serialized factors have explanations and the output contains no composite score.

- [ ] **Step 2: Write red tests for trend, freshness, and windows.**

  Define the allowlisted trend fields in the test fixture: `severity`, `status`, `riskTier`, `score`, `impact_score`, `structuralRisk`, `changePressure`, `coordinationCost`, `knowledgeRisk`, `temporalLinks`, `complexity`, and `commitsCount`. Assert that a mixed increase/decrease is `unknown`, a single increase is `worsening`, a single decrease is `improving`, equal known fields are `stable`, and a generic changed field yields no standalone trend signal.

  Assert freshness boundaries relative to the queue `asOf`: 0–7 days `fresh`, 8–30 `recent`, 31–90 `aging`, over 90 `stale`, and no observation time `unknown`. Use fixed ISO timestamps in fixtures; never read the machine clock.

  Assert `current` excludes trend evidence, `latest-compatible` adds the newest compatible trend evidence, and day windows include records with an in-window observation time while retaining no-observation records as `unknown` freshness. Assert the queue `asOf` is the greatest `generatedAt` among included current snapshots.

- [ ] **Step 3: Run the ranking tests to verify they fail.**

  Run: `bun test packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

  Expected: FAIL because the builder/ranking functions do not exist.

- [ ] **Step 4: Implement the lexicographic comparator and visible factors.**

  Keep ordinal ranks private to `Ranking.ts`; the public item stores only labels, values, and explanations:

  ```ts
  const compareQueueItems = (left: PortfolioActionQueueItem, right: PortfolioActionQueueItem): number =>
    comparePriority(right.priorityBand, left.priorityBand) ||
    right.corroboration - left.corroboration ||
    compareTrend(right.trend, left.trend) ||
    compareFreshness(right.freshness, left.freshness) ||
    left.id.localeCompare(right.id)
  ```

  Use `asOf` for every freshness calculation. Derive the item priority from the strongest non-trend signal; trend uses `unrated` and cannot become the only actionable item. Count distinct signal domains once, include a known trend domain in corroboration, and keep source records/evidence intact after grouping.

- [ ] **Step 5: Implement fail-closed dataset coverage and duplicate handling.**

  Sort dataset inputs by `datasetId`, reject duplicate dataset IDs as unavailable, exclude non-single-repository and planned entries with reasons, and keep malformed/missing current snapshots in coverage without creating items. For every declared domain, propagate `present`, `missing`, or `invalid` and its signal count. A candidate without a valid provenance anchor is dropped with a warning diagnostic.

- [ ] **Step 6: Implement filter projection without re-analysis.**

  `filterPortfolioActionQueue` must select items by canonical repository ID, any team ID, priority band, and any signal domain, then return a new queue with the same coverage/asOf/ranking policy and the normalized `filters` object. It must not alter factor values or mutate the source queue. The site will build one complete queue per time window so URL changes never require browser-side analysis.

- [ ] **Step 7: Run common tests and typecheck.**

  Run: `bun test packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts`

  Expected: PASS for grouping, ranking, windows, filters, provenance, and coverage.

  Run: `bun run --cwd packages/common typecheck`

  Expected: exit 0.

No commit is allowed at this checkpoint without explicit user authorization.

## Task 4: Build the site canonical source boundary

**Files:**

- Create: `apps/site/src/lib/datasets/actionQueueSource.ts`
- Modify: `apps/site/src/lib/datasets/snapshotHistory.ts`
- Create: `apps/site/src/lib/__tests__/actionQueueSource.test.ts`

**Interfaces:**

- Consumes `DatasetCatalog`, validated v2 contexts, `readDatasetReport`, `readDatasetSnapshotHistory`, and `readDatasetCurrentSnapshot`.
- Produces `readDatasetActionQueueModel({ catalog, datasetsRoot? }): DatasetActionQueueModel`:

  ```ts
  export type DatasetActionQueueModel = {
    readonly queuesByWindow: Readonly<Record<PortfolioActionWindow, PortfolioActionQueue>>
    readonly filterOptions: {
      readonly repositories: readonly { readonly id: string; readonly label: string }[]
      readonly teams: readonly { readonly id: string; readonly label: string }[]
      readonly priorities: readonly PortfolioActionPriorityBand[]
      readonly domains: readonly PortfolioActionSignalDomain[]
    }
  }
  ```

- Supplies canonical repository IDs from `report_context.json`; dataset slugs are used only to construct links.

- [ ] **Step 1: Extend current-snapshot reading behind an opt-in.**

  Add `includeEntities?: boolean` to the options accepted by `readDatasetCurrentSnapshot`. Pass that option through to the existing private `readHistoryEntry` call. Preserve the current default (`false`) so the Phase 3 portfolio trends reader does not start loading entity shards unexpectedly. Add a focused test proving `{ includeEntities: true }` returns the current components/hotspots/controls/ownership collections.

- [ ] **Step 2: Write source-boundary fixtures and failure assertions.**

  In `actionQueueSource.test.ts`, create temporary dataset roots containing:

  - one ready repository with `report_context.json`, `files_main.json`, `metrics.json`, `contributors.json`, `hotspots.json`, `controls.json`, `impact.json`, and component dependencies;
  - one partial repository with a valid context but missing optional impact/security/coupling evidence;
  - one planned catalogue seed, one landscape dataset with `landscape_dependency_alerts.json`, and one malformed v2 context;
  - one compatible `snapshot-history.json` pair with changed hotspot/control fields and exact historical provenance.

  Assert that the result includes ready/partial repositories, excludes planned/landscape entries, records malformed/missing states in coverage, never reads TXT, and retains exact `datasetId`, canonical `repositoryId`, snapshot IDs, shard names, record selectors, and dataset-scoped hrefs.

- [ ] **Step 3: Implement safe declared-shard readers.**

  In `actionQueueSource.ts`, use the already validated `context.canonicalShards` map and `join(dataDir, declaredFile)` only after `isValidV2ReportContext` succeeds. Accept raw arrays only at the documented keys: hotspot arrays (`fileHotspots`, `unitHotspots`, `componentHotspots`), controls (`goals[].controls[]`), impact (`impact_opportunities[]`), and repository-scoped security (`alerts[]`). Missing optional capability keys become `missing`; unreadable or malformed declared files, duplicate stable record identities, or duplicate array selectors become `invalid`.

  Reuse `readSnapshotEntities` for stable component/hotspot/control/ownership IDs and provenance. Convert each entity record's shard/record pair into a `PortfolioActionEvidence` anchor. For impact and security, preserve the source array index in selectors such as `impact_opportunities[index=0]` and `alerts[index=0]`.

- [ ] **Step 4: Implement source-domain assembly.**

  For each ready/partial single-repository entry, assemble `PortfolioActionDatasetInput` as follows:

  - `hotspot`: current hotspot entities;
  - `control`: current control entities;
  - `impact`: current impact opportunities;
  - `coupling`: component entities joined by stable component ID with component hotspot dimensions and dependency facts;
  - `ownership`: hotspot records whose reasons explicitly expose knowledge/ownership pressure;
  - `security`: only a declared repository-scoped `security`/`alerts` capability; landscape dependency files are not projected into repository records;
  - `trendInputs`: compatible history entity deltas whose known risk fields can be compared by the common trend adapter.

  Build evidence hrefs through `normaliseEvidencePath` and `route(`/datasets/${dataset.slug}/...`)`. Use a normalized source route when present; when a record has no route, use only the existing dataset-scoped overview route for that catalogue entry (never a global or landscape route), and reject the candidate if no dataset-scoped evidence route is available. Reject unsafe `..` paths. Do not use the active `PLANETNIK_DATASET` environment as a fallback for a named catalogue entry.

- [ ] **Step 5: Build all five window variants and filter options.**

  Call `buildPortfolioActionQueue` once for each `PortfolioActionWindow`. Derive repository options from included queue evidence using canonical repository IDs and catalogue titles; derive teams from emitted signal teams, always including `unassigned` when used. Keep options sorted deterministically and do not include planned/landscape-only entries as selectable repositories.

- [ ] **Step 6: Run the source tests and site typecheck.**

  Run: `bun test apps/site/src/lib/__tests__/actionQueueSource.test.ts apps/site/src/lib/__tests__/snapshotHistory.test.ts`

  Expected: PASS, including existing snapshot-history behavior and the new opt-in entity path.

  Run: `bun run --cwd apps/site typecheck`

  Expected: exit 0.

No commit is allowed at this checkpoint without explicit user authorization.

## Task 5: Add canonical URL filter parsing and serialization

**Files:**

- Create: `apps/site/src/lib/datasets/actionQueueFilters.ts`
- Create: `apps/site/src/lib/__tests__/actionQueueFilters.test.ts`

**Interfaces:**

- Consumes `URLSearchParams` and produces `PortfolioActionQueueFilters`.
- Produces `parsePortfolioActionFilters(params)`, `serializePortfolioActionFilters(filters)`, and `portfolioActionFilterDefaults()`.

- [ ] **Step 1: Write URL round-trip tests.**

  Use repeated query parameters so canonical repository IDs containing `:` remain unambiguous:

  ```text
  /datasets/actions?repo=repo%3ARequests%20Python%20Tree-sitter%20Pilot&team=platform&priority=critical&priority=high&domain=hotspot&domain=control&window=latest-compatible
  ```

  Assert parsing deduplicates values, accepts only known priority/domain/window values, sorts repository/team/domain IDs lexically, preserves the specified priority order (`critical`, `high`, `medium`, `low`, `unrated`), and defaults unknown/missing values to empty selections plus `window: "current"`. Assert `serialize(parse(params))` is stable and equivalent after a second parse.

- [ ] **Step 2: Run the filter tests to verify they fail.**

  Run: `bun test apps/site/src/lib/__tests__/actionQueueFilters.test.ts`

  Expected: FAIL because the filter module does not exist.

- [ ] **Step 3: Implement parsing and serialization without framework imports.**

  Read array selections with `params.getAll("repo")`, `team`, `priority`, and `domain`. Emit the same names with `URLSearchParams.append` in canonical order. Omit empty selections and `window=current` from serialized defaults. Never put filesystem paths, raw evidence text, or a numeric score in the URL.

- [ ] **Step 4: Run filter tests and site typecheck.**

  Run: `bun test apps/site/src/lib/__tests__/actionQueueFilters.test.ts`

  Expected: PASS for valid, invalid, duplicate, empty, and round-trip cases.

  Run: `bun run --cwd apps/site typecheck`

  Expected: exit 0.

No commit is allowed at this checkpoint without explicit user authorization.

## Task 6: Deliver the static evidence-first route and navigation

**Files:**

- Create: `apps/site/src/components/datasets/PortfolioActionQueuePanel.astro`
- Create: `apps/site/src/pages/datasets/actions.astro`
- Modify: `apps/site/src/layouts/ExploreLayout.astro`

**Interfaces:**

- Page consumes `loadDatasetCatalog()`, `readDatasetActionQueueModel()`, and `parsePortfolioActionFilters(Astro.url.searchParams)`.
- Panel consumes `DatasetActionQueueModel` plus the parsed `PortfolioActionQueueFilters` and renders only serialised queue data.

- [ ] **Step 1: Write a route-level acceptance fixture before markup.**

  Add a testable page contract in the panel implementation: the rendered default variant must expose `data-action-queue-status`, `data-action-item`, `data-repository-id`, `data-team-ids`, `data-priority`, and `data-domains` attributes. Each item must contain a visible priority band, all four factor explanations, corroborating-domain labels, trend/freshness labels, and a “Why this is here” disclosure with every evidence href.

- [ ] **Step 2: Implement the static route shell.**

  `apps/site/src/pages/datasets/actions.astro` must:

  1. load the catalog and action model at build time;
  2. parse the URL using the pure filter helper;
  3. select the requested window variant (default `current`);
  4. pass the selected filters/model to `PortfolioActionQueuePanel`; and
  5. use `ExploreLayout` with a breadcrumb back to `/explore` and a link to `/datasets/trends`.

  The page title/description must state “Portfolio actions” and “canonical JSON”. It must render coverage diagnostics even when no queue items exist.

- [ ] **Step 3: Implement the filter controls and evidence-first list.**

  Render a GET-style filter surface for repository, team/unassigned, priority, domain, and time window. Use the canonical repeated parameter names from Task 5. Render queue items in the common-ranked order; do not sort in Astro or the browser. For each item show:

  - plain-language primary action and repository title;
  - priority band and the visible factor explanations;
  - chips for corroboration, trend, freshness, and all participating domains;
  - alternate actions and source facts inside `<details>`;
  - exact dataset-scoped evidence links with snapshot ID, shard, and record selector;
  - explicit coverage states for missing/invalid domains and excluded datasets.

  A queue with no valid provenance-backed signal must show an honest empty state, not a placeholder action.

- [ ] **Step 4: Support static URL-addressable filtering without browser analysis.**

  Render one hidden queue section per precomputed window variant, each already ordered by the common builder. Add a small `data-astro-rerun` inline script that reads `window.location.search`, toggles the matching window section, hides rows based on the serialized data attributes, updates the result count, and calls `history.replaceState` using `serializePortfolioActionFilters`-equivalent parameter ordering. The script may filter/toggle rendered data only; it must not read files, calculate signal scores, or infer missing evidence.

  Include a `<noscript>` note explaining that the default current queue remains usable and every source link is still available without JavaScript.

- [ ] **Step 5: Add the Explore navigation link.**

  In `ExploreLayout.astro`, add `Portfolio actions` linking to `route("/datasets/actions")` beside the existing Portfolio trends link. Keep the current report link and theme switcher unchanged.

- [ ] **Step 6: Run focused site tests/typecheck.**

  Run: `bun test apps/site/src/lib/__tests__/actionQueueSource.test.ts apps/site/src/lib/__tests__/actionQueueFilters.test.ts`

  Expected: PASS.

  Run: `bun run --cwd apps/site typecheck`

  Expected: exit 0.

No commit is allowed at this checkpoint without explicit user authorization.

## Task 7: Run full verification and record delivery evidence

**Files:**

- Modify: `docs/adr/0022-adopt-explainable-portfolio-action-queue.md`
- Modify: `docs/product-roadmap.md`
- No hosted application files in this first slice.

**Interfaces:**

- Consumes the completed common/site implementation and direct browser evidence.
- Produces checked ADR verification boxes, a delivered Phase 4 roadmap status, and a concise evidence note without changing the approved contract.

- [ ] **Step 1: Run the focused common and site suites once more from the final worktree.**

  Run: `bun test packages/common/src/action-queue/__tests__/PortfolioActionQueue.test.ts apps/site/src/lib/__tests__/actionQueueSource.test.ts apps/site/src/lib/__tests__/actionQueueFilters.test.ts`

  Expected: exit 0 with no failed tests.

- [ ] **Step 2: Run workspace typechecks and lint.**

  Run: `bun run typecheck`

  Expected: exit 0 across all workspace packages/apps.

  Run: `bun run lint`

  Expected: exit 0 with zero warnings/errors. If unrelated pre-existing dirty files fail, record the exact paths and do not rewrite them as part of this feature.

- [ ] **Step 3: Build the static site.**

  Run: `bun run --cwd apps/site build`

  Expected: exit 0 and a generated `/datasets/actions` page with canonical queue markup; no TXT/HTML reader path is exercised.

- [ ] **Step 4: Capture direct browser evidence.**

  Start the site with the configured dataset root using `bun run dev:site`, restart it after any `.env` change, and inspect `http://localhost:4321/datasets/actions` in a real browser. Verify:

  - the page loads with no console errors;
  - ready and partial repository items appear while planned/landscape entries appear only in coverage diagnostics;
  - the visible factor explanations and “Why this is here” evidence links match the common queue model;
  - repository/team/priority/domain/window selections update the URL and visible rows deterministically;
  - an evidence link opens the existing dataset-scoped source route with the repository context intact;
  - the default static page remains readable with JavaScript disabled.

- [ ] **Step 5: Update the ADR and roadmap only after the gates are green.**

  In ADR-0022, change status to implementation delivered, check the verification boxes, and add the tested commands/browser date under Related Evidence. In `docs/product-roadmap.md`, change Phase 4 from design-approved/pending to delivered, add `/datasets/actions` and its exit evidence to the Now/Completed table, and keep the hosted acknowledgement overlay explicitly in the later boundary.

- [ ] **Step 6: Run documentation hygiene checks.**

  Run: `git diff --check -- docs/adr/0022-adopt-explainable-portfolio-action-queue.md docs/product-roadmap.md`

  Run: `git status --short`

  Expected: no whitespace errors; unrelated existing changes remain untouched; no commit is created without explicit user authorization.

## Self-review checklist

- Spec coverage: Tasks 1–3 cover the full serialisable contract, all seven signal domains, stable grouping, visible factor-vector ranking, freshness/trend windows, team sentinel, URL filters, and fail-closed behavior. Task 4 covers canonical v2 readers, exact provenance, partial data, and landscape security exclusion. Task 6 covers the static route, evidence-first UX, coverage diagnostics, and navigation. Task 7 covers full verification and direct browser evidence. Hosted acknowledgement remains intentionally outside this first implementation.
- Placeholder scan: this plan contains no `TBD`, `TODO`, “fill in,” or unspecified validation step; every task names files, interfaces, commands, and expected outcomes.
- Type consistency: Task 1 defines the source and public types; Task 2 consumes source domains; Task 3 produces `buildPortfolioActionQueue`/`filterPortfolioActionQueue`; Task 4 produces `DatasetActionQueueModel`; Tasks 5–6 consume those exact names; Task 7 verifies their final integration.

Plan execution must stop at each task checkpoint for review. The plan does not authorize a commit, release, hosted mutation, or status workflow implementation.
