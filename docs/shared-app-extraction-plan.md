# Shared App Extraction Plan

## Goal

Achieve UI parity between:

- `apps/site` as the static public report product
- `apps/app` as the authenticated hosted report and intelligence product

without collapsing both products into one deployment model.

The working rule is:

- share **presentation**, **shell primitives**, **charts**, **tables**, and **page-level view components**
- keep **routes**, **data loading**, **filesystem contracts**, **auth**, and **runtime integration** app-local

This is now an active migration plan, not a speculative future extraction.

## Current State

### Platform split is real

The repo now has a real hosted/static platform boundary:

- `apps/site`
  - static Astro
  - public dataset-backed reports
- `apps/app`
  - hosted Astro SSR
  - authenticated user-facing shell
- `apps/runtime`
  - Better Auth
  - Bun/Effect runtime
  - Neon-backed hosted state

This split is formalized in:

- [ADR-0015: Adopt Separate Static Reports and Hosted Runtime for Intelligence](/Users/alan/Projects/planetnik/docs/adr/0015-adopt-separate-static-reports-and-hosted-runtime-for-intelligence.md)

### Shared package work has started

The first shared design-system/report package already exists:

- `packages/report-ui`

It currently owns shared shell/theme and the first migrated report surface:

- shell theme CSS
- icons
- breadcrumb
- theme switcher
- chart primitives
- table primitives
- `LandscapeRepositoriesView`

This means the extraction strategy has moved past “what package should we create” and into “which surfaces migrate next”.

### Hosted route parity exists before UI parity

The hosted app already has broad route coverage for report and landscape repo drilldown. That matters because it lets us migrate presentation without inventing new route structure at the same time.

The remaining gap is mainly:

- visual parity
- shared component reuse
- reducing duplicate page composition between `apps/site` and `apps/app`

## Architectural Rule

Do not share Astro `src/pages` directly.

Instead:

- `apps/site` keeps static route files and filesystem/data-directory loaders
- `apps/app` keeps hosted route files and Eden/runtime integration
- `packages/report-ui` owns reusable presentational surfaces
- future `packages/report-core` owns pure view-model and route/helper logic only when stable duplication proves it is worth extracting

The route file remains the composition and data-boundary layer.

## What We Share

### Share now

These belong in `packages/report-ui`:

- shell primitives
- sidebar/nav section primitives
- breadcrumb and topbar elements
- metric cards
- charts
- data tables
- help/tooltip UI
- logos and icon wrappers
- page-level presentational views that accept plain props

Examples:

- `LandscapeRepositoriesView`
- chart cards
- horizontal bar charts
- report inventory tables
- shared shell theme and brand elements

### Keep app-local

These should remain in each app:

- Astro `src/pages`
- Astro middleware
- static filesystem/data-directory resolution
- hosted runtime client calls
- auth/session access
- env var resolution
- route param decoding tied to app route structure

## Package Strategy

## 1. `packages/report-ui`

This is the active extraction package.

Responsibilities:

- presentational shell primitives
- cards
- charts
- tables
- filters/search controls
- help UI
- page-level view components

This package must stay:

- data-source agnostic
- auth agnostic
- runtime agnostic
- filesystem agnostic

It should consume plain props only.

### Current direction

Use `packages/report-ui` for:

- shared shell and theme
- shared report inventory/table/chart views
- eventually repo summary and dashboard sections

### View API rule

Each shared view should accept only plain props such as:

- strings
- numbers
- booleans
- readonly arrays
- hrefs
- small, explicit item objects

Do not pass:

- runtime clients
- loader functions
- Astro collections
- session objects

## 2. `packages/report-core`

This is still a later package, not the immediate focus.

Use it only when pure logic duplication becomes stable across both apps.

Likely future contents:

- route helper encoding/decoding
- formatting helpers
- chart help text
- contributor/metrics/coupling pure helpers
- stable report view-model mappers

Do not create this package just because a helper can move. Create it when both apps really need the same pure logic.

## 3. No `packages/report-screens` yet

Do not introduce a separate screen package yet.

Page-sized shared views should continue to live in `packages/report-ui/src/views/*` until there is a clear reason to split them further.

## Migration Rules

### Rule 1: Migrate by surface, not by folder

Each migration slice should take one real user-facing surface from:

- static-only implementation
- hosted-only implementation or placeholder

to:

- shared view in `packages/report-ui`
- app-local data mapping in `apps/site` and `apps/app`

### Rule 2: Prefer inventory and dashboard surfaces before graph-heavy pages

Good early targets:

- repositories
- contributors
- tags
- metrics
- commits

Harder targets to leave later:

- topology
- coupling
- components

### Rule 3: Route/data stay local

The static and hosted pages should both:

- fetch/load their own data
- build their own props
- render the same shared view

### Rule 4: Public package boundaries should be readonly-friendly

Shared props should prefer:

- `ReadonlyArray<T>`
- explicit object shapes
- narrow optional props

That reduces friction at app boundaries and prevents the package from assuming ownership of caller data.

## Migration Order

## Phase 1: Shell Parity

Goal:

- make the hosted shell match the static shell structure closely enough that page-level parity work is not fighting layout drift

Shared targets:

- shell theme CSS
- breadcrumb
- icons
- logo wrapper
- topbar utilities
- nav section/list primitives
- content region wrappers
- summary cards

Status:

- partially complete

Next work:

- extract shared sidebar/nav section primitives
- reduce remaining shell markup drift between `apps/site` and `apps/app`

## Phase 2: Inventory Surfaces

Goal:

- migrate high-value, low-risk chart/table pages first

Order:

1. `landscape/repositories`
2. `landscape/contributors`
3. `landscape/tags`

Status:

1. `landscape/repositories`
   - in progress / first migration completed
   - shared view exists in `packages/report-ui`

Expected shared components:

- metric cards
- horizontal ranking chart
- searchable inventory table

## Phase 3: Repo Summary Surfaces

Goal:

- migrate the repeated repo-level read-only report pages

Suggested order:

1. repo dashboard summary
2. metrics
3. commits
4. dependencies
5. duplication
6. controls
7. impact
8. hotspots

These are strong candidates because they are mostly:

- stat cards
- lists
- summary charts
- small tables

## Phase 4: Shared Table System

Goal:

- make `packages/report-ui` the single home for report table behavior

Includes:

- sorting
- filtering
- pagination
- loading states
- empty states
- column config conventions

This phase is effectively started already with the shared report data grid.

## Phase 5: Shared Chart System

Goal:

- consolidate the recurring chart vocabulary used across both apps

Includes:

- horizontal bars
- donut/ring charts
- stat summaries
- tooltip/help patterns
- chart cards and loading states

## Phase 6: Graph-heavy Surfaces

Goal:

- migrate the fragile graph and topology pages after the simpler surfaces are stable

Targets:

- topology
- coupling
- components

These should be last because they have the highest risk of:

- hydration issues
- reload-route edge cases
- data-shape instability
- layout regressions

## Definition of Done

A page or surface is considered migrated when:

1. both `apps/site` and `apps/app` render the same shared view from `packages/report-ui`
2. the remaining differences are only:
   - route composition
   - data loading
   - prop mapping
3. the visual hierarchy matches the static product closely enough for parity work
4. the shared component is typechecked at package level
5. both app consumers typecheck and build successfully

## Testing and Verification

For each migration slice:

1. package-level checks
   - `bun run --cwd packages/report-ui typecheck`
2. hosted app checks
   - `bun run --cwd apps/app typecheck`
   - `bun run --cwd apps/app build`
3. static app checks
   - `bun run --cwd apps/site typecheck`
   - `bun run --cwd apps/site build`
4. app-local view-model tests remain in the consuming app unless the mapper is later extracted as a pure shared helper

## Delivery Checklist

Use this section as the live migration checklist. Mark items off as slices land.

### Done

- [x] shared shell/theme foundation
- [x] shared breadcrumb/icon/logo primitives
- [x] `landscape/repositories`
- [x] `landscape/contributors`
- [x] `landscape/tags`
- [x] `landscape/teams`

### Todo

- [ ] repo dashboard summary surface
- [ ] repo metrics
- [ ] repo commits
- [ ] repo dependencies
- [ ] repo duplication
- [ ] repo controls
- [ ] repo impact
- [ ] repo hotspots
- [ ] graph-heavy surfaces:
  - topology
  - coupling
  - components

## Near-Term Plan

### Next recommended slices

1. `landscape/teams`
2. repo dashboard summary surface
3. repo metrics
4. repo commits

That sequence keeps the migration on high-value, lower-risk UI before graph-heavy pages.

## Anti-Goals

Do not:

- share Astro `src/pages`
- move static filesystem loaders into a package
- move hosted runtime clients into a package
- force `apps/site` and `apps/app` into identical routing trees
- introduce a second shared logic package before duplication is proven

## Practical Summary

- `packages/report-ui` is the active shared parity package.
- Migrate one user-facing surface at a time.
- Keep routes and data loading app-local.
- Prefer inventory and dashboard pages before graph-heavy pages.
- Only extract pure logic to `report-core` when both apps demonstrably need it.
