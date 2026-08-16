# Code City Model from Canonical JSON Implementation Plan

> Status: complete. The five implementation slices, focused contract suite, and
> repository test run are complete; the root typecheck remains blocked by the
> pre-existing `apps/app/astro.config.mjs:47` `cache` option diagnostic.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure, renderer-neutral `CodeCityModel` in `packages/common` from the existing v2 canonical JSON shards, with deterministic hierarchy/layout hints and explicit coverage diagnostics.

**Architecture:** Add a focused `packages/common/src/code-city` module. `CodeCityModel.ts` owns the public value types and canonical input contracts; `CodeCityModelBuilder.ts` owns validation, normalisation, joins, aggregation, and deterministic ordering. The builder accepts parsed objects, performs no I/O, and returns a serialisable model; static/hosted integration and renderers remain outside this slice.

**Tech Stack:** Bun 1.3.11+, TypeScript 6, `bun:test`, existing `@planetnik/common` package conventions, no new runtime dependencies.

## Global Constraints

- Keep the builder pure: no filesystem, network, Astro, React, WebGL, HTML, TXT, or renderer imports.
- Use `packages/common/src/code-city` and update both local and package barrel exports.
- Use v2 canonical JSON only; require `dataVersion === 2`, a non-empty `repositoryId`, and `filesMain`.
- Preserve stable IDs from canonical records; derive component IDs only when a decomposition key is present.
- Never collapse missing evidence into zero-risk values; report optional gaps and malformed relationships through diagnostics.
- Emit one building per file ID; retain multiple component affiliations separately from `primaryDistrictId`.
- Keep component dependency edges even when endpoint districts have no buildings.
- Derive layout seed from repository identity and model version, never from `snapshotId`.
- Do not add an exporter shard, route, renderer, dependency, or roadmap status change in this slice.
- Preserve unrelated dirty worktree changes and stage only files named by the current task.
- Run Bun commands from the repository root; use `~/.bun/bin/bun` if `bun` is not on `PATH`.

---

## File map

| File | Responsibility |
| --- | --- |
| `packages/common/src/code-city/CodeCityModel.ts` | Public model value types, canonical input shard types, diagnostics, and typed input error |
| `packages/common/src/code-city/CodeCityModelBuilder.ts` | Pure validation, shard normalisation, district/building/unit/edge derivation, signal joins, aggregation, coverage, and ordering |
| `packages/common/src/code-city/index.ts` | Code City module barrel |
| `packages/common/src/index.ts` | Package-level export of the Code City module |
| `packages/common/src/code-city/__tests__/CodeCityModel.test.ts` | Canonical JSON fixture and focused contract tests |

The only implementation files are the two module files and the two barrels.
The only test file is the focused Code City test file.

## Public interfaces used across tasks

All interfaces below live in `CodeCityModel.ts` and are exported from both
barrels. Use `readonly` properties and `readonly` arrays throughout.

```ts
export type CodeCityModel = {
  readonly contractVersion: 1;
  readonly snapshot: CodeCitySnapshotIdentity;
  readonly districts: readonly CodeCityDistrict[];
  readonly buildings: readonly CodeCityBuilding[];
  readonly units: readonly CodeCityUnit[];
  readonly edges: readonly CodeCityDependencyEdge[];
  readonly coverage: CodeCityCoverage;
  readonly layout: CodeCityLayoutHints;
  readonly legend: CodeCityLegend;
};

export function buildCodeCityModel(
  input: CodeCitySnapshotInput,
): CodeCityModel;
```

`CodeCitySnapshotInput` contains `context`, required `filesMain`, and optional
`filesTest`, `units`, `componentDependencies`, `hotspots`, and `impact` shard
objects. Canonical record types must cover the current JSON fields: file `id`,
`relativePath`, `extension`, `linesOfCode`, `components`, `concerns`, churn,
contributors; unit `id`, names, file path, LOC, McCabe, parameters, and line
range; component dependency decomposition/name/id/count/LOC/evidence; hotspot
id/kind/name/parent/route/score/severity/size/churn/complexity/dimensions; and
impact opportunity id/kind/name/parent/route/score/dimension/dimensions.

`CodeCitySignals` contains separate footprint, complexity, health, change,
ownership, and impact fields. Missing numeric or categorical evidence is
represented by `null`, not a fabricated zero. `CodeCityEvidenceRef` contains a
stable entity ID, a `kind` (`file`, `unit`, `component`, `hotspot`, or
`impact`), and a relative report route.

`CodeCityCoverage` contains present shard names, missing optional shard names,
structured diagnostics, derived district IDs, and record counts. Diagnostics
have a stable code, `warning`/`error` severity, shard name, optional entity ID,
and detail. `CodeCityInputError` is the only hard failure type.

### Task 1: Lock the public types and a canonical JSON fixture

**Files:**
- Create: `packages/common/src/code-city/CodeCityModel.ts`
- Create: `packages/common/src/code-city/index.ts`
- Modify: `packages/common/src/index.ts`
- Create: `packages/common/src/code-city/__tests__/CodeCityModel.test.ts`

**Interfaces:**
- Produces the exported `CodeCityModel`, `CodeCitySnapshotInput`, `CanonicalHotspotRecord`, `CanonicalImpactOpportunityRecord`, all other canonical shard record types, `CodeCityCoverage`, `CodeCityLayoutHints`, `CodeCityLegend`, `CodeCitySignals`, `CodeCityEvidenceRef`, and `CodeCityInputError` used by every later task.
- Does not export a builder yet; later tasks add `buildCodeCityModel` to the same module barrel.

- [x] **Step 1: Write the public-contract test and fixture values**

Add a `minimalInput()` helper in `CodeCityModel.test.ts` with this exact shape:

```ts
const minimalInput = (): CodeCitySnapshotInput => ({
  context: {
    dataVersion: 2,
    reportMode: "single_repository",
    title: "Fixture Repo",
    repositoryId: "repo:fixture",
    snapshotId: "snapshot-1",
    generatedAt: "2026-08-16T00:00:00.000Z",
  },
  filesMain: {
    files: [
      {
        id: "file:src/index.ts",
        relativePath: "src/index.ts",
        extension: "ts",
        linesOfCode: 120,
        components: ["runtime"],
        concerns: ["api"],
        commitsCount: 8,
        contributorsCount: 2,
        contributors: ["alan@example.com", "sam@example.com"],
      },
    ],
  },
});
```

Add a contract test that constructs a fully typed `CodeCityModel` value with
`contractVersion: 1`, one snapshot, empty entity arrays, explicit empty
coverage, layout, and legend, then asserts `JSON.parse(JSON.stringify(model))`
deep-equals the original value. This checks the value-object shape without
depending on the builder that a later task will add.

- [x] **Step 2: Run the new type contract test and confirm the expected missing-type failure**

Run:

```bash
bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts
```

Expected: the test fails to compile because `CodeCitySnapshotInput` and the
model types do not exist yet.

- [x] **Step 3: Define the public types and canonical input contracts**

Implement the exact type families listed in the “Public interfaces used across
tasks” section. Use literal unions for `district.kind`, edge kind, source-set
labels, diagnostic severity, diagnostic codes, and evidence kinds. Keep optional
canonical JSON fields optional at the input boundary and convert missing output
signals to `null` in the model types.

Define `CodeCityInputError` as:

```ts
export class CodeCityInputError extends Error {
  readonly _tag = "CodeCityInputError" as const;

  constructor(readonly code: "invalid_context" | "missing_repository" | "missing_files_main", message: string) {
    super(message);
    this.name = "CodeCityInputError";
  }
}
```

- [x] **Step 4: Export the module**

Export all Code City types and the error from `code-city/index.ts`, then add
`export * from "./code-city/index.js";` to `packages/common/src/index.ts`.

- [x] **Step 5: Run the contract test and package typecheck**

Run:

```bash
bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts
bun run --cwd packages/common typecheck
```

Expected: both pass.

- [x] **Step 6: Commit the public contract**

```bash
git add packages/common/src/code-city/CodeCityModel.ts \
  packages/common/src/code-city/index.ts \
  packages/common/src/code-city/__tests__/CodeCityModel.test.ts \
  packages/common/src/index.ts
git commit -m "feat: define Code City model contract"
```

### Task 2: Add fail-closed validation and the base file/path model

**Files:**
- Create: `packages/common/src/code-city/CodeCityModelBuilder.ts`
- Modify: `packages/common/src/code-city/index.ts`
- Modify: `packages/common/src/code-city/__tests__/CodeCityModel.test.ts`

**Interfaces:**
- Consumes: `CodeCitySnapshotInput`, public output types, and `CodeCityInputError` from Task 1.
- Produces: `buildCodeCityModel(input: CodeCitySnapshotInput): CodeCityModel` and a base model containing snapshot identity, one building per file ID, deterministic path districts, empty optional collections, coverage, layout, and legend.

- [x] **Step 1: Write validation and base-model tests**

Add these tests before implementation:

```ts
test("rejects a non-v2 context", () => {
  expect(() => buildCodeCityModel({
    ...minimalInput(),
    context: { ...minimalInput().context, dataVersion: 1 },
  })).toThrowError(new CodeCityInputError("invalid_context", "Code City requires a v2 report context"));
});

test("rejects missing repository identity and files main", () => {
  expect(() => buildCodeCityModel({
    ...minimalInput(),
    context: { ...minimalInput().context, repositoryId: "" },
  })).toThrow();
  expect(() => buildCodeCityModel({
    ...minimalInput(),
    filesMain: undefined as never,
  })).toThrow();
});

test("builds a file building and a root path district", () => {
  const model = buildCodeCityModel(minimalInput());
  expect(model.snapshot.repositoryId).toBe("repo:fixture");
  expect(model.buildings).toHaveLength(1);
  expect(model.buildings[0]).toMatchObject({
    id: "file:src/index.ts",
    relativePath: "src/index.ts",
    primaryDistrictId: "path:src",
  });
  expect(model.districts[0]).toMatchObject({
    id: "path:src",
    kind: "path",
    buildingIds: ["file:src/index.ts"],
    derived: true,
  });
});
```

- [x] **Step 2: Run the tests to confirm the builder is missing**

Run:

```bash
bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts
```

Expected: compilation fails because `buildCodeCityModel` is not exported.

- [x] **Step 3: Implement required-input validation and path normalisation**

In `CodeCityModelBuilder.ts`, add `buildCodeCityModel` and private helpers:

```ts
export function buildCodeCityModel(input: CodeCitySnapshotInput): CodeCityModel
function normalisePath(value: string): string
function pathDistrictId(relativePath: string): string
```

`normalisePath` trims, converts backslashes to `/`, removes leading `./`, and
collapses repeated slashes. `pathDistrictId` uses the first normalised path
segment (`src` for `src/index.ts`) and `root` for a file with no directory. It
returns `path:<segment>`.

Validate `context.dataVersion === 2`, a non-empty trimmed `repositoryId`, and a
non-null `filesMain.files` array. Throw the corresponding `CodeCityInputError`
codes from Task 1.

- [x] **Step 4: Build snapshot identity, buildings, and path districts**

Union `filesMain.files` and `filesTest.files` by file ID. Keep a sorted
`sourceSets` array (`main`, `test`) on each building. For this task all files
use a path district. Populate `CodeCitySignals` with LOC and contributor IDs;
leave health, temporal links, and impact fields as `null`.

Use `Map` indexes keyed by stable ID and normalised path. A building must never
be duplicated because it appears in both source sets.

- [x] **Step 5: Add base coverage, layout, and legend values**

Record `report_context.json`, `files_main.json`, and present optional shard
names in coverage. Initialise empty diagnostics and count fields. Set layout
ordering arrays from sorted IDs. Use a temporary deterministic seed string
`code-city-v1:<repositoryId>`; Task 5 replaces the repository suffix with a
stable hash without changing the public field.

Define the fixed legend channels as `footprint`, `complexity`, `health`,
`change_pressure`, `ownership`, and `impact`, each naming its unit and source
shard.

- [x] **Step 6: Export the builder and run focused checks**

Export `buildCodeCityModel` from `code-city/index.ts`, then run:

```bash
bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts
bun run --cwd packages/common typecheck
```

Expected: all Task 1 and Task 2 tests pass.

- [x] **Step 7: Commit the base builder**

```bash
git add packages/common/src/code-city/CodeCityModelBuilder.ts \
  packages/common/src/code-city/index.ts \
  packages/common/src/code-city/__tests__/CodeCityModel.test.ts
git commit -m "feat: build base Code City files and districts"
```

### Task 3: Derive component districts, units, and dependency edges

**Files:**
- Modify: `packages/common/src/code-city/CodeCityModelBuilder.ts`
- Modify: `packages/common/src/code-city/__tests__/CodeCityModel.test.ts`

**Interfaces:**
- Consumes: the base model and indexes from Task 2.
- Produces: component districts with decomposition-aware IDs, building affiliations/primary placement, unit records, component edges, and relationship diagnostics.

- [x] **Step 1: Add component/unit/edge fixtures and failing tests**

Extend `minimalInput()` with two files (`runtime.ts` and `reports.ts`), one
unique `runtime` component membership, one component dependency, and one unit.
Add these assertions:

```ts
expect(model.districts.map(({ id }) => id)).toEqual([
  "component:primary:reports",
  "component:primary:runtime",
]);
expect(model.buildings.find((building) => building.id === "file:src/runtime.ts")?.districtIds)
  .toEqual(["component:primary:runtime"]);
expect(model.units[0]).toMatchObject({
  id: "unit:src/runtime.ts:1",
  fileId: "file:src/runtime.ts",
});
expect(model.edges[0]).toMatchObject({
  kind: "component_dependency",
  sourceDistrictId: "component:primary:runtime",
  targetDistrictId: "component:primary:reports",
  count: 5,
});
```

Add one unit pointing to `src/missing.ts` and assert a diagnostic with code
`orphan_unit`. Add an edge with an empty endpoint name and assert an
`unresolved_edge` diagnostic while preserving the valid edge.

- [x] **Step 2: Run the focused test to verify the new expectations fail**

Run:

```bash
bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts
```

Expected: the new component, unit, and edge assertions fail because Task 2
only builds path districts and no relationship records.

- [x] **Step 3: Implement component ID collection and membership resolution**

Add private helpers:

```ts
function componentId(decompositionKey: string, name: string): string
function collectComponentDistricts(input: CodeCitySnapshotInput): Map<string, CodeCityDistrict>
function resolveComponentIds(name: string, componentIdsByName: ReadonlyMap<string, readonly string[]>): readonly string[]
```

`componentId` returns `component:<normalised decomposition key>:<trimmed name>`.
Prefer canonical `fromComponentId`/`toComponentId` and hotspot IDs. When those
IDs are absent but the decomposition key and name are present, derive the same
format. Do not derive a component ID from a name alone.

For each building, map its component names to candidate IDs. A single candidate
becomes an affiliation. Multiple candidates trigger `ambiguous_component` and
leave the path district as `primaryDistrictId`; the building retains any unique
affiliations. A file with no affiliation keeps its path district. Remove path
districts that no longer have a building using them as `primaryDistrictId`.

- [x] **Step 4: Implement unit attachment and orphan diagnostics**

Normalise each unit `relativeFileName`, look up the file ID, and create a unit
record with file and district references. Missing file matches create an
`orphan_unit` diagnostic and do not fabricate a building. Sort units by stable
unit ID.

- [x] **Step 5: Implement component edges and endpoint states**

Create a component district placeholder for every valid dependency endpoint,
even when it has no buildings. Build an edge ID from
`<decompositionKey>:<sourceDistrictId>-><targetDistrictId>`. Retain count,
`locFrom`, and `evidenceCount` when present. A malformed endpoint produces an
`unresolved_edge` diagnostic; valid edges remain in the model.

- [x] **Step 6: Run focused checks and commit**

Run:

```bash
bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts
bun run --cwd packages/common typecheck
```

Expected: all relationship tests pass and the package typecheck is green.

```bash
git add packages/common/src/code-city/CodeCityModelBuilder.ts \
  packages/common/src/code-city/__tests__/CodeCityModel.test.ts
git commit -m "feat: derive Code City components units and edges"
```

### Task 4: Join hotspots and impact and compute semantic signals

**Files:**
- Modify: `packages/common/src/code-city/CodeCityModelBuilder.ts`
- Modify: `packages/common/src/code-city/__tests__/CodeCityModel.test.ts`

**Interfaces:**
- Consumes: component/building/unit/edge records from Task 3 plus optional hotspot and impact shards.
- Produces: populated health/change/ownership/impact signals, direct-versus-derived district metrics, evidence references, and optional-shard coverage.

- [x] **Step 1: Add hotspot/impact fixture data and failing assertions**

Add one file hotspot, one unit hotspot, one component hotspot, and one impact
opportunity to the fixture. Assert that each matching entity receives its
score, severity/dimension, source ID, and relative route. Assert that a missing
hotspot leaves `health.score === null`, not `0`.

Add a second input with `hotspots`, `impact`, and `units` omitted. Assert that
the model still builds and `coverage.missingOptionalShards` lists those shard
names.

- [x] **Step 2: Run the test to verify signal assertions fail**

Run:

```bash
bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts
```

Expected: the builder currently returns null optional signals and does not
attach health or impact evidence.

- [x] **Step 3: Implement hotspot and impact indexes**

Add private helpers:

```ts
function indexHotspots(shard: CanonicalHotspotsShard | undefined): Map<string, CanonicalHotspotRecord>
function indexImpact(shard: CanonicalImpactShard | undefined): Map<string, CanonicalImpactOpportunityRecord>
function evidenceRef(kind: CodeCityEvidenceKind, id: string, route: string | null): CodeCityEvidenceRef
```

Index all `fileHotspots`, `unitHotspots`, and `componentHotspots` by stable ID.
Index `impact_opportunities` by stable opportunity ID. Add matching evidence
references to buildings, units, and districts. Report `orphan_hotspot` and
`orphan_impact` diagnostics for records whose IDs do not match a model entity.

- [x] **Step 4: Populate direct signals and derived aggregates**

Use these exact aggregation rules:

- footprint LOC: sum unique child building LOC
- unit count: count attached units
- maximum complexity: maximum attached unit McCabe value, or `null` when no units exist
- commits: sum known child building commit counts; keep `null` when no child has a count
- temporal links: use hotspot temporal links when available, otherwise `null`
- ownership: sorted union of child contributor IDs; count is its length
- health: direct component hotspot wins; otherwise highest child hotspot score with its severity/dimension
- impact: direct component opportunity wins; otherwise highest child opportunity score with its dimension/source ID

Mark a district `derived: false` when it has a direct component hotspot or
impact record; otherwise mark it `derived: true` and add its ID to coverage.
Do not overwrite a direct signal with an aggregate.

- [x] **Step 5: Run focused checks and commit**

Run:

```bash
bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts
bun run --cwd packages/common typecheck
```

Expected: health, impact, missing-shard, and orphan diagnostics pass.

```bash
git add packages/common/src/code-city/CodeCityModelBuilder.ts \
  packages/common/src/code-city/__tests__/CodeCityModel.test.ts
git commit -m "feat: add Code City health and impact signals"
```

### Task 5: Make output deterministic and close the contract suite

**Files:**
- Modify: `packages/common/src/code-city/CodeCityModelBuilder.ts`
- Modify: `packages/common/src/code-city/__tests__/CodeCityModel.test.ts`

**Interfaces:**
- Consumes: the complete model builder from Task 4.
- Produces: invariant ordering, stable hashed layout seed, complete diagnostics coverage, and the final pure-model verification evidence.

- [x] **Step 1: Add permutation, seed, and serialisation tests**

Create `permutedInput()` by reversing every populated input array from the
fixture. Assert:

```ts
expect(buildCodeCityModel(minimalInput())).toEqual(buildCodeCityModel(permutedInput()));
expect(buildCodeCityModel(minimalInput()).layout.seed)
  .toBe(buildCodeCityModel(minimalInput()).layout.seed);
expect(buildCodeCityModel({
  ...minimalInput(),
  context: { ...minimalInput().context, snapshotId: "snapshot-2" },
}).layout.seed)
  .toBe(buildCodeCityModel(minimalInput()).layout.seed);
expect(JSON.parse(JSON.stringify(buildCodeCityModel(minimalInput()))))
  .toEqual(buildCodeCityModel(minimalInput()));
```

Assert every entity collection is sorted by ID and every layout order array is
the corresponding sorted ID list. Add a malformed-record fixture and assert
structured diagnostics contain the expected shard and entity ID.

- [x] **Step 2: Run the new tests to verify deterministic assertions fail**

Run:

```bash
bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts
```

Expected: permutation output or seed assertions fail until final ordering and
hashing are implemented.

- [x] **Step 3: Implement stable ordering and hashing**

Sort districts, buildings, units, edges, evidence, contributor IDs, and
diagnostics by stable ID/code. Add a small local FNV-1a 32-bit helper:

```ts
function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
```

Set `layout.seed` to `code-city-v1:${stableHash(repositoryId)}`. Set layout
district/building/unit order arrays from the already sorted entity IDs. Do not
include `snapshotId` in the hash.

- [x] **Step 4: Complete coverage counts and no-I/O assertions**

Populate coverage counts for files, districts, units, edges, and diagnostics.
Keep the no-I/O guarantee as an implementation review constraint: the builder
module must import only its model types and standard pure helpers. The runtime
test itself must call only the pure function and `JSON.stringify`.

- [x] **Step 5: Run focused and package verification**

Run:

```bash
bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts
bun run --cwd packages/common typecheck
```

Expected: all Code City tests pass and common typecheck is green.

- [x] **Step 6: Run the repository suite and inspect the diff**

Run:

```bash
bun test
git diff --check
git status --short
```

Expected: the repository suite passes; `git diff --check` is clean; only the
files listed in the task are changed by the implementation, with unrelated
pre-existing worktree changes preserved.

- [x] **Step 7: Commit the completed feasibility model**

```bash
git add packages/common/src/code-city/CodeCityModelBuilder.ts \
  packages/common/src/code-city/__tests__/CodeCityModel.test.ts
git commit -m "feat: complete canonical JSON Code City model"
```

## Final handoff evidence

After Task 5, report:

- the final commit hash
- focused Code City test count and expectation count
- `bun run --cwd packages/common typecheck` result
- full `bun test` result
- diagnostic counts from the canonical fixture
- whether the fixture required any path-district fallback or unresolved edge
- whether any existing canonical relationship was insufficient, which is the
  only trigger for proposing a new exporter shard

Do not claim browser, visual, WebGL, bundle, hosted-route, or static-site
integration success from this plan; those belong to a separately approved
feasibility follow-up.

## Recorded completion evidence

- Implementation commits: `ffac710`, `a0d126b`, `592d94d`, `ab5a916`, and
  `01a0773`.
- Focused Code City suite: 15 tests passed, 39 expectations passed.
- `bun run --cwd packages/common typecheck`: passed.
- Repository `bun test`: 961 tests passed, 0 failed, 5679 expectations.
- The canonical fixture reports no unresolved edge; the minimal file fixture
  intentionally uses its derived `path:src` district until component evidence
  is present.
- No new exporter shard was required; the v2 component, unit, hotspot, and
  impact relationships were sufficient for this pure model slice.
- Root `bun run typecheck` is not green because the existing hosted app config
  still reports `cache` as an unknown Astro config property at
  `apps/app/astro.config.mjs:47`; all other package typechecks completed.
