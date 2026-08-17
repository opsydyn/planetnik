# Landscape Repository Code City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a canonical-JSON-backed Code City route and navigation item to each landscape repository drilldown.

**Architecture:** Add a repository-aware route helper and reload matcher, adapt repository-local canonical JSON shards into the existing `CodeCitySnapshotInput`, and render the shared `CodeCityModel`/`CodeCityView` under the repository shell. Landscape-root aggregation remains unsupported.

**Tech Stack:** Bun 1.3.11, Astro 7, TypeScript, `@planetnik/common`, `@planetnik/report-ui`, Astro content collections, Bun test, and the existing static landscape data loader.

## Global Constraints

- Use only `report_context.json`, `files_main.json`, and optional Code City JSON shards.
- Do not parse TXT, HTML, source files, or runtime content.
- Reuse `toCodeCitySnapshotInput`, `buildCodeCityModel`, `resolveCodeCityRouteState`, and `CodeCityView`.
- Keep the route at `/landscape/repositories/[repo]/code-city`; do not add landscape-wide aggregation.
- Preserve unrelated working-tree files and stage only this slice and its docs.
- Follow the existing full-reload rule for WebGL/graph-heavy routes.

---

### Task 1: Add repository Code City route helpers and navigation contracts

**Files:**
- Modify: `apps/site/src/lib/landscapeRoutes.ts`
- Modify: `apps/site/src/layouts/Dashboard.astro`
- Modify: `apps/site/src/lib/reloadRoutes.ts`
- Test: `apps/site/src/lib/__tests__/landscapeRoutes.test.ts`
- Test: `apps/site/src/lib/__tests__/reloadRoutes.test.ts`

**Interfaces:**
- Produce `getLandscapeRepositoryCodeCityHref(repoKey: string): string`.
- Map `mapLandscapeRepositoryRoute(repoKey, "/code-city")` to that href.

- [x] **Step 1: Write failing tests**

Assert the encoded href, route mapping, and reload matcher for `alan/xmas` and `/landscape/repositories/alan$2Fxmas/code-city`.

- [x] **Step 2: Run focused tests and confirm RED**

Run `bun test apps/site/src/lib/__tests__/landscapeRoutes.test.ts apps/site/src/lib/__tests__/reloadRoutes.test.ts`.

Expected: the new helper is missing and the matcher assertion fails.

- [x] **Step 3: Implement the helper, mapping, matcher, and menu item**

Add the helper beside the existing repository page helpers; map `"/code-city"`; add a base-safe matcher for `/landscape/repositories/<repo>/code-city`; and add `{ href: getLandscapeRepositoryCodeCityHref(repoKey), label: "Code City" }` after Components in the landscape repository Structure section.

- [x] **Step 4: Re-run the focused tests and confirm GREEN**

All route and reload assertions must pass.

---

### Task 2: Adapt repository-local canonical JSON

**Files:**
- Create: `apps/site/src/lib/landscapeCodeCitySnapshot.ts`
- Test: `apps/site/src/lib/__tests__/landscapeCodeCitySnapshot.test.ts`

**Interfaces:**
- Consume the canonical Code City record types from `@planetnik/common`.
- Produce `toLandscapeCodeCitySnapshotInput(records): CodeCitySnapshotInput`.
- Produce `readLandscapeRepositoryCodeCitySnapshot(repoKey): CodeCitySnapshotInput`.

- [x] **Step 1: Write failing adapter tests**

Cover a valid v2 single-repository context with all shards, a manifest with empty optional records (which must retain optional wrappers), invalid context, and missing `files_main`.

- [x] **Step 2: Run the adapter test and confirm RED**

Run `bun test apps/site/src/lib/__tests__/landscapeCodeCitySnapshot.test.ts`.

Expected: the adapter module is missing.

- [x] **Step 3: Implement the pure adapter**

Require `dataVersion === 2`, `mode === "single_repository"`, `reportMode === "single_repository"`, and a non-null `filesMain` collection. Wrap raw records as `CodeCityCollectionEntry` values and delegate optional shard presence to `toCodeCitySnapshotInput`, flattening hotspot arrays.

- [x] **Step 4: Implement the repository JSON reader**

Use `readLandscapeRepoJson` for the repository-local data directory. Treat a missing required export as `filesMain: null`; treat missing optional exports as empty arrays/undefined so the v2 manifest remains authoritative for declared empty shards.

- [x] **Step 5: Re-run the adapter test and confirm GREEN**

All valid, empty-shard, and invalid-input assertions must pass.

---

### Task 3: Add the landscape repository Code City Astro route

**Files:**
- Create: `apps/site/src/pages/landscape/repositories/[repo]/code-city.astro`

- [x] **Step 1: Add static paths and model assembly**

Use `getLandscapeRepositoryStaticPaths()` and `getLandscapeRepositoryPageContext()`. Build the model inside the existing `CodeCityInputError` boundary and render `Dashboard` with the current `repoScope={{ repoKey, repoName }}`.

- [x] **Step 2: Render the shared view and explicit states**

Pass `evidenceBasePath={getLandscapeRepositoryHref(repoKey)}`. Reuse the single-repository ready/partial/empty summary language; for invalid input show the diagnostic and link to the repository dashboard; for an unexpected landscape context use the existing unsupported message.

- [x] **Step 3: Run site typecheck**

Run `bun run --cwd apps/site typecheck`; expect zero new errors or warnings.

---

### Task 4: Verify with a deterministic landscape fixture

- [x] **Step 1: Create an ignored local fixture**

Create a temporary dataset with a landscape context, one repository summary, and one repository directory containing the canonical single-repository Code City shards. Do not commit generated datasets.

- [x] **Step 2: Run the route and inspect it**

Start Astro against the fixture and verify `/landscape/repositories/<encoded-repo>/code-city`: the sidebar contains Code City, the summary identifies the repository, the map/table loads, and evidence links remain under the repository route.

- [x] **Step 3: Run focused and workspace gates**

Run the three focused site test files, `bun run --cwd apps/site typecheck`, `bun run --cwd apps/site build`, `bun run typecheck`, `bun test`, and `git diff --check`. Record exact pass counts and distinguish automated proof from browser evidence.

---

### Task 5: Commit and push the completed slice

- [x] **Step 1: Review the staged boundary**

Run `git status --short`, `git diff --cached --stat`, and `git diff --cached --check`. Confirm no generated datasets, `.superpowers` scratch files, or unrelated changes are staged.

- [x] **Step 2: Commit**

Run `git commit -m "feat: add landscape repository code city"`.

- [x] **Step 3: Push and verify**

Run `git push origin main`, `git status --short --branch`, and `git log -1 --oneline --decorate`. Report the commit SHA, remote branch, verification counts, and the live-browser evidence boundary without claiming more than was observed.
