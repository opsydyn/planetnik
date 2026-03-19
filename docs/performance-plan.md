# Site Performance Plan

## Goal

Reduce client bundle cost and improve route responsiveness without removing the interactive surfaces that differentiate Planetnik.

## Why Now

The current site build completes successfully, but Vite warns that some chunks are larger than `500 kB` after minification.

The current built asset profile shows three clear offenders:

- `ReportDataGrid.*.js`: `1.1 MB`
- `TopologyGraph.*.js`: `413 KB`
- `ForceGraphClient.*.js`: `185 KB`

The main issue is not the total number of pages. It is the amount of JavaScript we hydrate eagerly and the size of the libraries included in shared client chunks.

## Current Evidence

### Largest Built Assets

- `apps/site/dist/_astro/ReportDataGrid.*.js`: `1.1 MB`
- `apps/site/dist/_astro/ReportDataGrid.*.css`: `258 KB`
- `apps/site/dist/_astro/TopologyGraph.*.js`: `413 KB`
- `apps/site/dist/_astro/ForceGraphClient.*.js`: `185 KB`
- `apps/site/dist/_astro/client.*.js`: `174 KB`

### Main Technical Causes

- `ReportDataGrid` currently registers `AllCommunityModule` from AG Grid, which pulls in far more grid functionality than the site uses.
- Many pages still use `client:load` for charts and data grids, even when those elements are below the fold.
- Large route-specific libraries are not yet explicitly chunked:
  - AG Grid
  - visx
  - Sigma / Graphology
  - React Flow / dagre

## Success Criteria

### Build Targets

- no shared chunk above `500 KB` after minification
- `ReportDataGrid` chunk reduced materially from `1.1 MB`
- graph-specific libraries isolated into route-level or feature-level chunks

### Runtime Targets

- lower JS cost on dashboard and report pages that do not need graphs immediately
- charts and grids should not hydrate before they are needed
- no visible layout shift regression while deferring hydration

## Plan

## Phase 1: AG Grid Reduction

### Objective

Shrink the biggest chunk first.

### Work

- replace `AllCommunityModule` in `apps/site/src/components/tables/ReportDataGrid.tsx`
- register only the AG Grid modules the site actually uses:
  - client-side row model
  - sorting
  - filtering
  - pagination
  - menus
  - resizing
  - tooltips

### Expected Impact

- largest direct JS reduction
- smaller shared table chunk across all report pages

### Size

- `S`

## Phase 2: Hydration Audit

### Objective

Stop loading interactive code before the user needs it.

### Work

- audit every `client:load` usage in `apps/site/src/pages`
- move below-the-fold charts and grids to:
  - `client:visible` when tied to scroll position
  - `client:idle` when useful but not immediately needed
- keep only genuinely above-the-fold, critical interactions on `client:load`

### Good First Candidates

- report tables on:
  - `/components`
  - `/contributors`
  - `/files/*`
  - `/units/*`
  - `/controls`
  - `/findings`
  - `/hotspots`
- secondary charts below top summary cards

### Expected Impact

- lower initial route JS
- less work during first paint
- better perceived performance even before total bytes are fully reduced

### Size

- `M`

## Phase 3: Manual Chunking

### Objective

Split large feature stacks so unrelated routes do not share oversized bundles.

### Work

- add `build.rollupOptions.output.manualChunks` in `apps/site/astro.config.mjs`
- separate chunks for:
  - AG Grid
  - visx
  - Sigma / Graphology
  - React Flow / dagre

### Expected Impact

- better browser caching
- fewer routes paying for graph or grid code they do not use
- more predictable asset profile

### Size

- `M`

## Phase 4: Re-measure and Decide

### Objective

Only do deeper engineering if the first three phases are not enough.

### Work

- rebuild and compare chunk sizes
- inspect route loading behavior on:
  - `/`
  - `/components`
  - `/contributors/[email]`
  - `/files/temporal`
  - `/topology`
- decide whether a second optimization pass is warranted

### Possible Phase 4 Follow-ups

- static-first grid shell with deferred AG Grid import
- consolidate repeated visx usage behind smaller shared wrappers
- move more feature stacks behind route-specific lazy boundaries

### Size

- `S`

## Non-Goals

- replacing AG Grid again
- replacing visx again
- redesigning pages purely for Lighthouse optics
- removing high-value interactions such as force graphs or contributor topology

## Recommended Order

1. AG Grid module trimming
2. hydration audit
3. manual chunking
4. re-measure

## Definition of Done

- build warning eliminated or reduced to route-isolated chunks only
- no single shared chunk remains the obvious bottleneck
- pages still feel stable and interactive
- no regressions to CSP compatibility, search, grids, or graph views
