# ADR-0018: Adopt Versioned Canonical Analysis Snapshots

## Status

Accepted

## Date

2026-08-05

## Decision-makers

Planetnik maintainers

## Context and Problem Statement

Planetnik already exports useful JSON, but the reporting products do not yet
consume one explicit snapshot contract. The single-repository exporter writes
`metrics.txt` and `contributors.txt` while the static site and hosted runtime
still parse those files as primary inputs. `contributors.json` already exists,
and landscape export already emits a `report_context.json` manifest, but the
single-repository path does not emit that manifest and the existing manifest
only carries a bare `dataVersion`.

This makes parser changes, hosted ingestion, and future longitudinal views
harder to evolve safely: consumers cannot reliably identify a snapshot, learn
which canonical shards are present, or distinguish a canonical artifact from a
compatibility projection. It also leaves the static and hosted products with
different reconstruction rules. The first JSON-first slice established the v2
boundary; this ADR amendment records the identity, inventory, and validation
rules that make that boundary safe to consume.

The decision is constrained by the existing architecture:

- `apps/site` remains a static, snapshot-driven product; it must not depend on
  hosted services (ADR-0015).
- `apps/runtime` and `apps/copilot-runtime` may read the same exported files,
  but must not make the static site depend on their runtime code.
- Bun and Effect remain first-class, and this slice must not add a runtime
  dependency merely to serialize or identify a snapshot.
- Existing JSON shapes and legacy TXT/HTML outputs must remain usable during
  migration.

## Decision Drivers

- Make the exporter-to-loader boundary machine-first and explicit.
- Let old datasets continue to render while new datasets become JSON-first.
- Keep one portable contract usable by the static site, hosted runtime, and
  future ingestion without coupling those applications together.
- Keep the first migration small enough to verify at exporter and loader
  boundaries before broadening the shard inventory.

## Decision

Planetnik will treat versioned JSON analysis snapshots as the source of truth
for static and hosted report consumers. TXT and HTML outputs remain optional
compatibility or presentation projections and are never the primary input for
new consumer code. This option is chosen because it preserves existing
portable exports while removing text parsing from the critical path, with less
migration risk than a one-file rewrite or database-first ingestion.

### Snapshot manifest

Both single-repository and landscape exporters will emit a
`data/report_context.json` manifest with these fields in `dataVersion: 2`:

- `snapshotId`: a fresh UUID generated once per export run and shared by that
  run's manifest and canonical shards. Re-running an analysis creates a new
  snapshot identity, even when the resulting values are unchanged.
- `generatedAt`: one ISO-8601 timestamp captured for the export run.
- `mode` and `reportMode`: the existing report-mode discriminators.
- `capabilities`: the canonical domains guaranteed by the manifest.
- `canonicalShards`: a capability-to-relative-file map for the canonical JSON
  shards guaranteed by the manifest.
- `compatibilityProjections`: a capability-to-relative-file map for legacy
  projections that are still emitted.
- `repositoryId`: the stable repository entity ID for a single-repository
  snapshot.
- `entityIdPolicy`: the stable ID schemes used by canonical entity records.

The single-repository manifest guarantees `summary`, `metrics`, and
`contributors` at minimum, referencing `analysisResults.json`, `metrics.json`,
and `contributors.json`. It dynamically enumerates every known JSON shard that
was emitted and records only the TXT projections that exist. The landscape
manifest keeps its existing mode and navigation fields and dynamically
advertises its analysis, overview, repository, contributor, team, topology,
tag, and tag-matrix JSON shards when the staged export has emitted them.
`repositories.txt`, `contributors.txt`, and `teams.txt` are recorded only when
present.

The exporter writes a partial landscape manifest after core analysis and
overview contracts. The existing core → people → repositories → tags sequence
refreshes that manifest after each stage; the final context is the complete
snapshot boundary. A consumer must validate the manifest before treating a
v2 context as usable:

- `dataVersion` must be `2`, `snapshotId` must be UUID-shaped, and
  `generatedAt` must be an exact ISO timestamp.
- Single-repository contexts require a non-empty `repositoryId`; both modes
  require all five `entityIdPolicy` entries.
- Every `canonicalShards` key must appear in `capabilities`, point to a safe
  relative `.json` path, and resolve to an emitted file. The required core
  keys are `summary`, `metrics`, and `contributors` for single-repository
  snapshots, and `analysis` and `overview` for landscape snapshots.
- Declared compatibility projections must also be safe relative paths to
  existing files. Invalid v2 contexts are rejected or reduced to the existing
  v1 fallback; v1 contexts retain their current behaviour.

`dataVersion: 1` remains the legacy manifest format. Readers must continue to
accept v1 datasets while preferring v2 JSON shards. A future incompatible
contract requires a new data version; additive fields do not require a new
version. The first slice does not remove or rewrite existing JSON shard shapes.

### Canonical shard migration

- `metrics.json` will contain the existing metric values as
  `{ title, timestamp, metrics: [{ id, value }] }`.
- `contributors.json` remains the existing object-shaped contract and gains
  only additive status/percentage fields needed by JSON-first consumers.
- Static, hosted, and copilot contributor readers will use `contributors.json`
  before falling back to `contributors.txt`.
- Static and hosted metrics readers will use `metrics.json` before falling back
  to `metrics.txt`.
- Exporters will continue writing both JSON and TXT for the migration period;
  an empty contributor analysis will still produce an empty canonical JSON
  shard so the manifest cannot point at stale data.

Entity-level IDs are now formalized and additive. The exporters publish the
policy in every v2 manifest:

- `repo:<normalised repository key>` for repositories
- `file:<normalised relative path>` for files
- `unit:<normalised relative path>:<start line>` for units
- `component:<decomposition key>:<component name>` for components and their
  dependency endpoints
- `contributor:<lowercase trimmed email>` for contributors

The same IDs are used for contributor-repository and dependency-file records;
existing route-facing IDs are preserved for compatibility.

## Alternatives Considered

### Keep TXT as the primary contract

This preserves the current implementation cost, but keeps every new consumer
coupled to presentation-oriented parsing and makes cross-snapshot evolution
unsafe. It is rejected.

### Replace all exports with one large snapshot file

This would simplify one-file transport, but creates large downloads and broad
changes to existing loaders. It is rejected in favour of typed, independently
evolvable shards.

### Introduce database ingestion before stabilising the export contract

The hosted runtime already has a database direction, but ingesting unstable
TXT/JSON shapes would encode the current ambiguity and make static portability
worse. Database persistence remains a later projection of canonical snapshots.

### Use deterministic content hashes for `snapshotId`

Content identity would make identical re-exports collapse to one ID, which is
useful for deduplication but cannot distinguish separate analysis runs for
longitudinal comparison. A fresh UUID per export is the safer snapshot
boundary; content-addressed deduplication can be added later without changing
the manifest shape.

## Consequences

### Positive

- Static and hosted consumers share an explicit, machine-first boundary.
- A report can identify its export run and inspect its available canonical
  shards without guessing from filenames.
- Consumers can reject incomplete, unsafe, or unsupported v2 manifests before
  they parse domain shards, while legacy v1 datasets continue to work.
- Entity records can be joined across the static site, hosted runtime, and
  future persistence without inventing consumer-specific IDs.
- TXT compatibility can be removed incrementally after old datasets and
  consumers have migrated.
- Parser and future ingestion work can target stable snapshot metadata instead
  of presentation artefacts.

### Costs and risks

- Exporters temporarily write duplicate JSON and TXT representations.
- v1 fallback paths must remain covered until old datasets age out.
- A UUID makes identical re-exports distinct; trend and ingestion work must
  define deduplication policy separately.
- The manifest will grow as additional domains become canonical; each new
  domain must add a contract test rather than silently relying on a filename.

## Non-goals

- Implementing longitudinal trends or comparison queries.
- Persisting snapshots in Neon/Postgres or adding semantic retrieval.
- Porting another parser or changing Tree-sitter analysis semantics.
- Removing legacy TXT/HTML generation in this slice.
- Redesigning existing files, units, dependency, quality, or security JSON
  payloads.

## Related ADRs and Evidence

- [ADR-0003: Backend-only parity with Astro frontend](./0003-backend-only-parity-astro-frontend.md)
- [ADR-0007: Decomposition-aware JSON contracts](./0007-restore-logical-decomposition-parity-with-decomposition-aware-contracts.md)
- [ADR-0009: Tree-sitter Rust parser pilot](./0009-pilot-tree-sitter-for-rust-parser-parity.md)
- [ADR-0015: Separate static reports and hosted runtime](./0015-adopt-separate-static-reports-and-hosted-runtime-for-intelligence.md)
- [Product roadmap](../product-roadmap.md), Phase 1 and its immediate next move
- [Compatibility-removal fixture matrix](../compatibility-removal-fixture-matrix.md)
- [Archived report-data modernization roadmap](../report-data-modernization-roadmap.md), canonical contract inventory

## Implementation Plan

1. Add a small export-run identity/context helper in
   `packages/reports/src/exporters/SnapshotContext.ts`, then consume it from
   `DataExporter.ts` and `LandscapeDataExport.ts`. Capture one UUID and
   timestamp per export invocation; emit v2 manifests while retaining the
   current navigation and mode fields.
2. Extend `DataExporter` with `metrics.json`, a single-repository
   `report_context.json`, and an always-present empty-safe `contributors.json`.
   Keep the existing TXT writes as projections and preserve current JSON field
   names, adding only the status/percentage fields required by readers.
3. Update the static loader and schema in
   `apps/site/src/loaders/planetnik-loader.ts` and
   `apps/site/src/content.config.ts` to prefer canonical JSON and accept legacy
   v1 contexts/TXT fallbacks.
4. Update the hosted readers and response schema in
   `apps/runtime/src/lib/report-datasets.ts` and
   `apps/runtime/src/routes/reports/index.ts` to expose optional v2 manifest
   metadata and use JSON-first metrics/contributors for root and repo-scoped
   data directories.
5. Update `apps/copilot-runtime/src/data.ts` to read the existing contributor
   JSON contract before its TSV fallback.
6. Add exporter-to-loader contract tests in
   `packages/reports/src/__tests__/DataExporters.test.ts`,
   `packages/reports/src/__tests__/LandscapeDataExport.test.ts`,
   `apps/runtime/src/lib/__tests__/report-datasets.test.ts`, and a focused
   static-loader test under `apps/site/src/lib/__tests__/`.
7. Formalize the shared entity-ID policy in
   `packages/reports/src/exporters/EntityIdentity.ts`, add IDs to canonical
   records, and publish `repositoryId` plus `entityIdPolicy` in both manifests.
8. Derive complete emitted-file inventories for both exporters and validate v2
   manifests in the hosted and static readers, including negative fixtures for
   unsupported versions, missing declarations/files, and unsafe paths.

### Dependencies and configuration

- **Dependencies:** none. Use Bun's built-in `crypto.randomUUID()` and the
  existing filesystem/JSON helpers.
- **Configuration:** none. The manifest is generated from the existing export
  commands and requires no new environment variables or feature flags.
- **Migration:** emit v2 JSON and the current TXT projections together; make
  all named consumers JSON-first; retain v1/TXT fallbacks until the fixture and
  dataset inventory proves they are no longer needed.

### Patterns to follow

- Use existing `JSON.stringify(..., null, 2)` export style and `readJsonFile` /
  `readJsonRecord` helpers.
- Keep loader IDs stable and preserve existing collection schemas.
- Treat the manifest as metadata about the snapshot, not as a replacement for
  domain shard payloads.
- Use Bun's built-in `crypto.randomUUID()`; do not add a package for UUIDs.

### Patterns to avoid

- Do not make TXT parsing the first branch in a new or migrated reader.
- Do not import Astro page code into the hosted runtime or vice versa.
- Do not flatten all report data into one file or change existing shard shapes
  for convenience.
- Do not claim v2 support without a fixture that removes the TXT projection.

## Verification

- [x] `DataExporter` emits `metrics.json` and a v2 single-repository manifest
      with one shared UUID/timestamp and the documented shard/projection maps.
- [x] `LandscapeDataExport` emits the same v2 identity metadata while retaining
      its existing landscape fields and navigation.
- [x] JSON-first exporter/loader contract tests pass with TXT files removed;
      the same tests pass with JSON removed and TXT fixtures retained.
- [x] Empty contributor analyses produce an empty canonical JSON shard rather
      than leaving stale contributor data behind.
- [x] Static and hosted typechecks pass, including the response schema for
      optional v2 metadata.
- [x] Stable entity IDs are additive across single-repository and landscape
      canonical records, and the identity policy is present in v2 manifests.
- [x] Manifest inventories are derived from emitted files; staged landscape
      export refreshes preserve one snapshot identity through completion.
- [x] Runtime and static readers reject invalid v2 manifests while retaining
      v1/TXT compatibility fixtures.
- [x] JSON-only compatibility-removal matrix covers 19 single-repository
      hosted readers, 8 landscape-root readers, 19 landscape repository
      readers, and 29 static loader collections without any TXT projections;
      see [the executable matrix](../compatibility-removal-fixture-matrix.md).
- [ ] `bun test` and the repository's documented release gates pass without
      changing unrelated roadmap/documentation work.

Fresh verification on 2026-08-16: the focused compatibility command passes
with 64 tests and 124 expectations; the full `bun test` suite passes with 946
tests. Runtime and site typechecks pass. The final repository-gate item remains
open because root `bun run typecheck` still reports the pre-existing
`apps/app/astro.config.mjs` `cache` option error and `bun run lint` reports the
repository-wide diagnostics baseline. No lint autofix was run, and unrelated
baseline files were preserved.
