# ADR-0023: Pilot a FoldKit view layer in a parallel site app

## Status

Proposed — 2026-11-10. Review date: after the Phase 2 pilot slice in
[docs/foldkit-site-port-assessment.md](../foldkit-site-port-assessment.md).

## Context

`apps/site` renders the static Płanetnik report with Astro 7.4 plus React 19
islands. The island layer carries five visualisation dependency families —
`@visx/*`, `@xyflow/react` + `@dagrejs/dagre`, `@react-sigma/core` + `sigma` +
`graphology*`, `three`, `@tanstack/react-table@9` — alongside `@base-ui/react`
for interaction primitives and `@copilotkit/react-*` for the intelligence view.
UI state is split between React hooks and `@effect/atom-react`, which ADR-0004
adopted explicitly as a trial.

[FoldKit](https://foldkit.dev) is an Elm Architecture runtime on Effect.
`@opsydyn/astro-foldkit` registers it as an Astro renderer, so FoldKit
applications mount as Astro islands (`lazyApp`) or own a route's document
(`definePage`, SSG or request SSR). `@opsydyn/foldkit-viz` supplies pure chart
geometry with no D3 dependency; `@foldkit/ui` supplies headless accessible
primitives; `@opsydyn/effect-three*` supply declarative Three.js. Together they
cover most of what the island layer uses today under one maintained family, and
they move chart geometry into pure functions that `bun:test` can test directly —
which fits this repository's TDD convention better than component tests do.

Three things are not covered, and one precondition blocks everything:

- There is no FoldKit equivalent of `@tanstack/react-table` for the report data grid.
- ~~The `@opsydyn/foldkit-zloz*` family that would replace `@xyflow/react` is a workspace release candidate and is **not published to npm**.~~ Published at 0.3.0 on 2026-11-11; the topology slice is now gated on React Flow parity, not availability.
- FoldKit's AG-UI work is a fixture-backed reference demo, not a client for this repository's Mastra runtime (ADR-0013/0014).
- `foldkit@0.170.0`, `@foldkit/ui@0.170.0` and `@opsydyn/astro-foldkit@0.9.3` all require `effect ~4.1.0`. The root catalog pins `effect@4.0.6`, shared with `packages/analyzer`, `packages/common` and `apps/cli`.

`packages/report-ui` is not site-private: `apps/app`, the hosted SSR app, consumes
it from roughly thirty-five call sites.

## Decision

Pilot FoldKit in a **new, parallel Astro app, `apps/foldkit-site`**, leaving
`apps/site` and `packages/report-ui` untouched. Authorise only three phases:

1. ~~**Preconditions, as a throwaway spike.**~~ **Done 2026-11-10.** The catalog bump is green across every package, and a throwaway app proved `@opsydyn/astro-foldkit` and `@astrojs/react` coexist with both island kinds hydrating independently on one page. The spike also surfaced three upstream documentation defects in `@opsydyn/astro-foldkit`, chiefly a quickstart example that breaks hydration; a fix is committed on `docs/astro-foldkit-readme-schema-model`. A fourth claim made in the first draft, that islands clobber `document.title`, was wrong and is withdrawn in the assessment.
2. **The seam.** Build or copy a shared chart-scaffolding module (axes with category labels, gridlines, tooltips, accessible tables, keyboard navigation) — the spike established that `foldkit-viz` publishes geometry and scales only, and that FoldKit's own chart components depend on an unpublished app-local `ui/shared`. Then extract `apps/site`'s data layer (`src/loaders`, `src/lib`, `src/data`, `content.config.ts`) into a package consumed by both apps, and put FoldKit views in a **new** `packages/report-view-foldkit` rather than in `packages/report-ui`.
3. **One pilot page.** Port `/units/complexity`, which pairs three charts with the report data grid.

Keep `@astrojs/react` registered in `apps/foldkit-site` so unported islands —
topology, intelligence, and anything that fails a measurement — can be retained
in React rather than blocking a page.

Everything beyond the pilot (the remaining chart pages, code city, the graph
pages, the intelligence transport, the cutover) is **not** decided here. It is
gated on the pilot's evidence and on the stop conditions recorded in the
assessment.

## Consequences

- Two site apps exist during the transition, with two builds to keep green and `knip` to appease. `apps/site` keeps shipping throughout, so a failed pilot costs a spike and one page.
- The `effect` 4.1.x bump reaches `packages/analyzer` and `apps/cli`, neither of which benefits from it. This is the largest unmeasured risk and the reason it is a gate rather than a step.
- Every FoldKit-side dependency is pre-1.0 and version-locked: `astro-foldkit@0.9.3` pins `foldkit >=0.170.0 <0.171.0`, so each FoldKit minor release needs a matching integration release before this repository can move. The dependency family has one maintainer.
- `packages/report-view-foldkit` duplicates `packages/report-ui`'s export surface for the duration. That duplication is deliberate and bounded; it exists so `apps/app` is not disturbed.
- Not extracting the data layer would create a second copy of a 25KB loader and ~14k LOC of `lib`. The repository already has near-identical copies of `TopologyGraph.tsx`, `ForceGraphClient.tsx` and `ReportDataGridInner.tsx` in both `apps/site/src/components` and `packages/report-ui/src`, so the drift risk is demonstrated, not hypothetical.
- Astro keeps owning routing, content collections, the document and the build. This is not an Astro replacement.
- `@effect/atom-react` becomes unnecessary in ported views, retiring the ADR-0004 trial for the site.
- Per-page routing between two apps is a hosting capability. The GitHub Pages path in `docs/deployment/` cannot do it, so during the transition "strangler fig" means the new app grows to parity while the old one serves, with the swap at deploy level.

## Options considered

1. **Parallel app with a shared data layer (chosen).** `apps/site` stays intact and shipping; the new app can be deleted outright. Costs two builds and a deploy-level rather than request-level cutover.
2. **Swap islands in place inside `apps/site`.** Mechanically the cleanest strangler fig — the marker-based renderer `check` in `astro-foldkit/src/server.ts` means React and FoldKit islands coexist per page, so there is no routing problem at all and no duplicated data layer. Rejected because it mutates the shipping app on every step and leaves no intact fallback. Worth revisiting if the dual-build cost in Phase 0 proves high.
3. **Port everything at once.** Rejected: the three uncovered areas include one blocked on an unpublished package and one that needs a new backend transport.
4. **Stay on React and adopt `foldkit-viz`'s pure geometry only.** Captures the testability win with no runtime change, since `foldkit-viz`'s `effect` and `foldkit` peers are both optional. Rejected as the primary path because it leaves the React/atom state split in place — but it is the natural fallback if Phase 0 fails.
5. **Do nothing.** The current stack works. Rejected only because the dependency consolidation and pure-geometry testability are worth a bounded pilot, not because anything is broken.

## Trade-offs

Accepted: release-coupling risk on a pre-1.0, single-maintainer dependency
family, plus transitional duplication of both the view package and the app.
Bought: one state model instead of two, one visualisation family instead of five,
and chart geometry as pure testable functions. The trade is deliberately scoped
to a pilot so the bet can be unwound for the cost of a spike and one page.

## Follow-up work

- ~~`effect` 4.1.x catalog bump, verified across all packages~~ — **done 2026-11-10.** A named `effect` catalog in the root manifest pins the family at `4.1.3`; typecheck, 1,350 tests and all ten build targets are green. See the amendment in the assessment.
- Decide the transition hosting model (GitHub Pages vs the container path) before `apps/foldkit-site` picks its `base` — owner: Phase 0.
- A separate ADR superseding ADR-0013 if the intelligence view moves from CopilotKit to AG-UI. Not in this pilot's scope.
- ~~Revisit `@opsydyn/foldkit-zloz*` when it reaches npm.~~ **Done 2026-11-11** — published at 0.3.0. Scope the topology slice against the documented React Flow parity gaps before committing to it; until that measurement exists, the topology pages stay React.
