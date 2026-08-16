# Task 4 report: Code City lenses, selection, and evidence links

## Outcome

Implemented the renderer-neutral Code City interaction helpers in
`packages/report-ui/src/code-city`:

- `resolveCodeCityLens` is a total semantic-lens mapping for the six canonical
  legend IDs. Health remains its default lens; absent optional signals remain
  neutral and explicitly unavailable rather than being converted to zero.
- `resolveCodeCitySelection` resolves district and multi-affiliated building
  selections into represented district IDs, incident component-edge IDs, and
  deterministic combined evidence references. It does not synthesize
  file-level edges.
- `resolveCodeCityEvidenceHref` joins canonical relative evidence routes to a
  deployment base without an origin, duplicate path separators, or traversal
  outside the deployment base.

All helpers are re-exported through the Code City and package-root barrels.
They have no browser, DOM, WebGL, Three.js, loader, or runtime dependencies.

## Tests

Added focused Bun tests for:

- the default Health lens, missing neutral Health, severity-material mapping,
  Impact score, zero-contributor Ownership, all six stable lens IDs, and
  unchanged scene positions;
- empty, district, and multi-affiliated-building selection, including
  deterministic evidence and only incident component edges; and
- missing, normal, redundant-separator, and traversal-attempt evidence routes.

## Verification

- RED: each focused suite initially failed because its corresponding pure
  module did not exist.
- GREEN: `bun test packages/report-ui/src/code-city/__tests__/lens.test.ts` —
  6 pass, 0 fail, 17 assertions.
- GREEN: `bun test packages/report-ui/src/code-city/__tests__/selection.test.ts`
  — 3 pass, 0 fail, 7 assertions.
- GREEN: `bun test packages/report-ui/src/code-city/__tests__/evidence.test.ts`
  — 4 pass, 0 fail, 4 assertions.
- `bun run --cwd packages/report-ui typecheck` passed with exit code 0.
- `git diff --check` passed with no whitespace errors.

## Scope and concerns

The Task 4 commit includes only the three pure modules, their focused tests,
the necessary package-barrel exports, and this report. Existing unrelated
compatibility/snapshot worktree changes were preserved.

No blocking concerns remain. The palettes are stable semantic material tokens;
Task 5's renderer may consume them without changing scene coordinates or
evidence resolution.
