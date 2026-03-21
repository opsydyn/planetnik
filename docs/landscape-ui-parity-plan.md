# Landscape UI Parity Plan

## Goal

Bring Planetnik's multi-repository `landscape` capability to Astro UI parity with the Sokrates/OpenAI landscape reports, starting from the existing backend analyzer and exporter work rather than re-implementing the Java-era rendering approach.

Reference example:

- https://d3axxy9bcycpv7.cloudfront.net/openai/_sokrates_landscape/index.html

## Current State

### Backend already exists

The landscape backend is real and usable today:

- analyzer model and aggregation:
  - [LandscapeInfo.ts](/Users/alan/Projects/planetnik/packages/analyzer/src/landscape/LandscapeInfo.ts)
  - [LandscapeAnalysisResults.ts](/Users/alan/Projects/planetnik/packages/analyzer/src/landscape/LandscapeAnalysisResults.ts)
  - [LandscapeAnalyzer.ts](/Users/alan/Projects/planetnik/packages/analyzer/src/landscape/LandscapeAnalyzer.ts)
  - [LandscapeConfiguration.ts](/Users/alan/Projects/planetnik/packages/analyzer/src/landscape/LandscapeConfiguration.ts)
- multi-repo CLI workflow:
  - [analyzeLandscape.ts](/Users/alan/Projects/planetnik/apps/cli/src/commands/analyzeLandscape.ts)
  - [updateLandscape.ts](/Users/alan/Projects/planetnik/apps/cli/src/commands/updateLandscape.ts)
- landscape config support:
  - [landscape-config.example.json](/Users/alan/Projects/planetnik/landscape-config.example.json)
- existing landscape data export:
  - [LandscapeDataExport.ts](/Users/alan/Projects/planetnik/packages/reports/src/landscape/data/LandscapeDataExport.ts)
  - [RepositoryExport.ts](/Users/alan/Projects/planetnik/packages/reports/src/landscape/data/RepositoryExport.ts)
  - [ContributorExport.ts](/Users/alan/Projects/planetnik/packages/reports/src/landscape/data/ContributorExport.ts)
  - [ContributorRepositoryInfoExport.ts](/Users/alan/Projects/planetnik/packages/reports/src/landscape/data/ContributorRepositoryInfoExport.ts)

### Astro UI does not exist yet

The Astro site currently has no landscape routes, no landscape loaders, and no landscape content collections.

There is no `/landscape` surface in:

- [apps/site/src](/Users/alan/Projects/planetnik/apps/site/src)

### The current site shell is single-repository-first

The existing Astro shell assumes one codebase report:

- one fixed nav tree in [Dashboard.astro](/Users/alan/Projects/planetnik/apps/site/src/layouts/Dashboard.astro)
- one data root from [planetnik-loader.ts](/Users/alan/Projects/planetnik/apps/site/src/loaders/planetnik-loader.ts)
- one primary analysis contract: `analysisResults.json`
- one page hierarchy rooted around:
  - files
  - units
  - contributors
  - quality views

There is currently no explicit concept of:

- `single-repository report`
- `landscape report`
- `sub-landscape report`

That distinction needs to become first-class before the UI parity work starts, otherwise landscape pages will be bolted onto a shell that still describes a single repository.

### Landscape output location is not normalized yet

The current CLI commands do not write landscape output to a consistent place:

- [analyzeLandscape.ts](/Users/alan/Projects/planetnik/apps/cli/src/commands/analyzeLandscape.ts) writes to:
  - `_planetnik_landscape/reports/data`
- [updateLandscape.ts](/Users/alan/Projects/planetnik/apps/cli/src/commands/updateLandscape.ts) writes to:
  - `_planetnik/reports/data`

That is a contract problem, not just a path detail. The Astro loader should not have to guess which mode it is in from directory conventions that differ by command.

### Legacy TS landscape report is much smaller than the parity target

The current TS landscape report generator is intentionally minimal:

- [LandscapeReportGenerator.ts](/Users/alan/Projects/planetnik/packages/reports/src/landscape/LandscapeReportGenerator.ts)

It gives:

- overview
- languages
- repositories
- contributors

It does not attempt parity with the richer Sokrates/OpenAI landscape UI.

## Existing Data vs UI Readiness

### Ready or close to ready

These tabs can be built with moderate normalization on top of current landscape exports:

1. `Overview`
   - source:
     - `landscapeAnalysisResults.json`
     - `repositories.json`
     - `contributors.json`
   - can support:
     - repository count
     - contributor count
     - LOC totals
     - language mix
     - first/latest commit

2. `Repositories`
   - source:
     - `repositories.json`
   - already includes:
     - main/test/other LOC
     - contributors
     - commit counts
     - 30d and 90d activity
     - latest commit

3. `Contributors`
   - source:
     - `contributors.json`
   - already includes:
     - contributor identity
     - repo membership
     - commit counts across multiple windows

4. `Teams`
   - source:
     - `teams.json`
     - `teamsConfig` in landscape configuration
   - enough for a first inventory view

### Partial: likely needs backend enrichment or contract reshaping

These features are partially represented in the backend, but not yet exported in a UI-friendly way:

1. `Tags`
   - current export writes tag-scoped repository TXT files
   - missing:
     - normalized tags summary JSON
     - tag counts
     - tag-to-repo matrix contract

2. `Team Topology`
   - current aggregate includes:
     - `peopleDependencies30Days`
     - `peopleDependencies90Days`
   - missing:
     - normalized landscape people/team topology contract
     - period strategy beyond 30/90
     - team-level aggregation contract

3. `Statistics`
   - raw aggregate data exists
   - missing:
     - normalized sectioned statistics contract for Astro
     - explicit trend series
     - correlation-specific data

### Missing or thin for OpenAI/Sokrates parity

These areas appear to need additional backend work before UI parity is credible:

1. repository history sparklines / commits per week
2. contributor trend series per repository
3. rookies/new-contributor counts by repo and time window
4. tags matrix
5. correlations
6. features of interest
7. animated history / racing charts
8. richer multi-period landscape topology

## Parity Map Already in Repo

The repo already contains an explicit parity note:

- [ASTRO_PARITY.md](/Users/alan/Projects/planetnik/packages/reports/src/landscape/ASTRO_PARITY.md)

Important takeaways from that file:

- landscape data models are already ported
- many report generators are explicitly marked `not ported`
- missing Astro targets already identified include:
  - `/landscape`
  - `/landscape/contributors`
  - `/landscape/contributors/[email]`
  - `/landscape/repositories`
  - `/landscape/repositories/tags`
  - `/landscape/repositories/tags-matrix`
  - landscape contributor summary
  - landscape people topology
- some utility and visual classes are also still not ported

So the gap is mostly not analyzer existence. The gap is:

1. normalized UI contracts
2. Astro route structure
3. higher-fidelity landscape visual components

## Recommended Architecture

### Keep landscape in the existing Astro site

Do not create a second frontend.

Recommended route namespace:

- `/landscape`
- `/landscape/repositories`
- `/landscape/repositories/tags`
- `/landscape/repositories/tags-matrix`
- `/landscape/contributors`
- `/landscape/contributors/[email]`
- `/landscape/teams`
- `/landscape/topology`
- `/landscape/statistics`

### Add an explicit report context contract

Before adding landscape pages, introduce a small top-level UI context export such as:

- `report_context.json`

Suggested shape:

- `mode`
  - `single_repository`
  - `landscape`
  - `sub_landscape`
- `title`
- `rootRoute`
- `dataVersion`
- `source`
  - `generateReports`
  - `analyzeLandscape`
  - `updateLandscape`
- `hasLandscape`
- `hasSingleRepositoryAnalysis`
- `primaryNavigation`
  - list of enabled route groups

This file should be the canonical way the Astro shell knows what kind of report it is rendering.

Do not make the site infer mode only from the presence or absence of:

- `analysisResults.json`
- `landscapeAnalysisResults.json`
- `repositories.json`

Presence-based inference is acceptable as a fallback, but not as the long-term contract.

### Make the loader mode-aware before page-aware

The loader layer should become intelligent first.

Add a small site context loader that:

1. reads `report_context.json` if present
2. falls back to safe inference for older exports
3. exposes a stable `reportMode` to Astro

Only after that should the page tree start branching between:

- single-repository content
- landscape content

This keeps the logic centralized instead of scattering "if landscape" checks throughout pages.

### Make the navigation hierarchy mode-aware

The current hierarchy is correct for a single repository but wrong for a landscape.

Recommended shell behavior:

1. `single_repository`
   - current nav stays as-is
   - root route remains `/`

2. `landscape`
   - root route should be `/landscape`
   - primary sections become:
     - overview
     - repositories
     - contributors
     - teams
     - team topology
     - tags
     - statistics
   - file/unit pages should not appear at top-level landscape nav

3. `sub_landscape`
   - same landscape-oriented shell
   - plus a clear parent/child hierarchy if `LandscapeInfo.subLandscapes` is present

This distinction should be visible in:

- page titles
- sidebar groups
- search scope labels
- breadcrumbs or "back to landscape" links

### Treat hierarchy as part of parity

UI parity is not only about charts and tables. It is also about making the content model legible.

For landscape, the hierarchy should read as:

1. organization or landscape overview
2. repositories / contributors / teams / tags
3. detail pages underneath those

For a single repository, the hierarchy should read as:

1. repository overview
2. files / units / contributors / quality
3. detail pages underneath those

This is a product requirement, not just navigation polish.

### Define parity as two shells, not one flattened menu

Landscape parity should not mean copying the single-repository sidebar verbatim onto the landscape root.

That would mix two different scopes:

- `landscape scope`
  - organization or portfolio questions
  - which repositories matter
  - who contributes where
  - which teams or tags cut across repositories
- `repository scope`
  - file, unit, component, contributor, and quality questions for one specific repo

The correct parity model is:

1. a `landscape shell` for multi-repository navigation
2. a `repository sub-shell` for repo-scoped drilldown that mirrors the existing single-repo structure

Recommended information architecture:

- `/landscape`
  - overview
  - repositories
  - contributors
  - teams
  - team topology
  - tags
- `/landscape/repositories/[repo]`
  - repository dashboard
  - source code overview
  - metrics
  - components
  - balanced coupling
  - dependencies
  - duplication
  - files/*
  - units/*
  - contributors
  - commits
  - topology
  - hotspots
  - impact
  - controls
  - trends

This keeps the root landscape mode honest while still delivering near-full single-repo parity once a user chooses a repository.

### Repository drilldown contract requirements

To support a repo-scoped shell cleanly, landscape exports must carry stable repository identity and pathing metadata.

Minimum backend requirements:

- each landscape repository entry has:
  - `repoKey`
  - `analysisResultsPath`
- each landscape contributor repository entry has:
  - `repoKey`
  - `analysisResultsPath`
- the site can resolve a selected repository's data root from the landscape data root

This avoids brittle display-name matching and makes URLs stable:

- `/landscape/repositories/[repo]`
- `/landscape/repositories/[repo]/contributors/[email]`

The repo-scoped shell should always expose:

- a clear `Back to landscape` affordance
- a repository title and breadcrumb
- repo-local search scope
- the same section ordering as the current single-repo UI where practical

### Normalize landscape data before UI work

Do not point Astro directly at the current mix of:

- `landscapeAnalysisResults.json`
- `repositories.json`
- `contributors.json`
- `teams.json`
- tag TXT exports

Instead, add a clean UI-facing export layer.

Suggested JSON contracts:

- `report_context.json`
- `landscape_overview.json`
- `landscape_repositories.json`
- `landscape_contributors.json`
- `landscape_teams.json`
- `landscape_tags.json`
- `landscape_tag_matrix.json`
- `landscape_topology.json`
- `landscape_statistics.json`

## Recommended Rollout Order

### Slice 1: backend contract audit and normalization

Create the new UI-facing JSON contracts from current landscape data.

Definition of done:

- output location is normalized across `analyzeLandscape` and `updateLandscape`
- `report_context.json` exists
- Astro can distinguish `single_repository` vs `landscape`
- repository inventory contract exists
- contributors contract exists
- teams contract exists
- overview contract exists
- exported under one consistent data root
- exporter tests lock the shapes down

### Slice 2: Astro shell and first routes

Build:

- mode-aware shell and navigation
- `/landscape`
- `/landscape/repositories`

This should be the first visible parity slice because it aligns with the reference UI and gives immediate value for org-level codebase inspection.

Definition of done:

- sidebar and page titles reflect report mode
- root route behavior is clear for landscape mode
- landscape navigation shell exists
- overview cards and language mix exist
- repository inventory exists
- search and filtering work

### Slice 3: repository drilldown shell

Build:

- `/landscape/repositories/[repo]`
- repo-scoped shell and navigation
- first repo-scoped detail routes using the existing single-repo data root under the landscape analysis root

Definition of done:

- repository rows link into repo drilldown
- a selected repository has a dedicated shell
- repo-local routes are stable and do not depend on global `PLANETNIK_DATA_DIR`
- `Back to landscape` navigation is clear
- at least the repo dashboard, contributors, and contributor detail work end-to-end

### Slice 4: contributors and teams

Build:

- `/landscape/contributors`
- `/landscape/contributors/[email]`
- `/landscape/teams`

Definition of done:

- contributor inventory
- contributor per-repo detail
- team inventory
- reusable contributor/team cards and trend blocks

### Slice 5: topology and tags

Build:

- `/landscape/topology`
- `/landscape/repositories/tags`
- `/landscape/repositories/tags-matrix`

Definition of done:

- people/team topology uses normalized topology data
- tags inventory exists
- tag matrix exists

### Slice 6: repo-scoped single-repo parity

Build repo-scoped equivalents of the single-repo surfaces under:

- `/landscape/repositories/[repo]/overview`
- `/landscape/repositories/[repo]/metrics`
- `/landscape/repositories/[repo]/components`
- `/landscape/repositories/[repo]/coupling`
- `/landscape/repositories/[repo]/dependencies`
- `/landscape/repositories/[repo]/duplication`
- `/landscape/repositories/[repo]/files/*`
- `/landscape/repositories/[repo]/units/*`
- `/landscape/repositories/[repo]/commits`
- `/landscape/repositories/[repo]/topology`
- `/landscape/repositories/[repo]/hotspots`
- `/landscape/repositories/[repo]/impact`
- `/landscape/repositories/[repo]/controls`
- `/landscape/repositories/[repo]/trends`

Definition of done:

- the repo-scoped shell feels like the current single-repo product, not a partial side quest
- contributor, topology, and quality drilldowns stay within the selected repository by default
- links between repo-scoped pages preserve the selected repo context

### Slice 7: advanced parity

Only after the above:

- statistics detail tabs
- correlations
- features of interest
- animated history
- racing charts

## First UI Slice Recommendation

The first UI slice should be:

1. `landscape_overview.json`
2. `landscape_repositories.json`
3. `/landscape`
4. `/landscape/repositories`

Why:

- the current backend already supports this best
- it matches the most useful part of the OpenAI example
- it proves the contract and routing strategy before more specialized tabs
- it sets up the repository drilldown seam without prematurely copying single-repo pages onto the landscape root

## Likely Backend Gaps To Address Early

These are the most important contract gaps to resolve before promising full parity:

1. add normalized tags JSON instead of tag-scoped TXT only
2. add topology JSON instead of relying on raw people dependency arrays
3. add repository trend/history series if we want sparkline parity
4. add rookie/new-contributor counts by repository and time window
5. add richer stats/correlation export if we want the later tabs

## Suggested Testing Strategy

Backend first:

- exporter unit tests for all new landscape JSON contracts
- CLI integration test for `analyzeLandscape`
- snapshot or fixture validation against a small multi-repo sample

Then Astro:

- loader tests for landscape collections
- route smoke tests for `/landscape` and `/landscape/repositories`
- link and drilldown tests for contributor/team navigation

## Recommendation

Landscape should be treated as the next major product surface.

The backend is already far enough along that this is not a speculative area. But UI parity requires a proper contract layer first. The clean move is:

1. normalize landscape exports
2. build the Astro landscape shell
3. ship overview + repositories first
4. add the repository drilldown shell
5. add contributors/teams
6. then topology/tags
7. then fill out repo-scoped single-repo parity

## ADR Threshold

This likely merits a focused ADR once we commit to:

- the route map
- the normalized landscape JSON contracts
- whether landscape lives inside the main Astro site or as a separate app mode
- whether repository drilldown reuses the existing single-repo pages directly or is implemented as a repo-scoped shell namespace

My recommendation is to keep it in the main site under `/landscape/*`.
