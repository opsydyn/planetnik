# Task 6 report: Code City view, inspector, lenses, and fallback

## Outcome

Replaced the Task 1 null placeholder with the real React `CodeCityView` and
added the pure view models, labelled inspector, semantic fallback table, and
responsive theme-aware styles.

- Health is the default of six real lens buttons. Each button exposes
  `aria-pressed`; the active lens remains visible, and every model legend
  channel renders its unit and source.
- Selection updates stable React IDs and opens the inspector without issuing a
  camera command. **Focus** alone calls `focusEntity(id)`; clearing selection
  calls `focusEntity(null)` to restore a previously preserved camera view.
- The inspector exposes identity, path, district, source sets, LOC, health,
  ownership, impact, change, complexity, coverage, and only resolvable evidence
  links. Missing optional signals render the neutral text `Unavailable`.
- WebGL/module/initialisation failures and dense scenes switch to a complete
  building table with a plain-language status. Every row retains a
  keyboard-focusable Inspect action and exposes evidence when its route exists.
- The fallback stays in the DOM for print and reduced-motion presentation.
  Desktop map/inspector columns stack responsively, controls have visible
  keyboard focus, and the CSS uses the existing report theme tokens.
- Scene, lens, selection, and evidence boundaries remain renderer-neutral.
  Three.js objects were not added to React state, and no route, loader, or
  filesystem logic was introduced.

The new view-model and component types/functions are re-exported through the
Code City and package-root barrels.

## Tests and TDD evidence

The focused view-model test was written first and initially failed because
`viewModel.js` did not exist. It now covers:

- selected-building identity, source sets, district, all required metrics, and
  file/impact/incident-edge evidence links;
- an unselected `null` inspector;
- neutral missing health, ownership, impact, change, and complexity values;
- unresolved primary-district handling without losing the selected building;
  and
- fallback rows in `model.layout.buildingOrder`, including missing evidence.

## Verification

- `bun test packages/report-ui/src/code-city/__tests__/viewModel.test.ts` —
  5 pass, 0 fail, 11 assertions.
- `bun run --cwd packages/report-ui typecheck` — passed with exit code 0.
- `bun test packages/report-ui/src/code-city` — 28 pass, 0 fail,
  68 assertions across all six Code City suites.
- Targeted Biome check — passed for the formatter-managed Task 6 TypeScript
  files.
- `git diff --check` — passed with no whitespace errors.

## Scope and concerns

Existing unrelated compatibility/snapshot changes were preserved. The plan and
SDD progress ledger were not edited.

No blocking concerns remain. The dense node/edge limits are deliberately
provisional configuration values; Task 8 is responsible for measuring and
documenting that transition against representative datasets. Automated tests
and package typecheck do not constitute direct browser, WebGL, keyboard,
reduced-motion, or print evidence; those checks remain for Tasks 7–9.
