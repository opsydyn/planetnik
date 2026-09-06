# Local Dataset DX Review

## Purpose

This document reviews the current developer experience around Planetnik report datasets and recommends a pragmatic local-development model.

The goal is simple:

- datasets should be visible at the repo root
- developers should be able to keep multiple datasets side by side
- switching between datasets should be cheap and explicit
- the static Astro app should keep working without special-case setup
- CI/CD should keep using ephemeral workspace paths where appropriate

## Current State

Today the repo mixes several output conventions:

- single-repo reports commonly land in `_planetnik/reports/data`
- landscape reports commonly land in `<outputFolder>/_planetnik_landscape/reports/data`
- docs have historically shown both repo-local and `/tmp` examples
- the site currently resolves data from:
  1. `PLANETNIK_DATA_DIR`
  2. `PLANETNIK_LANDSCAPE_DATA_DIR`
  3. default `_planetnik/reports/data`

This works, but the DX is weak.

## Main Problems

### 1. Final datasets are easy to lose

Using `/tmp` for a dataset you want to keep is the wrong default. It is suitable for scratch space, not for reusable local analysis outputs.

### 2. The current root layout is not intentional

The repo root already contains generated output folders such as:

- `_planetnik`
- `_planetnik_landscape`

Those are implementation-oriented, not developer-oriented. They do not clearly communicate:

- which dataset is active
- which org or repo a dataset belongs to
- which datasets are safe to keep

### 3. Dataset switching is too path-centric

Changing datasets currently means editing a raw absolute path in `apps/site/.env`. That is workable, but fragile and not pleasant.

### 4. Landscape and single-repo outputs are inconsistent

Single-repo output can be clean when generated into a dedicated folder:

- `datasets/sokrates/data`

Landscape output is currently nested:

- `datasets/effect-ts/_planetnik_landscape/reports/data`

This is understandable from the CLI implementation, but not ideal as a long-term contract.

### 5. The site fallback can mask mistakes

If the requested dataset path is wrong or empty, the app can appear to “fall back” to the default single-repo dataset. That makes debugging dataset selection harder than it should be.

## Recommendation

Adopt a first-class repo-root `datasets/` directory for local development.

This should become the standard place for all local, reusable report outputs.

### Recommended root structure

```text
datasets/
  sokrates/
    data/
    # html/ and index.html are optional legacy projections

  effect-ts/
    _discovery/
    effect-TS/
      effect/
      cli/
      ...
    _planetnik_landscape/
      config.json
      reports/
        index.html # optional legacy projection
        data/

  alanpcurrie/
    _discovery/
    alanpcurrie/
      repo-a/
      repo-b/
    _planetnik_landscape/
      config.json
      reports/
        index.html # optional legacy projection
        data/
```

This is intentionally pragmatic:

- it does not require rewriting the CLI output model immediately
- it makes datasets visible and named
- it allows multiple datasets to coexist
- it works for both single-repo and landscape outputs

## Strong DX Recommendation

### Local datasets should always live under `datasets/`

Examples:

- `datasets/sokrates`
- `datasets/effect-ts`
- `datasets/alanpcurrie`

Do not recommend `/tmp` for final output in docs or examples.

Use `/tmp` only for:

- transient clones
- temporary working files
- CI scratch paths

## Environment Model

The current dual-env approach is serviceable but not ideal.

### Current compatibility model

Keep supporting:

- `PLANETNIK_DATA_DIR`
- `PLANETNIK_LANDSCAPE_DATA_DIR`

This is necessary for backward compatibility and CI.

### Recommended local-dev model

Add a higher-level dataset selector:

```env
PLANETNIK_DATASETS_ROOT=/Users/alan/Projects/planetnik/datasets
PLANETNIK_DATASET=effect-ts
```

Then the loader resolves the actual data directory by inspecting the selected dataset folder.

Suggested resolution order:

1. `PLANETNIK_DATA_DIR`
2. `PLANETNIK_LANDSCAPE_DATA_DIR`
3. `PLANETNIK_DATASET` + `PLANETNIK_DATASETS_ROOT`
4. repo default `_planetnik/reports/data`

### Why this is better

- switching becomes `effect-ts` vs `alanpcurrie`, not absolute path editing
- dataset names become part of the dev workflow
- the loader can remain mode-aware by checking `report_context.json`

## Dataset Selection Rules

When `PLANETNIK_DATASET` is set, the loader should look for a valid dataset in this order:

### Single-repo candidates

- `<datasetsRoot>/<dataset>/data`
- `<datasetsRoot>/<dataset>/reports/data`
- `<datasetsRoot>/<dataset>/_planetnik/reports/data`

### Landscape candidates

- `<datasetsRoot>/<dataset>/_planetnik_landscape/reports/data`

The selected candidate must contain:

- `report_context.json`
  or
- enough legacy single-repo files for fallback detection

If no candidate is valid, the loader should emit a strong warning and not silently pick a different dataset.

## CLI DX Recommendation

The CLI should steer users toward named dataset roots.

### Good local examples

Single repository:

```bash
bun run apps/cli/src/index.ts generateReports \
  --confFile ./planetnik.config.json \
  --outputFolder ./datasets/sokrates

# Add --emitLegacyProjections only when a legacy TXT/HTML bundle is needed.
```

Landscape:

```bash
bun run apps/cli/src/index.ts analyzeLandscape \
  --config ./landscape-config.json \
  --outputFolder ./datasets/effect-ts \
  --name "Effect Ecosystem"

# Add --emitLegacyProjections only when a legacy landscape TXT/HTML bundle is needed.
```

### Avoid in docs

```bash
--outputFolder /tmp/planetnik-...
```

That remains valid for debugging, but should not be the recommended local workflow.

## `.env` Recommendation

For app-local development, prefer:

```env
PLANETNIK_DATASETS_ROOT=/Users/alan/Projects/planetnik/datasets
PLANETNIK_DATASET=effect-ts
```

Keep raw path overrides available when needed:

```env
# PLANETNIK_DATA_DIR=/absolute/path/to/single-repo/data
# PLANETNIK_LANDSCAPE_DATA_DIR=/absolute/path/to/landscape/data
```

## CI/CD Recommendation

CI should not use the named local dataset root.

CI is a different environment:

- workspace paths are ephemeral
- outputs are job-local
- the pipeline already knows exactly which directory it just wrote

So CI should keep using explicit paths like:

- `${{ github.workspace }}/_reports/data`
- `${{ github.workspace }}/_landscape/_planetnik_landscape/reports/data`

That is correct for automation.

## Recommended Rollout

### Phase 1: standardize local output guidance

- adopt `datasets/` as the documented root for local reusable outputs
- stop using `/tmp` in local dev examples
- add `datasets/` to `.gitignore`

### Phase 2: improve loader selection

- add `PLANETNIK_DATASETS_ROOT`
- add `PLANETNIK_DATASET`
- keep current env vars as overrides
- fail loudly when a selected dataset is invalid

### Phase 3: improve dev scripts

Add helper scripts or a small CLI helper for local switching:

- `bun run dev:site --dataset effect-ts`
- `bun run dataset:list`
- `bun run dataset:use effect-ts`

These can come later. The main win is getting the directory and env model right first.

### Phase 4: flatten landscape output contract

Longer term, consider making landscape output look more like single-repo output:

```text
datasets/effect-ts/
  data/
  # html/ and index.html are optional legacy projections
  repos/
```

That would be cleaner, but it is a migration and should not block the earlier DX improvements.

## Recommended Decision

Adopt this as the local-development standard:

- local reusable datasets live under repo-root `datasets/`
- switching datasets should prefer a dataset name, not a raw path
- raw env paths remain supported as overrides
- CI continues using explicit workspace paths
- `/tmp` remains scratch-only

## Immediate Next Steps

1. Add `datasets/` to `.gitignore`.
2. Update docs examples to use `./datasets/<name>`.
3. Add `PLANETNIK_DATASET` and `PLANETNIK_DATASETS_ROOT` support to the site loader.
4. Update `apps/site/.env.example` to prefer named dataset selection.
