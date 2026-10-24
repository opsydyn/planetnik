# Astro and Effect 4 Dependency Upgrade Implementation Plan

> **For agentic workers:** Execute the approved dependency upgrade inline and use the verification-before-completion workflow for the final result.

**Goal:** Upgrade all workspace dependencies to compatible stable releases, including Astro 7.4 and Effect 4, preserving existing application behavior.

**Architecture:** Keep the existing Bun workspaces and application boundaries. Consolidate Effect APIs into their v4 packages, share matching Effect versions through the root catalog, and migrate callers without introducing a compatibility shim. Keep incremental rendering enabled and page concurrency at one.

**Tech Stack:** Bun 1.4.2, TypeScript, Astro, React, Effect 4.

**Spec:** User request of 2026-10-24: “Let’s upgrade Astro and other repo deps, effect 4 is now stable”.

## Global Constraints

- Preserve static site, hosted app, runtime, CLI, analyzer and report contracts.
- Use stable published dependency versions and matching Effect integration versions.
- Preserve existing unrelated untracked brainstorming files.
- Work in the supplied checkout; do not push, deploy, publish or change database state.
- Existing tests provide the regression suite; add targeted cases only for uncovered migration behavior.

## Review Focus

- Schema defaults and encoded/decoded config compatibility.
- CLI option names, help, parsing and compiled Bun execution.
- Landscape cancellation, bounded concurrency, retry and temporary-directory cleanup.
- Browser atom hydration and persisted state.
- Graph/chart/table integrations and static output after major dependency upgrades.

### Task 1: Resolve and install stable workspace dependencies

- [x] Verify baseline: `bun test` (1,316 pass), `bun run typecheck` (exit 0).
- [x] Update all manifests and the shared dependency catalog, replacing consolidated Effect packages and atom bindings.
- [x] Install and verify the lockfile resolves matching Effect 4 versions.

### Task 2: Migrate Effect and other changed APIs

- [x] Migrate Schema, CLI, services, logger, schedule and atom APIs using upstream migration documentation and installed type definitions.
- [x] Run typechecks and regression tests; fix migration failures while preserving assertions.
- [x] Smoke-test CLI help, compiled CLI, report generation, app and documentation builds.

### Task 3: Qualify and document the upgrade

- [x] Run the complete test suite, workspace typechecks, relevant builds, lint and dependency consistency checks.
- [x] Verify frozen-lockfile installation and inspect the final diff for behavior changes.
- [x] Update stack documentation and append migration notes to relevant ADRs.
- [x] Record exact versions, checks, baseline issues and any unresolved limitations.

## Execution record

- Baseline tracked tree clean; four unrelated brainstorming scratch paths are untracked.
- Registry access requires the approved network execution path in this sandbox.
- Baseline passes 1,316 tests / 6,941 assertions; site typecheck reports 21 existing hints.

## Resolved dependency versions

| Area | Result |
| --- | --- |
| Astro / React integration | Astro 7.4.2 across site, app and docs; React integration 7.1.1 |
| Effect | Core, platform integrations and React atoms pinned to 4.0.6 in the shared catalog |
| React | 19.3.1 |
| Tables / graph rendering | TanStack Table 9.3.1, Sigma 4.0.3, React Sigma 6.0.0 |
| Copilot / OpenAI client | CopilotKit 1.79.1, OpenAI 7.43.0 |
| Tooling | Biome 2.6.2, Knip 6.42.1, TypeScript 6.0.3 |

All remaining direct dependencies were updated to their stable registry versions.
A final recursive outdated check lists only TypeScript 7.0.2 as newer than the
selected 6.0.3. `@astrojs/check@0.9.12` declares TypeScript 5/6 support, so all
workspaces use 6.0.3. Bun remains pinned to the repository's 1.4.2 runtime.

## Compatibility decisions

- Effect package consolidation uses native v4 imports and matching platform
  implementations. `@emnapi/runtime` is an explicit compiler peer: without it,
  Astro's checker catches a module-load error and prompts to install itself
  rather than checking the project. Its indirect usage is excluded in Knip.
- Schema defaults preserve missing/undefined decoding and existing encodings.
  Schema-derived property tests use native Effect Arbitrary; independent
  generators continue using a direct `fast-check` development dependency.
- Runtime configuration retains validation, fallback, redaction and cookie
  safeguards. The OpenAPI adapter preserves optional versus nullable fields,
  named definitions and excess-property policy without changing validators.
- CopilotKit's removed A2UI viewer is replaced by its provider/renderer API.
  The existing runtime v0.8 surface contract is translated at the client
  boundary to the renderer's v0.9 contract; action context and bindings remain
  covered through the actual provider. Loading errors render inline.
- Table v9 features are registered explicitly. Sigma v4 uses declarative
  styles and the new camera reset API. Review identified that partial Sigma
  style groups replace defaults; resolved-style regression coverage guards
  labels and weighted edges in the correction.
- Two CLI config tests now locate real repository fixtures relative to their
  modules so both root and workspace test commands work. The compiled smoke
  fixture now puts its config below the source root, consistent with the
  generator's relative `srcRoot: ".."`, instead of scanning the temp directory.

## Qualification evidence

- Workspace typechecks execute successfully, including actual Astro checks:
  app 154 files, zero errors/warnings and 36 hints; site 163 files, zero
  errors/warnings and 29 hints.
- Final full test suite passes 1,347 tests across 181 files, zero failures and
  7,207 assertions in that run. The workspace-filtered test command also passes.
  Four graph evaluator cases reproduced the missing labels and incorrect edge
  thickness before the default-style correction and pass afterward.
- All production workspace builds passed using a fresh generated Python report
  fixture: static site 63 pages, docs four pages, hosted app, runtime, shared
  packages and CLI. The compiled CLI produced a real one-file report.
  The final combined build after the graph correction again passes all
  workspaces, with 63 static site pages and four documentation pages.
- Astro `--timings` works: a repeat fixture build reports 4.14 seconds across
  69 rendered/cached routes, including 10 cache hits. This is a small fixture,
  not a comparative benchmark or qualification of the full real catalogue.
  Parallel prerendering remains disabled.
- Frozen-lockfile installation succeeds. Changed-file Biome checks pass.
- At the initial upgrade checkpoint, repository-wide lint remained open: the same Biome 2.6.2 reported 553 errors
  on an exported unchanged HEAD and 491 on this checkout. These unrelated
  baseline findings were not mass-fixed. Knip also reports existing unused
  code/export findings and requires database configuration to load the
  Drizzle config; no database operation was performed. The subsequently approved
  [repository cleanup](2026-10-24-repository-cleanup.md) resolved these lint and
  Knip findings and established both checks in CI.
- An independent read-only review checked executable compatibility and found
  the Sigma style-default issue above; no other actionable migration defect
  was reported. Existing test assertions were preserved.
- Browser/WebGL interaction, mounted atom hydration, visual A2UI parity and
  authenticated/live database or AI-provider flows were not exercised. The
  browser connector has no available browser in this session. No remote
  landscape analysis, deployment or publication was performed.

## Upstream references

- [Astro 7.4](https://astro.build/blog/astro-740/)
- [Effect 4 migration guide](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md)
- [Effect API migration map](https://github.com/Effect-TS/effect/blob/main/migration/v3-to-v4.md)
- [Effect Schema migration](https://github.com/Effect-TS/effect/blob/main/migration/schema.md)
- [TanStack Table migration](https://tanstack.com/table/latest/docs/framework/react/guide/migrating)
