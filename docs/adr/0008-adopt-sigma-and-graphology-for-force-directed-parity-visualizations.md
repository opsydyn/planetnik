# ADR-0008: Adopt Sigma and Graphology for Force-Directed Parity Visualizations

## Status

Accepted

## Context

Płanetnik already renders the standard report pages in Astro and React, and it already uses specialized libraries where they fit the interaction model:

- `@xyflow/react` for the current contributor topology in `apps/site/src/components/TopologyGraph.tsx`
- `@visx/*` for charts such as donuts, bars, treemaps, line charts, and heatmaps
- `ag-grid-community` and `ag-grid-react` for large searchable report tables

That matches the direction captured in [ADR-0003](./0003-backend-only-parity-astro-frontend.md): Astro owns the frontend, while backend analysis and exporter contracts remain the critical boundary.

Recent parity work under [ADR-0007](./0007-restore-logical-decomposition-parity-with-decomposition-aware-contracts.md) restored decomposition-aware contracts for standard report pages such as components, dependencies, and temporal dependencies. However, parity is still incomplete for the richer standalone Sokrates graph visualizations that are linked from classic HTML reports, including:

- contributor force-directed visualizations such as `people_dependencies_30_1.svg`
- file changed-together force-directed visualizations such as `file_changed_together_dependencies_files_30_days_force_2d.html`
- future component dependency force graphs once the decomposition-aware contracts are complete enough to drive them cleanly

The current frontend can approximate these analysis areas with tables, matrices, bar charts, and the existing `/topology` page, but those do not replace the original force-directed exploration model:

- `apps/site/src/pages/topology.astro` and `apps/site/src/components/TopologyGraph.tsx` provide a structured contributor relationship view, but they are built around React Flow and dagre-style layout rather than a large interactive force graph
- `apps/site/src/pages/files/temporal.astro` and `apps/site/src/components/TemporalDependenciesExplorer.tsx` provide searchable file temporal-dependency exploration, but not a graph-native spatial visualization
- `apps/site/src/pages/dependencies.astro` and `apps/site/src/components/charts/DependencyMatrix.tsx` provide component dependency analysis, but not a force-directed dependency view

This is now an architectural decision rather than a local implementation choice because it introduces:

- a new frontend dependency stack
- a new graph rendering model and data-shaping pattern
- shared implementation conventions for multiple future parity routes

The choice is hard to reverse once multiple routes and components depend on it, so it needs an explicit ADR.

## Decision

We will adopt Sigma.js and Graphology, using a React binding, as the standard stack for new force-directed parity visualizations in `apps/site`.

### Core policy

- Use Sigma.js plus Graphology for force-directed graph views that are intended to replace classic Sokrates standalone graph visualizations.
- Keep React Flow for the current `/topology` experience unless a later ADR explicitly decides to replace it.
- Keep visx for chart-style visualizations and AG Grid for searchable tabular exploration.
- Do not introduce Cytoscape.js or a second graph-visualization stack for the same force-directed parity use case.

### Scope of this decision

This ADR applies to new force-directed parity visualizations only.

Initial implementation targets:

- contributor force-directed graph views
- file temporal-dependency force-directed graph views

Planned future extension under the same stack:

- component dependency force-directed graph views, once the decomposition-aware contracts from ADR-0007 are stable enough to support them

### Data policy

- Sigma/Graphology views must consume existing backend exports or explicit new backend contracts. They must not scrape rendered HTML or invent frontend-only graph semantics.
- Node and edge identity must remain stable and deterministic so graph interactions can link into Astro routes and AG Grid-backed detail views.
- Force-directed graph routes should coexist with the existing searchable table and chart views rather than replace them outright.

### Frontend policy

- Force-directed graph components should be isolated in dedicated React islands under `apps/site/src/components/`.
- Astro pages should use those islands as focused visualization surfaces with surrounding explanatory copy, filters, and links to the existing detailed table views.
- Any route added under this ADR should continue to work with Astro view transitions and should avoid introducing hard browser reload behavior for in-app navigation.

## Why this option

- Sigma.js is purpose-built for graph visualization and is a stronger fit for large, interactive force-directed views than React Flow’s editor-oriented model.
- Graphology provides a graph-native data model and layout ecosystem that fits the missing Sokrates-style parity work well.
- This keeps the frontend architecture coherent: React Flow for node-editor or topology-style UI, visx for analytical charts, AG Grid for heavy tables, and Sigma/Graphology for graph-native force exploration.
- It avoids stretching the current React Flow plus dagre approach into a use case it was not chosen for.
- It provides a reusable path for multiple parity gaps instead of solving each missing graph as an isolated experiment.

## Alternatives Considered

### Continue using React Flow with dagre or elk for the missing parity visuals

This would minimize new dependencies.

We are not choosing it because the missing parity work is explicitly about graph-native force-directed exploration, not layered layout or editor-like interaction. React Flow remains the right tool for the existing topology view, but it is not the right default for this class of parity visual.

### Adopt Cytoscape.js for all future graph work

This is a credible alternative with a broad graph feature set.

We are not choosing it because it adds a wider and heavier graph platform than we currently need. For the narrow force-directed parity goal, Sigma plus Graphology gives a cleaner graph-visualization stack with a smaller conceptual footprint.

### Keep the missing parity visuals as tables and matrices only

This would avoid any new graph library.

We are not choosing it because it would leave a visible parity gap with classic Sokrates reports and remove an exploration mode that is well suited to contributor, file, and component relationship data.

## Consequences

- `apps/site` will gain a new graph-visualization dependency stack centered on Sigma and Graphology.
- New graph views will be implemented as React islands rather than plain Astro or visx charts.
- The project will maintain multiple visualization stacks by intent:
  - React Flow for the existing topology/editor-style graph
  - Sigma/Graphology for force-directed graph parity views
  - visx for chart-style analytics
  - AG Grid for searchable detail tables
- Future parity work for component dependency force graphs will have a defined frontend stack instead of reopening the library choice.

## Non-goals

- No replacement of the existing `TopologyGraph.tsx` implementation
- No migration of existing visx charts to Sigma
- No migration of AG Grid-backed report tables to graph views
- No commitment to recreate every legacy Sokrates graph artifact pixel-for-pixel
- No backend contract changes beyond what a concrete force-graph route actually requires

## Related ADRs

- ADR-0003: Backend-Only Parity — Astro Frontend Replaces Java HTML Reports
- ADR-0006: Add Contributor Detail Routes and a Per-Contributor Export Contract
- ADR-0007: Restore Logical Decomposition Parity with Decomposition-Aware Contracts

## Implementation Plan

- **Affected paths**: `apps/site/package.json`, `apps/site/src/components/`, `apps/site/src/pages/`, `apps/site/src/lib/`, `apps/site/src/layouts/Dashboard.astro`, `apps/site/src/loaders/planetnik-loader.ts`, `apps/site/src/content.config.ts`, `apps/site/src/lib/__tests__/`, and any exporter/contract files needed for graph-specific data
- Add Sigma and Graphology dependencies to `apps/site` with the React binding chosen for the integration.
- Create a reusable force-graph React wrapper that:
  - builds a Graphology graph from typed node and edge input
  - initializes a force layout
  - exposes click handlers for Astro route navigation
  - reserves layout space and uses the existing skeleton/loading discipline used elsewhere in the site
- Implement the first parity slice for file temporal dependencies using the existing temporal dependency contract behind `/files/temporal`.
- Add a dedicated Astro route or visualization section for the file temporal-dependency force graph that complements, rather than replaces, the current searchable explorer.
- Implement the second parity slice for contributor dependency force graphs using the people dependency data already used by `/topology`.
- Ensure programmatic navigation from graph nodes or edges uses Astro transitions instead of hard page reloads.
- Keep the existing `/topology` route on React Flow until a separate decision is made.
- Reuse the same Sigma/Graphology wrapper for future component dependency force graphs once ADR-0007 contract work is ready.
- Add focused tests for graph data shaping and any route helpers used by the new graph views.

## Verification

- [ ] `apps/site` includes Sigma and Graphology as the accepted force-directed visualization stack
- [ ] A reusable Sigma/Graphology React graph component exists for new parity views
- [ ] A file temporal-dependency force graph builds successfully from real Sokrates data
- [ ] A contributor dependency force graph builds successfully from real Sokrates data
- [ ] In-app graph navigation participates in Astro view transitions rather than forcing a hard reload
- [ ] Existing React Flow topology, visx charts, and AG Grid tables continue to build and work unchanged
- [ ] The same stack is documented as the future path for component dependency force graphs under ADR-0007 follow-up work
