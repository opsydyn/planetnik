# Task 8 report — route-state, accessibility, dense-data, and build hardening

## Delivered

- Added the pure `resolveCodeCityRouteState` boundary with the exact `ready`,
  `partial`, `unsupported-landscape`, `invalid`, and `empty` tags.
- Reworked `/code-city` to use that boundary and render explicit stateful
  guidance. Partial snapshots now expose their title, snapshot ID, file/context
  counts, diagnostic count, missing canonical shard names, and an existing file
  evidence route. Invalid and empty input cannot render an empty WebGL island.
- Kept the measured scene node/edge fallback policy and renderer-unavailable
  fallback explicit. The table starts with every model building visible; an
  explicit district/building selection can now be toggled as a filter rather
  than silently removing rows.
- Made map status keyboard reachable (`role=status`, `tabIndex=0`) after the
  native map/table and lens controls. The existing native table controls,
  inspector actions, and evidence links remain in the normal tab sequence.
- Preserved print behaviour: GPU workspace is hidden and the full fallback
  table prints. Reduced-motion CSS removes CSS motion; the renderer already
  uses `OrbitControls.enableDamping = false` and immediate focus/restore, so it
  has no camera easing to run under reduced motion.
- Completed the package-root Code City exports for fallback, inspector, and
  view controls/types, which were previously omitted from the root barrel.

## TDD evidence

The initial route-state test ran RED because `../routeState.js` did not exist.
The minimal resolver was then added and the five contract cases ran GREEN.

## Verification

- `bun test packages/report-ui/src/code-city/__tests__/routeState.test.ts` — 5 pass, 0 fail.
- `bun test packages/report-ui/src/code-city/__tests__` — 36 pass, 0 fail.
- `bun run --cwd packages/report-ui typecheck` — passed.
- `bun run --cwd apps/site typecheck` — passed with 0 errors and 0 warnings;
  the command reports existing unused-import hints and local missing-dataset
  loader notices only.
- `git diff --check` — passed.

## Boundary / remaining evidence

No direct browser, WebGL, print-preview, reduced-motion media-query, or dense
fixture runtime proof was claimed here. Those acceptance checks remain Task 9.
