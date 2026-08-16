# Task 3 report: deterministic Code City scene adapter

## Outcome

Implemented `buildCodeCityScene(model)` as a pure, renderer-neutral adapter in
`packages/report-ui`. It uses the model layout hints for repeatable district
and building order, creates balanced row-first district parcels and bounded
row-first building cells, and derives positive logarithmic building heights
from LOC without allowing LOC outliers to expand parcel footprints.

Component dependency edges are retained as scene records. Resolved district
endpoints receive a raised three-point route; unresolved endpoints are kept
with their available deterministic IDs, `renderable: false`, and no points.
No file-level edges, browser APIs, or Three.js imports were introduced.
The adapter is re-exported from both the Code City and package-root barrels so
the static and future hosted consumers share the same public boundary.

## Tests

Added focused real-model tests covering:

- identical scene output when district, building, and edge model arrays are
  permuted while layout hints remain stable;
- two parcels and three buildings, including a multi-affiliated building that
  appears once in its primary district;
- valid primary-district parents for every scene building;
- resolved and unresolved component routes, including the empty non-renderable
  unresolved record; and
- JSON round-tripping of the complete scene contract.
- the package-root public export used by consumers.

## Verification

- RED: `bun test packages/report-ui/src/code-city/__tests__/sceneAdapter.test.ts`
  failed before implementation because `../sceneAdapter.js` did not exist.
- GREEN: the focused adapter test passed: 4 pass, 0 fail, 14 assertions.
- Public-boundary RED/GREEN: importing `buildCodeCityScene` from the package
  root failed before the barrel export, then passed after it was added.
- `bun run --cwd packages/report-ui typecheck` passed with exit code 0.
- `git diff --check` passed with no whitespace errors.

## Scope and concerns

The commit includes only the Task 3 adapter, its focused test, and this report.
Existing unrelated compatibility/snapshot worktree changes were not touched.

No blocking concerns remain. The adapter assumes the canonical model invariant
that a building's `primaryDistrictId` names an emitted district; malformed
orphan buildings are deliberately not rendered rather than being assigned a
fictional parcel.
