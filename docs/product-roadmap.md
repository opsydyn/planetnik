# Planetnik Product Roadmap

> **Status: Canonical**
>
> **Last reconciled: 2026-08-16**
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
- Metrics and contributor readers are JSON-first, with TXT retained as a
  compatibility projection for legacy datasets.
- Each export has one UUID/timestamp identity, an emitted-file shard inventory,
  and explicit compatibility projection references.
- Repository, file, unit, component, contributor, dependency-file, and
  contributor-repository records carry stable additive IDs.
- Static and hosted readers reject unsupported, incomplete, or unsafe v2
  manifests while preserving v1 fallback behaviour.

The contract decision and field rules remain governed by
[ADR-0018](./adr/0018-adopt-versioned-canonical-analysis-snapshots.md).

### Parser coverage

- Rust uses `web-tree-sitter` and `tree-sitter-rust` for syntax-backed units and
  conservative dependency extraction
- the Rust pilot produced a measurable quality improvement on Tokio
- Tree-sitter WASM assets are embedded successfully in standalone Bun binaries
- Haskell has dedicated unit and dependency heuristics
- HTML, XML, JSON, YAML, CSS, Shell, and SQL have explicit analyzers rather than
  silently falling through the original language matrix

The Rust evidence is recorded in
[Rust Tree-sitter Migration Discovery](./rust-tree-sitter-migration-discovery.md).

## Durable gaps

### 1. Trends are a surface without longitudinal data

The hosted trends route exists, but `readReportTrendsSummary` still returns an
unavailable state. Planetnik needs multiple comparable snapshots before it can
claim trend direction or regression detection.

### 2. Actionability is mostly report-scoped

Individual hotspot, control, security, coupling, and impact views exist. The
next product-level gap is a portfolio queue that ranks evidence-backed actions
across repositories without hiding the underlying signals.

### 3. Language support depth is uneven

Rust has proved the parser-backed approach, while Python still advertises unit
and complexity capabilities without producing units or dependencies. The
project needs a reusable parser adapter and demand-led language expansion, not
a parser rewrite for every recognized extension.

### 4. Hosted intelligence lacks a canonical persisted substrate

The hosted runtime can browse filesystem-backed reports, but it does not yet
ingest versioned analysis snapshots as durable entities. Semantic retrieval
would be premature until those entities and their provenance are stable.

## Delivery sequence

## Phase 1 — Versioned canonical analysis snapshots

**Status: Delivered — canonical snapshot contract and compatibility-removal proof green**

### Outcome

Static reports, hosted reports, parser improvements, and future ingestion all
consume the same explicit, versioned, machine-first snapshot contract.

### Deliverables

- accept an ADR declaring canonical JSON snapshots as the reporting source of
  truth
- add `metrics.json` while retaining `metrics.txt` as a compatibility
  projection
- make static and hosted metrics consumers JSON-first
- make contributor consumers use the existing `contributors.json` contract
  before falling back to `contributors.txt`
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
- reject invalid v2 manifests at the runtime and static-loader boundaries,
  while retaining v1/TXT compatibility
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
  route; the repo-scoped route directly showed the same audience, story, table,
  and evidence surfaces
- the partial fixture directly explained that `impact.json` was unavailable and
  kept the available component evidence, but the partial story was not run to
  its unavailable step
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

**Status: Next, after the parser fact shape in Phase 1 is fixed**

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
  real repositories
- port Python unit, complexity, and conservative import extraction
- validate Python against fixtures plus one representative public corpus
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

**Status: Next**

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

## Phase 4 — Portfolio action queue

**Status: Later**

### Outcome

Landscape users receive one explainable queue of the most important
interventions across repositories.

### Deliverables

- combine hotspot, control, security, impact, coupling, ownership, and trend
  evidence without collapsing them into an opaque score
- provide repository, team, severity, evidence, and time-window filters
- show why an item is ranked and which existing report surfaces support it
- support explicit acknowledgement or workflow state only in the hosted product

### Exit criteria

- each queue item is reproducible from canonical snapshot records
- ranking factors are visible and testable
- the static product can display the queue without requiring hosted services

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
| Now | Phase 2: shared parser adapter and Python pilot |
| Completed | Phase 1: versioned canonical snapshots and compatibility-removal proof |
| Next | Phase 2: shared parser adapter and Python pilot |
| Next | Phase 3: real snapshot trends |
| Later | Phase 4: portfolio action queue |
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
contexts. It retains TXT projections and v1 fallback behaviour.

The Phase 1 compatibility-removal gate is green as of 2026-08-16. The
[JSON-only fixture matrix](./compatibility-removal-fixture-matrix.md) covers
the single-repository and landscape static loaders plus every hosted reader
surface, with `metrics.txt` and `contributors.txt` absent. TXT export and v1
fallback remain available for migration, but current routes no longer require
those projections as primary input.

The next bounded move is Phase 2: extract a shared parser adapter and prove it
with the Python pilot, after the Rust evidence and canonical snapshot contracts.
Keep Code City follow-ons bounded to its direct interaction matrix, landscape
aggregation, and hosted repo-scoped integration; do not widen into a renderer
rewrite or new semantic shard without evidence.
