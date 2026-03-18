# ADR-0006: Add Contributor Detail Routes and a Per-Contributor Export Contract

## Status

Accepted

## Context

`apps/site` already exposes two contributor-related views:

- the aggregate contributors page at `apps/site/src/pages/contributors.astro`
- the contributor topology graph at `apps/site/src/pages/topology.astro` and `apps/site/src/components/TopologyGraph.tsx`

The current contributor experience is useful but shallow. It tells us:

- who the contributors are
- how many commits they have made over coarse time windows
- who is connected to whom through shared-file activity

It does not yet support a rich contributor detail page. In particular, the site does not currently have:

- dynamic contributor routes
- a stable contributor detail URL from topology nodes or contributor tables
- a per-contributor daily activity export suitable for a calendar or heatmap
- a contributor-focused page combining activity, footprint, collaboration, and code context

The existing data flow matters here:

- contributor collection entries are keyed by email in `apps/site/src/loaders/planetnik-loader.ts`
- topology nodes also use contributor email as the React Flow node ID in `apps/site/src/components/TopologyGraph.tsx`
- the analyzer already computes global contributor time-slot summaries such as `contributorsPerDay` in `packages/analyzer/src/analysis/ContributorsAnalyzer.ts`
- the reports exporter currently writes only aggregate contributor files such as `contributors.txt`, `people_dependencies*.json`, and `contributor_timeline.json` from `packages/reports/src/exporters/DataExporter.ts`

That means contributor email is already the stable identity across the current system, but the export contract is not yet rich enough to power a meaningful per-person detail page with a commit heatmap.

## Decision

We will add dynamic contributor detail routes to `apps/site`, keyed by contributor email, and extend the report export contract to provide per-contributor detail data for a rich contributor page.

### Route identity

- Contributor detail pages will use email as the route identifier.
- The route shape will be `/contributors/[email]`.
- Links will use URL-encoded email values.
- Display name remains a presentation concern only and must not be treated as the canonical identifier.

### Navigation behavior

- Clicking a contributor node in the topology graph will navigate to that contributor’s detail page.
- Contributor names in tables and summary views should progressively link to the same route.
- Where navigation originates from a time-windowed topology view, the selected period may be passed as query context, but email remains the primary route key.

### Contributor page goal

The contributor detail page should become the richest contributor-centric view the current analysis pipeline can support. It should combine:

- identity and summary metrics
- commit activity visualizations
- collaborator relationships
- file and component footprint
- language or extension footprint
- structural signals derived from existing report data

### Heatmap requirement

We will use `@visx/heatmap` for a contributor activity heatmap, but we will not fake the data from aggregate counters.

The heatmap requires a new per-contributor export contract from the backend report pipeline. The site must not infer a per-day personal activity grid from aggregate contributor totals.

## Why this option

- It matches the stable identity already used across contributor data and topology graph nodes.
- It avoids collisions and rename instability that would come from name-based slugs.
- It makes topology click-through implementation trivial and reliable.
- It keeps route generation deterministic for Astro static builds.
- It acknowledges that the page quality depends on better data, not just better frontend composition.

## Alternatives Considered

### Use contributor name or username as the route slug

This would produce friendlier URLs.

We are not choosing it because contributor names and usernames are not guaranteed to be unique, stable, or even present. The current system is already keyed by email, so changing route identity would add slug-mapping complexity and collision handling with little architectural benefit.

### Build contributor detail pages from current aggregate exports only

This would allow a faster first page implementation.

We are not choosing it as the final architecture because it would block the heatmap and produce a weak detail page. We may still use current exports for an initial skeleton page, but the accepted design requires a richer per-contributor export contract.

### Keep contributor detail as a client-side modal instead of a route

This would avoid dynamic routes.

We are not choosing it because contributor detail is important enough to deserve a shareable, indexable URL. A route also composes better with topology navigation, future search results, and direct linking.

## Consequences

- `apps/site` will gain a dynamic contributor route and shared contributor-link helpers.
- `TopologyGraph.tsx` will need explicit node click behavior that maps node IDs to contributor URLs.
- The CLI/report export pipeline will need new per-contributor detail data, not just aggregate contributor summaries.
- The content collection layer will need a new contributor-detail loader and schema.
- Contributor detail will become a first-class information architecture concept in the Astro frontend.

## Non-goals

- No switch to name-based contributor route IDs
- No fake heatmap generated from coarse aggregate counters
- No server-side contributor API; data remains static-export driven
- No attempt to redesign all contributor-related pages in one step
- No requirement that every contributor page ship every possible visualization in the first iteration

## Related ADRs

- ADR-0003: Backend-Only Parity — Astro Frontend Replaces Java HTML Reports
- ADR-0005: Adopt Fuse.js for Site-Wide Search Backed by Astro Content Collections

## Implementation Plan

- **Affected paths**: `apps/site/src/pages/contributors.astro`, `apps/site/src/pages/contributors/[email].astro`, `apps/site/src/components/TopologyGraph.tsx`, `apps/site/src/lib/`, `apps/site/src/loaders/planetnik-loader.ts`, `apps/site/src/content.config.ts`, `packages/reports/src/exporters/DataExporter.ts`, `packages/analyzer/src/analysis/ContributorsAnalyzer.ts`
- Add a shared contributor route helper in `apps/site/src/lib/` that converts contributor email to a URL-safe contributor detail route.
- Update contributor list views and topology interactions to link to `/contributors/[email]`.
- Add a dynamic Astro route at `apps/site/src/pages/contributors/[email].astro`.
- Use the existing aggregate contributors export to build an initial detail page shell with summary data and linked collaboration context.
- Extend the exporter contract to emit per-contributor detail data files under the report `data/` folder.
- Ensure the per-contributor export includes enough information for:
  - daily activity heatmap bins
  - monthly or yearly trend bins
  - top files touched
  - extension or language footprint
  - strongest collaborators
- Add a new content collection loader and schema for contributor detail exports in the Astro site.
- Add a dedicated React chart component for contributor activity heatmaps using `@visx/heatmap`.
- Keep the contributor detail page build-time only; no runtime search or server fetch should be required beyond static assets already emitted by Astro.

## Verification

- [ ] Contributor detail pages are generated as static Astro routes under `/contributors/[email]`
- [ ] Contributor links resolve using email-based route identity rather than display name
- [ ] Clicking a topology node navigates to the correct contributor detail page
- [ ] The contributor detail page renders from exported data without requiring a backend API
- [ ] A per-contributor heatmap uses explicit per-day contributor activity data from the export contract
- [ ] The contributor detail page surfaces richer information than the aggregate contributors table alone
- [ ] Existing aggregate contributor pages continue to build and render after the new route and export additions
