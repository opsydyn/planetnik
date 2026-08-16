# Task 2 report: adapt canonical collections for Code City

## Outcome

Implemented the pure Astro collection-entry adapter in `apps/site/src/lib/codeCitySnapshot.ts`.
It accepts canonical collection entries and produces `CodeCitySnapshotInput`, preserving collection order while leaving canonical sorting and diagnostics to the common builder. Optional shards are emitted only when they contain records, and hotspot records are partitioned by their explicit `kind` (`file`, `unit`, or `component`). Unknown hotspot kinds are omitted.

## Tests

Added `apps/site/src/lib/__tests__/codeCitySnapshot.test.ts` covering:

- conversion of context, main/test files, units, dependencies, hotspots, and impact;
- hotspot grouping by kind;
- omission of empty optional shards and unknown hotspot kinds;
- preservation of a valid main-file shard when all optional inputs are empty.

## Verification

- `bun test apps/site/src/lib/__tests__/codeCitySnapshot.test.ts` — 2 pass, 0 fail.
- `bun run --cwd apps/site typecheck` — 0 errors, 0 warnings, 20 existing hints.

The typecheck emitted expected local data-directory-not-found messages while Astro content synchronized; it completed successfully.

## Scope and concerns

Only the adapter, focused test, and this report are part of the Task 2 commit. Existing unrelated dirty changes were preserved. No filesystem access, loader calls, or runtime imports were added to the adapter.

No blocking concerns remain. The site typecheck retains its pre-existing unused-import hints outside this task.
