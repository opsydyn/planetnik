# ADR-0011: Adopt a Repo-Scoped Shell for Landscape Drilldown

## Status

Proposed

## Context

Planetnik now supports both:

- `single_repository` reports
- `landscape` reports

The landscape backend already exports normalized multi-repository contracts and the Astro site can render landscape pages such as:

- [landscape/index.astro](/Users/alan/Projects/planetnik/apps/site/src/pages/landscape/index.astro)
- [landscape/repositories.astro](/Users/alan/Projects/planetnik/apps/site/src/pages/landscape/repositories.astro)
- [landscape/contributors.astro](/Users/alan/Projects/planetnik/apps/site/src/pages/landscape/contributors.astro)
- [landscape/teams.astro](/Users/alan/Projects/planetnik/apps/site/src/pages/landscape/teams.astro)
- [landscape/topology.astro](/Users/alan/Projects/planetnik/apps/site/src/pages/landscape/topology.astro)
- [landscape/tags.astro](/Users/alan/Projects/planetnik/apps/site/src/pages/landscape/tags.astro)

The current single-repository shell in [Dashboard.astro](/Users/alan/Projects/planetnik/apps/site/src/layouts/Dashboard.astro) is intentionally organized around one repository:

- overview
- structure
- files
- units
- team
- quality

The user requirement is to reach single-repository parity while working from a landscape report. In practice, this means:

- starting from a landscape-wide view
- choosing a repository
- drilling into repository-specific views such as metrics, files, units, contributors, topology, hotspots, impact, and controls

This creates an architecture decision:

1. flatten the existing single-repository sidebar into the landscape root
2. keep a distinct landscape root and add a repo-scoped shell underneath it

Flattening the single-repository menu onto the landscape root would mix different scopes:

- landscape scope:
  - organizations
  - repositories
  - teams
  - cross-repository contributors
  - cross-repository topology
- repository scope:
  - file, unit, component, and quality detail for one selected repo

The current backend and route model already point toward the second option:

- landscape repository entries carry stable identity and analysis paths
- landscape contributor entries carry repo-scoped references
- drilldown routes already exist or are feasible under `/landscape/repositories/[repo]/*`

This is now worth capturing as an ADR because:

- it defines the information architecture for the multi-repository product surface
- it will shape the route namespace and layout structure
- it affects loader behavior, navigation, search scope, breadcrumbs, and drilldown links
- it is harder to reverse once repo-scoped routes and links are spread through the site

## Decision

We will implement landscape parity as a two-shell model:

1. a `landscape shell` for multi-repository navigation
2. a `repo-scoped shell` for repository drilldown that mirrors the existing single-repository product structure

### Core policy

- The landscape root must remain landscape-oriented.
- Single-repository sections must not be copied wholesale onto the landscape root sidebar.
- Repository-specific parity must live under `/landscape/repositories/[repo]/*`.
- Repo-scoped pages should follow the same section ordering and mental model as the existing single-repository UI where practical.
- Landscape drilldown links must preserve repository context explicitly through stable route params, not inferred display-name matching.
- Repo-scoped pages must provide a clear return path back to the landscape shell.

### Route model

Landscape shell:

- `/landscape`
- `/landscape/repositories`
- `/landscape/contributors`
- `/landscape/teams`
- `/landscape/topology`
- `/landscape/tags`

Repo-scoped shell:

- `/landscape/repositories/[repo]`
- `/landscape/repositories/[repo]/overview`
- `/landscape/repositories/[repo]/metrics`
- `/landscape/repositories/[repo]/components`
- `/landscape/repositories/[repo]/coupling`
- `/landscape/repositories/[repo]/dependencies`
- `/landscape/repositories/[repo]/duplication`
- `/landscape/repositories/[repo]/files/*`
- `/landscape/repositories/[repo]/units/*`
- `/landscape/repositories/[repo]/contributors`
- `/landscape/repositories/[repo]/contributors/[email]`
- `/landscape/repositories/[repo]/commits`
- `/landscape/repositories/[repo]/topology`
- `/landscape/repositories/[repo]/hotspots`
- `/landscape/repositories/[repo]/impact`
- `/landscape/repositories/[repo]/controls`
- `/landscape/repositories/[repo]/trends`

### Navigation policy

- `reportMode === "landscape"` determines the top-level shell.
- The landscape root sidebar must expose only landscape-wide concepts.
- Entering a repository drilldown route switches the page to a repo-scoped navigation model.
- Repo-scoped navigation must visibly indicate:
  - selected repository
  - current repository route
  - back link to the landscape root or repository inventory

### Search policy

- Landscape root search should prioritize landscape pages and cross-repository entities.
- Repo-scoped pages should search within the selected repository scope when practical.
- Search results from repo-scoped pages must preserve repository context in their URLs.

## Why this option

- It respects the difference between multi-repository questions and single-repository questions.
- It avoids misleading users with file/unit/quality sections at landscape root where no true landscape equivalent exists yet.
- It matches how Sokrates-style drilldown actually works: broad landscape first, then repository detail.
- It aligns with the current backend contracts, which already expose stable repository identity and per-repo analysis paths.
- It gives us a clean expansion path to near-full single-repository parity without inventing fake landscape-level pages for everything.
- It keeps the navigation model legible for both humans and coding agents.

## Alternatives Considered

### Flatten the single-repository menu onto the landscape root

This would make the landscape sidebar look more like the existing single-repository sidebar immediately.

We are not choosing it because:

- it confuses landscape scope with repository scope
- many single-repository sections do not yet have meaningful landscape-level equivalents
- it would either create dead ends or force placeholder pages
- it would make the sidebar larger and less legible

### Keep a minimal landscape root and deep-link straight into the existing single-repo routes

This would reuse more of the current route tree directly.

We are not choosing it because the current single-repo routes assume the global report root, not a selected repository nested under a landscape analysis root. That would lead to brittle data-root switching and ambiguous navigation.

### Create a separate frontend for landscape drilldown

This would isolate landscape behavior from single-repository behavior.

We are not choosing it because we already have a shared Astro shell, shared components, and shared report context model. A second frontend would duplicate work and split product behavior unnecessarily.

## Consequences

- The site will have two explicit navigation shells instead of one overloaded shell.
- The route namespace under `/landscape/repositories/[repo]/*` will become a first-class product surface.
- Some current single-repo pages will need repo-scoped counterparts or a shared implementation that can resolve repository-local data roots.
- Loader and helper code will need to resolve both:
  - landscape data root
  - selected repository data root
- Breadcrumbs, search, and link helpers will become more important because repository context must be preserved consistently.
- The resulting information architecture will be cleaner and easier to extend than a flat landscape root menu.

## Non-goals

- No attempt to create landscape-level equivalents for every single-repository page immediately
- No second frontend application for landscape mode
- No flattening of file/unit/quality sections onto the landscape root
- No requirement that the first repo-scoped shell reach full single-repo parity in one change
- No change to the underlying analyzer semantics as part of this ADR

## Related ADRs

- ADR-0003: Backend-only parity, Astro frontend
- ADR-0010: Adopt Effect structured concurrency for landscape analysis

## Implementation Plan

- **Affected paths**:
  - [Dashboard.astro](/Users/alan/Projects/planetnik/apps/site/src/layouts/Dashboard.astro)
  - [planetnik-loader.ts](/Users/alan/Projects/planetnik/apps/site/src/loaders/planetnik-loader.ts)
  - [content.config.ts](/Users/alan/Projects/planetnik/apps/site/src/content.config.ts)
  - [landscape.ts](/Users/alan/Projects/planetnik/apps/site/src/lib/landscape.ts)
  - landscape root routes under [apps/site/src/pages/landscape](/Users/alan/Projects/planetnik/apps/site/src/pages/landscape)
  - new repo-scoped routes under [apps/site/src/pages/landscape/repositories](/Users/alan/Projects/planetnik/apps/site/src/pages/landscape/repositories)
  - search helpers under [apps/site/src/lib/search](/Users/alan/Projects/planetnik/apps/site/src/lib/search)

- Keep the current landscape root shell limited to:
  - overview
  - repositories
  - contributors
  - teams
  - topology
  - tags

- Introduce a repo-scoped layout or layout mode for `/landscape/repositories/[repo]/*`.
  - it must render repository title and breadcrumb
  - it must expose a `Back to landscape` path
  - it must use repo-scoped navigation groups that mirror the single-repo shell

- Standardize route helpers in [landscape.ts](/Users/alan/Projects/planetnik/apps/site/src/lib/landscape.ts).
  - repository href generation
  - contributor href generation
  - repo contributor href generation
  - repo key encoding and decoding
  - repo-local data dir resolution

- Make repo-scoped pages resolve their data from the selected repo directory under the landscape analysis root, not from the global `PLANETNIK_DATA_DIR` alone.

- Start repo-scoped parity with the highest-value routes:
  - repository dashboard
  - contributors
  - contributor detail
  - topology
  - hotspots / impact once repo-local data loading is reusable

- Reuse single-repo page components where practical, but do not force page-level reuse if it makes context handling opaque.

- Update search indexing to distinguish:
  - landscape entities
  - repo-scoped pages

- Keep repo-scoped URLs stable and explicit.
  - no repo lookup by display label
  - no hidden global data-root switching

## Verification

- [ ] Landscape root sidebar shows only landscape-wide sections
- [ ] Repository rows link into `/landscape/repositories/[repo]`
- [ ] Repo-scoped pages display a clear selected-repository context
- [ ] Repo-scoped contributor routes work under `/landscape/repositories/[repo]/contributors/[email]`
- [ ] Repo-scoped links preserve repository context rather than jumping back to single-repository root routes
- [ ] Landscape root search and repo-scoped search do not generate ambiguous URLs
- [ ] Users can navigate from landscape root to repository detail and back without losing context
- [ ] At least one repository can reach parity for dashboard, contributors, contributor detail, and topology through the repo-scoped shell

## References

- [Landscape UI Parity Plan](/Users/alan/Projects/planetnik/docs/landscape-ui-parity-plan.md)
- [landscape-config.example.json](/Users/alan/Projects/planetnik/landscape-config.example.json)
