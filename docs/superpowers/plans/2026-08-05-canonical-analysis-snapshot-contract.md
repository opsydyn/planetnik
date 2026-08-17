# Canonical Analysis Snapshot Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Emit a v2 snapshot manifest and metrics JSON shard, then make static and hosted consumers JSON-first while preserving v1/TXT compatibility.

**Architecture:** Exporters capture one UUID and timestamp per export run and write a small `report_context.json` manifest alongside typed JSON shards. Site, runtime, and copilot readers prefer those shards and fall back only when reading older datasets. Existing shard payload shapes stay intact; the manifest describes the first canonical domains without flattening the report.

**Tech Stack:** Bun 1.3.11, TypeScript, `bun:test`, Astro content loaders/Zod, Effect Schema for the hosted response boundary, Node/Bun filesystem APIs, built-in `crypto.randomUUID()`.

> **Historical execution status (2026-08-05):** Tasks 1–5 and focused Task 6
> verification are complete. The follow-on stable-ID, complete-inventory, and
> negative-validation slice is recorded in
> `2026-08-05-stable-entity-ids-and-contract-validation.md` and is complete.
> The remaining Phase 1 work is tracked in the canonical roadmap: prove
> compatibility-projection removal across every core route. The full `bun test`
> suite passes; root typecheck and repository-wide Biome lint remain blocked by
> the documented existing errors, with no lint autofix run.

## Global Constraints

- Keep Bun and Effect first-class; do not add a UUID or serialization dependency.
- `apps/site` remains static and must not import hosted runtime code (ADR-0015).
- Preserve existing `contributors.json` field names and TXT/HTML projections.
- New consumers must branch JSON-first; TXT is fallback only for legacy datasets.
- v1 contexts and datasets without JSON shards must continue to load.
- Use `.js` extensions for new TypeScript imports and update barrels for new exported files.
- Preserve the user's existing roadmap/documentation edits in the dirty worktree.

---

### Task 1: Add the shared export-run identity helper

**Files:**
- Create: `packages/reports/src/exporters/SnapshotContext.ts`
- Modify: `packages/reports/src/exporters/index.ts`
- Test: `packages/reports/src/__tests__/DataExporters.test.ts`

**Interfaces:**
- Produces `SnapshotExportContext` with readonly `snapshotId: string` and `generatedAt: string`.
- Produces `createSnapshotExportContext(): SnapshotExportContext`, using `crypto.randomUUID()` and one `new Date().toISOString()` call.

- [ ] **Step 1: Write the failing test**

Add a small test that calls `createSnapshotExportContext()` twice and asserts each result has a UUID-shaped `snapshotId`, an ISO timestamp, and distinct IDs. Import it from the public reports exporter barrel so the barrel contract is exercised.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun test packages/reports/src/__tests__/DataExporters.test.ts
```

Expected: FAIL because `SnapshotContext.ts` and its barrel export do not yet exist.

- [ ] **Step 3: Write the minimal implementation**

Create the helper with no clock/UUID injection and export it from `packages/reports/src/exporters/index.ts`. Keep the helper independent of exporters so single-repository and landscape exporters share the exact identity policy.

- [ ] **Step 4: Run the test to verify it passes**

Run the same command and confirm the new test and all existing exporter tests pass.

- [ ] **Step 5: Refactor only after green**

Keep the helper as a single focused file; do not add manifest-building logic here.

### Task 2: Make the single-repository exporter emit the v2 canonical slice

**Files:**
- Modify: `packages/reports/src/exporters/DataExporter.ts`
- Test: `packages/reports/src/__tests__/DataExporters.test.ts`

**Interfaces:**
- `DataExporter.exportData()` creates one `SnapshotExportContext` and passes it to metrics, contributors, and manifest writers.
- `metrics.json` shape: `{ title: "Metrics", timestamp: generatedAt, metrics: Array<{ id: string; value: number }> }`.
- `report_context.json` shape includes `dataVersion: 2`, `snapshotId`, `generatedAt`, existing mode/title/navigation fields, `capabilities: ["summary", "metrics", "contributors"]`, `canonicalShards`, and `compatibilityProjections`.

- [ ] **Step 1: Write the failing exporter contract test**

Extend the existing `DataExporter` fixture with metrics and contributors. After `exportData()`, read `metrics.json`, `contributors.json`, and `report_context.json`. Assert:

```ts
expect(metricsJson.metrics).toEqual([{ id: "LOC", value: 120 }])
expect(context.dataVersion).toBe(2)
expect(context.capabilities).toEqual(["summary", "metrics", "contributors"])
expect(context.canonicalShards.metrics).toBe("metrics.json")
expect(context.compatibilityProjections.metrics).toBe("metrics.txt")
expect(context.snapshotId).toMatch(/^[0-9a-f-]{36}$/)
expect(context.generatedAt).toBe(metricsJson.timestamp)
expect(contributorsJson.contributors[0]).toEqual(expect.objectContaining({
  email: "alice@example.com",
  percentage: expect.any(String),
  isRookie: expect.any(Boolean),
  isActive: expect.any(Boolean),
}))
```

Add a second fixture with no contributors and assert `contributors.json` exists with `contributorCount: 0` and `contributors: []`.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
bun test packages/reports/src/__tests__/DataExporters.test.ts
```

Expected: FAIL because metrics JSON, the single-repository manifest, and the empty-safe contributor JSON are not emitted.

- [ ] **Step 3: Write the minimal implementation**

Capture the context once at the start of `exportData()`. Add `exportMetricsJson` (or equivalent inside `exportMetrics`) while retaining the current TXT write. Refactor contributor export so the JSON and TXT files are written even for an empty list; add only the additive percentage/status fields needed by JSON-first consumers. Write the manifest after all other exports so it describes the completed data directory. Use the existing metadata name and navigation fallback used by the site loader.

- [ ] **Step 4: Run the tests to verify they pass**

Run the same command and confirm both new contract tests and all existing exporter tests pass.

- [ ] **Step 5: Refactor after green**

Remove duplicated timestamp creation only where the new context is already available. Do not change unrelated shard timestamps or payload shapes.

### Task 3: Add v2 metadata to the landscape manifest

**Files:**
- Modify: `packages/reports/src/landscape/data/LandscapeDataExport.ts`
- Test: `packages/reports/src/__tests__/LandscapeDataExport.test.ts`

**Interfaces:**
- `LandscapeDataExport.exportCoreContracts()` creates one `SnapshotExportContext` and writes it into `report_context.json`.
- Landscape context keeps all existing fields and adds `dataVersion: 2`, `snapshotId`, `generatedAt`, capabilities for overview/repositories/contributors/teams/topology/tags, canonical shard paths, and `repositories.txt` compatibility metadata.

- [ ] **Step 1: Write the failing test**

Extend the existing landscape context assertion to require v2 metadata, a UUID-shaped ID, an ISO `generatedAt`, and the expected overview/repositories shard references while retaining the current mode/source/navigation assertions.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun test packages/reports/src/__tests__/LandscapeDataExport.test.ts
```

Expected: FAIL because the landscape exporter still writes `dataVersion: 1` without identity or shard metadata.

- [ ] **Step 3: Write the minimal implementation**

Import the shared context helper, create the context in `exportCoreContracts`, and pass it to `exportReportContext`. Keep source values and existing navigation unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run the same command and confirm all landscape exporter tests pass.

### Task 4: Make the Astro site loaders JSON-first

**Files:**
- Modify: `apps/site/src/loaders/planetnik-loader.ts`
- Modify: `apps/site/src/content.config.ts`
- Create: `apps/site/src/lib/__tests__/planetnik-loader.test.ts`

**Interfaces:**
- `metricsLoader()` reads `metrics.json.metrics` first and emits `{ id, value }`; it reads `metrics.txt` only when the JSON file is absent.
- `contributorsLoader()` reads `contributors.json.contributors` first and maps current contributor fields to the existing collection schema; it reads `contributors.txt` only when the JSON file is absent.
- The report context schema accepts optional v2 fields so v1 fallback contexts remain valid.

- [ ] **Step 1: Write failing loader tests**

Create temporary data directories and invoke the real loader `load` methods with a small in-memory `store`/`parseData` harness. For metrics and contributors, write conflicting JSON and TXT values and assert the stored records come from JSON. Remove JSON and assert the same loaders still parse the TXT fixtures.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
bun test apps/site/src/lib/__tests__/planetnik-loader.test.ts
```

Expected: FAIL because the loaders currently read TXT only.

- [ ] **Step 3: Write the minimal implementation**

Branch on the presence of the JSON object, return after processing its arrays (including an intentionally empty array), and retain the current TXT parser as the missing-file fallback. Add optional `snapshotId`, `generatedAt`, `capabilities`, `canonicalShards`, and `compatibilityProjections` fields to `reportContextSchema` using the existing Zod style.

- [ ] **Step 4: Run focused site tests and typecheck**

Run:

```bash
bun test apps/site/src/lib/__tests__/planetnik-loader.test.ts
bun run --cwd apps/site typecheck
```

Expected: PASS with no Astro schema errors.

### Task 5: Make hosted and copilot readers JSON-first

**Files:**
- Modify: `apps/runtime/src/lib/report-datasets.ts`
- Modify: `apps/runtime/src/routes/reports/index.ts`
- Modify: `apps/copilot-runtime/src/data.ts`
- Test: `apps/runtime/src/lib/__tests__/report-datasets.test.ts`

**Interfaces:**
- `readMetricsMap(dataDir)` parses `metrics.json.metrics` first, returning an empty map for a present empty JSON array, and falls back to `metrics.txt` only when JSON is absent.
- `readReportContributorsSummary(dataDir)` parses `contributors.json.contributors` first, joins contributor details by email, and falls back to `contributors.txt` only when JSON is absent.
- `ReportContextSummary` and `ReportContextSummarySchema` expose optional v2 manifest metadata without breaking v1 fixtures.
- `apps/copilot-runtime/src/data.ts:getContributors()` follows the same JSON-first/TSV-fallback rule.

- [ ] **Step 1: Write failing runtime contract tests**

Add metrics and contributor fixtures with conflicting JSON/TXT values. Assert the JSON values win, then remove JSON and assert the TXT values still load. Add a v2 context fixture and assert `readReportContextSummary` returns its identity, timestamp, capabilities, shard map, and projection map.

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
bun test apps/runtime/src/lib/__tests__/report-datasets.test.ts
```

Expected: FAIL because the readers only parse TXT and the context type drops v2 fields.

- [ ] **Step 3: Write the minimal implementation**

Add narrow JSON parsing branches using the existing `readJsonRecord` helper. Validate optional manifest fields when present and preserve null behavior for malformed/missing legacy contexts. Extend the Effect response schema with `Schema.optional(...)` fields. Update the copilot reader without changing its public `Contributor` interface.

- [ ] **Step 4: Run the runtime tests and typecheck**

Run:

```bash
bun test apps/runtime/src/lib/__tests__/report-datasets.test.ts
bun run --cwd apps/runtime typecheck
bun run --cwd apps/copilot-runtime typecheck
```

Expected: PASS with the existing legacy tests still green.

### Task 6: Run the complete verification gates and reconcile roadmap status

**Files:**
- Modify: `docs/product-roadmap.md` only if the completed slice needs a factual status update.

- [ ] **Step 1: Run focused cross-boundary tests**

```bash
bun test packages/reports/src/__tests__/DataExporters.test.ts packages/reports/src/__tests__/LandscapeDataExport.test.ts apps/site/src/lib/__tests__/planetnik-loader.test.ts apps/runtime/src/lib/__tests__/report-datasets.test.ts
```

- [ ] **Step 2: Run repository gates**

```bash
bun run typecheck
bun test
bun run lint
```

- [ ] **Step 3: Inspect the diff and contract artifacts**

Confirm only the new ADR/plan, snapshot contract code/tests, and an evidence-backed roadmap status line changed. Confirm no TXT fallback was removed and no unrelated dirty documentation edits were overwritten.

- [ ] **Step 4: Mark the plan and ADR verification items complete**

Record the commands and results in the final handoff; do not claim visual, live, or persistence success because this slice is filesystem/export contract work.
