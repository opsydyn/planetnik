# @planetnik/report-data

The report data layer: Astro content-collection loaders, route helpers and the
pure analysis/derivation modules that report pages build their props from.

Extracted from `apps/site` so `apps/site` and `apps/foldkit-site` consume one
copy instead of diverging. It is framework-free: nothing here imports
`astro:content`. Reading collections is the app's job, matching the convention
`@planetnik/report-ui` already follows. `loaders/planetnik-loader` imports only
the `astro/loaders` *type*, because defining a loader is data, not access.

## Known gap: type strictness

`tsconfig.json` disables `exactOptionalPropertyTypes` and
`noUncheckedIndexedAccess`, and excludes `src/lib/__tests__`. That mirrors the
settings this code was written and shipped under: `apps/site/tsconfig.json`
extends `astro/tsconfigs/strict`, not the repository's `tsconfig.base.json`, and
excluded its tests from checking.

Raising this package to the repository default surfaces **58 pre-existing
errors** (about 37 in tests, the rest in `src`). Fixing them is real work on
working, tested code and is deliberately not part of the extraction that created
this package. Raise the two flags and clear them as a separate change.
