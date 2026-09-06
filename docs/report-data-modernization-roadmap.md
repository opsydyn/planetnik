# Report Data Modernization Roadmap

> **Status: Archived — 2026-07-19**
>
> This discovery supplied the canonical-snapshot direction now incorporated
> into the [canonical product roadmap](./product-roadmap.md). Preserve it as
> architectural evidence, but do not use its phase numbering for current
> sequencing.
>
> The static/hosted/Copilot/landscape reader holdouts described below were
> retired on 2026-09-05. Their TXT artifacts remain writer-only compatibility
> projections; see the canonical roadmap and ADR-0018 for current policy.

## Why this discovery exists

Planetnik is currently carrying three overlapping reporting eras at the same time:

1. **Sokrates-era text and HTML lineage** — `RichTextReport`, `ReportRenderer`, `ReportFileExporter`, and the Java-parity generator stack still exist and still write HTML files such as `index.html`.
2. **Astro/static-site JSON contracts** — much of the current site already consumes JSON such as `analysisResults.json`, `hotspots.json`, `impact.json`, `contributors.json`, `report_context.json`, and the landscape contract set.
3. **Hosted intelligence ambitions** — the hosted runtime already uses Neon Postgres, and the roadmap already points toward semantic retrieval, memory, and AI-assisted analysis.

The core modernization problem is **not** that Planetnik lacks JSON. The repo already exports a lot of it.

The problem is that Planetnik still lacks a **single canonical, versioned, machine-first analysis contract** that clearly separates:

- canonical analysis facts
- compatibility/debug projections
- presentation artifacts
- hosted semantic projections

That makes the platform harder to evolve, makes Tree-sitter upgrades harder to land cleanly, and leaves AI features standing on transitional data rather than stable contracts.

## Current-state findings

### What the codebase says today

| Area | Evidence | What it means |
| --- | --- | --- |
| Single-repo export is mixed-mode | `packages/reports/src/exporters/DataExporter.ts` writes both JSON and text outputs | Single-repo reporting still treats text exports as first-class artifacts instead of optional derived outputs |
| Static site still parses legacy text | `apps/site/src/loaders/planetnik-loader.ts` reads `metrics.txt` and `contributors.txt` | The frontend contract is still partially anchored to text dumps |
| Landscape repo pages still read text in places | repo-scoped landscape pages still read `metrics.txt` for some views | Landscape is more modern overall, but the migration is not complete |
| HTML lineage is still active in code | `packages/reports/src/generators/BasicSourceCodeReportGenerator.ts` still builds `RichTextReport` instances for `*.html` pages; `packages/reports/src/core/ReportFileExporter.ts` still writes HTML files and `index.html` | The Java HTML abstraction is not just historical documentation; it still exists as executable compatibility code |
| Parity docs explicitly describe the legacy layer | `packages/reports/src/generators/ASTRO_PARITY.md`, `packages/reports/src/landscape/ASTRO_PARITY.md`, and `packages/reports/src/core/ASTRO_PARITY.md` all describe TS generator/core files as legacy parity layers | The repo already knows these layers are transitional |
| Landscape export is already JSON-first | `packages/reports/src/landscape/data/LandscapeDataExport.ts` exports `report_context.json`, `landscape_overview.json`, `landscape_repositories.json`, `landscape_contributors.json`, `landscape_teams.json`, `landscape_topology.json`, and more | Landscape mode is the clearest proof that Planetnik can operate on explicit JSON contracts |
| Hosted intelligence already has a durable backend direction | `apps/runtime/src/db/index.ts` uses Neon-backed Postgres via Drizzle | Hosted semantic capabilities can evolve on the existing platform instead of introducing a second persistence stack |
| Existing ADRs already prefer semantic contracts over presentation parity | `docs/adr/0007-restore-logical-decomposition-parity-with-decomposition-aware-contracts.md` says “Prefer semantic parity over 1:1 HTML parity” | The repo already has the right architectural instinct; this roadmap generalizes that principle |
| Tree-sitter work already warns about syntax vs semantics | `docs/tree-sitter-rust-pilot-checklist.md` says to “document the boundary between parser syntax extraction and later semantic heuristics” | Parser modernization and AI/data modernization should be designed together, not bolted together later |

### Artifact classes in the current platform

| Artifact class | Examples | Current role | Recommended future role |
| --- | --- | --- | --- |
| Canonical-ish JSON contracts | `analysisResults.json`, `hotspots.json`, `impact.json`, `contributor_impact.json`, `controls.json`, `contributors.json`, `report_context.json`, `landscape_overview.json` | Real data inputs to Astro and hosted flows | Keep and strengthen as the source of truth |
| Transitional text dumps | `metrics.txt`, `files.txt`, `contributors.txt`, `controls.txt`, `units.txt`, `duplicates.txt`, `dependencies_*.txt`, `temporal_dependencies*.txt` | Mixed frontend, compatibility, and human-readable debug outputs | Demote to optional compatibility/debug projections |
| Legacy HTML/RichText pipeline | `RichTextReport`, `ReportRenderer`, `ReportFileExporter`, `BasicSourceCodeReportGenerator`, `LandscapeReportGenerator` | Sokrates-compatible rendering lineage | Remove from the primary path; keep temporarily only behind compatibility flags if needed |
| Hosted semantic/runtime projections | Neon tables, future embedding documents, chat context, saved notes | Early-stage / partially implemented | Build on top of canonical snapshots, not raw text or HTML |

## Diagnosis

Planetnik’s reporting layer is currently **good enough to ship reports**, but not yet ideal for long-term platform evolution.

### The main structural issues

1. **Contract drift**
   - the same logical area is sometimes represented in JSON, sometimes in TXT, and sometimes via legacy HTML-oriented abstractions
   - consumers have to know too much about artifact shape and history

2. **Page-shaped exports instead of domain-shaped contracts**
   - some exports still exist because a historical report page needed them, not because they define a stable domain boundary
   - this makes it harder to share contracts across the static site, hosted runtime, and future AI workflows

3. **AI-hostile ground truth**
   - text dumps are readable, but they are weak canonical inputs for retrieval, provenance, citations, filtering, and semantic enrichment
   - embeddings over unstable or presentation-biased text would freeze the wrong abstraction

4. **Parser improvements have no clearly protected landing zone**
   - Tree-sitter can improve units, dependencies, symbol spans, and lexical signals
   - without a stable downstream contract, parser upgrades risk producing more one-off exporter logic instead of reusable facts

5. **Hosted and static delivery modes need a common substrate**
   - the static site should remain snapshot-driven
   - the hosted runtime should add richer querying and semantic features
   - both should still speak the same canonical analysis language

## What “minimum JSON” should mean

“Minimum JSON” should **not** mean one giant file or the smallest possible amount of data.

It should mean the **smallest stable, machine-first, versioned contract set** that can support:

- the static site
- hosted report browsing
- AI retrieval and citations
- parser evolution
- regression testing
- future export/import workflows

### Properties of the minimum canonical contract

The canonical contract should be:

- **versioned** — explicit `dataVersion` or `contractVersion`
- **manifest-driven** — `report_context.json` should describe what is present and which capabilities are available
- **ID-stable** — entities need durable IDs, not just display names
- **domain-oriented** — shaped around files, units, components, contributors, dependencies, history, quality, security
- **machine-first** — no frontend should need to scrape text dumps to reconstruct meaning
- **projection-friendly** — large datasets may stay sharded rather than flattened into one file
- **presentation-neutral** — no HTML assumptions baked into the source of truth
- **semantic-ready** — entity provenance and summaries can be derived for retrieval and explanations

### Recommended canonical contract set

This is intentionally evolutionary, not a rewrite-from-scratch proposal. Existing good JSON should be kept where it already works.

| Domain | Canonical files |
| --- | --- |
| Context | `report_context.json` |
| Summary | `analysisResults.json` or a future `summary.json` alias |
| Metrics | **add a canonical JSON form** such as `metrics.json`; stop treating `metrics.txt` as primary |
| Files | `files_main.json`, `files_test.json` |
| Units | `units.json` |
| Architecture | decomposition-aware component and dependency JSON contracts |
| History | `temporal_dependencies.json`, `commits_per_extension.json`, `contributor_timeline.json` |
| People | `contributors.json`, `contributor_details/*.json`, `people_dependencies*.json` |
| Quality | `controls.json`, `findings.json`, `hotspots.json`, `impact.json`, duplication JSON exports |
| Security | landscape security JSON exports now; single-repo or hosted security later if added |

The key point is simple:

> if the site, hosted runtime, or AI layer needs a data shape more than once, it should exist as explicit JSON rather than being reconstructed from text or HTML-era artifacts.

## Recommended target architecture

### Layer 1: Parser fact layer

This layer is where heuristic analyzers and Tree-sitter adapters produce structured facts such as:

- file metadata
- units and spans
- complexity signals
- imports and dependency edges
- comments/docstrings/lexical cues where appropriate

This layer should remain **syntax- and evidence-oriented**.
It should not pretend to perform whole-program semantic resolution when the parser cannot truly support it.

### Layer 2: Canonical analysis snapshot layer

This is the durable build artifact written to disk for static reports and ingestion.

It should provide:

- stable IDs
- typed domain shards
- snapshot metadata
- feature/capability flags
- clear provenance for derived scores

This is the layer the static site should consume directly.
It is also the layer the hosted runtime should ingest.

### Layer 3: Projection layer

This layer contains optional, consumer-specific outputs derived from the canonical snapshot:

- compatibility TXT dumps
- compatibility HTML outputs
- chart-ready aggregates
- CSV downloads
- cached overview summaries

These are useful, but they are **not** the source of truth.

### Layer 4: Hosted entity store

The hosted runtime should ingest canonical snapshots into Neon/Postgres for:

- multi-tenant report browsing
- saved report metadata
- cross-snapshot comparisons
- filtered queries without reparsing JSON on every request
- future longitudinal and organizational analysis

The database is a projection and query accelerator, not a replacement for the canonical snapshot contract.

### Layer 5: Semantic retrieval layer

Semantic capabilities should be built on curated documents derived from canonical entities, for example:

- project summaries
- component summaries
- hotspot narratives
- contributor summaries
- security summaries
- change/trend summaries

Each semantic document should retain:

- snapshot ID
- entity type
- entity ID
- source record references

That allows the agent to retrieve semantically and then rehydrate exact factual records for grounding and citation.

## Key recommendations

### 1. Make canonical JSON the explicit policy

Adopt a repo-wide rule:

- JSON contracts are the reporting source of truth
- TXT and HTML artifacts are optional compatibility/debug outputs
- no new frontend or hosted feature should depend primarily on text dumps

This extends the spirit of ADR-0007 from logical decomposition into the whole reporting surface.

### 2. Fix the obvious stragglers first

The first wave should target the places where the platform is still clearly depending on text:

- replace `metrics.txt` as a primary contract with `metrics.json`
- switch loaders that still parse `contributors.txt` to `contributors.json`
- remove repo-page dependencies on `metrics.txt` where they still exist

This is low-drama, high-leverage work.

### 3. Keep the manifest pattern and strengthen it

`report_context.json` is already the right direction.
It should become the canonical manifest for both single-repo and landscape snapshots, including:

- contract version
- report mode
- available domains/capabilities
- optional file references or shard presence
- compatibility flags where legacy projections still exist

### 4. Use landscape as the reference model where it is already ahead

Landscape export is already more explicitly JSON-first than single-repo export.
Where practical, single-repo contracts should follow the same style:

- explicit overview files
- explicit report context
- explicit collections rather than text parsing

### 5. Separate parser facts from semantic enrichment

Tree-sitter expansion should feed a stable normalized fact model.
Semantic capabilities should be layered on top, not mixed into parser adapters.

That keeps the contract honest:

- Tree-sitter improves extraction fidelity
- enrichment computes higher-level semantics
- AI retrieval summarizes and retrieves

Each layer stays testable.

### 6. Ingest snapshots into Neon before adding embeddings

The hosted runtime already has a good persistence base.
Before adding `pgvector`, Planetnik should first establish a reliable relational or `jsonb` entity store for:

- snapshots
- entities
- relationships
- report metadata

That gives the hosted platform a strong queryable substrate even before semantic retrieval arrives.

### 7. Add `pgvector` only after the contract is stable enough to deserve it

`pgvector` is a good fit for Planetnik, but it should be a **phase-two multiplier**, not phase-one glue.

Embed stable, curated semantic documents — not raw HTML, not legacy text dumps, and not every primitive metric row on day one.

## pgvector assessment

### Why it is a good fit

`pgvector` is a strong candidate because:

- Planetnik already uses Neon Postgres in `apps/runtime`
- it keeps operational complexity lower than adding a separate vector database immediately
- it pairs naturally with structured relational and `jsonb` records
- it enables hybrid retrieval patterns where semantic search resolves to exact snapshot/entity IDs

### Where it should be used

Recommended initial semantic document types:

- project summary narratives
- component summaries
- hotspot opportunity summaries
- contributor and team summaries
- security posture summaries
- trend/diff summaries between snapshots

Recommended retrieval pattern:

1. retrieve candidate semantic documents by vector similarity
2. resolve returned entity IDs back to canonical snapshot records
3. answer from the exact grounded JSON facts

### What to avoid

Do **not** start by embedding:

- `metrics.txt`
- HTML report bodies
- arbitrary page markup
- unstable compatibility exports
- every raw edge or row without a curated summary strategy

That would create a semantic layer on top of unstable contracts and presentation-biased text.

### Bottom line

`pgvector` should be adopted **after** canonical snapshot contracts and hosted snapshot ingestion are in place.
It is a good fit for Planetnik’s hosted intelligence direction, but not the first brick.

## Relationship to Tree-sitter

This modernization work ties directly into the Tree-sitter roadmap.

### Why they reinforce each other

Tree-sitter can improve:

- unit extraction accuracy
- dependency coverage
- lexical and structural evidence quality
- location/span fidelity
- future symbol-aware analysis

But Tree-sitter alone does not modernize the platform if the output still flows into legacy text or HTML-era assumptions.

### The right contract boundary

The parser boundary should produce normalized facts such as:

- unit kind
- unit name
- span
- parameter count
- import/dependency evidence
- optional lexical tokens or doc-comment fragments where appropriate

The enrichment boundary can then derive:

- semantic coupling
- naming clusters
- domain language extraction
- higher-confidence hotspot narratives
- AI-facing semantic documents

This matches the rule already captured in the Tree-sitter pilot checklist: syntax extraction first, semantic heuristics later.

## Phased rollout

### Phase 0 — Freeze the contract problem clearly

- document which loaders and pages still depend on TXT artifacts
- classify every export as canonical, compatibility, or presentation
- add explicit deprecation comments where legacy projections remain necessary

**Exit criteria:** the repo has a maintained inventory of legacy consumers and no ambiguity about which artifacts are canonical.

### Phase 1 — Canonicalize the obvious text holdouts

- add `metrics.json` as the canonical metrics contract
- switch single-repo metrics loading to JSON first
- switch contributor loading to `contributors.json`
- remove remaining site/runtime dependencies on `metrics.txt` where practical

**Exit criteria:** no core page or loader requires `metrics.txt` or `contributors.txt` as a primary input.

### Phase 2 — Strengthen the snapshot manifest and contract tests

- enrich `report_context.json` for single-repo and landscape modes
- add contract-version assertions
- add exporter/loader tests around the canonical snapshot set
- codify stable IDs and capability flags

**Exit criteria:** the snapshot contract is versioned, explicit, and test-protected.

### Phase 3 — Demote the legacy HTML/TXT pipeline

- move `RichTextReport`/HTML export off the primary path
- keep compatibility generation only behind explicit options if still needed
- stop adding new generator logic to the legacy report abstraction

**Exit criteria:** the legacy generator/core stack is no longer the default reporting path.

### Phase 4 — Hosted snapshot ingestion on Neon

- ingest canonical snapshot metadata and entities into hosted storage
- support filtered/runtime queries over stored entities
- establish stable snapshot/entity references for future semantic retrieval

**Exit criteria:** the hosted runtime can browse and query canonical analysis entities without relying on ad hoc file parsing alone.

### Phase 5 — Curated semantic retrieval with `pgvector`

- create curated semantic documents from canonical entities
- store embeddings with snapshot/entity references
- implement hybrid retrieval that always rehydrates grounded facts

**Exit criteria:** hosted intelligence can answer fuzzy questions semantically while still citing exact canonical records.

### Phase 6 — Tree-sitter expansion on top of the stabilized contract

- extend Tree-sitter adapters to additional languages
- map richer parser facts into the canonical snapshot model
- add new semantic enrichments only where the fact model supports them cleanly

**Exit criteria:** parser improvements land as contract improvements, not as one-off exporter hacks.

## Recommended first implementation slice

If this work starts soon, the best first slice is:

1. add a canonical `metrics.json`
2. switch the site metrics loader to JSON-first
3. switch contributor loading to `contributors.json`
4. add stronger single-repo `report_context.json` coverage
5. add regression tests for those contracts

That slice is small enough to ship incrementally and meaningful enough to prove the direction.

## Recommended ADRs

The next ADR numbers available are `0018+`.

| Proposed ADR | Purpose | Recommended timing |
| --- | --- | --- |
| `0018-adopt-versioned-canonical-analysis-snapshots.md` | Declare canonical JSON snapshots as the reporting source of truth for static and hosted flows | Before or during Phase 1 |
| `0019-separate-parser-fact-extraction-from-semantic-enrichment.md` | Formalize the Tree-sitter boundary: parser facts first, semantic heuristics later | Before or during Phase 2 |
| `0020-demote-legacy-text-and-html-report-artifacts-to-compatibility-projections.md` | Move TXT/HTML outputs out of the primary contract path | Before or during Phase 3 |
| `0021-adopt-neon-backed-analysis-snapshot-ingestion-for-hosted-runtime.md` | Define how hosted runtime stores and queries canonical snapshots | Before or during Phase 4 |
| `0022-adopt-pgvector-for-curated-analysis-document-retrieval.md` | Define the semantic retrieval model for hosted intelligence | Before Phase 5 |

### Suggested ADR order

1. canonical snapshots
2. parser facts vs semantic enrichment
3. legacy projection demotion
4. hosted snapshot ingestion
5. semantic retrieval with `pgvector`

That order keeps the platform architecture honest and avoids trying to solve semantic retrieval before the facts are stable.

## Non-goals

This roadmap does **not** propose:

- replacing the static site with the hosted app
- making the static site depend on Neon or hosted services
- promising full language semantics from Tree-sitter
- deleting every compatibility artifact in one step
- embedding arbitrary HTML or text dumps as the long-term semantic substrate

## Final recommendation

Planetnik should modernize reporting around a simple rule:

> **canonical JSON snapshots first, derived projections second, semantic retrieval third.**

That sequence gives the project a clean bridge from Sokrates-era report lineage to a modern platform that supports:

- static reports
- hosted browsing
- richer parser output
- semantic retrieval
- AI-first workflows

without asking the platform to keep treating text and HTML compatibility artifacts as the center of the system.
