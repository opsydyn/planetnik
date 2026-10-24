# Repository Cleanup Record

**Goal:** Complete the requested repository-wide lint, formatting, dependency and dead-code cleanup after the Astro/Effect upgrade, preserving product behavior and the intentionally exposed package APIs.

## Work

- [x] Capture current lint and Knip diagnostics before cleanup.
- [x] Apply safe Biome formatting and import-order fixes across the repository.
- [x] Resolve remaining lint findings with behavioral fixes or narrow, justified false-positive annotations.
- [x] Configure Knip to model Bun tests, Astro assets, scripts and static configuration correctly without requiring database credentials.
- [x] Remove confirmed unused files, exports and dependencies; preserve intended package entry APIs and explicitly retained dormant templates.
- [x] Run lint, Knip, tests, typechecks, frozen installation, production builds and compiled CLI smoke verification.

## Constraints and rationale

- The existing uncommitted dependency upgrade is part of the starting tree and is preserved.
- Unrelated `.superpowers/brainstorm` scratch files are not deleted or analyzed as product sources.
- Static site/hosted app boundaries and Bun 1.4.2 remain unchanged.
- Runtime database credential checks remain effective for real database commands; static analysis must not invoke those commands.
- The dormant hosted sign-up template is explicitly retained in source for future re-enablement; it is not a live route.
- The date-string maximum uses lexical comparison. Biome's suggested numeric `Math.max` conversion is incorrect for ISO strings, so that single expression has an explanatory suppression.

## Initial evidence

- Biome: 491 errors and five warnings. The safe fixer changed 466 files, leaving four errors and three warnings for manual review.
- Knip: database-config loading error, 42 reported unused files, eight unused dependencies, two unused dev dependencies, two unlisted binaries, 51 unused exports, 124 unused exported types and eight duplicate exports. This report includes false-positive tests because the site has no test script and Bun test entry discovery was incomplete.

## Completed cleanup

- Biome now includes shared-package TSX and Knip configuration, covering 813
  local files. Safe formatting/import fixes were followed by manual review of
  remaining findings. No rules were globally weakened. Narrow SVG, keyboard
  status, trusted icon-catalog HTML and lexical-date exceptions explain cases
  where the checker suggests an invalid transformation.
- Shared Code City controls use named native fieldsets with visual resets.
  SVG controls retain keyboard activation; tooltip-only graphics have data
  labels. Seven unused default aliases were removed while named components and
  the public package entrypoints remain intact.
- Search loads are cached per index URL, failed requests can retry, and late
  responses cannot overwrite another report or a closed dialog. The backdrop
  is a labelled button. Focus is trapped/restored, repeated open shortcuts
  preserve the original focus target, and Enter on controls keeps native
  behavior. Four URL-cache regression tests cover reuse, isolation, retry and
  out-of-order completion.
- Removed three confirmed orphans: `HostedBrand.astro`,
  `DependencyHealthSchema.ts` and the unused `duplication/impl/index.ts` barrel.
  The implementations behind that barrel remain. Their prior tracked versions
  remain recoverable from Git.
- Removed ten unused/redundant direct dependency declarations and synchronized
  the lockfile. Astro supplies its compiler dependency transitively;
  `@emnapi/runtime` remains the explicit native-compiler peer workaround.
- Unused app-private type exports are module-local, unused aliases/helpers are
  removed, and obsolete barrel re-exports are pruned. Active validators and
  inferred result shapes are unchanged.
- Knip explicitly models Bun tests (including underscore test names), Astro
  entries, public scripts, the dormant signup template and Drizzle's static
  schema/config. Root is tooling-only with no root source project; application
  sources are analyzed through their own workspaces. This excludes local
  `.superpowers` scratch without an ignore that becomes stale in a clean CI
  checkout. Real database commands retain their credential guards.
- CI now runs lint and strict Knip configuration validation alongside typechecks
  and tests, preventing a return to the old baseline.

## Verification

- `bun run lint`: zero errors and warnings, 813 files checked locally.
- `bun run knip`: zero findings and configuration hints; the script treats
  configuration hints as failures.
- `bun test`: 1,352 pass, zero failures, 182 test files.
- `bun run typecheck`: all workspaces pass with zero errors/warnings. Astro
  reports 28 site and 36 app Copilot deprecation hints; see the boundary below.
- `bun install --frozen-lockfile`: passes.
- `bun run build` with a freshly generated bounded report fixture: all
  workspace builds pass, including 63 static site pages, four documentation
  pages, hosted app, CLI, runtime and shared packages.
- Compiled CLI smoke: help, real report generation, one analyzed file and
  positive LOC all pass.
- A clean temporary source checkout, excluding local/generated files, passes
  frozen installation, lint, strict Knip, the full 1,352-test suite, all
  typechecks and compiled CLI smoke. This caught and eliminated a machine-local
  Knip ignore/configuration-hint dependency before CI enforcement was finalized.
- Independent read-only review found no blocking regression. Its minor search
  focus-restoration finding was corrected. Interactive browser/AT verification
  and live database/AI-provider traffic were not performed.

## Deliberately retained compatibility notices

The 64 Copilot deprecation hints are not suppressed. The installed runtime
already adapts its v1-named endpoint/adapter to a v2 single-route handler, so a
backend protocol replacement is not inherently required. However, supported v2
frontend APIs change chat slots, welcome/error/copy labels, styling, prompt
registration, tool schemas and hosted follow-up dispatch. Preserving those
behaviors requires a separate intelligence UI compatibility migration and
browser qualification, rather than deleting deprecated props or hiding hints
as part of dead-code cleanup.
