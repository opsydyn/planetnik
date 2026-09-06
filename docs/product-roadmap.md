# Planetnik Product Roadmap

> **Status: Canonical**
>
> **Last reconciled: 2026-09-06**
>
> This is the sole source of truth for product sequencing. Specialist plans and
> discovery documents provide implementation history or evidence, but they do
> not override this roadmap.

## Goal

Make Planetnik an actionable engineering decision-support product: explain
what deserves attention, why it matters, who is affected, and what evidence
supports the recommendation.

Planetnik should retain its two delivery modes:

- `apps/site` is the static, shareable report product
- `apps/app` plus `apps/runtime` is the authenticated hosted product for
  intelligence, persistence, and secret-dependent integrations

The static product must not depend on the hosted runtime.

## How to maintain this roadmap

- Update this document in the same change that materially completes or
  re-sequences a roadmap slice.
- Move completed work into the delivered baseline; do not leave it described as
  future work.
- Promote unfinished work from a specialist plan into this document before
  treating it as a product commitment.
- Keep ADRs authoritative for architectural decisions. This roadmap determines
  delivery order, not architecture by itself.
- Require repository evidence and fresh verification before changing a slice's
  status.

## Delivered baseline

The following capabilities already exist and are not future roadmap items.

### Analysis and decision surfaces

- file, unit, component, contributor, dependency, duplication, and temporal
  analysis
- explainable hotspots and impact views
- controls and findings surfaces
- static, temporal, and people-coupling views
- topology, security, ownership, contributor, and team views
- searchable report navigation

### Landscape mode

- multi-repository analysis and normalized landscape contracts
- landscape overview, repositories, contributors, teams, topology, tags, and
  security routes
- repo-scoped drilldown with single-repository report parity
- a dedicated landscape root shell rather than a flattened copy of the
  single-repository navigation

The shell decision remains governed by
[ADR-0011](./adr/0011-adopt-repo-scoped-shell-for-landscape-drilldown.md).

### Static and hosted products

- static reports remain available through `apps/site`
- the authenticated Astro application exists in `apps/app`
- the Bun/Effect hosted runtime exists in `apps/runtime`
- authentication, administration, report browsing, and intelligence surfaces
  exist in the hosted product
- shared report presentation has begun moving into `packages/report-ui`

The product boundary remains governed by
[ADR-0015](./adr/0015-adopt-separate-static-reports-and-hosted-runtime-for-intelligence.md).

### Canonical snapshot contract

- ADR-0018 is accepted and v2 `report_context.json` is emitted for both
  single-repository and landscape exports.
- Metrics and contributor readers consume canonical JSON shards only. TXT
  remains a writer-only compatibility projection for intentional migration
  exports; single-repository CLI exports emit it only when explicitly enabled.
- Each export has one UUID/timestamp identity, an emitted-file shard inventory,
  and explicit compatibility projection references.
- Repository, file, unit, component, contributor, dependency-file, and
  contributor-repository records carry stable additive IDs.
- Static and hosted readers reject unsupported, incomplete, or unsafe v2
  manifests. Legacy v1 context metadata remains recognisable, but report data
  readers no longer reconstruct metrics or contributors from TXT.

The contract decision and field rules remain governed by
[ADR-0018](./adr/0018-adopt-versioned-canonical-analysis-snapshots.md).

### Migration completeness

**Status: Delivered at the canonical reader boundary — v2 readers, projection
demotion, structured findings, findings HTML fallback removal, and reader TXT
fallback retirement (2026-09-05)**

The JSON migration is complete at the primary consumer boundary: static,
hosted, Copilot, Code City, Trends, repo-scoped landscape pages, and the
landscape analyzer read canonical JSON shards only, and the
compatibility-removal matrix passes with TXT projections absent. This is the
reporting source-of-truth guarantee; it is not a claim that every legacy
writer or parser has disappeared.

The remaining compatibility boundary is now explicit:

- static, hosted, Copilot, repo-scoped landscape, and landscape-analyzer
  readers require canonical JSON for metrics and contributor data; missing or
  malformed shards produce an empty/unavailable result rather than consulting
  TXT
- the landscape exporter and commands now write legacy TXT/HTML projections
  only through an explicit opt-in; stale files in reused output folders are not
  advertised by the v2 context
- the single-repository `DataExporter` and CLI keep the same projections
  available only through an explicit opt-in; the Sokrates-era
  `RichTextReport`/HTML generator stack remains the opt-in presentation path
- canonical `findings.json` authoring input now supplies stable IDs, summaries,
  and Markdown/plain-text bodies; the exporter derives `bodyHtml`/`bodyText`
  records for the existing readers
- legacy findings HTML is derived from canonical `findings.json` only for the
  explicit legacy report projection; HTML fragments are no longer accepted as
  input

Writer inventory after the projection-demotion and structured-findings slice:

- single-repository `packages/reports/src/exporters/DataExporter.ts` — `files.txt`,
  component file lists, metrics, controls, contributors, duplicates, units,
  component dependencies, and temporal dependency TXT projections; now gated by
  `emitCompatibilityProjections`
- `packages/reports/src/landscape/data/LandscapeDataExport.ts` —
  `repositories.txt`, `contributors.txt`, `teams.txt`, and tag repository TXT
  projections; now gated by `emitCompatibilityProjections`
- `apps/cli/src/commands/analyzeLandscape.ts` and
  `apps/cli/src/commands/updateLandscape.ts` — landscape `index.html`; now
  gated by `emitLegacyProjections`
- `packages/reports/src/findings/FindingsAuthoring.ts` and
  `apps/cli/src/commands/generateReports.ts` — canonical `findings.json`
  authoring input with stable IDs and Markdown/plain-text body normalization;
  legacy HTML is derived only for the opt-in report projection
- `apps/cli/src/git/GitHistoryExtractor.ts` and `extractFiles.ts` —
  `git-history.txt` analysis input/transport, not a report projection and
  intentionally out of scope for this demotion

The reader-retirement slice now makes the canonical rule unconditional: no
static, hosted, Copilot, repo-scoped landscape, or landscape-analyzer reader
falls back to metrics or contributor TXT, even when a legacy context or missing
JSON shard is encountered. The v2 rule therefore fails closed at every active
report-consumer boundary.
The single-repository and landscape writer slices are now delivered:
`generateReports`, `analyzeLandscape`, and `updateLandscape` emit canonical JSON
by default, while `emitLegacyProjections: true` (or the CLI flag) intentionally
restores the legacy TXT/HTML projections. The projection-demotion workstream is
not a new numbered phase. Structured `findings.json` authoring is now the
canonical input, with stable IDs and Markdown/plain-text bodies normalized into
the existing JSON reader contract. The migration exit criteria are now met at
the reader boundary: no active consumer depends on TXT or HTML input, the
default report path is canonical JSON plus Astro/static presentation, the
no-legacy fixture covers the core readers, and compatibility output remains
available only as an intentional migration projection. The parser-era findings
HTML input path has also been removed.

### Parser coverage

- Rust uses `web-tree-sitter` and `tree-sitter-rust` for syntax-backed units and
  conservative dependency extraction
- the Rust pilot produced a measurable quality improvement on Tokio
- Python now uses the shared Tree-sitter adapter for syntax-backed units,
  complexity, and conservative internal imports; its public-corpus gate is
  recorded in Phase 2 below
- Tree-sitter WASM assets are embedded successfully in standalone Bun binaries
- Haskell has dedicated unit and dependency heuristics
- HTML, XML, JSON, YAML, CSS, Shell, and SQL have explicit analyzers rather than
  silently falling through the original language matrix

The Rust evidence is recorded in
[Rust Tree-sitter Migration Discovery](./rust-tree-sitter-migration-discovery.md).

### Tree-sitter completeness

Phase 2 is delivered for the shared runtime, Rust, and Python adoption gate.
The parser track is not considered complete merely because the gate passed. Its
explicit hardening checklist is:

- **Delivered:** benchmark and document shared adapter initialisation, disposal,
  parse errors, and fallback behaviour (the runtime contract, failed-load
  recovery, and repeatable Tokio/Requests baselines are documented and
  fixture-tested)
- **Delivered:** broadened Rust fixtures cover cfg-gated async functions,
  trait defaults and declaration-only signatures, trait and inherent impls,
  nested modules, `if let`/`while let`, boolean branches, match-arm
  complexity, extern declarations, and macro token-tree conservatism
  (`rust-tree-sitter-coverage-v1`)
- **Delivered:** add a legacy-comparison harness that classifies intended
  improvements, neutral differences, and regressions. The local classifier,
  provenance-backed historical fixture, fail-closed capture runner, first
  Docker-backed Java-runtime evidence, and ADR-0021 path-sensitive metric
  policy are all delivered. The runtime `.rs` capture is authoritative; the
  extensionless upstream JUnit value remains labelled historical evidence.
- **Maintenance:** keep the Rust-generated report-contract fixture green as the
  shared canonical
  shard map evolves (CLI exporter coverage is delivered; static and hosted
  readers retain their language-neutral v2 gates)

These are hardening obligations, not a licence to infer Cargo semantics, macro
expansion, type resolution, or whole-program symbols from syntax alone. New
language ports remain behind the Phase 6 demand and quality gate; the first
recommended family is TypeScript/JavaScript/TSX, followed by Go only when real
dataset demand justifies it.

The first Tree-sitter hardening slice is now delivered (2026-09-05): Rust unit
fixtures qualify nested module and trait/impl scopes, preserve qualified unit
names, count nested match arms in complexity, and prove that declaration-only
trait/foreign signatures and macro token trees are not invented as executable
units. The repeatable adapter benchmark baseline and a fail-closed runtime
capture runner are also recorded. ADR-0021 resolves the remaining metric
question: the Docker-backed `.rs` runtime capture is authoritative for report
LOC, while the extensionless test value is an explicit neutral difference.

## Durable gaps

### 1. Trends have only partial longitudinal coverage

Static metric and entity comparisons now work for captured histories, and a
catalogue-level roll-up makes the current showcase footprint visible. Local
durable retention is now available through the opted-in `generateReports`
workflow, but the hosted trends route still returns an unavailable state and
most repositories have only one retained snapshot. Planetnik needs hosted
multi-snapshot persistence before it can claim portfolio-wide trend direction
or regression detection.

### 2. Actionability is mostly report-scoped

Individual hotspot, control, security, coupling, and impact views exist. The
next product-level gap is a portfolio queue that ranks evidence-backed actions
across repositories without hiding the underlying signals.

### 3. Language support depth is uneven

Rust has proved the parser-backed approach, and Python now has a syntax-backed
baseline for functions, classes, methods, complexity, and conservative imports.
Depth remains uneven across the language matrix. The project needs a reusable
parser adapter and demand-led language expansion, not a parser rewrite for every
recognized extension.

### 4. Hosted intelligence lacks a canonical persisted substrate

The hosted runtime can browse filesystem-backed reports, but it does not yet
ingest versioned analysis snapshots as durable entities. Semantic retrieval
would be premature until those entities and their provenance are stable.

### 5. Legacy projections and parser hardening need explicit completion gates

Canonical JSON is now the only active report-reader contract. TXT and
HTML/RichText writers remain migration-era compatibility/presentation code,
while the deprecated HTML-fragment findings fallback has been removed. The
Rust/Python Tree-sitter baseline is proven, the broader Rust coverage matrix is
delivered, and ADR-0021 closes the runtime-capture metric-policy review with
the `.rs` capture authoritative. These workstreams are deliberately sequenced
after the first longitudinal trends slice and before hosted semantic retrieval
or broad parser expansion.

## Delivery sequence

## Phase 1 — Versioned canonical analysis snapshots

**Status: Delivered — canonical snapshot contract and compatibility-removal proof green**

### Outcome

Static reports, hosted reports, parser improvements, and future ingestion all
consume the same explicit, versioned, machine-first snapshot contract.

### Deliverables

- accept an ADR declaring canonical JSON snapshots as the reporting source of
  truth
- add `metrics.json` while retaining `metrics.txt` as an opt-in compatibility
  projection
- make static and hosted metrics consumers JSON-first
- make contributor consumers use the existing `contributors.json` contract
  as their only report-data input
- extend `report_context.json` with:
  - a documented `dataVersion` compatibility policy
  - `snapshotId`
  - `generatedAt`
  - report mode
  - capabilities
  - canonical shard references
  - compatibility projection flags
- define stable identity rules for repository, file, unit, component, and
  contributor records
- enumerate the complete set of emitted canonical shards and compatibility
  projections in each manifest
- reject invalid v2 manifests at the runtime and static-loader boundaries;
  recognise legacy v1 metadata without reconstructing report data from TXT
- add exporter-to-loader contract tests for both single-repository and
  landscape snapshots

### Exit criteria

- no core static or hosted route requires `metrics.txt` or `contributors.txt`
  as its primary input
- a consumer can determine snapshot version and available capabilities from
  `report_context.json`
- compatibility artifacts can be removed from a test fixture without breaking
  every core static and hosted route; the route-by-route matrix is green as of
  2026-08-16
- contract tests fail clearly when a required canonical shard or version is
  invalid

## Phase 1.5 — Code City semantic visualisation

**Status: Delivered foundation — audience-aware static UI implemented and
partially exercised in a real browser; direct interaction acceptance remains
open**

### Reference implementation

The product concept is informed by [Draxul](https://github.com/cmaughan/Draxul),
particularly its [MegaCity plugin](https://github.com/cmaughan/draxul-megacity),
which turns a semantic code model into an explorable city with dependency and
health overlays. These repositories are reference material only; Planetnik
should reimplement the concept rather than copy code or assets until reuse
licensing is explicitly established.

### Outcome

Planetnik has a repo-scoped Code City decision surface that makes structure,
coupling, hotspots, ownership, and impact explorable while preserving exact
links to the underlying report evidence.

### Deliverables

- build an in-memory `CodeCityModel` from the existing canonical JSON shards
  before adding a new exporter contract
- use logical components or stable path groups as districts, files as the
  first building level, and units as drill-down detail
- map LOC, complexity, hotspot severity, churn, ownership, impact, and
  dependency strength to explicit visual channels with explanatory legends
- provide deterministic, ID-seeded layout with level-of-detail limits for
  small and dense repositories
- ship the first view as a lazy-loaded 2.5D/browser visualisation shared by
  `apps/site` and the hosted repo-scoped product; do not port Draxul's native
  Vulkan/Metal renderer
- make every selectable entity resolve to its existing file, unit, component,
  hotspot, or impact surface
- provide a table/list fallback for accessibility, no-WebGL browsers, print,
  and large datasets
- measure bundle cost, interaction latency, layout stability, and visual
  regression behaviour on representative small and dense repositories
- add a new canonical semantic/code-structure shard only if the feasibility
  slice proves that existing records cannot express the required view

### Exit criteria

- the prototype is useful for at least one concrete engineering question, not
  only visually impressive
- positions remain stable across repeated exports when entity IDs are stable
- dense repositories degrade through documented LOD/drill-down behaviour rather
  than silently dropping evidence
- the view remains functional with WebGL unavailable and links to exact source
  records
- static and hosted products consume the same model without a runtime coupling
- an ADR records whether to adopt, defer, or narrow the Code City contract

### Delivered evidence and remaining acceptance

- the canonical v2 model, deterministic scene adapter, semantic lenses,
  inspector, evidence links, lazy Three.js renderer, and complete table fallback
  are implemented in shared report UI primitives
- `/code-city` and the repo-scoped landscape Code City route use canonical JSON
  content collections and expose Onboarding, Architecture Review, and
  Stakeholder explanations, a reversible story rail, architecture brief, and
  table path
- focused model, scene, selection, fallback, route-state, responsive, print,
  and reduced-motion assertions pass; the workspace typecheck and deterministic
  fixture build pass
- the complete fixture directly showed the rendered orthographic/isometric
  city, table, all three audience questions and first actions, stable selection
  through audience changes, story navigation, focus/return announcements, and
  matching brief, inspector, and story evidence links on the single-repository
  route; repo-scoped browser evidence covered Onboarding and Architecture
  Review, story start and advance to Name a district, the 16-row table, and
  repo-scoped brief and evidence links, while Stakeholder and the remaining
  story controls stay open on that route
- the partial fixture directly explained that `impact.json` was unavailable and
  kept the available component evidence, but the partial story was not run to
  its unavailable step
- the static Explore catalogue now discovers validated local snapshots and
  pre-renders dataset-scoped Overview and Code City routes for ready and
  partial entries. The named report reader consumes the selected v2 shard map
  directly, while planned entries remain detail-only. Code City evidence links
  resolve to dataset-scoped canonical evidence readers rather than the
  environment-selected report. The Python, complete, partial, dense, and
  legacy fixtures all build successfully
- the first local repository showcase set is materialised at pinned refs for
  OpenAI Python, FastAPI, Flask, Tokio, Effect, Visual Studio Code, Hugging
  Face Transformers, and Kubernetes. All eight validate as ready canonical v2
  snapshots and build into dataset-scoped Overview and Code City routes;
  Kubernetes omits duplication analysis after its full-scale merge exceeded
  available memory, preserving a useful scale signal for the later concurrency
  slice
- direct browser acceptance on port 4321 confirmed the Explore catalogue,
  Python search filtering, OpenAI Python Overview, and OpenAI Python Code City;
  a fresh Code City load reported no console errors, and all eight showcase
  datasets returned working Overview and Code City routes
- after the final hydration repair in `79d5251`, direct reload of
  `audience=architecture-review&story=connect` restored Architecture Review,
  Connect the city, the `analysis` inspector, and Map view on both routes
- the renderer chunk measured 571,471 bytes raw and 142,358 bytes gzip in the
  2026-08-17 acceptance build; no first-usable interaction claim is made yet
- direct orbit/pan/zoom, camera coordinate preservation and restore, keyboard
  traversal, forced no-WebGL, print preview, reduced-motion emulation, the
  partial unavailable-step flow, and the dense snapshot remain open
- landscape aggregation and hosted route integration remain later slices; both
  must consume the same `CodeCityModel` and renderer-neutral scene contract

## Phase 2 — Shared Tree-sitter platform and Python pilot

**Status: Delivered — shared runtime and Python pilot adoption gate passed (2026-09-03)**

The first infrastructure slice is delivered as of 2026-09-03. Rust now uses
the shared `TreeSitterRuntime` language-adapter boundary with one-time runtime
initialisation, adapter-identity language caching, explicit parser/tree
disposal, and syntax-error preservation. The Rust facts and existing report
output remain unchanged. Python now has a syntax-backed baseline for functions,
classes, methods, complexity, and conservative imports.

The adoption gate was exercised against `psf/requests` at shallow-clone commit
`dae7ef63b4df6eded86637f251fc4e3a06c3b479` (37 Python files, 407,127 bytes).
The direct adapter run took 188.60 ms with a 368.36 MiB peak RSS, found zero
syntax-error files or parse failures, emitted 807 units (96 classes and 711
functions, including 580 qualified methods), validated all 807 source ranges
and declarations, and emitted 102 unique internal dependency edges backed by
114 import fragments. A compiled Bun CLI run completed the same repository
analysis in 0.41 s real time with 551 MiB maximum RSS and emitted a v2
`report_context.json`, 39-file summary (9,841 Python LOC), the 807-unit and
102-edge canonical shards, and 12 HTML reports. These measurements are a
repeatable baseline, not a cross-machine performance SLA.

### Outcome

Planetnik has one repeatable parser-backed integration pattern, proven by Rust
and a structurally different second language.

### Deliverables

- extract a shared Tree-sitter runtime and language-adapter boundary
- initialize the runtime once and make parser and tree disposal explicit
- use per-language Tree-sitter queries for unit and import captures where they
  simplify traversal
- document parse failure, syntax-error, and heuristic-fallback behaviour
- retain static WASM asset imports compatible with `bun build --compile`
- benchmark elapsed time, peak memory, and output quality on representative
  real repositories (completed on `psf/requests`; measurements above)
- port Python unit, complexity, and conservative import extraction
- validate Python against fixtures plus one representative public corpus
  (completed on `psf/requests`; compiled CLI and v2 shard checks green)
- map parser facts into the canonical snapshot contract without adding
  language-specific exporter shapes

### Exit criteria

- Rust continues to pass its fixtures and Tokio quality checks through the
  shared adapter
- Python produces functions, async functions, methods, classes, complexity,
  and conservative internal import evidence
- standalone compiled CLI execution loads every included grammar successfully
- measured parser cost and output quality are recorded before another language
  is approved

## Phase 3 — Real longitudinal trends

**Status: In progress — static roll-up and local durable retention delivered; hosted persistence remains (2026-09-05)**

### Outcome

Planetnik compares compatible snapshots and explains material movement rather
than showing an unavailable trends placeholder.

### Deliverables

- retain or ingest multiple snapshots with stable repository and entity IDs
- define compatibility rules for comparing contract versions
- implement project, component, hotspot, control, and ownership deltas
- replace the unavailable `readReportTrendsSummary` result with real summaries
- expose snapshot provenance and comparison windows in static or hosted views
- distinguish missing history from an unchanged metric

### Exit criteria

- at least two compatible snapshots produce deterministic trend summaries
- incompatible snapshots fail with an explicit contract error
- every displayed trend links back to exact snapshots and underlying records

The static entity extension now satisfies these criteria for component,
hotspot, control, and ownership collections. The Trends view also provides a
project-level movement roll-up and explicit per-snapshot coverage state, so
empty or unavailable collections are not mistaken for zero change. A static
cross-repository roll-up and local durable retention are now delivered for the
dataset catalogue; hosted persistence remains open Phase 3/5 work.

### Delivered first slice

The common `compareLatestCanonicalSnapshots` pairing boundary now selects the
two newest canonical snapshots deterministically by `generatedAt` and
`snapshotId`, then delegates to the JSON-only comparator. The static site reads
an explicit `snapshot-history.json` manifest beside the selected report data,
validates each referenced v2 context and safe relative directory, and loads the
declared `metrics.json` shard without TXT fallback. The top-level `/trends`
route now renders snapshot provenance, metric movement, exact record paths,
and stable evidence anchors. Fewer than two snapshots, malformed history, and
incompatible contexts remain explicit states; hosted ingestion remains later
Phase 3/5 work.

The static history manifest is intentionally small and portable:

```json
{
  "historyVersion": 1,
  "snapshots": [
    { "dataDir": "history/2026-08-01" },
    { "dataDir": "." }
  ]
}
```

Each directory must contain a valid canonical v2 `report_context.json`; the
reader follows only its declared JSON shards and resolves `dataDir` beneath the
selected report data directory.

The Requests Python showcase now exercises this contract with two real local
snapshots: the existing `main` snapshot (`3d611736-9df1-4d22-a93e-00d06b13e767`)
and a fresh `3.0` branch analysis (`b0dc95f9-d522-464d-8a8f-fba3aea4b268`),
registered in `datasets/requests-python-pilot/data/snapshot-history.json`.
The generated metrics remain local showcase data (the `datasets/` directory is
ignored); the manifest and reader are the portable contract.

The entity follow-on is now delivered in the static reader: canonical
`files_main.json`, `units.json`, `component_dependencies.json`,
`hotspots.json`, `controls.json`, and `contributors.json` shards are projected
into stable component, hotspot, control, and ownership records. The common
comparator classifies added, removed, changed, and unchanged entities with
sorted field deltas and snapshot/shard/record provenance. `/trends` renders
these as grouped, priority-first static sections while keeping unavailable
domains explicit and avoiding TXT/HTML fallback. The page intentionally caps
rendered rows per lens for a usable static payload; the canonical comparison
retains the complete record set for the next drilldown slice. It now also
renders a project-level movement roll-up with baseline/current footprints and
coverage caveats derived from the two canonical entity collections. Empty and
unavailable lenses remain visible as data-quality observations rather than
being collapsed into synthetic zero deltas.

Dataset-scoped history selection is now delivered for single-repository
catalogue entries through `/datasets/:datasetId/trends`. The route resolves
that entry's own `snapshot-history.json` beneath the named dataset, keeps the
active report environment untouched, and presents a truthful unavailable state
when a manifest has not yet been captured. Landscape and planned entries do not
receive a repository Trends route.

The first cross-repository follow-on is now delivered through the static
`/datasets/trends` route. It reads each ready or partial single-repository
catalogue entry's current canonical `metrics.json`, sums only the shared
portfolio metric contract (main LOC, total files, units, contributors, and
dependency links), and keeps metric coverage explicit when a shard is absent.
Per-repository compatible histories contribute baseline and delta totals plus
metric/entity movement counts; repositories without a comparable pair remain
included in the current footprint but do not receive invented deltas.
Every metric row exposes exact snapshot and `metrics.json` record provenance,
with links back to the repository detail or Trends route. Planned landscape
entries remain visible as excluded catalogue evidence rather than being mixed
into repository totals. The current-snapshot reader intentionally avoids the
large entity projector; entity comparison remains confined to retained history
entries.

The local retention follow-on is now delivered for single-repository exports.
`generateReports --retainSnapshots N` validates the current v2 context and its
declared canonical JSON shard inventory, archives the previous snapshot under
`history/<snapshotId>` before overwrite, writes the portable v1
`snapshot-history.json` manifest only after a successful export, and prunes the
oldest archives beyond N total snapshots. Archives contain only
`report_context.json` and declared `.json` shards; TXT/HTML compatibility
projections are never copied. First-run, malformed, unsafe, interrupted, and
identity-mismatched states remain explicit and fail closed. Hosted ingestion and
durable storage beyond the local showcase remain the open Phase 5 boundary.

## Phase 4 — Portfolio action queue

**Status: Static implementation delivered — focused verification, bounded
fixture build, direct browser evidence, and the bounded default catalogue build
are green; repository-wide lint remains open (2026-09-06)**

### Outcome

Landscape users receive one explainable queue of the most important
interventions across repositories.

### Deliverables

- combine hotspot, control, security, impact, coupling, ownership, and trend
  evidence without collapsing them into an opaque score
- provide repository, team, severity, evidence, and time-window filters
- show why an item is ranked and which existing report surfaces support it
- support explicit acknowledgement or workflow state only in the hosted product

The approved contract is captured in the
[portfolio action-queue design](./superpowers/specs/2026-09-06-portfolio-action-queue-design.md)
and governed by
[ADR-0022](./adr/0022-adopt-explainable-portfolio-action-queue.md). The static
slice is now implemented at `/datasets/actions`: it reads canonical v2 JSON,
keeps ready and partial single-repository coverage explicit, ranks with the
visible factor vector, and links each item to exact dataset-scoped evidence.
Planned and landscape entries remain coverage diagnostics. The hosted
acknowledgement/status overlay remains a later boundary and is not implemented
here. The route now reads a versioned, source-fingerprinted page artifact for
one window at a time, with immutable JSON links and deterministic pagination.
The default real-catalogue prebuild materializes the ranked top 250 items per
window and states the full total plus `complete: false`, so filtering never
presents a bounded slice as the complete queue. Complete pagination remains
available to a future unbounded materializer once the measured shard-memory
cost is reduced.

### Exit criteria

- each queue item is reproducible from canonical snapshot records
- ranking factors are visible and testable
- the static product can display the queue without requiring hosted services

The focused common/site suite, workspace typecheck, full test suite, bounded
static fixture build, direct Firefox route evidence, and the final named-dataset
Astro build over the local catalogue artifacts meet the static-slice criteria.
The fixture build completes 64 pages; the final combined build completes 131
pages under a 4 GB Node heap, takes 264.43 seconds wall-clock, and peaks at
14,213,120,000 bytes RSS. The generated root action page is 88,900,127 bytes
and the current JSON route is 104,383,387 bytes. An unchanged rerun restores
the five action JSON routes from Astro's incremental cache with the same source
fingerprint. The follow-up compact v2 artifact projection now stores repeated
evidence bases once per chunk and omits the redundant item-level evidence
copy: real page-one materializer inputs are 4,820,331 bytes (`current`),
4,820,341 (`latest-compatible`), 4,827,434 (`7d`), and 4,820,327 each
(`30d`/`90d`), a 95.38% reduction for the current window. The reader restores
the exact queue contract; the public JSON route remains full-contract by
design. Lower-memory complete pagination remains a bounded follow-up. The
compact artifacts integrate with the named-dataset build at 131 pages in
119.87 seconds and
14,253,522,944 bytes maximum RSS; an unchanged rerun restored all five action
JSON routes from incremental cache in 113.64 seconds.
The follow-up per-window content invalidation is now implemented: each window
manifest entry carries a canonical queue-content fingerprint that includes the
window, source identities, projection version, page size, full total, and
materialized queue, while the global source fingerprint remains provenance.
Route cache keys also include a canonical digest of the manifest-wide filter
options, since those controls are rendered on every page; the content digest
includes the artifact version as a schema salt.
A synthetic two-window materialization kept the global source fingerprint and
the unchanged window fingerprint stable while changing only the other window.
In a copied `requests-python-pilot` fixture, changing one `hotspots.json` score
(`30` to `31`) kept the global fingerprint at `7c582629...` but changed the
current content fingerprint (`088f0d1f...` to `3d73af14...`) and compact
artifact (`d4a4c83f...` to `4bc90467...`). The changed Astro build regenerated
the current JSON route, whose body matched the rehydrated changed queue
(`7fbd27c1...`), and an unchanged rerun restored all five JSON routes. This
shard contributes to each observation window in the fixture, so all five JSON
routes were regenerated for the mutation; selective reuse is now guarded by
the window-level content key.
The repository-wide Biome lint gate still reports its existing schema and
format baseline and remains open rather than being folded into delivery status.

## Phase 5 — Hosted snapshot ingestion and grounded retrieval

**Status: Later**

### Outcome

The hosted runtime persists canonical snapshots as queryable entities and uses
them as the factual substrate for intelligence.

### Deliverables

- ingest snapshot metadata, entities, relationships, and provenance into Neon
- preserve the canonical snapshot as the portable source of truth
- support filtered and cross-snapshot queries over persisted entities
- create curated semantic documents from stable project, component, hotspot,
  contributor, security, and trend records
- add `pgvector` only when retrieval can resolve every result back to exact
  snapshot and entity IDs

### Exit criteria

- hosted reports can query ingested entities without reparsing every JSON file
- re-ingestion is idempotent by snapshot identity
- semantic answers rehydrate and cite exact canonical records
- raw HTML and compatibility TXT files are not the embedding substrate

## Phase 6 — Demand-led language expansion

**Status: Later**

### Recommended order

1. TypeScript, JavaScript, and TSX as one language family with explicit grammar
   dialects
2. Go when active dataset frequency and baseline errors justify the port
3. Ruby, Kotlin, C#, and other languages only from measured dataset demand

Java remains a lower-priority parser candidate because it already has useful
dependency extraction. C and C++ remain deferred because preprocessing and
build semantics make syntax-only results easier to overstate. Config, markup,
and data formats should keep lightweight analyzers unless architectural value
is demonstrated.

### Adoption gate

A new Tree-sitter language must have:

- meaningful frequency in real Planetnik datasets
- a demonstrable unit, complexity, or dependency gap
- a maintained grammar with compatible WASM output
- measurable improvement on a representative corpus
- acceptable runtime, memory, and compiled-binary size
- conservative dependency mapping that does not invent internal edges
- fixture, corpus, typecheck, and standalone compiled-CLI verification

Tree-sitter provides syntax and error recovery. It does not provide project
semantics, macro expansion, type resolution, or whole-program symbols.

## Now, next, and later

| Horizon | Work |
| --- | --- |
| Completed | Dataset showcase acceptance: direct browser evidence for the new dataset-scoped reader routes (2026-09-04) |
| Completed | Phase 1: versioned canonical snapshots and compatibility-removal proof |
| Completed | Phase 2: shared parser adapter and Python pilot |
| Completed | ADR-0010 Phase 2: Effect `forEach` with bounded landscape concurrency (2026-09-04) |
| Completed | ADR-0010 Phase 3: Ref-based summary state and structured failure collection (2026-09-04) |
| Completed | ADR-0010 Phase 4: targeted retries and interruption-safe landscape runs (2026-09-04) |
| Completed | ADR-0010 Phase 5: compile-friendly CLI packaging validation (2026-09-04) |
| Completed | Phase 3 static cross-repository portfolio roll-up — shared metric contract, per-repository coverage, movement summary, and provenance links at `/datasets/trends` (2026-09-05) |
| Completed | Phase 3 local durable snapshot retention — opt-in export rotation, canonical-only archives, bounded `snapshot-history.json`, and fail-closed pruning (2026-09-05) |
| Completed | Migration completeness: all active report readers fail closed to canonical JSON; single-repository and landscape TXT/HTML projections are opt-in; structured findings authoring is canonical (2026-09-05) |
| Completed | Tree-sitter hardening slice: scope-aware Rust module/trait/impl fixtures and failed grammar-load recovery (2026-09-05) |
| Completed | Tree-sitter parity slice: explicit unit/dependency diff classifications with fail-closed regressions (2026-09-05) |
| Completed | Tree-sitter captured-reference fixture: upstream Sokrates Rust sample pinned to commit `f400eb7` with explicit provenance and normalized parity assertion (2026-09-05) |
| Completed | Rust report-contract fixture: generated Tree-sitter units/dependencies and v2 context verified with compatibility projections absent (2026-09-05) |
| Completed | Tree-sitter adapter benchmark: repeatable Bun command with pinned Tokio and Requests corpus baselines (2026-09-05) |
| Completed | Tree-sitter capture lane: pinned-commit preflight, Maven build plan, disposable Java harness, and fail-closed command test (2026-09-05) |
| Completed | Tree-sitter runtime evidence: Docker-backed Temurin 17 capture retained with 3 units/0 dependencies and explicit `.rs` cleaner provenance (2026-09-05) |
| Completed | Tree-sitter metric policy: ADR-0021 makes real-file-extension semantics authoritative and classifies the extensionless `main` LOC difference as neutral (2026-09-05) |
| Completed | Phase 4 static portfolio action queue — canonical JSON evidence, explainable factor-vector ranking, deterministic filters, coverage diagnostics, bounded top-250 static materialization, and `/datasets/actions` browser evidence (2026-09-06) |
| Completed | Phase 4 incremental action artifacts — source-fingerprinted per-window JSON/HTML page routes, sequential Effect materialization, explicit incomplete totals, and 131-page real Astro build (2026-09-06) |
| Completed | Phase 4 content-aware action artifact invalidation — canonical per-window fingerprints, filter-option cache digest, schema salt, and mutation regression evidence (2026-09-06) |
| Later | Phase 4 hosted acknowledgement/status overlay |
| Later | Phase 5: hosted snapshot ingestion and grounded semantic retrieval |
| Later | Phase 6: demand-led parser expansion |

Phase 1.5 is delivered as a repo-scoped static foundation; its remaining
interaction matrix, landscape aggregation, and hosted integration stay as
explicit follow-ons. Phase 2 can begin after the parser fact contract in
Phase 1 is fixed. Phase 3 depends on snapshot identity and versioning from
Phase 1. Phases 4 and 5 depend on trustworthy trends and canonical entities.

## Not planned next

- more standalone charts without a decision workflow
- Tree-sitter for every recognized language
- full language semantics inferred from syntax trees
- semantic embeddings over raw report text or HTML
- converting the static product into a server-dependent application
- a direct Draxul/native Vulkan/Metal port or renderer-first rewrite
- BioView/organism metaphors before the Code City decision surface proves its
  value
- Cynefin classification, automated bounded-context inference, runtime coupling,
  or advanced offboarding simulation before the evidence substrate is stable
- another charting, graph, table, or state-management stack replacement without
  a demonstrated product blocker

## Roadmap document status

| Document | Status | Role |
| --- | --- | --- |
| `docs/product-roadmap.md` | Canonical | Sole source of product sequencing |
| `docs/parser-coverage-roadmap.md` | Archived | Historical parser coverage proposal |
| `docs/report-data-modernization-roadmap.md` | Archived | Discovery input for Phase 1 and Phase 5 |
| `docs/landscape-ui-parity-plan.md` | Archived | Historical delivery plan for shipped landscape work |
| `docs/shared-app-extraction-plan.md` | Archived | Historical delivery and handoff record for shared UI work |
| `docs/tree-sitter-rust-pilot-checklist.md` | Completed and archived | Original Rust execution checklist |
| `docs/rust-tree-sitter-migration-discovery.md` | Completed evidence | Measured Rust pilot outcome and limitations |
| `docs/tree-sitter-runtime-contract.md` | Current evidence | Shared adapter lifecycle, parse outcomes, and fallback boundary |
| `docs/compatibility-removal-fixture-matrix.md` | Current evidence | Phase 1 compatibility-removal proof |
| `docs/adr/*.md` | Decision records | Binding architectural decisions according to ADR status |

Other specialist plans may describe implementation detail, but they are not
product sequencing authorities. If they conflict with this document, this
roadmap wins unless an accepted ADR requires a different architecture.

## Immediate next move

The previously approved immediate move was delivered on 2026-08-05. ADR-0018,
[Adopt versioned canonical analysis snapshots](./adr/0018-adopt-versioned-canonical-analysis-snapshots.md),
is accepted, and the first JSON-first contract slice is implemented across the
report exporter, static site loader, hosted report reader, and Copilot data
reader. The follow-on identity and validation slice is also delivered: it
emits stable entity IDs, truthful single-repository and staged landscape shard
inventories, and negative fixtures for unsupported, incomplete, and unsafe v2
contexts. Legacy TXT/HTML projections remain available only as an explicit
single-repository or landscape CLI/config opt-in; active report readers do not
parse those projections.

The Phase 1 compatibility-removal gate is green as of 2026-09-05. The
[JSON-only fixture matrix](./compatibility-removal-fixture-matrix.md) covers
the single-repository and landscape static loaders plus every hosted reader
surface, with `metrics.txt` and `contributors.txt` absent. Legacy TXT export
remains available for intentional migration runs, but current routes and
analyzer readers do not consume those projections. `generateReports`,
`analyzeLandscape`, and `updateLandscape` now default to JSON-only output and require
`emitLegacyProjections` (config or flag) for the legacy TXT/HTML bundle.

The shared parser adapter and Python pilot were delivered on 2026-09-03. The
representative public-corpus, runtime, output-quality, and compiled-CLI gate
also passed: the run produced a v2 canonical snapshot with the expected Python
units and dependency evidence. Phase 2 is therefore closed for the current
Rust/Python baseline; future language ports still require the same adoption
gate.

The dataset-aware showcase reader is now implemented: validated ready and
partial catalogue entries have real Overview and Code City routes, while
planned examples remain honest detail pages. Direct browser acceptance was
recorded on 2026-09-04 against the local port-4321 showcase: Explore loaded,
Python search reduced the catalogue to seven results, OpenAI Python Overview
and Code City rendered their canonical snapshot metadata, and a fresh Code
City load had no browser console errors. All eight local repository showcase
datasets returned working Overview and Code City routes. The first local
repository showcase set is now present and reproducible from the exact refs in
`apps/site/src/data/dataset-catalog.json`;
organisation landscapes remain planned until their bounded repository sets
also pass the v2 and provenance gates. ADR-0010 Phase 5 compile-friendly CLI
packaging validation is now also delivered: its local smoke compiled the CLI,
parsed the full command surface, and generated a valid Python report through
the standalone executable. Phase 3 longitudinal trends is now underway. The
first comparator slice is delivered in
`@planetnik/common`: it validates v2 context, matching report mode and
repository identity, and distinct snapshot IDs before producing sorted metric
deltas with exact snapshot and `metrics.json` record provenance. The follow-on
pairing and static reader slice is now also delivered: `snapshot-history.json`
is an explicit, safe-relative manifest beside the selected report data, and
the top-level `/trends` route renders compatible movement, provenance, and
exact record anchors. The static entity extension now compares and renders
component, hotspot, control, and ownership records with stable IDs, changed
fields, and exact canonical shard/record provenance. Missing snapshots,
shards, domains, and incompatible contexts remain explicit result states. The
project-level roll-up, coverage signal, and dataset-scoped repository Trends
route are now delivered; the static cross-repository portfolio roll-up is now
delivered at `/datasets/trends`, and local durable history retention is now
available through `generateReports --retainSnapshots N`. Hosted persistence
remains open. The roadmap now also tracks the remaining migration-completeness
workstream (TXT/HTML projection demotion, structured findings authoring, and
reader fallback retirement) and
the Tree-sitter hardening workstream (adapter benchmark/docs, Rust parity and
coverage, the Rust exporter contract fixture, and the fail-closed Java capture
runner) as explicit
items rather than leaving them only in archived discovery notes. ADR-0010 Phases 3 and 4
remain delivered as backend reliability slices: concurrent run counts are
maintained in an atomic `Ref`, ordered tagged outcomes remain the canonical
detailed failure evidence, and discovery/clone retries are bounded, selective,
and interruption-safe.
The parser-era findings HTML input path is now removed, with a fixture proving
that a legacy HTML file is not treated as a findings source. Reader-side TXT
fallback retirement is also complete, and ADR-0021 closes the Tree-sitter
runtime metric-policy review. The next bounded move is review of the written
Phase 4 action-queue design and ADR. That review, the static implementation,
and the bounded incremental artifact-route follow-up are delivered; hosted
acknowledgement/status and lower-memory complete pagination remain later
follow-ups.
Keep Code City follow-ons bounded to its direct interaction matrix, landscape
aggregation, and hosted repo-scoped integration; do not widen into a renderer
rewrite or new semantic shard without evidence.
