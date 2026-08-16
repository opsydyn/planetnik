# Task 5 report: lazy Three.js renderer and constrained camera

## Outcome

Implemented the browser-only Code City rendering boundary in
`packages/report-ui/src/code-city`:

- `threeRenderer.ts` builds a disposable plain-Three.js scene from the existing
  renderer-neutral `CodeCityScene` and per-entity `CodeCityLensVisual` records.
  It uses an orthographic isometric camera, constrained `OrbitControls`, lit box
  meshes for parcels/buildings, restrained raised route strips, and raycasting
  that emits only stable entity IDs.
- Selection changes materials and relevant district routes without moving the
  camera. `focusEntity(id)` is the only reframing command; `focusEntity(null)`
  restores the camera position, target, and zoom captured before the first
  focus.
- `CodeCityCanvas.tsx` dynamically imports the renderer from `useEffect`, keeps
  its initial render SSR-safe, exposes only stable IDs/reasons and an imperative
  string-ID focus command, and performs no model or layout transformation.
- WebGL/context failures report stable reasons rather than escaping through
  React. Initialisation, observers, controls, listeners, materials, geometries,
  the scene, and the renderer have one idempotent cleanup path.

The Task 1 placeholder `CodeCityView.tsx`, package barrels, the approved plan,
and the SDD progress ledger were not changed.

## Tests and TDD evidence

The focused test was written before the renderer module and initially failed
because `threeRenderer.js` did not exist. It covers:

- missing and present WebGL contexts;
- orthographic projection with finite, bounded polar and azimuth limits; and
- building selection resolving to its parent district for route emphasis.

The building-route regression was also observed RED with `file:alpha` returned
instead of the expected `district:core`, then passed after the route selection
helper was implemented.

## Verification

- `bun test packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts` —
  4 pass, 0 fail, 13 assertions.
- `bun run --cwd packages/report-ui typecheck` — passed with exit code 0.
- Targeted Biome check — passed for the formatter-managed Task 5 TypeScript
  files.
- `git diff --check` — passed with no whitespace errors.
- Independent review found two Important issues in the first draft: partial
  renderer setup failures could leak/misreport, and building selection did not
  reveal its district route. Both were fixed and the re-review found no new
  Critical or Important issues.

## Scope and concerns

Direct WebGL/GPU visual evidence is intentionally deferred to the route smoke
task. These unit tests prove the capability/configuration boundary and pure
route-selection behaviour; they do not claim successful rendering on a real
GPU or validate final visual composition.

No blocking concerns remain for Task 6. The current renderer represents a
building's primary/parent district route because that is the district identity
available on `CodeCitySceneNode`; it does not invent additional file-level
edges or transform the canonical scene layout.
