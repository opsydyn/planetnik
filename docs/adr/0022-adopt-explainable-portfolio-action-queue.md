# ADR-0022: Adopt an Explainable Portfolio Action Queue Contract

## Status

Accepted — static implementation, bounded artifact routes, compact v2 artifact
projection, and per-window content invalidation delivered 2026-09-06; final
incremental build evidence is green, real materialization is still
memory-heavy, and repository-wide lint remains open

## Date

2026-09-06

## Decision-makers

Planetnik maintainers

## Context and Problem Statement

Planetnik has canonical v2 evidence for hotspots, controls, security,
impact, coupling, ownership, and snapshot movement, but those signals are
currently presented in separate repository or landscape views. Portfolio users
must manually compare those pages before deciding what to do next.

Phase 4 needs a queue of interventions across repositories. The queue has two
constraints that make this an architectural decision:

- the static product must derive it from canonical JSON without a server or a
  new analytical truth; and
- the ordering must explain why an item is present and why it appears above
  another item.

The existing canonical snapshot, entity provenance, trend, dataset catalogue,
and repo-scoped evidence routes already provide the required facts. They do
not provide a shared action model or a safe cross-domain ranking contract.

## Decision

Adopt a route-neutral, serialisable `PortfolioActionQueue` read model in the
common package. Build it from validated canonical v2 snapshots and the latest
compatible history, then project it to a static `/datasets/actions` route
first. A future hosted landscape route may consume the same model.

Signals are normalized into source-preserving records, grouped by stable
repository and target identity, and retained with exact snapshot/shard/record
provenance. The queue uses no composite score. It orders items with the
versioned lexicographic factor vector:

```text
priority band → distinct-domain corroboration → trend direction
→ evidence freshness → stable item id
```

Each factor is serialized with a human-readable explanation. Missing,
malformed, unknown, and unavailable data remain explicit states and never
become synthetic zeros or guessed ownership.

Signals carry an explicit canonical team when one exists; otherwise adapters
use the stable `unassigned` sentinel. Queue items expose sorted, deduplicated
team memberships so repository/team filters are deterministic. The first
static route admits only single-repository catalogue entries, so landscape-level
dependency alert and health shards remain coverage-only until a projection can
join each alert to a stable repository identity.

The initial static queue includes ready and partial single-repository catalogue
entries. Planned, invalid, and landscape entries remain coverage diagnostics.
Static items are read-only and carry `status: "untracked"`; hosted
acknowledgement, snooze, and resolution are a separate overlay keyed by item
and snapshot identity.

The static site materializes the ranked top 250 items per observation window
by default. A versioned manifest and deterministic page-one chunk are written
under Astro's ignored `.astro/planetnik-action-queue` cache directory; the
HTML and JSON routes read only the selected chunk and use the selected
window's content fingerprint plus a canonical digest of the manifest-wide
filter options, projection version, window, and page in their cache keys. The
content fingerprint is salted with the artifact version so an on-disk schema
change cannot silently reuse an older route cache. The manifest retains the
global source-identity fingerprint for provenance. The site model keeps
the full ranked total and an explicit `complete`/truncation flag, so filters
cannot present a bounded slice as the complete queue. The materializer can
write complete paginated windows when called without `itemLimit`, but that
mode is not yet safe for the current 4 GB catalogue tree.

Artifact version 2 keeps the public queue contract unchanged while compacting
the ignored cache payload: each chunk stores repeated evidence metadata once
in `evidenceBases`, signals refer to it with ordered `[baseId, record]`
tuples, and the redundant item-level evidence copy is omitted. The route
reader rehydrates the exact queue shape before rendering HTML or serving the
JSON endpoint; stale v1 manifests fail closed.

## Decision Drivers

- Preserve ADR-0018's canonical v2 JSON boundary.
- Reuse existing dataset-scoped evidence links and entity IDs.
- Make ranking deterministic, inspectable, and testable without pretending a
  cross-domain score has objective meaning.
- Keep the static product useful when optional domains or history are absent.
- Avoid a new exporter shard until the derived read model demonstrates a real
  contract gap.
- Keep hosted workflow state out of portable analysis snapshots.

## Alternatives Considered

### One weighted composite score

A weighted sum would provide a compact sort key, but the weights would hide
trade-offs between security, maintainability, ownership, and change pressure.
It would be difficult to explain or safely recalibrate across repositories.
Rejected.

### Separate queues per signal domain

This preserves source semantics, but leaves portfolio users to perform the
manual cross-domain prioritization Phase 4 is intended to remove. It also
makes corroboration across domains invisible.
Rejected.

### Add a dedicated canonical `actions.json` exporter shard first

This would make the first route look simple, but would duplicate existing
facts before the derived model has proved which joins and fields are stable.
It would also expand the snapshot contract and migration surface prematurely.
Rejected; the queue remains a derived read model for the first slice.

### Hosted-only queue with workflow state from day one

This could support acknowledgement immediately, but would make the static
showcase depend on authentication and persistence and would mix mutable
workflow state with immutable snapshot evidence. Rejected for the first
delivery.

## Consequences

### Positive

- Portfolio users get one decision surface while retaining links to the exact
  source evidence.
- The factor vector makes ranking reasons visible and lets tests assert each
  ordering rule independently.
- Static and hosted products can share the same serialisable model without
  sharing Astro page files or coupling loaders to a database.
- Partial datasets remain useful and honest because coverage is first-class.
- A future status overlay can evolve independently of canonical snapshot
  identity.
- The page shell no longer serializes all five full queues at once; each
  window/page is independently cacheable and directly readable as JSON.

### Costs and risks

- Signal adapters must understand several existing JSON shapes and preserve
  domain-specific provenance; mitigate this with adapter-local positive and
  negative fixtures plus exact shard/record assertions before the route exists.
- A lexicographic policy is still a product policy; changing factor order or
  bands requires a new ranking-policy version and review; visible factors and
  independent ordering tests make that change auditable.
- Cross-repository freshness and compatible-history availability will make the
  queue visibly uneven for older showcase snapshots; explicit freshness and
  coverage states are the acceptance rationale for showing that unevenness
  rather than fabricating recency.
- Some domains, especially ownership and coupling, may be unavailable when
  their source records do not expose an explicit actionable signal; coverage
  diagnostics keep those domains visible without inventing a signal.
- The current bounded materializer still parses the large canonical shards in
  one Bun process. On the local catalogue it peaked at 12,455,657,472 bytes
  RSS for five sequential windows, so full unbounded pagination remains a
  follow-up rather than an implied guarantee.

## Non-goals

- Do not parse TXT, HTML, or rendered report output.
- Do not infer missing teams, severity, ownership, or trends.
- Do not add static acknowledgement controls or persist browser-local state as
  if it were workflow state.
- Do not include planned or landscape catalogue entries in the first
  repository queue.
- Do not add a new canonical shard or a machine-learned ranking model in this
  phase.

## Implementation Plan

- **Affected paths**: add route-neutral queue types and pure signal/ranking
  helpers under `packages/common/src/action-queue/`; add focused common tests;
  add a static dataset reader and `/datasets/actions` page under
  `apps/site/src/lib/datasets/` and `apps/site/src/pages/`; add route-aware
  evidence links using existing dataset readers; later add a hosted projection
  under `apps/app` only after the static contract is green.
- **Dependencies**: none and no new environment/configuration is required in
  the first slice. Reuse the existing canonical v2 readers,
  `CrossRepositoryTrends`, `SnapshotEntityTrends`, dataset catalogue, and
  `route()` helpers.
- **Patterns to follow**: validate v2 contexts before reading shards; carry
  `snapshotId`, `generatedAt`, shard, record, and safe relative links; use
  pure serialisable view models; preserve explicit missing/invalid states; use
  deterministic lexical tie-breakers.
- **Patterns to avoid**: no TXT/HTML fallback, no Astro imports in common
  code, no hidden numeric score, no guessed zeros or teams, no display-name
  identity fallback, and no mutation of canonical snapshots for hosted status.
- **Delivery order**: implement common contract and adapter fixtures first;
  implement grouping/ranking/filter tests next; add the static route and
  browser evidence after the pure model is green; only then design the hosted
  status overlay.

## Verification

- [x] Common queue types are serialisable and carry `contractVersion: 1` and
      `rankingPolicyVersion: 1`.
- [x] Every supported signal adapter has a positive fixture, a skip/unknown
      fixture, and exact snapshot/shard/record provenance assertions.
- [x] Grouping and ranking tests prove the factor-vector ordering, stable
      ties, visible explanations, and absence of a composite score.
- [x] Filter and time-window tests are deterministic and URL-round-trippable.
- [x] Team filters cover explicit teams and the `unassigned` sentinel, including
      items whose corroborating signals expose different teams.
- [x] Invalid, missing, duplicate, and provenance-less inputs fail closed with
      explicit coverage diagnostics.
- [x] `/datasets/actions` renders ready and partial repository items and
      excludes planned, invalid, and landscape entries without fabricated
      actions.
- [x] Static build, workspace typechecks, full tests, and direct browser
      evidence pass before the Phase 4 implementation is marked delivered.

Verification evidence for the static slice (2026-09-06): the focused
action-queue/materializer/route/page suites pass (52 tests, 336 assertions),
`bun test` passes 1,291 tests with 0 failures, and `bun run typecheck`
exits 0 across the workspace. The checked-in `code-city-task9-complete`
fixture builds 64 pages, including one HTML and one JSON route for each
observation window. The final named-dataset combined build materializes five
bounded windows and completes 131 pages with
`NODE_OPTIONS=--max-old-space-size=4096`; `/usr/bin/time -l` reports 264.43
seconds total and 14,213,120,000 bytes maximum RSS. The manifest writes one
250-item page per window, records full totals of 1,469,802 for
current/latest-compatible/30d/90d and 357,129 for 7d, and marks each window
`complete: false`. The generated root action page is 88,900,127 bytes, the
current HTML page is 88,899,532 bytes, and the current page JSON is
104,383,387 bytes. The output preserves the queue contract and exact
dataset-scoped evidence anchors; direct inspection confirms `ready`, explicit
truncation, 250-item page payloads, and the expected evidence routes. A second
unchanged build restored all five action JSON routes from Astro's incremental
cache with the same source fingerprint. The earlier Firefox evidence still
covers the bounded action surface; no fresh browser provider was available for
this artifact-route pass, so static HTML and JSON were inspected directly. The
root `bun run lint` remains red on the repository's existing Biome 2.5/schema
and format baseline (549 errors, 3 warnings, and 2 infos); unbounded full
pagination remains a follow-up.

Compaction follow-up evidence (2026-09-06): the real catalogue materializer
wrote v2 page-one artifacts of 4,820,331 bytes for `current`, 4,820,341 for
`latest-compatible`, 4,827,434 for `7d`, and 4,820,327 each for `30d` and
`90d`. The `current` artifact is 95.38% smaller than the previous
104,383,387-byte v1 chunk while preserving 250 items, 108,278 rehydrated
evidence anchors, exact selectors, and the same full totals. This measurement
covers the ignored materializer input artifacts; the public JSON route still
serializes the full queue contract by design. The compact artifacts integrate
with the real named-dataset Astro build: 131 pages completed in 119.87 seconds
with 14,253,522,944 bytes maximum RSS, and an unchanged rerun completed in
113.64 seconds while restoring all five action JSON routes from incremental
cache. The build remains memory-heavy, so complete unbounded pagination is
still deferred.

Per-window content invalidation evidence (2026-09-06): each window manifest
entry now carries a canonical queue-content fingerprint that includes the
window, source identities, projection version, page size, full total, and
materialized queue. A synthetic two-window materialization kept the global
source fingerprint and the unchanged window fingerprint stable while changing
only the other window. In a copied `requests-python-pilot` fixture, changing
one `hotspots.json` score (`30` to `31`) kept the global source fingerprint at
`7c582629...` but changed the current content fingerprint (`088f0d1f...` to
`3d73af14...`) and compact artifact (`d4a4c83f...` to `4bc90467...`). The
changed build regenerated the current JSON route; its body matched the
rehydrated changed queue (`7fbd27c1...`), and an unchanged rerun restored all
five JSON routes. The shard contributes to each observation window in this
fixture, so all five JSON routes were regenerated for the mutation.

## Related ADRs and Evidence

- [ADR-0010: Effect structured concurrency for landscape analysis](./0010-adopt-effect-structured-concurrency-for-landscape-analysis.md)
- [ADR-0011: Repo-scoped shell for landscape drilldown](./0011-adopt-repo-scoped-shell-for-landscape-drilldown.md)
- [ADR-0018: Versioned canonical analysis snapshots](./0018-adopt-versioned-canonical-analysis-snapshots.md)
- [ADR-0019: Repo-scoped WebGL Code City decision surface](./0019-adopt-code-city-webgl-decision-surface.md)
- [ADR-0020: Static dataset catalogue and Explore surface](./0020-adopt-static-dataset-explore-catalog.md)
- [Portfolio action queue design](../superpowers/specs/2026-09-06-portfolio-action-queue-design.md)
- [Portfolio action queue implementation plan](../superpowers/plans/2026-09-06-portfolio-action-queue.md)
- [Incremental action queue artifacts implementation plan](../superpowers/plans/2026-09-06-incremental-action-queue-artifacts.md)
- [Cross-repository trend contract](../../packages/common/src/trends/CrossRepositoryTrends.ts)
- [Snapshot entity provenance contract](../../packages/common/src/trends/SnapshotEntityTrends.ts)
