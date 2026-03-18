# Contributor Detail Checklist

Implementation checklist for ADR-0006.

## Phase 1: Export Contract First

- [ ] Define the per-contributor export shape before touching the contributor detail UI
- [ ] Keep contributor identity keyed by email throughout the export contract
- [ ] Decide the emitted file layout, for example:
  - `data/contributor_details/<encoded-email>.json`
  - or a single indexed `data/contributor_details.json`
- [ ] Prefer one file per contributor if payload size and Astro route generation remain reasonable
- [ ] Ensure the export shape is derived from analysis data, not frontend inference

## Phase 2: Analyzer and Exporter Data

- [ ] Audit what already exists in `ContributorsAnalyzer`
- [ ] Reuse existing contributor identity and period counters where possible
- [ ] Add or expose data required for a real contributor detail page:
  - daily activity bins for a heatmap
  - monthly and/or yearly activity bins
  - top files touched
  - components touched
  - concerns touched where available
  - extension or language footprint
  - strongest collaborators from people dependencies
- [ ] Keep the export bounded so one contributor cannot explode output size
- [ ] Add tests around the new export contract in `packages/reports` and, if needed, `packages/analyzer`

## Phase 3: Report Data Export

- [ ] Update `packages/reports/src/exporters/DataExporter.ts`
- [ ] Emit the new contributor detail data alongside existing contributor exports
- [ ] Preserve existing exports:
  - `contributors.txt`
  - `people_dependencies*.json`
  - `contributor_timeline.json`
- [ ] Ensure `generateReports` continues to complete when contributor detail export is enabled
- [ ] Verify the generated report `data/` folder contains contributor detail data after a fresh report run

## Phase 4: Astro Content Collection Wiring

- [ ] Add a contributor detail loader in `apps/site/src/loaders/planetnik-loader.ts`
- [ ] Add a `contributorDetails` collection in `apps/site/src/content.config.ts`
- [ ] Validate schema fields for the exported contributor detail shape
- [ ] Ensure the collection loads cleanly when contributor detail files are present
- [ ] Decide and document behavior when contributor detail exports are missing

## Phase 5: Route Helpers

- [ ] Add a shared helper in `apps/site/src/lib/` for contributor detail links
- [ ] Use `encodeURIComponent(email)` for the route segment
- [ ] Keep display name logic separate from route identity logic
- [ ] Add a matching decode path for dynamic route lookup

## Phase 6: Dynamic Contributor Route

- [ ] Create `apps/site/src/pages/contributors/[email].astro`
- [ ] Use `getStaticPaths()` to generate one page per exported contributor
- [ ] Build a detail page shell with:
  - contributor name/email
  - summary stats
  - first and last commit
  - active/rookie indicators
- [ ] Fail clearly if the route param does not resolve to contributor data

## Phase 7: Navigation Integration

- [ ] Link contributor names from the aggregate contributors table to the detail route
- [ ] Link contributor names from collaboration or strongest-connection tables to the detail route
- [ ] Update `TopologyGraph.tsx` so clicking a node navigates to the contributor detail page
- [ ] Optionally preserve topology period as query context

## Phase 8: Contributor Visualizations

- [ ] Create a contributor heatmap component using `@visx/heatmap`
- [ ] Drive the heatmap only from explicit per-day contributor activity bins
- [ ] Add at least one additional contributor-focused chart:
  - monthly activity trend
  - extension footprint
  - collaborator strength
- [ ] Keep visualizations responsive in the existing dashboard shell

## Phase 9: Rich Detail Sections

- [ ] Add files touched summary
- [ ] Add component footprint summary
- [ ] Add concern footprint summary when data exists
- [ ] Add strongest collaborators section
- [ ] Add extension or language footprint section
- [ ] Ensure the detail page is materially richer than the aggregate contributors table

## Phase 10: Verification

- [ ] Run report generation and inspect exported contributor detail files
- [ ] Run `bun run --filter site build`
- [ ] Verify `/contributors/[email]` routes are statically generated
- [ ] Verify links from aggregate contributor views work
- [ ] Verify topology node click-through works
- [ ] Verify the heatmap reflects exported per-day activity rather than inferred totals
- [ ] Verify pages still build when contributor detail data is absent or partial

## Phase 11: Deferred Follow-ups

- [ ] Add contributor pages to site search results
- [ ] Add contributor detail breadcrumbs back to aggregate views
- [ ] Add period switching on contributor detail pages if the export contract supports it cleanly
- [ ] Consider contributor-to-contributor comparison pages only after the single-person route is stable
