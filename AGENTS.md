# AGENTS

This file is a practical handoff for the next coding agent working in `planetnik`.

It complements [CLAUDE.md](/Users/alan/Projects/planetnik/CLAUDE.md). `CLAUDE.md` explains the project and baseline conventions; this file focuses on the operational knowledge and project-specific traps discovered during recent work.

## What This Repo Is

- `planetnik` is a Bun-first TypeScript port of Sokrates.
- Primary packages:
  - `packages/common`
  - `packages/analyzer`
  - `packages/reports`
- Primary apps:
  - `apps/cli`
  - `apps/site`
  - `apps/docs`

## Runtime And Tooling

- Runtime is Bun, not Node.
- Root manifest uses `bun@1.3.11`.
- Main root scripts:
  - `bun run dev:site`
  - `bun run dev:cli`
  - `bun run build`
  - `bun run test`
  - `bun run typecheck`
  - `bun run lint`
  - `bun run lint:fix`
  - `bun run knip`
- If `bun` is missing from `PATH` in this environment, `~/.bun/bin/bun` has worked reliably.

## Working Style

- Keep Bun and Effect first-class. Avoid introducing Node-only assumptions.
- This repo intentionally allows some Java-port-friendly patterns:
  - static-only utility classes
  - selective non-null assertions
- Imports in TS use `.js` extensions.
- Barrel exports matter. When adding new source files, update local `index.ts` files and package root exports.

## Commands You Will Actually Use

### Site

- Dev:
  - `bun run dev:site`
- Typecheck:
  - `bun run --cwd apps/site typecheck`

### CLI

- Dev:
  - `bun run dev:cli`
- Typecheck:
  - `bun run --cwd apps/cli typecheck`

### Single-Repo Report Build

- Example:
  - `bun run dev:cli generateReports --confFile ./planetnik.config.json --outputFolder ./_planetnik/reports`

### Landscape Build

- Example:
  - `bun run dev:cli analyzeLandscape --config ./landscape-config.json --outputFolder ./datasets/<name> --name "<Name> Landscape"`
- Rebuild normalized landscape contracts from an existing analysis root:
  - `bun run dev:cli updateLandscape --analysisRoot ./datasets/<name>`

## Dataset Model And Local DX

The site supports both single-repo and landscape datasets.

### Preferred Local Setup

Use a visible repo-root `datasets/` directory. Do not rely on `/tmp` for datasets you care about keeping.

Preferred env model in `apps/site/.env`:

```env
PLANETNIK_DATASETS_ROOT=/Users/alan/Projects/planetnik/datasets
PLANETNIK_DATASET=alanpcurrie
```

The site loader will resolve named datasets from common layouts such as:

- `datasets/<name>/data`
- `datasets/<name>/reports/data`
- `datasets/<name>/_planetnik/reports/data`
- `datasets/<name>/_planetnik_landscape/reports/data`

Relevant code:

- [apps/site/src/loaders/planetnik-loader.ts](/Users/alan/Projects/planetnik/apps/site/src/loaders/planetnik-loader.ts)
- [apps/site/src/lib/dataDirectories.ts](/Users/alan/Projects/planetnik/apps/site/src/lib/dataDirectories.ts)

### Low-Level Overrides

These still work and take precedence:

- `PLANETNIK_DATA_DIR`
- `PLANETNIK_LANDSCAPE_DATA_DIR`

### Important Local Rule

- Changing `.env` while `astro dev` is already running will not be picked up reliably.
- Restart `bun run dev:site` after changing dataset env vars.

## Landscape Mode

Landscape mode is real, backend-first, and already integrated into the site.

### Landscape Root Routes

- `/landscape`
- `/landscape/repositories`
- `/landscape/contributors`
- `/landscape/teams`
- `/landscape/topology`
- `/landscape/tags`
- `/landscape/security`

### Repo-Scoped Landscape Routes

Landscape parity is implemented as a repo sub-shell, not a flat copy of the single-repo sidebar.

Example namespace:

- `/landscape/repositories/[repo]`
- `/landscape/repositories/[repo]/contributors`
- `/landscape/repositories/[repo]/contributors/[email]`
- `/landscape/repositories/[repo]/topology`
- `/landscape/repositories/[repo]/files/[view]`
- `/landscape/repositories/[repo]/units/[view]`
- `/landscape/repositories/[repo]/metrics`
- `/landscape/repositories/[repo]/duplication`
- `/landscape/repositories/[repo]/hotspots`
- `/landscape/repositories/[repo]/impact`
- `/landscape/repositories/[repo]/controls`

### Key Architectural Decision

- Landscape root is for multi-repo concepts.
- Repo drilldown is where single-repo parity lives.
- Do not flatten the entire single-repo sidebar onto landscape root.

Related docs:

- [docs/product-roadmap.md](docs/product-roadmap.md) — canonical product sequencing
- [docs/landscape-ui-parity-plan.md](docs/landscape-ui-parity-plan.md) — archived delivery history
- [docs/adr/0011-adopt-repo-scoped-shell-for-landscape-drilldown.md](/Users/alan/Projects/planetnik/docs/adr/0011-adopt-repo-scoped-shell-for-landscape-drilldown.md)

## Graph And Routing Caveats

Graph-heavy routes have had real hydration and navigation regressions.

### Astro ClientRouter Bypass

Some routes intentionally bypass `ClientRouter` and force a full reload. See:

- [apps/site/src/lib/reloadRoutes.ts](/Users/alan/Projects/planetnik/apps/site/src/lib/reloadRoutes.ts)

This exists because some graph pages do not reliably survive Astro client-side swaps.

### Force Graph / Topology Notes

- Dense topology graphs can blow up dagre layout.
- The structured topology view is intentionally capped for large graphs.
- Force-directed views have adaptive behavior for large graphs.
- If a graph page looks broken only after navigation, check whether the route should be added to `reloadRoutes.ts`.

## Security / Dependabot Landscape Data

Landscape dependency security is fetched during `analyzeLandscape`, not `updateLandscape`.

Requirements:

- `GITHUB_TOKEN` available to the CLI
- landscape config security enabled

Expected output files:

- `landscape_dependency_alerts.json`
- `landscape_dependency_health.json`

If these are missing, the landscape security page will show no data.

Important:

- `apps/site/.env` is irrelevant for CLI auth.
- CLI auth belongs in `apps/cli/.env`.

## CI/CD State

Current workflow direction is good, but keep these rules in mind:

- Bun is pinned to `1.3.11` in workflows.
- Landscape deploy expects `LANDSCAPE_GITHUB_TOKEN`.
- Deploy is now stricter about landscape security data being present when landscape analysis runs.

Main workflows:

- [.github/workflows/ci.yml](/Users/alan/Projects/planetnik/.github/workflows/ci.yml)
- [.github/workflows/deploy.yml](/Users/alan/Projects/planetnik/.github/workflows/deploy.yml)

### Secret Hygiene

- Never paste real GitHub tokens into docs, commits, or issue text.
- If a token was exposed in chat or logs, rotate it immediately.

## Shared-App Direction

There is an explicit plan to keep:

- `apps/site` as the static public report product
- a future authenticated/containerized app as a separate app

The pragmatic sharing model is:

- share components, layouts, tables, charts, view-models, route helpers
- do not share Astro `src/pages` directly
- do not couple static loaders to the future hosted runtime

Historical delivery plan:

- [docs/shared-app-extraction-plan.md](docs/shared-app-extraction-plan.md) — archived; promote unfinished work into the canonical roadmap before acting on it

## Docs Worth Reading Before Large Changes

- [docs/product-roadmap.md](docs/product-roadmap.md) — sole source of truth for current product sequencing
- [CLAUDE.md](/Users/alan/Projects/planetnik/CLAUDE.md)
- [README.md](/Users/alan/Projects/planetnik/README.md)
- [docs/cli.md](/Users/alan/Projects/planetnik/docs/cli.md)
- [docs/local-dataset-dx-review.md](/Users/alan/Projects/planetnik/docs/local-dataset-dx-review.md)
- [docs/rust-tree-sitter-migration-discovery.md](docs/rust-tree-sitter-migration-discovery.md) — completed parser evidence, not active sequencing
- [docs/adr/0010-adopt-effect-structured-concurrency-for-landscape-analysis.md](/Users/alan/Projects/planetnik/docs/adr/0010-adopt-effect-structured-concurrency-for-landscape-analysis.md)
- [docs/adr/0011-adopt-repo-scoped-shell-for-landscape-drilldown.md](/Users/alan/Projects/planetnik/docs/adr/0011-adopt-repo-scoped-shell-for-landscape-drilldown.md)
- [docs/adr/0018-adopt-versioned-canonical-analysis-snapshots.md](docs/adr/0018-adopt-versioned-canonical-analysis-snapshots.md) — canonical snapshot and identity contract
- [docs/compatibility-removal-fixture-matrix.md](docs/compatibility-removal-fixture-matrix.md) — executable Phase 1 proof that core routes do not require TXT projections

## If You Are Resuming A Broken Session

Do these first:

1. `git status --short`
2. `bun run typecheck`
3. `bun test`
4. Confirm which dataset the site is actually using
5. Restart the site dev server after any dataset env change

If landscape mode appears empty:

1. verify `report_context.json` exists in the selected dataset
2. verify `landscape_overview.json` exists
3. verify the selected dataset path is not an old `/tmp` directory

If a client island errors in landscape mode:

1. check for server-only imports leaking into client code
2. check route bypass rules for graph-heavy pages
3. test the route with a hard reload, not only via Astro navigation

## Practical Summary

- Use Bun everywhere.
- Prefer repo-root `datasets/` for local analysis outputs.
- Restart Astro when env-driven dataset selection changes.
- Treat landscape as a first-class mode, but keep repo parity inside repo-scoped drilldown.
- Be suspicious of graph pages after client-side navigation.
- Be explicit about tokens and security data expectations in landscape runs.
