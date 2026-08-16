# Code City model from canonical JSON — Design

**Date:** 2026-08-16  
**Status:** Approved (design), pending spec review

## Goal

Build the first renderer-neutral `CodeCityModel` from Planetnik's existing v2
canonical JSON shards. Establish whether the current records are sufficient for
a useful repo-scoped Code City decision surface before adding an exporter shard,
route, WebGL renderer, or hosted/static integration.

The feasibility slice should answer at least one concrete engineering question:
which districts and files combine the largest structural footprint, change
pressure, ownership risk, and impact opportunity, with links back to existing
report evidence.

## Context and evidence

Phase 1 established the v2 snapshot boundary in [ADR-0018](../../adr/0018-adopt-versioned-canonical-analysis-snapshots.md).
The compatibility-removal matrix proves that current hosted and static route
readers can operate with the TXT projections absent. The current canonical
shards already provide:

- `report_context.json`: v2 identity, repository identity, capabilities, and
  emitted shard inventory
- `files_main.json` and optional `files_test.json`: stable file IDs, paths, LOC,
  components, concerns, churn, and contributor IDs
- `units.json`: stable unit IDs, file paths, LOC, McCabe complexity, parameters,
  and line ranges
- `component_dependencies.json`: decomposition-aware component endpoints,
  counts, LOC, and evidence counts
- `hotspots.json`: file, unit, and component health/risk records
- `impact.json`: selected file, unit, and component opportunities

No new canonical semantic shard is justified before this model reports what is
missing or ambiguous.

## Locked decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Public home | `packages/common/src/code-city` | Existing framework-free shared package; usable by static and hosted consumers without coupling them |
| Builder boundary | Pure function over parsed canonical shard objects | No filesystem, Astro, runtime, React, or renderer dependency |
| First model scope | Repo-scoped snapshot, primarily single-repository v2 data | Matches the roadmap and works for a landscape repository drill-down when its per-repository shards are supplied |
| District source | Logical components where decomposition membership is unambiguous; deterministic path groups otherwise | Preserves evidence without fabricating decomposition relationships |
| Building identity | One building per stable file ID | Avoids duplicate geometry when files have multiple component affiliations |
| Initial edges | Component dependency edges | Existing canonical JSON provides decomposition-aware edges; file-level graph expansion is deferred |
| Layout contract | Stable seed and ordering hints only | Keeps the model renderer-neutral and makes repeated exports deterministic |
| Missing optional data | Build with explicit diagnostics | A partial model remains useful without turning missing evidence into zero risk |
| Invalid required data | Fail closed with a typed input error | Prevents a misleading empty city from rendering |

## Public model contract

The model is a serialisable value object, not a scene graph:

```ts
type CodeCityModel = {
  readonly contractVersion: 1;
  readonly snapshot: {
    readonly repositoryId: string;
    readonly snapshotId?: string;
    readonly title: string;
    readonly generatedAt?: string;
  };
  readonly districts: readonly CodeCityDistrict[];
  readonly buildings: readonly CodeCityBuilding[];
  readonly units: readonly CodeCityUnit[];
  readonly edges: readonly CodeCityDependencyEdge[];
  readonly coverage: CodeCityCoverage;
  readonly layout: CodeCityLayoutHints;
  readonly legend: CodeCityLegend;
};
```

### Districts

Each district has a stable ID, `kind: "component" | "path"`, label, building
IDs, aggregate footprint/change/ownership/health/impact signals, and evidence
references. Component districts also retain their decomposition key. Path
districts retain the normalised path prefix used to derive them.

### Buildings

Each file is represented once, with its stable file ID, relative path,
extension, source-set labels, LOC, component affiliations, a deterministic
`primaryDistrictId`, raw signals, and evidence references. Multiple component
affiliations are preserved in `districtIds`; the primary district is only the
stable placement hint for a future renderer.

### Units

Each unit retains its stable unit ID, file ID, short/long name, LOC, McCabe
complexity, parameter count, line range, component affiliations, and evidence
references. A unit whose file is not present is not silently attached; it is
reported as an orphan diagnostic.

### Edges

Initial edges are component dependency records with a stable edge ID,
decomposition key, source and target district IDs, count, optional LOC/evidence
counts, and an endpoint resolution state. An edge is retained even if one or
both endpoint districts have no buildings, so the model does not hide evidence.

### Signals, evidence, and legends

Signals remain separate rather than being collapsed into one visual score:

- footprint: LOC
- complexity: maximum/representative McCabe complexity and unit count
- health: hotspot score, severity, and dominant risk dimension
- change pressure: commit count and temporal-link count
- ownership: contributor IDs and contributor count
- impact: selected impact score, dimension, and source ID when present

Evidence references use stable entity IDs, a kind (`file`, `unit`, `component`,
`hotspot`, or `impact`), and a relative report route. They do not contain an
environment-specific origin or slug. A later consumer can resolve the same
reference for static and hosted route bases.

`legend` describes the semantic channel names, units, and source fields. It is
part of the model so a renderer or table fallback cannot silently invent an
encoding.

`layout` contains only `contractVersion`, a stable seed derived from repository
identity and model version, and deterministic district/building/unit ordering
keys. It contains no coordinates, WebGL buffers, DOM nodes, or renderer types.

## Canonical input and derivation

The builder accepts parsed shard objects rather than paths:

```ts
type CodeCitySnapshotInput = {
  readonly context: CanonicalReportContext;
  readonly filesMain: CanonicalFilesShard;
  readonly filesTest?: CanonicalFilesShard;
  readonly units?: CanonicalUnitsShard;
  readonly componentDependencies?: CanonicalComponentDependenciesShard;
  readonly hotspots?: CanonicalHotspotsShard;
  readonly impact?: CanonicalImpactShard;
};
```

Derivation is ordered and deterministic:

1. Validate v2 context and require a repository identity. `filesMain` is the
   minimum viable shard.
2. Union main/test files by stable file ID while retaining source-set labels.
3. Create one building per file and index it by ID and normalised relative path.
4. Collect known component districts from decomposition-aware dependency
   endpoints and component hotspot IDs. Prefer supplied stable IDs; derive a
   component ID only when a decomposition key is present.
5. Attach a file to component districts only when its component name maps to a
   unique decomposition. Preserve all unambiguous affiliations.
6. For a file with no component or ambiguous decomposition membership, create or
   reuse a deterministic path district and emit a diagnostic.
7. Attach units by normalised `relativeFileName`. Preserve orphan units as
   diagnostics rather than dropping them silently.
8. Join hotspot and impact records by stable entity ID. Missing signals remain
   absent, not zero-risk.
9. Aggregate district values from child records only when no direct component
   record exists. Mark those districts as derived in coverage.
10. Retain component edges with resolved/unresolved endpoint state.
11. Sort every collection by stable ID and derive the layout seed without using
   `snapshotId`, so repeated exports remain spatially stable.

## Failure and diagnostics

`CodeCityInputError` is raised for:

- missing or invalid v2 context
- missing repository identity
- missing `filesMain`

Optional shard gaps and record-level problems are non-fatal. The model returns a
`CodeCityCoverage` object containing present/missing shard names and structured
diagnostics. Diagnostics cover malformed rows, dropped records, orphaned units,
orphaned hotspot/impact records, ambiguous component membership, unresolved
edge endpoints, and derived path districts.

This lets feasibility evaluation distinguish “the existing contract expresses
this view” from “the builder guessed a value.”

## Package architecture

The first implementation is confined to:

- `packages/common/src/code-city/CodeCityModel.ts` — public value types,
  diagnostics, legends, and input contracts
- `packages/common/src/code-city/CodeCityModelBuilder.ts` — pure normalisation
  and derivation
- `packages/common/src/code-city/index.ts` and
  `packages/common/src/index.ts` — barrel exports
- `packages/common/src/code-city/__tests__/CodeCityModel.test.ts` — focused
  canonical JSON fixtures and contract tests

No consumer imports, route files, exporters, package dependencies, or renderer
code change in this slice. Static and hosted integration will consume the
shared model only after the feasibility evidence is accepted.

## Verification

Focused tests must prove:

1. A JSON-only canonical fixture builds expected districts, buildings, units,
   edges, signals, evidence references, legend, and coverage.
2. Reordering every input array produces identical model output.
3. Stable IDs and layout seed remain unchanged across repeated builds.
4. Ambiguous/missing component membership becomes a path district and a
   diagnostic.
5. Orphan units, hotspots, impact records, and dependency endpoints are
   reported without disappearing from the evidence accounting.
6. Missing optional shards preserve a usable model with explicit coverage.
7. Invalid required input fails with `CodeCityInputError`.
8. The builder performs no filesystem, TXT, HTML, network, or renderer work and
   the result round-trips through `JSON.stringify`/`JSON.parse`.

Run the focused common test file and common typecheck first, then the repository
test suite if the focused checks are green. This slice claims model-contract
evidence only; it does not claim browser, visual, WebGL, bundle, or hosted-route
success.

## Exit criteria for the feasibility slice

- A shared `CodeCityModel` can answer at least one concrete risk/structure
  question from current canonical JSON.
- Stable IDs and ordering produce repeatable model output.
- Coverage diagnostics make every unsupported or ambiguous relationship
  visible.
- No new canonical shard is added unless tests demonstrate that an existing
  record cannot express a required relationship.
- The model is usable by a future table fallback and renderer without changing
  its public contract.
- A follow-on ADR records whether Code City is adopted, narrowed, or deferred.

## Explicitly out of scope

- Astro or hosted routes
- WebGL, 2.5D, 3D, canvas, SVG, or Draxul/native renderer work
- coordinates, camera state, interaction state, or layout engine selection
- new exporter shards or TXT/HTML compatibility removal
- landscape-root Code City aggregation
- historical trends, semantic embeddings, runtime coupling, or new language
  parser work
- copying Draxul code, assets, or renderer architecture

## Related records

- [Product roadmap — Phase 1.5](../../product-roadmap.md#phase-15--code-city-semantic-visualisation)
- [ADR-0018 — versioned canonical analysis snapshots](../../adr/0018-adopt-versioned-canonical-analysis-snapshots.md)
- [Phase 1 compatibility-removal fixture matrix](../../compatibility-removal-fixture-matrix.md)
