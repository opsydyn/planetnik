# Portfolio Action Queue Design

**Status:** Approved design — implementation not started (2026-09-06)

**Related decision:** [ADR-0022: Adopt an explainable portfolio action queue contract](../../adr/0022-adopt-explainable-portfolio-action-queue.md)

## Problem

Planetnik already has high-value signals, but they are split across hotspot,
control, security, impact, coupling, ownership, and trends views. A portfolio
user still has to inspect several repositories and pages to decide what to do
next. A queue can reduce that navigation cost only if every item remains
traceable to canonical snapshot records and the ordering explains itself.

The queue must work for the static catalogue without a server, while leaving
room for a hosted acknowledgement workflow later. It must not become a new
analytical source of truth, a hidden weighted score, or a reconstruction of
TXT/HTML reports.

## Goals

- Produce one deterministic, serialisable queue of evidence-backed
  interventions across ready and partial single-repository catalogue entries.
- Combine distinct signal domains without collapsing them into an opaque
  composite score.
- Preserve exact snapshot, shard, record, and dataset-route provenance for
  every displayed fact.
- Make repository, team/owner, priority, domain, and time-window filters
  deterministic and URL-addressable.
- Keep unavailable or malformed evidence explicit rather than turning it into
  zero risk, zero change, or an invented owner.
- Keep the static queue read-only and allow a hosted product to add status as a
  separate overlay keyed by the queue item and snapshot identity.

## Non-goals

- No new `actions.json` canonical shard in this first slice. The queue is a
  derived read model over existing v2 shards and history.
- No runtime repository fetching, TXT/HTML parsing, or browser-side analysis.
- No one-number risk or priority score and no hidden learned ranking model.
- No automatic assignment, acknowledgement, snooze, or resolution in the
  static product.
- No inclusion of planned, invalid, or landscape catalogue entries in the
  initial repository queue. They remain visible in coverage diagnostics.
- No inference of teams, ownership, Cargo semantics, type resolution, or
  security severity when the source record does not provide it.

## Product boundary

The route-neutral common model is built from canonical v2 data:

```text
catalogue entries
  → current snapshot + latest compatible history
  → signal adapters
  → normalized signals
  → target grouping and action deduplication
  → factor-vector ordering
  → static /datasets/actions or hosted projection
```

The first static route is `/datasets/actions`, alongside `/datasets/trends`.
It includes `ready` and `partial` single-repository entries whose v2 context
and declared shards validate. The route is pre-rendered; the browser only
filters the serialized queue. A future hosted landscape route consumes the
same common model and may overlay workflow state.

Because the first route admits only single-repository entries, security signals
are emitted only from a repository-scoped canonical alert/health shard when one
is declared. Existing landscape-level `landscape_dependency_alerts.json` and
`landscape_dependency_health.json` data is reported as coverage-only until a
landscape projection can join each alert to a stable repository identity.

## Contract

The following TypeScript-shaped definitions describe the public boundary. They
are intentionally serialisable and contain no framework or database types.

```ts
type PortfolioActionSignalDomain =
  | "hotspot"
  | "control"
  | "security"
  | "impact"
  | "coupling"
  | "ownership"
  | "trend"

type PortfolioActionTeam = {
  id: string
  label: string
}

type PortfolioActionPriorityBand =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "unrated"

type PortfolioActionTrend = "worsening" | "stable" | "improving" | "unknown"
type PortfolioActionFreshness = "fresh" | "recent" | "aging" | "stale" | "unknown"

type PortfolioActionEvidence = {
  datasetId: string
  repositoryId: string
  snapshotId: string
  generatedAt: string
  domain: PortfolioActionSignalDomain
  shard: string
  record: string
  href: string
  label: string
  observed: Readonly<Record<string, string | number | boolean | null>>
}

type PortfolioActionSignal = {
  id: string
  repositoryId: string
  targetId: string
  targetLabel: string
  team: PortfolioActionTeam // id "unassigned" when no explicit team exists
  domain: PortfolioActionSignalDomain
  priorityBand: PortfolioActionPriorityBand
  sourcePriority: { label: string; value: string | number | null }
  observedAt: string | null
  action: { key: string; label: string }
  explanation: string
  facts: readonly { label: string; value: string | number | boolean | null }[]
  evidence: readonly PortfolioActionEvidence[]
}

type PortfolioActionFactor = {
  key: "priority" | "corroboration" | "trend" | "freshness"
  label: string
  value: string | number
  explanation: string
}

type PortfolioActionQueueItem = {
  id: string // action:<repositoryId>:<targetId>
  repositoryId: string
  repositoryTitle: string
  target: { id: string; label: string }
  teams: readonly PortfolioActionTeam[]
  primaryAction: { key: string; label: string }
  alternateActions: readonly { key: string; label: string }[]
  priorityBand: PortfolioActionPriorityBand
  trend: PortfolioActionTrend
  freshness: PortfolioActionFreshness
  corroboration: number
  factors: readonly PortfolioActionFactor[]
  signals: readonly PortfolioActionSignal[]
  evidence: readonly PortfolioActionEvidence[]
  status: "untracked"
}

type PortfolioActionQueue = {
  contractVersion: 1
  rankingPolicyVersion: 1
  asOf: string
  filters: {
    repositoryIds: readonly string[]
    teamIds: readonly string[]
    priorityBands: readonly PortfolioActionPriorityBand[]
    domains: readonly PortfolioActionSignalDomain[]
    window: "current" | "latest-compatible" | "7d" | "30d" | "90d"
  }
  items: readonly PortfolioActionQueueItem[]
  coverage: PortfolioActionQueueCoverage
}
```

`PortfolioActionQueueCoverage` records included, planned, excluded, and
unavailable datasets plus per-domain `present`, `missing`, or `invalid` status
and counts. A queue item is reproducible only when it has at least one valid
canonical evidence anchor; otherwise the adapter emits a diagnostic and no
item.

The item identity is stable across snapshots when the repository and target
entity identity are stable. Signals for the same repository and target are
grouped into one item. Distinct targets are never merged merely because their
display names match.

## Signal adapter policy

Adapters preserve source-native values and produce a normalized priority band
only through the explicit rules below. An absent optional shard yields a
domain-level coverage state, not a synthetic signal.

| Domain | Canonical input | Candidate rule | Priority source |
| --- | --- | --- | --- |
| Hotspot | `hotspots.json` | One signal per valid file, unit, or component hotspot | Existing `severity` (`Critical`/`High`/`Medium`/`Low`) |
| Control | `controls.json` | `FAILED` and `TOLERATED` controls only | `FAILED` → Critical; `TOLERATED` → High; unknown status is not promoted |
| Security | declared repository-scoped alert/health shard | Open alerts only | Source `severity` (`critical`/`high`/`medium`/`low`); unknown remains Unrated |
| Impact | `impact.json` opportunities | One signal per valid opportunity | Existing `impact_score`: ≥75 Critical, ≥55 High, ≥35 Medium, otherwise Low |
| Coupling | component hotspot dimensions and available component-coupling facts | Emit when explicit coordination/static/temporal pressure is present; dependency records corroborate but do not invent an action | Existing coupling `riskTier` when present; otherwise the source hotspot severity |
| Ownership | hotspot knowledge-risk fields and contributor/ownership records | Emit only when the source exposes ownership concentration or a knowledge-risk reason | Inherited hotspot severity; no owner-count threshold is silently promoted |
| Trend | compatible history/entity comparison | Enrich an existing target when a known risk field has a direction; a generic `changed` delta is not a standalone action | Trend is a ranking factor, never a replacement priority band |

The initial source order for deterministic action selection is `security`,
`control`, `hotspot`, `coupling`, `ownership`, `impact`, `trend`. When several
signals suggest work on one target, the highest-priority signal supplies the
primary action; remaining distinct actions are retained in source order.

Team filters use only an explicit canonical `team` or `teamId` field. Adapters
copy that value into `signal.team`; a record without one receives the stable
`unassigned` sentinel, not a guessed team. An action item exposes the sorted,
deduplicated teams from its signals so URL-addressable team filters remain
deterministic even when corroborating signals disagree. Contributor email or
ownership evidence can be displayed as an owner fact without being called a
team.

## Ranking without an opaque score

The queue is sorted by a lexicographic factor vector, in this exact order:

1. **Priority band:** Critical, High, Medium, Low, Unrated.
2. **Corroboration:** number of distinct signal domains supporting the target,
   descending. Duplicate records in one domain count once.
3. **Trend:** Worsening, Stable, Improving, Unknown. Unknown is not treated as
   worsening or improving.
4. **Freshness:** Fresh (0–7 days), Recent (8–30), Aging (31–90), Stale
   (>90), Unknown. Age is measured from queue `asOf`, not the machine clock.
5. **Stable item ID:** ascending lexical tie-breaker.

The model stores the first four factors as visible `factors` with explanations.
It does not store or display a summed score. The ordinal ranks used internally
for sorting are implementation details, while `rankingPolicyVersion: 1` makes
the ordering contract explicit and testable.

`asOf` is the greatest `generatedAt` among included current snapshots. A
`current` window reads current evidence; `latest-compatible` adds the newest
compatible history pair; day windows include evidence whose observation time
falls within the stated interval before `asOf`. If a source has no observation
time, it remains eligible for `current` but has Unknown freshness for day
windows.

## Static and hosted state

The static route always emits `status: "untracked"`. A hosted projection may
join a separate status record:

```ts
type HostedActionStatus = {
  itemId: string
  snapshotId: string
  state: "acknowledged" | "snoozed" | "resolved"
  changedAt: string
  changedBy: string
  note?: string
}
```

Hosted status never changes canonical evidence, priority factors, or snapshot
identity. If the target changes materially in a new snapshot, the status join
must require an explicit policy rather than silently carrying the old state.

## Provenance and failure behavior

- Every signal carries `snapshotId`, `generatedAt`, safe relative `shard`,
  canonical `record` selector, and a dataset-scoped `href` to an existing
  evidence page.
- A malformed v2 context excludes the dataset and records a diagnostic.
- A missing shard marks that domain unavailable; it does not contribute a
  zero-valued signal.
- A malformed shard or duplicate record identity marks that domain invalid and
  emits no affected signals.
- An unknown source severity is retained as Unrated when the record is still a
  valid actionable alert; it is never upgraded by a queue-wide default.
- A candidate without a stable source target/entity ID is discarded; a display
  name is never used as a fallback identity.
- A signal without a valid provenance anchor is discarded with a diagnostic so
  every visible item remains reproducible.
- Planned and landscape catalogue entries appear in coverage as excluded, but
  cannot enter the initial repository queue.

## UX contract

The first static presentation is an evidence-first table/list with:

- a plain-language action headline and repository name;
- a visible priority band and the factor explanations;
- compact chips for corroborating domains, trend, and freshness;
- filters that preserve selection in the URL;
- an expandable “Why this is here” section showing source facts and exact
  evidence links; and
- explicit coverage diagnostics for unavailable domains or repositories.

The queue does not hide the source views. Every item links back to the existing
dataset-scoped hotspot, control, security, impact, coupling, ownership, or
trend evidence route. A user can move from “what should we do?” to “show me
the record” without losing the repository context.

## Verification matrix for implementation

The implementation is complete only when these checks are green:

- Common-package fixtures cover each adapter's candidate and skip rules,
  source-priority mapping, stable identity, and exact evidence anchors.
- Grouping tests prove that distinct domains corroborate one target without
  duplicating it, while equal display names with different IDs remain separate.
- Ranking tests prove the lexicographic order, visible factors, stable ties,
  and the absence of a composite score field.
- Filter tests cover repository, explicit team/unassigned, priority, domain,
  current/history windows, and URL round-tripping.
- Negative fixtures cover invalid contexts, missing/malformed shards,
  duplicate IDs, missing provenance, unknown severity, and unavailable history.
- Static route tests prove ready/partial inclusion, planned/landscape
  exclusion, row/link equality with the model, and the explicit coverage UI.
- A hosted serialization test proves status is an overlay and does not mutate
  canonical evidence or ranking factors.
- Workspace typecheck, full tests, static build, and direct browser evidence
  pass before the route is marked delivered.

## Revisit triggers

Reopen this design before implementation if any of the following becomes true:

- a new canonical shard is required to produce a trustworthy signal;
- a source domain cannot provide a reproducible evidence anchor;
- users need a ranking factor that cannot be explained as a discrete ordered
  value;
- landscape entries need to participate in the same queue as repositories; or
- hosted workflow state must become part of the portable snapshot contract.
