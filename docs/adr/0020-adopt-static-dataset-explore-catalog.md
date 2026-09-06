# ADR-0020: Adopt a Static Dataset Catalogue and URL-Addressable Explore Surface

## Status

Accepted — catalogue and dataset-aware report reader slice shipped 2026-09-04;
shell switcher and wider route parity remain in progress

## Date

2026-09-04

## Decision-makers

Planetnik maintainers

## Consulted

Existing static-site, canonical-snapshot, and Code City design work

## Informed

Future hosted-app and dataset-curation maintainers

## Context and Problem Statement

`apps/site` currently resolves one dataset at process/build startup through
`PLANETNIK_DATASET`, `PLANETNIK_DATA_DIR`, or the landscape equivalent. That
keeps the report deterministic, but it makes the public site feel like one
report rather than a place to explore a set of useful codebases. A Sokrates-
style gallery of examples, an in-site dataset switcher, and a diverse set of
open-source landscapes all need a stable catalogue and a shareable selection
boundary.

The problem is not solved safely by changing an environment variable in the
browser. A static GitHub Pages build cannot analyse an arbitrary repository at
runtime, and a query-string-only switcher would still leave the server-side
Astro content collections bound to one build-time dataset. Runtime cloning or
HTML/TXT reconstruction would also violate the canonical v2 JSON boundary
established by [ADR-0018](./0018-adopt-versioned-canonical-analysis-snapshots.md).

The first release must therefore make several already-generated snapshots
discoverable without turning the static product into a server-dependent
application. It must also leave the existing top-level report routes and the
future hosted split in place.

## Decision Drivers

- Keep `apps/site` static, deterministic, and deployable to GitHub Pages.
- Treat v2 canonical JSON snapshots as the only analytical input.
- Make dataset selection URL-addressable and safe to share or reload.
- Preserve existing top-level routes and the current environment-selected
  local development workflow.
- Separate editorial curation from snapshot facts without creating a second
  analytical source of truth.
- Support both `single_repository` and `landscape` snapshots with explicit
  capability and partial-data states.
- Make the selection flow keyboard-accessible, mobile-usable, and auditable.
- Give a future hosted app a reusable catalogue and dataset identity contract
  without sharing Astro page files or static loaders.

## Considered Options

1. Static catalogue plus explicit dataset routes and a dataset-aware loader
2. Keep one dataset per build and expose environment/rebuild instructions
3. Fetch or clone arbitrary repositories in the browser
4. Host each report separately and link or embed the reports from a gallery

## Decision Outcome

Chosen option: **static catalogue plus explicit dataset routes and a
dataset-aware loader**.

Planetnik will add a `DatasetCatalog` read model and a dedicated
`/explore` surface to the static site. The catalogue is generated at build time
from a tracked curation manifest plus validated v2 JSON snapshots found under
the configured dataset root. It contains stable dataset identity, presentation
metadata, provenance, headline statistics, language summaries, and advertised
capabilities. It never replaces `report_context.json` or the canonical domain
shards.

The first route namespace is:

```text
/planetnik/explore
/planetnik/datasets/<dataset-id>/
/planetnik/datasets/<dataset-id>/overview
/planetnik/datasets/<dataset-id>/code-city
/planetnik/datasets/<dataset-id>/landscape
```

`<dataset-id>` is an opaque, URL-safe catalogue identifier. It is not a
filesystem path, repository URL, or user-provided path fragment. A route
resolves it through a validated `DatasetHandle`, then passes the selected
snapshot to the existing view model and visualisation boundaries.

The current top-level `/`, `/overview`, `/code-city`, and other report routes
remain compatibility aliases for the default environment-selected dataset.
The new dataset namespace is the path used by Explore links and by the
dataset switcher.

### Catalogue boundary

The catalogue contract is versioned independently from report data:

```text
catalogVersion: 1
DatasetDescriptor {
  id / slug
  title
  mode: single_repository | landscape
  snapshot?: { snapshotId, dataVersion, generatedAt }
  provenance: { sourceUrl?, sourceRef?, licence?, capturedAt? }
  description
  stats: { repositories?, files?, loc?, units?, contributors?, commits?, dependencies? }
  languages: [{ key, label, loc, share }]
  capabilities
  tags
  curation: { featured, shelf, order }
  availability: ready | partial | planned | invalid
}
```

`ready` and `partial` entries require a validated local snapshot. `planned`
entries may omit `snapshot` because they are editorial recommendations with no fabricated metrics;
they may appear in a clearly labelled “coming soon” shelf but cannot be
opened as reports. `invalid` entries are build diagnostics and are not shown
in the public catalogue.

Editorial metadata is stored in a tracked curation input such as
`apps/site/src/data/dataset-catalog.json`. Snapshot facts are read from the
selected dataset's v2 JSON. Absolute local paths are build-only implementation
details and never enter the descriptor sent to the browser or written into
static HTML.

### Static build and loader boundary

The site will introduce the following adapter flow:

```text
catalog entry → DatasetHandle → ReportSnapshotReader → existing view model → view
```

The initial implementation migrates Explore, `overview`, and `code-city` to
the explicit handle. The current `resolveDataDir()` and content-collection
loaders remain available for compatibility while the remaining report and
landscape routes migrate incrementally. Static builds enumerate valid entries
and pre-render their routes; the browser performs only local catalogue search,
filtering, and sorting.

The report shell receives the active dataset identity and current lens. When a
user changes datasets, the switcher maps the current lens to the target's
advertised capabilities. If the lens is unavailable, it opens the target's
landing page with an explicit explanation rather than inventing a view.

### Curated sample strategy

The catalogue will recommend a deliberately varied set of public repositories
and organisation landscapes, but a recommendation is not a verified report.
Every selectable sample must pass these gates:

- public source URL and pinned ref or commit;
- compatible licence and attribution metadata;
- reproducible analysis with a v2 `report_context.json`;
- representative language, scale, domain, and topology value;
- no private, sensitive, generated-secret, or unbounded dependency input;
- recorded analysis date and snapshot identity.

Initial candidate repositories for the curation manifest are:

| Candidate | Diversity value | Intended use |
| --- | --- | --- |
| `openai/openai-python` | Focused, production Python SDK with a clear public API | Python onboarding and repository Code City |
| `fastapi/fastapi` | Python framework with recognisable application boundaries | Python structure and health |
| `pallets/flask` | Smaller, mature Python framework useful for a readable baseline | Onboarding and comparison |
| `tokio-rs/tokio` | Rust async runtime with distinctive modules and ownership pressure | Rust parser and dependency showcase |
| `effect-ts/effect` | TypeScript monorepo with packages and explicit functional boundaries | Monorepo/component showcase |
| `microsoft/vscode` | Large TypeScript application with extension and platform structure | Dense-scene and LOD stress case |
| `huggingface/transformers` | Large, domain-heavy Python project with broad model surface | AI-domain landscape and stress case |
| `kubernetes/kubernetes` | Very large Go platform repository with operational topology | Large-scale LOD and landscape stress case |

Organisation-landscape candidates inspired by the Sokrates examples include
OpenAI, Hugging Face, JetBrains, Mozilla, and Google Gemini. They remain
`planned` until a bounded repository set, licence/provenance record, and
successful v2 export exist. The first public gallery should mix small,
medium, and large examples rather than displaying only famous, oversized
projects.

### Local showcase slice (2026-09-04)

The first repository showcase slice is now materialised under the local
`datasets/` root. It includes all eight repository candidates above: OpenAI
Python, FastAPI, Flask, Tokio, Effect, Visual Studio Code, Hugging Face
Transformers, and Kubernetes. Each entry records the exact fetched default-
branch commit, capture date, source URL, and licence in the curation manifest;
the generated v2 `report_context.json` and canonical shards are the source of
the displayed metrics and capabilities.

Kubernetes is a valid canonical v2 snapshot, but its duplication analysis was
disabled on the bounded retry after the full-scale duplication merge exceeded
available memory. That omission is explicit scale evidence for the later
bounded-concurrency/large-repository work; it does not affect its Overview or
Code City routes.

## Consequences

### Positive

- Users can browse and share a dataset without editing environment variables
  or rebuilding the site.
- The catalogue gives Sokrates-style headline context while preserving exact
  snapshot identity and evidence links.
- The static product remains deterministic and does not need a server, token,
  repository clone, or browser-side analysis runtime.
- Dataset identity is explicit enough for future hosted ingestion and
  longitudinal work without coupling hosted code to Astro pages.
- Curation can express diversity and recommendations without fabricating
  metrics for datasets that have not yet been analysed.
- Existing single-dataset links keep working during incremental migration.

### Costs and risks

- A genuine multi-dataset static build requires an explicit loader seam and
  route-aware page generation; the current one-dataset content collections
  cannot simply be reused unchanged.
- Every additional snapshot increases build time and static output size. The
  catalogue must stay small, and report shards must be loaded only for routes
  that need them.
- Curated examples need periodic refresh, licence/provenance review, and a
  policy for stale snapshots.
- Partial capabilities create more visible states that must be tested; this
  is preferable to silently displaying invented zero values.
- Very large candidates such as VS Code or Kubernetes may require measured
  LOD or fallback thresholds before they become default featured cards.

## Non-goals

- Runtime repository cloning, arbitrary GitHub URL analysis, or authenticated
  user uploads.
- Replacing the current report shell or removing the environment-selected
  compatibility routes.
- A database, hosted persistence, saved collections, or per-user curation.
- Trends between datasets; trends remain a same-repository snapshot problem.
- Making every historical route multi-dataset in the first implementation.
- Adding a new canonical analytical shard solely to populate a card.
- Parsing TXT, HTML, or rendered report output to build catalogue statistics.
- Automatically analysing or publishing every repository in a recommended
  organisation.

## Related ADRs and Evidence

- [ADR-0001: Effect TS with Bun runtime](./0001-effect-ts-with-bun-runtime.md)
- [ADR-0003: Backend-only parity with Astro frontend](./0003-backend-only-parity-astro-frontend.md)
- [ADR-0005: Fuse.js site-wide search](./0005-adopt-fusejs-for-site-wide-search.md)
- [ADR-0011: Repo-scoped shell for landscape drilldown](./0011-adopt-repo-scoped-shell-for-landscape-drilldown.md)
- [ADR-0015: Separate static reports and hosted runtime](./0015-adopt-separate-static-reports-and-hosted-runtime-for-intelligence.md)
- [ADR-0018: Versioned canonical analysis snapshots](./0018-adopt-versioned-canonical-analysis-snapshots.md)
- [ADR-0019: Repo-scoped WebGL Code City](./0019-adopt-code-city-webgl-decision-surface.md)
- [Explore datasets design specification](../superpowers/specs/2026-09-04-explore-datasets-design.md)
- [Product roadmap](../product-roadmap.md)
- [Sokrates examples](https://www.sokrates.dev/)

## Implementation Plan

1. Add shared catalogue types and validation under
   `packages/common/src/dataset-catalog/`, including `DatasetId`,
   `DatasetDescriptor`, `DatasetCatalog`, `catalogVersion: 1`, availability
   states, and safe URL/id parsing. Update the package barrel exports.
2. Add the tracked curation input at
   `apps/site/src/data/dataset-catalog.json`. Keep source URLs, pinned refs,
   licences, descriptions, shelves, and featured order there; never put
   derived LOC, contributor, or commit numbers there.
3. Add a build-time catalogue reader/generator under
   `apps/site/src/lib/datasets/`. It should scan the configured dataset root
   through `getDatasetCandidateDirs`, validate each v2 manifest using the
   existing loader rules, read only canonical JSON shards, and produce a
   descriptor plus diagnostics. It must not read TXT or HTML files.
4. Introduce an explicit dataset reader/handle in
   `apps/site/src/loaders/planetnik-loader.ts` or a neighbouring
   `apps/site/src/lib/datasets/reportReader.ts`. Preserve `resolveDataDir()`
   and the current content-collection loaders as compatibility paths while
   allowing a route to load a named dataset without mutating process env.
5. Add `apps/site/src/layouts/ExploreLayout.astro`,
   `apps/site/src/pages/explore.astro`, and dataset catalogue components under
   `apps/site/src/components/datasets/`. Server-render the cards and hydrate
   only the search/filter/sort island. Add a full-page preview fallback for
   users who do not run client JavaScript.
6. Add dynamic dataset routes under
   `apps/site/src/pages/datasets/[datasetId]/` for the landing page,
   `overview`, and `code-city`. Use `getStaticPaths` from the validated
   catalogue, pass `DatasetHandle` into the existing view-model builders, and
   use `route()` for the `/planetnik` base path.
7. Extend `Dashboard.astro` and the report shell with an “Explore datasets”
   link, active dataset identity, and a lens-preserving switcher. Use the
   existing graph-route reload policy where hard reloads are required.
8. Add build/deploy packaging in `.github/workflows/deploy.yml` only after
   the local multi-dataset build works. Materialise the curated dataset set,
   run the v2 validation gate, and build one static artifact; do not embed
   tokens or absolute workstation paths.
9. Add focused tests in
   `packages/common/src/dataset-catalog/__tests__/`,
   `apps/site/src/lib/__tests__/datasetCatalog.test.ts`,
   `apps/site/src/lib/__tests__/datasetRoutes.test.ts`, and
   `apps/site/src/lib/__tests__/planetnik-loader.test.ts`. Extend the existing
   static build and Code City route checks with Python, complete, partial, and
   invalid fixtures.
10. Curate the first verified set from the candidate list only after each
    snapshot has a recorded source/ref/licence, v2 manifest, generated date,
    and direct browser smoke evidence. Keep unanalysed recommendations in the
    `planned` state.

### Delivered slice — dataset-aware report reader (2026-09-04)

- `apps/site/src/lib/datasets/reportReader.ts` reads a named dataset through
  its validated v2 `report_context.json` and canonical shard map without
  mutating `PLANETNIK_DATASET`.
- Ready and partial catalogue entries now pre-render real
  `/datasets/<id>/overview` and `/datasets/<id>/code-city` routes. Planned
  entries remain detail-only and do not receive invented report links.
- Overview reads summary, file, metric, and unit evidence from the selected
  snapshot. Code City uses the shared `CodeCityModel` and preserves the
  existing partial/empty/invalid route states.
- Code City evidence links now land on dataset-scoped canonical evidence
  readers (for example `files/churn`, `units/complexity`, `components`, and
  `impact`) instead of pointing at the environment-selected report.
- Explore card actions now follow the selected audience to the corresponding
  dataset-scoped report view; snapshot detail remains the progressive fallback.
- The static site build produced the original fixture routes plus eight local
  repository showcase routes (130 pages total). Port 4321 hard-load checks
  returned 200 for every selected repository's Overview, Code City, and one
  canonical evidence route after restarting the dev server; an unanalysed
  organisation landscape still correctly returns 404 for report routes.
- Direct pointer, WebGL, and visual browser evidence for these new dataset
  routes remains open because the current CUA browser surface is unavailable.

### Dependencies and configuration

- No new runtime dependency is required. Use the existing Bun filesystem,
  JSON helpers, Effect/schema conventions, Astro static paths, and report-ui
  primitives.
- Keep `PLANETNIK_DATASETS_ROOT`, `PLANETNIK_DATASET`,
  `PLANETNIK_DATA_DIR`, and `PLANETNIK_LANDSCAPE_DATA_DIR` unchanged. They
  select the compatibility/default dataset; the catalogue reader receives a
  validated named dataset at build time.
- Do not add a browser API, server endpoint, or GitHub token requirement for
  Explore.

### Patterns to follow

- Reuse `getDatasetCandidateDirs`, `isRecognizedDataDir`, and the v2 manifest
  validation rules in `apps/site/src/lib/dataDirectories.ts` and
  `apps/site/src/loaders/planetnik-loader.ts`.
- Keep stable snapshot/entity IDs and relative evidence routes from ADR-0018.
- Use `route()` for every public link and preserve the existing Astro
  `data-astro-reload` policy for fragile graph/WebGL routes.
- Keep catalogue filtering client-only and progressive; cards must be useful
  in server-rendered HTML before hydration.
- Keep report UI and view models shareable with the future hosted app, but do
  not share Astro page files or static filesystem loaders.

### Patterns to avoid

- Do not put absolute data directories, GitHub tokens, or unvalidated paths in
  `DatasetDescriptor` or browser payloads.
- Do not use `PLANETNIK_DATASET` as mutable client state or require a rebuild
  for a normal card selection.
- Do not derive catalogue metrics from TXT, HTML, or rendered DOM output.
- Do not present `planned` candidates with fake LOC, contributor, commit, or
  health values.
- Do not duplicate a separate analytical model for cards when a canonical v2
  shard already supplies the fact.

### Migration steps

1. Ship the catalogue contract and validator with no route changes; prove it
   against the existing Code City and Python fixtures.
2. Ship `/explore` and a static preview using only descriptors; keep the
   current default report build unchanged.
3. Add the explicit handle and pre-render `overview` and `code-city` for
   multiple local datasets; retain top-level compatibility aliases.
4. Add the shell switcher and hard-reload/direct-link checks.
5. Expand route parity and CI packaging incrementally; promote candidates from
   `planned` to `ready` only after evidence review.

## Verification

- [x] A valid v2 dataset produces exactly one safe, URL-addressable descriptor
      with snapshot identity, provenance, headline stats, capabilities, and
      no absolute filesystem path.
- [x] A dataset with missing optional shards is `partial`, names the missing
      capability, and never invents a zero or fallback metric.
- [x] Catalogue generation reads canonical JSON only; a fixture with all TXT
      and HTML projections removed still produces the same descriptor facts.
- [ ] Invalid data versions, unsafe shard paths, missing required files, and
      malformed IDs are rejected from the public catalogue with a build
      diagnostic.
- [x] `/planetnik/explore` server-renders the card title, type, headline stats,
      provenance, and availability before client hydration.
- [ ] Search, filter, and sort work with keyboard input, visible focus, and no
      colour-only state; the no-JavaScript page remains navigable.
- [x] `getStaticPaths` pre-renders the selected dataset landing, overview, and
      Code City routes, and hard reloads resolve them without environment
      mutation.
- [ ] Switching datasets preserves the current lens when the target advertises
      it and gives an explicit fallback explanation when it does not.
- [ ] Existing top-level report routes continue to render the dataset selected
      by the current environment variables.
- [x] A static build contains multiple verified dataset routes and no
      workstation-specific absolute paths or secrets.
- [x] The Python, complete Code City, partial, and invalid fixtures are covered
      by focused tests, `bun run typecheck`, `bun test`, and a site build. The
      eight local repository showcases also pass v2 catalogue validation and
      static route generation.
- [ ] Direct browser evidence on the local site shows Explore → preview →
      report → switcher flow on desktop and mobile, including a WebGL fallback
      for Code City.
- [ ] The first curated sample set includes at least one small, medium, and
      large repository, at least three language families, and one organisation
      landscape before any “rich examples” claim is published.

## More Information

The companion UX specification is
[2026-09-04-explore-datasets-design.md](../superpowers/specs/2026-09-04-explore-datasets-design.md).
It defines the Explore information architecture, card content, audience-aware
emphasis, switcher behaviour, accessibility rules, and curated sample shelves.

Revisit this decision if the static build cannot keep catalogue and route
generation within the project’s published build budget, if a hosted product
requires server-side arbitrary repository ingestion, or if canonical v2 JSON
cannot express a metric required by the catalogue without a new evidence-backed
shard.
