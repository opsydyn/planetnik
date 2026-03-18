# ADR-0005: Adopt Fuse.js for Site-Wide Search Backed by Astro Content Collections

## Status

Accepted

## Context

`apps/site` now exposes a growing set of report pages under a shared dashboard shell:

- overview pages such as `/`, `/overview`, `/metrics`, and `/about`
- structural report pages such as `/components`, `/dependencies`, and `/duplication`
- file and unit analysis pages such as `/files/size` and `/units/complexity`
- contributor and topology pages such as `/contributors`, `/commits`, and `/topology`

The frontend is static Astro with a small number of React islands. Report data already enters the site through Astro content collections defined in `apps/site/src/content.config.ts` and populated by custom loaders in `apps/site/src/loaders/planetnik-loader.ts`.

That means the site already has a build-time, normalized data layer for:

- report metadata
- files
- units
- contributors
- metrics
- extension summaries

What it does not have is a site-wide search experience. As the number of pages and report entities grows, navigation alone will not be enough. Users need a fast way to jump to:

- pages
- files
- units
- contributors
- important metrics
- major language or extension views

The search experience must work well for static hosting, avoid introducing a server dependency, and stay aligned with Astro's content-first architecture rather than scraping rendered HTML.

## Decision

We will implement site-wide search in `apps/site` using `fuse.js`, with the search corpus generated from Astro content collections at build time.

### Core design

- Use Astro content collections as the source of truth for searchable documents.
- Generate a compact, normalized search document list during the site build.
- Expose that search payload through a static JSON endpoint in the Astro app.
- Load the search payload lazily in a small React search island mounted from the shared dashboard layout.
- Use Fuse.js in the browser for fuzzy ranking, result grouping, and match highlighting.

### Initial searchable entities

- dashboard and report pages
- main files
- units
- contributors
- metrics
- language or extension summary entries

### Initial exclusions

- raw duplicate blocks
- dependency edge rows
- temporal dependency rows
- people dependency edges

These collections are either noisier or materially larger relative to their user value in a first search release. They can be added later once the first search experience is proven useful.

### Why this option

- It works with static Astro hosting and does not require a separate search service.
- It reuses the site's existing content collection layer instead of duplicating a parallel indexing system.
- Fuse.js is a good fit for fuzzy matching across compact in-browser datasets.
- It keeps the first implementation small and reversible.
- It leaves room for later refinement such as prebuilt Fuse indexes, entity filters, and richer result ranking without changing the core architecture.

## Alternatives Considered

### Build search from rendered HTML pages

This would avoid defining a search document model.

We are not choosing it because rendered HTML is the wrong abstraction level for this app. It is harder to rank well, harder to control field weighting, and duplicates information already available in Astro collections.

### Add a server-side or third-party hosted search service

This could support larger datasets and more advanced ranking.

We are not choosing it because the current site is static, the dataset is still moderate, and introducing operational infrastructure would be disproportionate to the problem.

### Use plain substring search over JSON without Fuse.js

This would reduce dependencies and implementation complexity.

We are not choosing it because the search needs fuzzy matching, relevance weighting, and match metadata for highlighting. Fuse.js provides that with a well-understood API and small integration surface.

## Consequences

- `apps/site` will gain a new dependency on `fuse.js`.
- Search results will be based on a normalized document model rather than page-specific UI markup.
- Search relevance will become a product surface that requires iteration rather than a one-off utility.
- The first implementation should keep the indexed dataset compact enough to lazy-load without noticeably affecting page startup.
- Future report pages should be evaluated for whether they need explicit search documents when they are added.

## Non-goals

- No server-side search endpoint or persistent search backend
- No full-text indexing of rendered HTML blobs
- No indexing of every low-level report row in the first release
- No automatic search over duplicate block bodies, dependency edges, or topology graph edges in v1
- No replacement of normal navigation; search augments the dashboard rather than redefining the IA

## Related ADRs

- ADR-0003: Backend-Only Parity — Astro Frontend Replaces Java HTML Reports

## Implementation Plan

- **Affected paths**: `apps/site/package.json`, `apps/site/src/layouts/Dashboard.astro`, `apps/site/src/content.config.ts`, `apps/site/src/lib/search/`, `apps/site/src/components/search/`, `apps/site/src/pages/search-index.json.ts`
- Add `fuse.js` to `apps/site` and keep search isolated to the Astro frontend.
- Create a normalized search document type under `apps/site/src/lib/search/` with fields such as `id`, `kind`, `title`, `subtitle`, `description`, `keywords`, `route`, `section`, and `rank`.
- Build search documents from `getCollection()` and `getEntry()` calls rather than from rendered page HTML.
- Add a search document builder that includes the initial entity set only: pages, main files, units, contributors, metrics, and extension summaries.
- Add a static JSON endpoint at `apps/site/src/pages/search-index.json.ts` that emits the search documents and, if helpful, a prebuilt Fuse index.
- Add a small React island under `apps/site/src/components/search/` to handle keyboard shortcut activation, lazy loading of the search payload, query input, fuzzy matching, grouped result rendering, and direct navigation.
- Mount the search trigger and dialog from `apps/site/src/layouts/Dashboard.astro` so the experience is available on every report page.
- Keep the first UI deliberately narrow: one global entry point, one input, grouped results, and keyboard-friendly navigation.
- Add explicit weighting for important fields such as `title` and `keywords`, and keep lower-value fields such as `route` at low weight.
- Defer large or noisy entity types until relevance and payload size are validated on the first release.

## Verification

- [ ] `apps/site` installs and builds after adding `fuse.js`
- [ ] Search is reachable from every dashboard page through a shared UI entry point
- [ ] The search payload is generated from Astro content collections rather than scraped HTML
- [ ] Searching returns relevant matches for pages, files, units, contributors, metrics, and extension summaries
- [ ] Search payload loading is lazy and does not block initial page rendering
- [ ] Result selection navigates correctly to the destination route
- [ ] The first implementation does not index duplicate blocks, dependency rows, temporal dependency rows, or people dependency edges
