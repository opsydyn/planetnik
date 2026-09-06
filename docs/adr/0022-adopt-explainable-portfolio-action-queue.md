# ADR-0022: Adopt an Explainable Portfolio Action Queue Contract

## Status

Accepted — design approved 2026-09-06; implementation pending

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

- [ ] Common queue types are serialisable and carry `contractVersion: 1` and
      `rankingPolicyVersion: 1`.
- [ ] Every supported signal adapter has a positive fixture, a skip/unknown
      fixture, and exact snapshot/shard/record provenance assertions.
- [ ] Grouping and ranking tests prove the factor-vector ordering, stable
      ties, visible explanations, and absence of a composite score.
- [ ] Filter and time-window tests are deterministic and URL-round-trippable.
- [ ] Team filters cover explicit teams and the `unassigned` sentinel, including
      items whose corroborating signals expose different teams.
- [ ] Invalid, missing, duplicate, and provenance-less inputs fail closed with
      explicit coverage diagnostics.
- [ ] `/datasets/actions` renders ready and partial repository items and
      excludes planned, invalid, and landscape entries without fabricated
      actions.
- [ ] Static build, workspace typechecks, full tests, and direct browser
      evidence pass before the Phase 4 implementation is marked delivered.

## Related ADRs and Evidence

- [ADR-0010: Effect structured concurrency for landscape analysis](./0010-adopt-effect-structured-concurrency-for-landscape-analysis.md)
- [ADR-0011: Repo-scoped shell for landscape drilldown](./0011-adopt-repo-scoped-shell-for-landscape-drilldown.md)
- [ADR-0018: Versioned canonical analysis snapshots](./0018-adopt-versioned-canonical-analysis-snapshots.md)
- [ADR-0019: Repo-scoped WebGL Code City decision surface](./0019-adopt-code-city-webgl-decision-surface.md)
- [ADR-0020: Static dataset catalogue and Explore surface](./0020-adopt-static-dataset-explore-catalog.md)
- [Portfolio action queue design](../superpowers/specs/2026-09-06-portfolio-action-queue-design.md)
- [Cross-repository trend contract](../../packages/common/src/trends/CrossRepositoryTrends.ts)
- [Snapshot entity provenance contract](../../packages/common/src/trends/SnapshotEntityTrends.ts)
