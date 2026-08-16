# Code City WebGL UI — Design

**Date:** 2026-08-16
**Status:** Approved
**Depends on:** [Code City model design](./2026-08-16-code-city-model-design.md)

## Goal

Build the first repo-scoped Code City decision surface in the static site. It
should make bounded contexts, structural footprint, health, ownership, change,
coupling, and impact explorable without losing the exact report evidence that
supports each signal.

The first view is a real browser WebGL scene with a stylised 2.5D/isometric
city grammar. It is not a port of Draxul's native renderer and it does not add
runtime source scanning. Canonical v2 JSON remains the only product input.

The first slice must help answer a concrete engineering question such as:

> Which bounded contexts and files combine the largest structural footprint
> with the greatest health, ownership, or impact concern?

## Context and constraints

The renderer-neutral `CodeCityModel` already exists in
`packages/common/src/code-city`. It contains stable districts, file buildings,
unit drill-down records, component dependency edges, signals, evidence routes,
coverage diagnostics, deterministic ordering hints, and a semantic legend.

The product roadmap calls for a repo-scoped browser visualisation shared by the
static site and the future hosted repo-scoped product. The static site is the
first consumer. Landscape-root aggregation, new canonical shards, native GPU
architecture, and runtime parsing are outside this slice.

The existing report UI is React/Astro-based and already follows client-only
island patterns for graph-heavy views. The current graph stack is 2D (Sigma,
D3, and XYFlow); Three.js is a deliberate new dependency rather than a reuse
of the existing graph renderer.

## Locked decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| First route | `apps/site` `/code-city` | Static-first, repo-scoped decision surface |
| First dataset scope | One repository snapshot | Bounded vertical slice; landscape follows renderer stability |
| Input boundary | v2 canonical JSON → `CodeCityModel` | No TXT, HTML, text, or runtime source parsing |
| Renderer | Plain Three.js behind a thin React client island | Real WebGL scene with a small runtime surface; avoids a second React rendering abstraction |
| Scene style | Stylised 2.5D city with real extruded geometry | Provides depth and isometric affordances without a native renderer port |
| Default camera | Orthographic isometric | Preserves map comparison and bounded-context geography |
| Camera freedom | Constrained orbit plus pan/zoom | Adds depth while keeping the civic map legible |
| Selection camera behaviour | Camera remains fixed; **Focus** is explicit | Inspector-first workflow preserves context |
| Geography | Context parcels first | Components or stable path groups become named districts |
| Building identity | One building per stable file ID | Matches the canonical model and avoids duplicate geometry |
| Building mass | LOC-derived, bounded/log-scaled | Stable physical footprint with readable outlier handling |
| Analytical lenses | Health default; Footprint, Impact, Change, Ownership, Complexity switchable | Geometry remains stable while the question changes |
| Dependency routes | Selection path by default; broader emphasis in Impact lens | Evidence appears on demand instead of becoming road clutter |
| Inspector | Right-side inspector with exact signals and evidence links | Makes the visualisation actionable and auditable |
| Degraded experience | Table/list fallback | Covers no WebGL, accessibility, print, and dense datasets |
| Shared boundary | Scene adapter and UI primitives in `packages/report-ui` | Static and hosted consumers share behaviour without sharing Astro pages |

## User experience

### Route and shell

`/code-city` uses the existing `Dashboard` shell and report navigation. The
server-side Astro route loads the selected repository's canonical shards,
builds a `CodeCityModel`, and serialises that value into a client-only Code
City island. The island owns WebGL lifecycle and interaction state; it does not
read files, inspect the environment, or call the analysis runtime.

The first route is single-repository. A landscape repository drill-down may
later supply the same model shape, but the first UI does not invent a
landscape-root city or cross-repository coordinate system.

### Opening state

The initial viewport shows the whole repository when it fits, with the first
districts visible as named context parcels. The default lens is **Health**.
The camera starts in orthographic isometric mode. There is no automatic camera
fly-to when the user selects an entity.

If the health shard is absent, the Health lens remains selectable but renders a
neutral material and an explicit “Health unavailable” state. It does not fall
back to a fabricated score or silently change the default question.

### Scene grammar

- **Districts / parcels:** logical components where decomposition is
  unambiguous; deterministic path groups otherwise. Each parcel has a stable
  label, identity colour/boundary, aggregate footprint, and optional coverage
  marker.
- **Buildings:** files placed inside their primary district. The building
  shape is deliberately simple and legible; LOC controls bounded mass, with a
  stable minimum so small files remain selectable.
- **Units:** not rendered as a separate city-wide geometry layer in the first
  slice. Units appear in the selected building's inspector and may be shown as
  a focused drill-down later.
- **Routes:** component dependency edges become thin raised connection strips
  only when relevant to the current selection or lens. They never move
  districts or buildings.
- **Labels:** district labels are visible at overview scale; building labels
  appear on hover/selection or when the camera is sufficiently close.

The scene is designed as a calm civic map, not a constantly animated game
world. There are no required particle effects, automatic camera tours, or
continuous data animations in the first slice.

### Lens contract

All lenses operate over the same scene coordinates and entity ordering:

- **Footprint:** neutral structural palette; LOC remains visible in the
  inspector and legend.
- **Health:** hotspot score/severity/dominant dimension drive material tone and
  severity accent. This is the default.
- **Impact:** impact score/dimension drive accent and selection-path emphasis.
- **Change:** commit and temporal-link pressure drive a warm intensity scale.
- **Ownership:** contributor count and identity drive a documented ownership
  palette; multiple contributors must not be collapsed into a single invented
  owner.
- **Complexity:** unit McCabe signal drives a risk accent while building mass
  remains LOC-derived.

The active lens is always named in the control bar and legend. Missing values
remain visually neutral and are labelled unavailable in the inspector. Lens
changes never reshuffle parcels, change building mass, or invalidate evidence
links.

### Selection and inspection

Selection is the primary interaction:

1. Clicking a district or building adds a clear selection outline.
2. The right inspector opens without changing the camera.
3. The selected entity's connected dependency path is revealed; unrelated
   routes remain subdued.
4. The inspector presents identity, district, source set, LOC, health,
   ownership, impact, and any available change/complexity values.
5. Evidence links use the model's relative routes and open the existing file,
   unit, component, hotspot, or impact surface.
6. **Focus** is an explicit action that reframes the camera around the selected
   entity. Clearing selection restores the prior camera state.

Hover may preview a name and primary metric, but hover must not open the
inspector or move the camera. Keyboard navigation and the table fallback must
provide the same selection and evidence path for users who cannot use a
pointer.

### Dependency route behaviour

The default route state is quiet. A selected district reveals incident edges;
a selected building reveals the edges attached to any of its represented
districts. The Impact lens may increase the emphasis of relevant incident
routes, but the renderer does not manufacture file-level edges that are not in
the model. Unresolved model edges remain available through coverage/diagnostic
surfaces rather than being drawn as misleading connections.

## Renderer and package architecture

### Browser boundary

The browser-facing implementation lives under `packages/report-ui` and is
loaded by `apps/site` as a client-only React island. The recommended structure
is:

- `CodeCityView` — React host for controls, inspector, fallback, and state;
- `CodeCityCanvas` — lifecycle wrapper for the Three.js renderer;
- `CodeCitySceneAdapter` — pure conversion from `CodeCityModel` to
  renderer-neutral scene records;
- `CodeCityLens` helpers — total mapping from semantic channels to materials,
  accents, legends, and unavailable states;
- `CodeCitySelection` helpers — deterministic entity selection and route
  highlighting;
- `CodeCityFallback` — accessible table/list representation.

Three.js is a runtime dependency of the package that owns the scene. It must
not leak into `packages/common`, Astro loaders, or server-only modules. The
React host should lazy-load the scene code and fail into the fallback when
WebGL or renderer initialisation is unavailable. React owns controls and
selection state; the render loop owns only GPU scene state.

The route should be tested with hard reloads first. If Astro client navigation
does not preserve the WebGL island reliably, `/code-city` must use the existing
reload-route bypass rather than carrying a fragile hydration workaround.

### Deterministic scene layout

The model's seed and ordering hints are the only identity inputs. The adapter
derives positions as follows:

1. Sort districts by `layout.districtOrder` and place them in a balanced,
   deterministic parcel grid.
2. Size parcel capacity from child building count with bounded padding; do not
   allow one large LOC outlier to push every other district off-screen.
3. Sort buildings by `layout.buildingOrder` and place them row-first within the
   primary parcel. Their mass uses bounded/log-scaled LOC.
4. Keep multi-district affiliations in the inspector and selection-path logic;
   do not duplicate a building merely to make the picture look fuller.
5. Sort units by `layout.unitOrder` for inspector drill-down.
6. Route geometry is derived after entity positions and is never an input to
   parcel placement.

The adapter must be pure and repeatable. Given the same model, viewport mode,
and layout options it produces the same scene records. Lens changes and
selection state must not alter coordinates.

### Level of detail

The renderer uses documented levels of detail rather than silently dropping
evidence:

- **Overview:** parcels, bounded building masses, labels, and quiet route
  affordances.
- **District focus:** selected parcel buildings and incident routes become
  clearer; unrelated labels may be reduced.
- **Building focus:** selected building, units in the inspector, and evidence
  links; units are not a second dense city-wide mesh.
- **Dense fallback:** large or slow scenes switch to the table/list view or a
  district-first view with an explicit “more detail” affordance.

The initial thresholds are implementation/configuration details to be measured
against representative small and dense repositories; they must not change the
semantic model or hide records from the fallback.

## Data, coverage, and failure states

The route must distinguish these states:

- **Valid model:** render the scene and show coverage in the legend/inspector.
- **Partial optional data:** render what is present; show missing shard names
  and neutral unavailable lens values.
- **Invalid required input:** show a clear report error for invalid v2 context,
  missing repository identity, or missing `filesMain`; do not render an empty
  fictional city.
- **WebGL unavailable/initialisation failure:** show the table/list fallback and
  preserve all evidence links.
- **No entities after a valid load:** show an honest empty snapshot state with
  snapshot identity and coverage diagnostics.

Diagnostics are evidence. They should be reachable from the fallback or an
inspector coverage affordance, not logged only to the console.

## Accessibility and responsive behaviour

- The lens bar uses real buttons with an accessible active state and a visible
  legend; colour is never the sole signal.
- Every selectable scene entity has a corresponding list/fallback row.
- The inspector is keyboard reachable, has a labelled heading, and exposes
  unavailable values as text rather than colour alone.
- The map and inspector stack on narrow screens; the fallback remains usable
  without WebGL.
- Print output uses the table/list representation rather than attempting to
  print a GPU canvas.
- Reduced-motion preferences disable non-essential camera easing and visual
  pulses.

## Verification and acceptance

### Automated checks

The UI slice must add focused tests for:

1. deterministic scene records for a fixture `CodeCityModel`;
2. stable coordinates when model arrays are permuted;
3. total lens mapping, including missing/neutral values;
4. selection-path highlighting for districts and multi-affiliated buildings;
5. evidence-link resolution without environment-specific origins;
6. fallback rendering for WebGL absence, partial coverage, and invalid input;
7. stable table ordering and unit drill-down ordering;
8. package typecheck, site typecheck, and static build.

### Direct evidence

Before claiming the slice complete, verify:

- the `/code-city` route loads from a built static site with a fixture dataset;
- the WebGL scene starts in orthographic isometric mode;
- constrained orbit, pan, zoom, selection, and explicit Focus work;
- lens changes preserve scene geometry;
- the inspector links to existing evidence routes;
- a hard reload and a route navigation do not leave a broken island;
- WebGL-disabled/failing initialisation reaches the table/list fallback;
- a dense representative dataset reaches documented LOD behaviour;
- bundle cost, first interaction latency, and repeated-layout stability are
  recorded;
- a visual regression capture shows the same parcel/building arrangement for
  the same snapshot.

This evidence claims the UI slice only. It does not claim native renderer
parity, runtime parsing, landscape aggregation, or a new canonical exporter.

## Rollout boundary

The implementation should first prove the route with a small fixture and the
existing canonical model. It may then be exercised against one representative
real repository before any landscape or hosted-product promotion. The shared
renderer boundary is designed now, but the hosted app integration remains a
follow-on consumer and must not force static loaders to depend on it.

## Explicitly out of scope

- Landscape-root or cross-repository city layout
- Runtime repository scanning or text/HTML parsing
- A new canonical semantic/code-structure shard before a demonstrated model
  gap
- Native Vulkan/Metal/Draxul renderer or copied Draxul assets/code
- Full perspective mode, free-camera flight, automatic tours, or game-like
  animation
- File-level dependency synthesis beyond the canonical component edges
- Historical trends, embeddings, runtime coupling, or additional language
  parser work
- Sharing Astro page files with the future hosted product

## Self-review checklist

- [x] User-approved geography: context parcels.
- [x] User-approved renderer direction: real WebGL, orthographic isometric
  default.
- [x] User-approved camera: constrained orbit.
- [x] User-approved visual encoding: stable LOC city with switchable lenses.
- [x] User-approved interaction: inspector-first, camera preserved, explicit
  Focus.
- [x] User-approved routes: selection path dependency edges.
- [x] User-approved scope: single repository first.
- [x] Canonical JSON and existing evidence routes remain authoritative.
- [x] No silent missing-data coercion or fallback to invented values.
- [x] Static/hosted boundary and no-native-renderer boundary are preserved.
- [x] Accessibility, no-WebGL, print, dense-data, and hard-reload states are
  explicit.
- [x] Verification distinguishes automated checks from direct visual/runtime
  evidence.

## Related records

- [Product roadmap — Phase 1.5](../../product-roadmap.md#phase-15--code-city-semantic-visualisation)
- [Code City model design](./2026-08-16-code-city-model-design.md)
- [ADR-0018 — versioned canonical analysis snapshots](../../adr/0018-adopt-versioned-canonical-analysis-snapshots.md)
- [Phase 1 compatibility-removal fixture matrix](../../compatibility-removal-fixture-matrix.md)
