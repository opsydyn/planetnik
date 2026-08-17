# Stable Entity IDs and Snapshot Contract Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the next bounded Phase 1 slice by formalising stable entity-ID rules, making v2 manifest shard references reflect emitted files, and rejecting invalid v2 snapshots while preserving v1 compatibility.

**Architecture:** Keep the existing v2 `report_context.json` boundary and add a small pure identity module in `@planetnik/reports`. Exporters use the module for repository, file, unit, component, and contributor IDs and publish the policy in the manifest. Manifests enumerate only known JSON/TXT artifacts that exist in the completed export; runtime and static readers validate v2 metadata and required shards before accepting it.

**Tech Stack:** Bun 1.3.11, TypeScript, `bun:test`, Node filesystem APIs, Astro loaders/Zod, Effect Schema, existing exporter models.

> **Execution status (2026-08-05):** Tasks 1–3 are implemented and their
> focused exporter, runtime, and static-loader tests pass. Task 4 documentation
> is reconciled in ADR-0018 and the canonical product roadmap. Package,
> runtime, and site typechecks pass; the remaining repository gates are the
> known root `apps/app/astro.config.mjs` typecheck error and the existing
> repository-wide Biome lint baseline. The next product gate is the
> route-by-route compatibility-projection removal matrix.

## Global Constraints

- Preserve the accepted ADR-0018 v2 shape and v1/TXT fallback behaviour.
- Keep existing impact IDs and route parsing compatible; identity helpers must reproduce the current `file:`, `unit:`, and `component:` forms.
- Do not add a dependency or make `apps/site` import hosted runtime code.
- Do not begin trends, persistence, semantic retrieval, or another parser port.
- Do not overwrite the existing dirty roadmap/documentation edits.
- Use TDD vertical slices: one failing public-behaviour test, minimal implementation, green verification, then refactor.

---

### Task 1: Formalise and emit stable entity IDs

**Files:**
- Create: `packages/reports/src/exporters/EntityIdentity.ts`
- Modify: `packages/reports/src/exporters/index.ts`
- Modify: `packages/reports/src/exporters/FileExportInfo.ts`
- Modify: `packages/reports/src/exporters/UnitsExportInfo.ts`
- Modify: `packages/reports/src/exporters/DependenciesExportInfo.ts`
- Modify: `packages/reports/src/exporters/ComponentDependenciesExportInfo.ts`
- Modify: `packages/reports/src/exporters/DataExporter.ts`
- Modify: `packages/reports/src/landscape/data/RepositoryExport.ts`
- Modify: `packages/reports/src/landscape/data/ContributorExport.ts`
- Modify: `packages/reports/src/landscape/data/ContributorRepositoryInfoExport.ts`
- Test: `packages/reports/src/__tests__/EntityIdentity.test.ts`
- Test: `packages/reports/src/__tests__/DataExporters.test.ts`
- Test: `packages/reports/src/__tests__/LandscapeDataExport.test.ts`

**Interfaces:**
- `repositoryEntityId(key: string): string` → `repo:<normalised key>`.
- `fileEntityId(relativePath: string): string` → `file:<normalised relative path>`.
- `unitEntityId(relativePath: string, startLine: number): string` → `unit:<path>:<startLine>`.
- `componentEntityId(decompositionKey: string, name: string): string` → `component:<decomposition>:<name>`.
- `contributorEntityId(email: string): string` → `contributor:<lowercase trimmed email>`.
- `ENTITY_ID_POLICY` documents those five schemes for `report_context.json`.

- [ ] **Step 1: Write the failing identity test**

Assert normalisation, deterministic repeated calls, and the exact existing impact ID forms. Include a case-insensitive contributor email and Windows-style paths.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun test packages/reports/src/__tests__/EntityIdentity.test.ts
```

Expected: FAIL because the identity module and barrel export do not exist.

- [ ] **Step 3: Implement the pure identity module**

Keep it free of filesystem, date, and analyzer dependencies. Reuse slash normalisation for repository/file paths and preserve the current unescaped route-facing ID grammar.

- [ ] **Step 4: Run the identity test to verify it passes**

Run the same command and confirm the new test is green.

- [ ] **Step 5: Add IDs to emitted canonical records**

Add additive `id` fields to file, unit, contributor, repository, contributor-repository, dependency-file, and component-dependency records. Use the helpers in existing hotspot builders so no current route ID changes. Add `repositoryId` and `entityIdPolicy` to both v2 manifests.

- [ ] **Step 6: Run exporter tests and refactor only after green**

Run:

```bash
bun test packages/reports/src/__tests__/DataExporters.test.ts packages/reports/src/__tests__/LandscapeDataExport.test.ts
```

Update exact fixture expectations only for additive fields; preserve all legacy fields and route IDs.

### Task 2: Make manifest shard inventories complete and truthful

**Files:**
- Modify: `packages/reports/src/exporters/DataExporter.ts`
- Modify: `packages/reports/src/landscape/data/LandscapeDataExport.ts`
- Test: `packages/reports/src/__tests__/DataExporters.test.ts`
- Test: `packages/reports/src/__tests__/LandscapeDataExport.test.ts`

**Interfaces:**
- Single-repository v2 `canonicalShards` enumerates the known JSON artifacts that exist after `exportData()`; `compatibilityProjections` enumerates emitted TXT projections.
- Landscape v2 `canonicalShards` includes analysis, overview, repositories, contributors, teams, topology, tags, and tag matrix when present; the manifest is refreshed through the existing core → people → repositories → tags export sequence using one snapshot identity.
- `capabilities` is derived from the keys in `canonicalShards`, so it cannot claim a missing shard.

- [ ] **Step 1: Write the failing inventory tests**

Assert a single-repository export advertises `analysisResults.json`, `metrics.json`, `contributors.json`, and every other JSON shard emitted by the fixture, while omitting conditional shards that were not written. Assert a complete landscape export advertises all seven landscape domain shards plus `landscapeAnalysisResults.json` and `landscape_tag_matrix.json`.

- [ ] **Step 2: Run the tests to verify they fail**

Run the focused exporter tests. Expected: FAIL because current manifests contain only the first three single-repo shards and the landscape manifest is written before later stages.

- [ ] **Step 3: Implement deterministic shard catalogs and staged landscape refresh**

Filter fixed capability-to-file catalogs with `existsSync`. Store the landscape export’s source/context on the exporter instance, write a partial core manifest after overview, and refresh it after people, repositories, and tags so the completed CLI sequence produces the complete inventory.

- [ ] **Step 4: Run exporter tests to verify green**

Run the same focused exporter command and confirm both partial-core and completed-landscape assertions pass.

### Task 3: Reject invalid v2 contexts and retain v1 compatibility

**Files:**
- Modify: `apps/runtime/src/lib/report-datasets.ts`
- Modify: `apps/runtime/src/routes/reports/index.ts`
- Modify: `apps/site/src/loaders/planetnik-loader.ts`
- Modify: `apps/site/src/content.config.ts`
- Test: `apps/runtime/src/lib/__tests__/report-datasets.test.ts`
- Test: `apps/site/src/lib/__tests__/planetnik-loader.test.ts`

**Interfaces:**
- v1 contexts remain accepted without v2 metadata.
- v2 contexts require `dataVersion: 2`, a UUID-shaped `snapshotId`, ISO `generatedAt`, `entityIdPolicy`, capabilities, safe relative canonical shard paths, and required core shards (`summary`, `metrics`, `contributors` for single-repository; `analysis`, `overview` for landscape).
- `readReportContextSummary()` returns `null` for unsupported versions, missing required shard declarations/files, malformed identity metadata, or traversal/absolute shard paths.
- The static loader falls back to its derived v1 context when a v2 manifest fails the same checks; valid legacy TXT-only fixtures continue to load.

- [ ] **Step 1: Add failing negative fixtures**

Add runtime fixtures for unsupported `dataVersion`, missing required `metrics`, missing referenced shard file, and unsafe `../` shard paths. Add a site-loader fixture proving an invalid v2 context resolves to the v1 fallback while a valid v1/TXT dataset still loads.

- [ ] **Step 2: Run the negative tests to verify they fail**

Run:

```bash
bun test apps/runtime/src/lib/__tests__/report-datasets.test.ts apps/site/src/lib/__tests__/planetnik-loader.test.ts
```

Expected: FAIL because current readers accept arbitrary numeric versions and do not verify required shard references.

- [ ] **Step 3: Implement narrow v2 validation**

Validate only the manifest boundary, with explicit rejection and no change to domain-shard parsing. Keep legacy v1 contexts on the existing path and add the optional manifest fields to the Astro and Effect response schemas.

- [ ] **Step 4: Run runtime/site tests and typechecks**

```bash
bun test apps/runtime/src/lib/__tests__/report-datasets.test.ts apps/site/src/lib/__tests__/planetnik-loader.test.ts
bun run --cwd apps/runtime typecheck
bun run --cwd apps/site typecheck
```

### Task 4: Record the completed Phase 1 status

**Files:**
- Modify: `docs/adr/0018-adopt-versioned-canonical-analysis-snapshots.md`
- Modify: `docs/product-roadmap.md`
- Modify: this plan

- [ ] **Step 1: Document the identity and validation policy**

Add the five ID schemes, required v2 shard rules, and the distinction between a partial staged landscape export and a completed snapshot to ADR-0018.

- [ ] **Step 2: Run the complete verification gates**

```bash
bun test
bun run typecheck
bun run lint
git diff --check
```

Report pre-existing repository blockers honestly; do not apply broad unrelated fixes.

- [ ] **Step 3: Reconcile roadmap status**

Mark the identity/shard/negative-fixture work delivered if its focused gates pass, and leave only any evidence-backed remaining Phase 1 work in `docs/product-roadmap.md`.
