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

Automated evidence on 2026-08-17 covers the canonical model, deterministic
layout, lenses, selection paths, safe evidence links, audience and story state
machines, fallback row preservation, WebGL capability handling, responsive,
print, and reduced-motion rules, workspace typechecks, and the static build.
The acceptance build emitted the lazy `threeRenderer` chunk at 571,471 bytes
raw and 142,358 bytes gzip.

The in-app browser opened the deterministic complete fixture at
`/planetnik/code-city`. The DOM and screenshots showed 13 files, three
contexts, zero diagnostics, the map and 16-row table, and a rendered
orthographic/isometric city. Onboarding, Architecture Review, and Stakeholder
showed their distinct opening questions and first actions while the selected
`analysis` district, one dependency route, architecture-brief facts, evidence
links, and visible scene framing remained stable. The complete story was
advanced, reversed, focused, returned to overview, completed, replayed, and
exited. At its Prove step, story, inspector, and brief linked the same component
and impact evidence routes.

The encoded repo-scoped route
`/planetnik/landscape/repositories/acme$2Faudience-fixture/code-city` directly
showed the complete map/table surface, Architecture Review, story navigation,
16 fallback rows, and repo-scoped component and impact evidence links. The
partial single-repository fixture directly named `impact.json` as unavailable,
retained its 16-row record set and available component evidence, and did not
invent a replacement impact value. The partial story was only observed at its
available Orient step, where Skip was correctly disabled; its unavailable step
and the partial repo-scoped route were not exercised.

After the final URL hydration repair in `79d5251`, direct reload of URLs containing
`audience=architecture-review&story=connect` restored Architecture Review,
Connect the city, the `analysis` inspector, and Map view on both routes. This is
fresh direct evidence rather than a result inferred from the URL parser tests.

The remaining direct rows are orbit/pan/zoom, exact camera-coordinate
preservation and restore, keyboard traversal, forced renderer failure, print
preview, reduced-motion emulation, the partial unavailable-story flow, the
1,501-building dense fixture, and a reliable first-usable interaction time.
Until those remaining rows are green, this ADR does not accept the full
interaction contract. This boundary does not broaden the ADR into a native
renderer commitment or permit removing the HTML fallback.

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
   including orbit limits, exact camera preservation and restore, no-WebGL
   fallback, keyboard flow, print, and reduced motion.
2. Run the partial unavailable-story step and 1,501-building dense fixture
   directly, recording table row equality and LOD behaviour on both routes.
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
