# ADR-0019: Adopt a Repo-Scoped WebGL Code City Decision Surface

## Status

Provisional — initial browser-render boundary only

## Date

2026-08-16

## Decision-makers

Planetnik maintainers

## Context and Problem Statement

Planetnik has strong file, component, hotspot, ownership, impact, and coupling
evidence, but those signals are spread across separate report pages. A Code
City can make bounded contexts, file mass, health, and dependency paths easier
to explore if it remains a decision surface over the existing evidence rather
than becoming a second analysis model.

Draxul and its MegaCity plugin informed the product concept. Their native
Vulkan/Metal implementation, assets, and source code are not part of this
decision. Planetnik needs a browser-native static-report implementation that
preserves its canonical JSON and hosted/static application boundaries.

## Decision Drivers

- Preserve canonical v2 JSON as the only product input.
- Make bounded contexts the primary geography and files the first building
  level.
- Keep layout stable while lenses change, so visual comparison remains honest.
- Preserve exact links to existing evidence pages.
- Keep the static report usable without WebGL and for keyboard, print, and dense
  datasets.
- Share renderer primitives with a future hosted consumer without sharing Astro
  page files or introducing runtime coupling.
- Avoid adopting a native renderer or a new canonical shard before evidence
  proves either is necessary.

## Decision

Planetnik will provisionally adopt the first Code City as a single-repository,
progressively enhanced decision surface in `apps/site`. Final acceptance is
pending the direct interaction matrix defined in this ADR's follow-up.

The canonical boundary is v2 JSON to `CodeCityModel`. Astro content collections
adapt existing files, units, component dependencies, hotspots, and impact
records into that model. Runtime source parsing, TXT/HTML reconstruction, and a
new exporter shard are outside this decision.

`packages/report-ui` owns a renderer-neutral, serialisable scene adapter. A
lazy-loaded plain Three.js renderer consumes that scene in the browser with an
orthographic isometric default and constrained orbit, pan, and zoom. Stable
LOC-derived geometry represents mass; Health, Footprint, Impact, Change,
Ownership, and Complexity lenses change materials and accents rather than
positions. Selection does not reframe the camera; an explicit **Focus** action
does. Dependency routes are selection paths rather than permanent road clutter.

WebGL is an enhancement, not the information boundary. A complete native HTML
table/list must remain available for explicit table mode, renderer failure,
print, accessibility, and datasets above the renderer's documented density
limits. Missing optional shards remain visibly unavailable or partial and must
never be converted into invented zero values.

The first route is `/code-city` in the single-repository static shell.
Landscape aggregation and hosted route integration are follow-on decisions
that must reuse `CodeCityModel` and renderer-neutral scene records. This ADR
does not adopt or port Draxul's native renderer, code, or assets.

## Evidence Boundary

The provisional evidence boundary is deliberately narrow.

Automated evidence on 2026-08-16 covered the canonical model, deterministic
layout, lenses, selection paths, safe evidence links, route states, fallback
row preservation, WebGL capability handling, route reload policy, package/site
typechecks, and the full workspace build. The acceptance build emitted the
lazy `threeRenderer` chunk at 547,233 bytes raw and 135,705 bytes gzip.

A real browser opened the deterministic complete fixture at
`/planetnik/code-city`. The DOM and screenshot showed 13 files, three contexts,
zero diagnostics, the Health lens, all six lens controls, the map/table switch,
inspector, navigation entry, and a rendered orthographic/isometric city. A
lower-level browser diagnostic then hung, so this evidence does not establish
orbit/pan/zoom, camera preservation and restore, Focus behaviour, forced
renderer failure, print preview, reduced motion, partial snapshots, dense
fallback, or a reliable first-usable interaction time.

Those checks remain a release-confidence follow-on. Until they are recorded,
this ADR establishes only that the canonical fixture can reach and render the
initial WebGL view; it does not accept the interaction contract. In particular,
orbit/pan/zoom, selection/focus/restore, renderer fallback, keyboard and print
behaviour, reduced motion, partial and dense snapshots, and first-usable timing
remain pending. This boundary does not broaden the ADR into a native renderer
commitment or permit removing the HTML fallback.

## Alternatives Considered

### Port Draxul's native renderer

This would introduce a substantially different runtime, deployment, and asset
surface without improving Planetnik's canonical evidence contract. It is
rejected.

### Use CSS-only isometric cards

This lowers bundle cost, but does not provide the constrained spatial
interaction or route emphasis required by the approved product concept. It is
rejected for the primary renderer and remains compatible with fallback views.

### Use React Three Fiber

It offers a convenient React abstraction, but adds another public framework
boundary before Planetnik has enough renderer complexity to justify it. Plain
Three.js behind a thin React island is adopted instead.

### Add a dedicated semantic-city exporter shard first

The existing canonical records express the first view. A new shard would
prematurely duplicate semantics and is deferred until a demonstrated model gap
exists.

## Consequences

### Positive

- Code City remains traceable to existing report evidence.
- Static and future hosted consumers can share model and scene primitives.
- Stable geometry supports meaningful lens comparison.
- WebGL failure, accessibility, print, and dense data retain a complete HTML
  path.
- Native renderer and new-shard scope remain explicitly excluded.

### Costs and risks

- The measured renderer chunk is material and must remain lazy-loaded and
  monitored.
- WebGL and pointer interactions require direct browser regression evidence in
  addition to unit tests.
- Visual comparison needs stable fixture snapshots and cannot be inferred from
  process exit alone.
- Landscape aggregation and hosted routing remain unfinished product slices.

## Follow-up

1. Complete the direct interaction matrix in a reliable browser harness,
   including orbit limits, selection/focus/restore, lens geometry stability,
   no-WebGL fallback, keyboard flow, print, and reduced motion.
2. Run the partial and 1,501-building dense fixtures directly and record table
   row equality and LOD behaviour.
3. Establish a repeatable first-usable interaction measurement before setting
   a performance budget or publishing a latency claim.
4. Integrate the shared model and UI primitives into a hosted repo-scoped route
   only after the static interaction matrix is green.
5. Consider landscape aggregation separately; do not flatten a city onto the
   landscape root shell.

## Related ADRs and Evidence

- [ADR-0011: Repo-scoped shell for landscape drilldown](./0011-adopt-repo-scoped-shell-for-landscape-drilldown.md)
- [ADR-0015: Separate static reports and hosted runtime](./0015-adopt-separate-static-reports-and-hosted-runtime-for-intelligence.md)
- [ADR-0018: Versioned canonical analysis snapshots](./0018-adopt-versioned-canonical-analysis-snapshots.md)
- [Product roadmap](../product-roadmap.md), Phase 1.5
- [Code City design specification](../superpowers/specs/2026-08-16-code-city-ui-design.md)
- [Code City implementation plan](../superpowers/plans/2026-08-16-code-city-ui.md)
