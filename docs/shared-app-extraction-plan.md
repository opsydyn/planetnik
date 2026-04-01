# Shared App Extraction Plan

## Goal

Share most of the current `apps/site` implementation across:

- the existing static report app
- the future authenticated hosted app

without collapsing both products into one deployment model.

The practical rule is:

- share **presentation**, **view-model logic**, and **route helpers**
- do **not** share **pages**, **filesystem loaders**, **auth middleware**, or **runtime integrations**

## Current Repo Fit

This repo is already set up for the right extraction approach:

- Bun workspaces already cover `apps/*` and `packages/*`
- there is already a package pattern under `packages/*`
- `apps/site` contains most of the reusable code today
- `apps/copilot-runtime` already exists and can evolve into the hosted runtime app later

This means we do not need a repo reorganization first. We can extract incrementally.

## What We Should Share

### Shareable now

These are good candidates to move into packages with minimal risk:

- theme tokens and design primitives
- charts
- table components
- cards
- help/tooltip UI
- icons and logo wrappers
- formatting helpers
- route helper functions
- report view-model builders
- landscape route mapping helpers

### Keep app-local

These should remain in each app:

- Astro `src/pages`
- Astro middleware
- static file-backed loaders
- env var resolution
- filesystem reads
- request-time auth/session logic
- runtime API clients that are different between public and hosted apps

## Target Package Split

Use three layers.

### 1. `packages/report-ui`

Owns reusable presentational UI.

Suggested contents:

- `charts/`
- `tables/`
- `help/`
- `icons/`
- `theme/`
- `shell/` primitives such as nav groups and cards

Examples to move here:

- `apps/site/src/components/charts/*`
- `apps/site/src/components/help/*`
- `apps/site/src/components/tables/*`
- `apps/site/src/components/icons/*`
- `apps/site/src/components/theme-switcher/ThemeSwitcher.astro`

### 2. `packages/report-core`

Owns report/domain helpers and pure view-model logic.

Suggested contents:

- `routes/`
- `formatting/`
- `contributors/`
- `metrics/`
- `coupling/`
- `topology/`
- `search/` types and config

Examples to move here:

- `apps/site/src/lib/contributors.ts`
- `apps/site/src/lib/metrics.ts`
- `apps/site/src/lib/route.ts`
- `apps/site/src/lib/chartHelp.ts`
- `apps/site/src/lib/forceGraph.ts`
- `apps/site/src/lib/coupling/balancedCouplingModel.ts`
- `apps/site/src/lib/landscapeRoutes.ts`

### 3. `packages/report-screens` later, not first

Owns page-sized screen components once the app split is real.

Examples:

- dashboard screen
- hotspots screen
- contributor detail screen
- impact screen

Do not start here. This package only becomes useful once `apps/app` exists and there is obvious duplication in page composition.

## Keep These App-Local

These files or categories should **not** move in the first extraction:

- `apps/site/src/pages/**`
- `apps/site/src/loaders/**`
- `apps/site/src/lib/landscape.ts`
  - uses `node:fs`
- `apps/site/src/lib/search/buildSearchDocuments.ts`
  - page inventory is app-specific
- `apps/site/src/layouts/Dashboard.astro`
  - keep local until we know how different the hosted shell must be
- `apps/site/src/components/intelligence/**`
  - these are candidates for the hosted app, not shared package extraction first

## First Extraction Slice

This should be the first concrete move because it has high reuse and low coupling to filesystem/auth concerns.

### Package to create first

- `packages/report-ui`

### Files to move first

1. `apps/site/src/components/help/HelpTooltip.tsx`
2. `apps/site/src/components/help/HelpTooltip.css`
3. `apps/site/src/components/charts/ChartCard.tsx`
4. `apps/site/src/components/charts/theme.ts`
5. `apps/site/src/components/tables/ReportDataGrid.tsx`
6. `apps/site/src/components/tables/ReportDataGridInner.tsx`
7. `apps/site/src/components/tables/ReportDataGrid.types.ts`
8. `apps/site/src/components/tables/ReportDataGrid.css`
9. `apps/site/src/components/tables/StaticReportTable.astro`
10. `apps/site/src/components/tables/StaticReportTable.css`

Why these first:

- they are used across many pages
- they do not need direct filesystem access
- they do not need auth/runtime context
- they create immediate value for both the static and hosted apps

## Second Extraction Slice

After `report-ui` is stable, create:

- `packages/report-core`

### Files to move next

1. `apps/site/src/lib/contributors.ts`
2. `apps/site/src/lib/metrics.ts`
3. `apps/site/src/lib/route.ts`
4. `apps/site/src/lib/chartHelp.ts`
5. `apps/site/src/lib/contributorHeatmap.ts`
6. `apps/site/src/lib/forceGraph.ts`
7. `apps/site/src/lib/landscapeRoutes.ts`
8. `apps/site/src/lib/coupling/balancedCouplingModel.ts`
9. `apps/site/src/lib/search/types.ts`
10. `apps/site/src/lib/search/fuseConfig.ts`

Why these second:

- they are pure or nearly pure
- they shape the public contract between report data and UI
- they let both apps render the same concepts consistently

## Third Extraction Slice

Only after the hosted app exists:

- extract repeated screen composition into `packages/report-screens`

Likely candidates:

- contributor detail summary grid
- hotspot dashboard sections
- impact page sections
- topology summary sections

This is where the duplication between `apps/site` and `apps/app` will actually show itself.

## Proposed Package APIs

Keep the APIs boring and stable.

### `@planetnik/report-ui`

Exports:

- `charts/*`
- `tables/*`
- `help/*`
- `icons/*`
- `theme/*`

This package should not know anything about:

- filesystem paths
- Astro loaders
- auth/session
- environment variables

### `@planetnik/report-core`

Exports:

- route helpers
- formatting helpers
- contributor helpers
- metric helpers
- pure graph/coupling builders
- search config/types

This package should not know anything about:

- `node:fs`
- Astro page modules
- Bun process env loading
- hosted auth/runtime services

## Import Policy

Use this dependency direction:

- `apps/site` -> `@planetnik/report-ui`, `@planetnik/report-core`
- `apps/app` -> `@planetnik/report-ui`, `@planetnik/report-core`
- `@planetnik/report-ui` -> `@planetnik/report-core` only if truly needed
- `@planetnik/report-core` -> no dependency on app code

Forbidden direction:

- packages importing from `apps/site`
- packages importing from `apps/app`

## CSS and Assets Strategy

### CSS

Keep CSS colocated with the component inside the package.

That means:

- `packages/report-ui/src/tables/ReportDataGrid.css`
- `packages/report-ui/src/help/HelpTooltip.css`

### Assets

For now:

- keep static images in each app’s `public/`
- share only wrapper components and icon mapping logic

Later:

- extract common branding assets into a small `packages/brand-assets` package only if duplication is real

Do not start by moving every image.

## What We Should Not Extract Yet

Do not extract these in the first pass:

- `TopologyGraph.tsx`
- `ForceGraph.tsx`
- `ForceGraphClient.tsx`
- `LandscapeTopologyExplorer.tsx`
- `GlobalSearch.tsx`
- `Dashboard.astro`
- intelligence components

These are still too entangled with:

- route behavior
- app shell assumptions
- landscape/static mode handling
- hydration and reload policy

They can be revisited later.

## Hosted App Reuse Strategy

When `apps/app` is created:

- do not copy `apps/site`
- create thin Astro pages that compose:
  - shared UI from `@planetnik/report-ui`
  - shared view-models from `@planetnik/report-core`
  - hosted-only wrappers for auth and runtime calls

That keeps the hosted app small and intentional.

## Concrete Delivery Plan

### Phase 1

- create `packages/report-ui`
- move help, chart card, and table components
- switch `apps/site` imports to package imports
- no behavior changes

### Phase 2

- create `packages/report-core`
- move route/formatting/view-model helpers
- switch `apps/site` imports
- no behavior changes

### Phase 3

- create `apps/app`
- build the hosted Astro shell
- reuse `report-ui` and `report-core`

### Phase 4

- identify duplicated page composition between `site` and `app`
- extract only the repeated screens

## Success Criteria

The extraction is working when:

- `apps/site` still builds and deploys statically
- `apps/app` can reuse the same charts, tables, and card system
- shared packages contain no filesystem/env/auth leakage
- no package imports back into app code
- the hosted app can grow without cloning the entire site codebase

## Recommended First PR

The first extraction PR should do only this:

- add `packages/report-ui`
- move:
  - `HelpTooltip`
  - `ChartCard`
  - `ReportDataGrid`
  - `StaticReportTable`
- update imports in `apps/site`
- keep CSS and behavior identical

That is the smallest high-leverage move.
