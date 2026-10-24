# ADR-0004: Adopt Effect Atom for a Limited UI State Trial

## Status

Accepted

## Package migration note — 2026-10-24

The approved Effect 4 dependency upgrade replaces `@effect-atom/atom-react` with
the matching `@effect/atom-react` package. Core `Atom` and `AtomRegistry` now come
from `effect/reactivity`; React hooks and registry providers remain framework
bindings. The persisted-state, server-value and topology derivation contracts
are unchanged and covered by their existing regression tests. The initial trial
decision and its scope below remain historical context.

## Context

`apps/site` currently manages interactive state with local React hooks only. That is fine for isolated components, but it does not yet tell us whether an Effect-native state model will improve the frontend as the Astro UI grows.

ADR-0001 already established Effect TS as a core part of the project. If we introduce a frontend state library, we should prefer one that fits that direction instead of adding a separate state-management model with different runtime and mental overhead.

The current frontend is still small. The only substantial interactive React surface in `apps/site` is `apps/site/src/components/TopologyGraph.tsx`, which manages:

- period selection
- readiness/bootstrap view state
- pure derived topology values such as current edges, contributor stats, and strongest-connection rows

That makes `TopologyGraph` the lowest-risk place to evaluate whether Effect Atom improves state organization without committing the entire frontend to it.

## Decision

We will add `@effect-atom/atom-react` to `apps/site` and use it for a **single limited trial** before deciding whether it should become a broader frontend pattern.

### Trial scope

- Initial trial target: `apps/site/src/components/TopologyGraph.tsx`
- Initial atom scope: selected period and pure derived topology state
- State that remains local for the trial: React Flow node/edge hooks, DOM-oriented bootstrap concerns, and one-off imperative view setup

### Why this option

- It aligns with ADR-0001 instead of introducing a second state-management ecosystem unrelated to Effect.
- It gives us a clean way to model derived state explicitly.
- It preserves a future path to effectful atoms if report-loading or async UI state becomes more complex.
- It keeps the trial small enough to reverse cheaply if it adds more ceremony than value.

## Alternatives Considered

### Continue using local React hooks only

This is the lowest-effort option and remains acceptable for simple components.

We are not choosing it for this trial because it does not answer the architectural question we now have: whether an Effect-native state layer improves organization for derived frontend state in this repo.

### Adopt a separate React state library such as Zustand or Jotai

These libraries would likely work well for frontend ergonomics.

We are not choosing them because the repo already leans on Effect. Adding a second state model would increase conceptual surface area for contributors and future agents.

### Roll Effect Atom out across the whole site immediately

This would maximize consistency quickly.

We are not choosing it because the frontend is still small and we do not yet have enough evidence that Effect Atom should be the default for every interactive surface.

## Consequences

- `apps/site` now carries the `@effect-atom/atom-react` dependency so the trial can be implemented without additional package churn.
- The first trial should stay tightly scoped and reversible.
- A successful trial will justify either a follow-up ADR or an update to this ADR defining when Effect Atom becomes the default choice.
- An unsuccessful trial should be removed instead of defended on principle.

## Non-goals

- No immediate site-wide migration from hooks to atoms
- No global UI store for the Astro frontend
- No cross-page shared state as part of the first trial
- No effect runtime, layers, or service wiring unless the trial area actually requires them

## Related ADRs

- ADR-0001: Effect TS with Bun Runtime

## Implementation Plan

- **Affected paths**: `apps/site/package.json`, `apps/site/src/components/TopologyGraph.tsx`, `apps/site/src/pages/topology.astro`, `apps/site/src/state/topologyGraphState.ts`
- Keep the dependency installation in `apps/site` limited to `@effect-atom/atom-react`, `effect`, and the existing React runtime stack already used by the app.
- Create a small state module under `apps/site/src/state/` for the topology trial.
- Move only `selectedPeriod` and its pure derived values into atoms for the first iteration.
- Keep React Flow integration details local to `TopologyGraph.tsx` until the trial proves the atom boundary is helping rather than obscuring the component.
- Add a lightweight ADR reference comment at the entry point of the new topology state module when the trial implementation lands.
- Re-evaluate after the first working trial before using Effect Atom anywhere else in the frontend.

## Verification

- [ ] `apps/site` installs and builds with the new dependency set
- [ ] The topology page still renders and period selection still works after the trial implementation
- [ ] Contributor counts, connection counts, and strongest-connection rows still update correctly when the selected period changes
- [ ] No unrelated page is migrated to Effect Atom as part of the initial trial
- [ ] React Flow's imperative state remains local during the first trial
