# Code City WebGL UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first single-repository `/code-city` decision surface as a static-site WebGL/isometric city backed only by the canonical v2 `CodeCityModel`.

**Architecture:** Build a pure scene adapter in `packages/report-ui` that turns the shared `CodeCityModel` into deterministic district, building, and dependency scene records. Render those records with a lazy-loaded plain Three.js canvas behind a React view that owns lenses, selection, inspector, fallback, and accessibility. Assemble the model in the Astro route from existing canonical content collections; do not add runtime parsing or a new exporter shard.

**Tech Stack:** Bun 1.3.11 workspace, TypeScript, Astro 7, React 19, `@planetnik/common`, `@planetnik/report-ui`, Three.js WebGL, existing Dashboard shell, and Bun test.

## Global Constraints

- Runtime is Bun; use Bun-native commands and do not introduce Node-only runtime assumptions.
- The only product input is v2 canonical JSON → `CodeCityModel`; no TXT, HTML, text, or runtime source parsing.
- The first route is a single-repository `apps/site` `/code-city` route; landscape-root aggregation is out of scope.
- Use plain Three.js behind a thin React client island; do not port Draxul's native Vulkan/Metal renderer or copy its assets/code.
- The scene is real WebGL with stylised 2.5D geometry, an orthographic isometric default, and constrained orbit plus pan/zoom.
- Building mass is bounded/log-scaled LOC; lens changes never move parcels or buildings.
- Health is the default lens; Footprint, Impact, Change, Ownership, and Complexity remain explicit switchable lenses.
- Selection preserves the camera; **Focus** is the only action that reframes it.
- Dependency routes are selection paths by default; the Impact lens may emphasise relevant incident routes.
- Missing optional data remains neutral/unavailable and is never coerced into an invented zero or score.
- The right inspector links to existing evidence routes; route resolution must remain environment-independent.
- A table/list fallback is required for no WebGL, accessibility, print, and dense datasets.
- Static and hosted products may share renderer primitives, but Astro page files are not shared.
- Do not create commits until the user explicitly approves committing; keep verification checkpoints usable in the working tree otherwise.

---

## File map

### Shared package

- Create `packages/report-ui/src/code-city/sceneTypes.ts` — serialisable renderer-neutral scene records.
- Create `packages/report-ui/src/code-city/sceneAdapter.ts` — deterministic parcel, building, and route placement.
- Create `packages/report-ui/src/code-city/lens.ts` — semantic lens IDs, availability, colours, and legend presentation.
- Create `packages/report-ui/src/code-city/selection.ts` — entity selection and incident dependency path resolution.
- Create `packages/report-ui/src/code-city/evidence.ts` — relative evidence-link resolution.
- Create `packages/report-ui/src/code-city/viewModel.ts` — pure inspector, legend, and fallback row view models.
- Create `packages/report-ui/src/code-city/threeRenderer.ts` — WebGL capability and Three.js scene lifecycle helpers.
- Create `packages/report-ui/src/code-city/CodeCityCanvas.tsx` — client-only canvas host and pointer/camera bridge.
- Create `packages/report-ui/src/code-city/CodeCityView.tsx` — lens controls, selection state, inspector, canvas, and fallback orchestration.
- Create `packages/report-ui/src/code-city/CodeCityInspector.tsx` — selected entity signals and evidence links.
- Create `packages/report-ui/src/code-city/CodeCityFallback.tsx` — accessible table/list representation.
- Create `packages/report-ui/src/code-city/CodeCityView.css` — responsive, theme-aware city shell and inspector styles.
- Create `packages/report-ui/src/code-city/index.ts` — public Code City UI exports.
- Create focused tests under `packages/report-ui/src/code-city/__tests__/` for each pure boundary.
- Modify `packages/report-ui/package.json` and `packages/report-ui/src/index.ts` for dependencies and exports.

### Static site

- Create `apps/site/src/lib/codeCitySnapshot.ts` — convert Astro collection entries into `CodeCitySnapshotInput`.
- Create `apps/site/src/lib/__tests__/codeCitySnapshot.test.ts` — canonical collection-to-model-input fixtures.
- Create `apps/site/src/pages/code-city.astro` — single-repository route, model assembly, error states, and React island.
- Modify `apps/site/src/layouts/Dashboard.astro` — add the Code City navigation item.
- Modify `apps/site/src/lib/reloadRoutes.ts` and its test — bypass Astro client swaps for the WebGL route if required by the existing graph-route rule.
- Modify `apps/site/package.json` — declare the shared common package dependency used to build the model.

### Verification and records

- Add/extend fixture data in the shared Code City tests rather than adding a new exporter or production shard.
- Update `docs/product-roadmap.md` only after direct route and fallback evidence is captured.
- Add an adoption ADR only after the UI exit criteria pass; the implementation must not claim visual/WebGL success from unit tests alone.

## Task 1: Establish the shared UI package boundary

**Files:**
- Create: `packages/report-ui/src/code-city/sceneTypes.ts`
- Create: `packages/report-ui/src/code-city/index.ts`
- Modify: `packages/report-ui/package.json`
- Modify: `packages/report-ui/src/index.ts`
- Modify: `apps/site/package.json`

**Interfaces:**
- Consumes: `CodeCityModel` and its entity/edge types from `@planetnik/common`.
- Produces: public `CodeCityView` export path and the scene-record types consumed by all later tasks.

- [ ] **Step 1: Add the workspace dependencies**

Use Bun to add the renderer and shared model dependencies to the packages that own them:

```bash
bun add --cwd packages/report-ui three
bun add --cwd packages/report-ui @planetnik/common@workspace:*
bun add --cwd packages/report-ui --dev @types/three
bun add --cwd apps/site @planetnik/common@workspace:*
```

Expected result: `three` is a runtime dependency of `@planetnik/report-ui`, `@types/three` is a development dependency there, and both consumers declare the workspace common package without changing the root Bun version.

- [ ] **Step 2: Define the serialisable scene contract**

Create `sceneTypes.ts` with these exact public shapes:

```ts
export type CodeCityScenePoint = {
	readonly x: number;
	readonly y: number;
	readonly z: number;
};

export type CodeCitySceneNode = {
	readonly id: string;
	readonly kind: "district" | "building";
	readonly label: string;
	readonly parentId: string | null;
	readonly center: { readonly x: number; readonly z: number };
	readonly size: {
		readonly width: number;
		readonly depth: number;
		readonly height: number;
	};
	readonly districtKey: string;
};

export type CodeCitySceneEdge = {
	readonly id: string;
	readonly sourceId: string;
	readonly targetId: string;
	readonly renderable: boolean;
	readonly points: readonly CodeCityScenePoint[];
	readonly weight: number;
};

export type CodeCityScene = {
	readonly contractVersion: 1;
	readonly nodes: readonly CodeCitySceneNode[];
	readonly edges: readonly CodeCitySceneEdge[];
	readonly bounds: {
		readonly width: number;
		readonly depth: number;
		readonly height: number;
	};
};
```

Keep Three.js types out of this file so the adapter remains testable in Bun and reusable by the future hosted consumer.

- [ ] **Step 3: Add barrel exports**

Export the Code City view and scene types from `packages/report-ui/src/code-city/index.ts`, then re-export the public view from `packages/report-ui/src/index.ts` using the existing package style. Add an explicit package export for `./code-city/CodeCityView`.

- [ ] **Step 4: Run the package typecheck**

Run:

```bash
bun run --cwd packages/report-ui typecheck
```

Expected: PASS, with no Three.js imports leaking into `packages/common` or server-only files.

- [ ] **Step 5: Verification checkpoint**

Run `bun install --frozen-lockfile` and repeat the package typecheck. After explicit commit approval, the checkpoint commit message is `feat: establish code city ui package boundary`.

## Task 2: Adapt canonical Astro collections into the model input

**Files:**
- Create: `apps/site/src/lib/codeCitySnapshot.ts`
- Create: `apps/site/src/lib/__tests__/codeCitySnapshot.test.ts`

**Interfaces:**
- Consumes: Astro collection entries whose `.data` values match the canonical shard record types.
- Produces: `toCodeCitySnapshotInput(collections): CodeCitySnapshotInput` with required `context`/`filesMain` and optional shard wrappers.

- [ ] **Step 1: Write the failing input-shape tests**

Create a fixture with one v2 context, two main files, one test file, one unit, one component dependency, one file hotspot, one component hotspot, and one impact opportunity. Assert that the helper preserves records and groups hotspot entries by `kind`:

```ts
test("converts canonical collection entries into CodeCitySnapshotInput", () => {
	const input = toCodeCitySnapshotInput(fixtureCollections());

	expect(input.context.dataVersion).toBe(2);
	expect(input.filesMain.files).toHaveLength(2);
	expect(input.filesTest?.files).toHaveLength(1);
	expect(input.units?.units).toHaveLength(1);
	expect(input.componentDependencies?.dependencies).toHaveLength(1);
	expect(input.hotspots?.fileHotspots).toHaveLength(1);
	expect(input.hotspots?.componentHotspots).toHaveLength(1);
	expect(input.impact?.impact_opportunities).toHaveLength(1);
});
```

Run:

```bash
bun test apps/site/src/lib/__tests__/codeCitySnapshot.test.ts
```

Expected: FAIL because the adapter and fixture helper do not exist yet.

- [ ] **Step 2: Define the collection-entry interfaces**

In `codeCitySnapshot.ts`, define the exact adapter boundary:

```ts
export type CodeCityCollectionEntry<T> = { readonly data: T };

export type CodeCitySnapshotCollections = {
	readonly context: CanonicalReportContext;
	readonly filesMain: readonly CodeCityCollectionEntry<CanonicalFileRecord>[];
	readonly filesTest: readonly CodeCityCollectionEntry<CanonicalFileRecord>[];
	readonly units: readonly CodeCityCollectionEntry<CanonicalUnitRecord>[];
	readonly dependencies: readonly CodeCityCollectionEntry<CanonicalComponentDependencyRecord>[];
	readonly hotspots: readonly CodeCityCollectionEntry<CanonicalHotspotRecord>[];
	readonly impact: CanonicalImpactShard | undefined;
};

export function toCodeCitySnapshotInput(
	collections: CodeCitySnapshotCollections,
): CodeCitySnapshotInput;
```

Use type-only imports from `@planetnik/common`; do not read the filesystem or call a loader from this helper.

- [ ] **Step 3: Implement the minimal conversion**

Return the shard wrappers expected by `buildCodeCityModel`. Copy file/unit/dependency records in collection order for now; the common builder owns canonical sorting and diagnostics. Partition hotspots into `fileHotspots`, `unitHotspots`, and `componentHotspots`, preserving unknown kinds in the component bucket only when the record is explicitly a component; otherwise omit the optional group rather than inventing a kind. Pass `impact` through unchanged when present.

- [ ] **Step 4: Run the focused tests**

Run the same Bun test command. Expected: PASS, including an optional-shard case where `filesTest`, `units`, `dependencies`, `hotspots`, and `impact` are empty/undefined but `filesMain` remains valid.

- [ ] **Step 5: Verification checkpoint**

Run:

```bash
bun test apps/site/src/lib/__tests__/codeCitySnapshot.test.ts
bun run --cwd apps/site typecheck
```

Expected: PASS. After explicit commit approval, use `feat: adapt canonical collections for code city`.

## Task 3: Build the deterministic parcel/building/route scene adapter

**Files:**
- Create: `packages/report-ui/src/code-city/sceneAdapter.ts`
- Create: `packages/report-ui/src/code-city/__tests__/sceneAdapter.test.ts`

**Interfaces:**
- Consumes: `CodeCityModel` and `CodeCityScene` types from Task 1.
- Produces: `buildCodeCityScene(model: CodeCityModel): CodeCityScene`.

- [ ] **Step 1: Write deterministic layout tests**

Use the existing common Code City fixture shape and assert:

```ts
test("builds stable district and building positions", () => {
	const first = buildCodeCityScene(modelFixture());
	const permuted = buildCodeCityScene(permutedModelFixture());

	expect(first).toEqual(permuted);
	expect(first.nodes.filter((node) => node.kind === "district")).toHaveLength(2);
	expect(first.nodes.filter((node) => node.kind === "building")).toHaveLength(3);
	expect(first.bounds.width).toBeGreaterThan(0);
	expect(first.bounds.depth).toBeGreaterThan(0);
});
```

Add assertions that a multi-affiliated building appears exactly once, every building has a valid primary district, and unresolved edges remain in the scene record with deterministic endpoint IDs.

Run:

```bash
bun test packages/report-ui/src/code-city/__tests__/sceneAdapter.test.ts
```

Expected: FAIL because the adapter is not implemented.

- [ ] **Step 2: Implement deterministic district placement**

Sort districts by `model.layout.districtOrder`. Derive a balanced column count from the district count, place parcels row-first, and use the district building count plus bounded padding for parcel capacity. Use `model.layout.seed` only to break deterministic ties; never use array insertion order, wall-clock time, or random values.

- [ ] **Step 3: Implement bounded LOC building mass**

Sort buildings by `model.layout.buildingOrder`, place each building row-first in its `primaryDistrictId`, and calculate a positive minimum height with a bounded/logarithmic transform of `building.metrics.footprint.loc`. Keep width/depth bounded by the parcel cell so an outlier cannot push other districts off-screen. Preserve the building ID and district key in each scene node.

- [ ] **Step 4: Implement incident dependency routes**

After node positions exist, resolve each model edge's `sourceDistrictId` and `targetDistrictId`. Create a three-point raised strip path through the midpoint between parcels for resolved endpoints. Retain unresolved edges in a deterministic scene-edge record with `renderable: false` and an empty `points` array; the renderer suppresses those records while the inspector/coverage surfaces retain the source evidence. Do not synthesise file-level edges.

- [ ] **Step 5: Run the focused adapter tests**

Run:

```bash
bun test packages/report-ui/src/code-city/__tests__/sceneAdapter.test.ts
bun run --cwd packages/report-ui typecheck
```

Expected: PASS with stable output under every fixture permutation.

- [ ] **Step 6: Verification checkpoint**

Record the JSON serialisability check with `expect(JSON.parse(JSON.stringify(scene))).toEqual(scene)`. After explicit commit approval, use `feat: add deterministic code city scene adapter`.

## Task 4: Implement lenses, evidence links, and selection paths as pure logic

**Files:**
- Create: `packages/report-ui/src/code-city/lens.ts`
- Create: `packages/report-ui/src/code-city/selection.ts`
- Create: `packages/report-ui/src/code-city/evidence.ts`
- Create: `packages/report-ui/src/code-city/__tests__/lens.test.ts`
- Create: `packages/report-ui/src/code-city/__tests__/selection.test.ts`
- Create: `packages/report-ui/src/code-city/__tests__/evidence.test.ts`

**Interfaces:**
- Consumes: `CodeCityModel`, `CodeCitySignals`, `CodeCityEvidenceRef`, and `CodeCityScene`.
- Produces: `CodeCityLensId`, `resolveCodeCityLens`, `resolveCodeCitySelection`, and `resolveCodeCityEvidenceHref`.

- [ ] **Step 1: Define the semantic lens types**

Use the model legend IDs rather than a second string vocabulary:

```ts
export type CodeCityLensId =
	| "footprint"
	| "complexity"
	| "health"
	| "change_pressure"
	| "ownership"
	| "impact";

export type CodeCityLensVisual = {
	readonly lens: CodeCityLensId;
	readonly available: boolean;
	readonly fill: string;
	readonly accent: string;
	readonly label: string;
	readonly unavailableReason: string | null;
};
```

`resolveCodeCityLens(entity, lens)` must return a neutral palette and a non-null reason when the requested signal is absent. It must not convert `null` to `0`.

- [ ] **Step 2: Write lens tests**

Cover the default Health state, missing health, severity mapping, impact score, zero-contributor ownership, and stable output for all six lens IDs. Assert that changing a lens changes visual values only and never a scene node position.

- [ ] **Step 3: Define selection resolution**

Use this exact selection shape:

```ts
export type CodeCitySelection =
	| { readonly kind: "district" | "building"; readonly id: string }
	| null;

export type CodeCitySelectionResult = {
	readonly selection: CodeCitySelection;
	readonly districtIds: readonly string[];
	readonly incidentEdgeIds: readonly string[];
	readonly evidence: readonly CodeCityEvidenceRef[];
};

export function resolveCodeCitySelection(
	model: CodeCityModel,
	selection: CodeCitySelection,
): CodeCitySelectionResult;
```

Selecting a building includes every represented district ID, selects no unrelated edge, and preserves evidence refs in deterministic order. Selecting `null` returns empty IDs/evidence.

- [ ] **Step 4: Define relative evidence-link resolution**

Implement:

```ts
export function resolveCodeCityEvidenceHref(
	basePath: string,
	route: string | null,
): string | null;
```

Normalise a base such as `/planetnik/` and a relative model route such as `/files/size#file-id` without introducing an origin, double slash, or `..` traversal. Return `null` for a missing route.

- [ ] **Step 5: Run pure logic tests**

Run:

```bash
bun test packages/report-ui/src/code-city/__tests__/lens.test.ts
bun test packages/report-ui/src/code-city/__tests__/selection.test.ts
bun test packages/report-ui/src/code-city/__tests__/evidence.test.ts
```

Expected: PASS with no DOM or WebGL dependency.

- [ ] **Step 6: Verification checkpoint**

Run `bun run --cwd packages/report-ui typecheck`. After explicit commit approval, use `feat: add code city lenses and evidence selection`.

## Task 5: Add the lazy Three.js renderer and constrained camera

**Files:**
- Create: `packages/report-ui/src/code-city/threeRenderer.ts`
- Create: `packages/report-ui/src/code-city/CodeCityCanvas.tsx`
- Create: `packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts`

**Interfaces:**
- Consumes: `CodeCityScene`, `CodeCityLensVisual`, and selected entity IDs from Tasks 3–4.
- Produces: a canvas host that emits `onSelect(id)`, `onFocusComplete()`, and `onRendererUnavailable(reason)` without exposing Three.js objects to the React view.

- [ ] **Step 1: Write renderer capability tests**

Test a pure helper:

```ts
export type CodeCityRendererStatus = "pending" | "ready" | "unavailable";

export function canCreateWebGLRenderer(
	context: WebGLRenderingContext | null,
): boolean;
```

Assert that a null context returns false and a minimal mock context returns true. Add a test that the configured camera limits are constrained rather than a free perspective camera.

- [ ] **Step 2: Implement the renderer lifecycle**

In `threeRenderer.ts`, create a disposable scene controller that accepts `HTMLCanvasElement`, `CodeCityScene`, lens visuals, and a selected ID. Use `WebGLRenderer`, `OrthographicCamera`, ambient/directional lights, parcel/building box geometry, and restrained raised route strips. Import `OrbitControls` from `three/examples/jsm/controls/OrbitControls.js`.

Set the default camera to an isometric position and constrain the controls with `enablePan`, `enableZoom`, `minPolarAngle`, `maxPolarAngle`, `minAzimuthAngle`, and `maxAzimuthAngle`. Keep perspective mode and unrestricted flight out of the first slice.

- [ ] **Step 3: Implement selection and explicit Focus**

Use a raycaster for pointer selection. Emit only the stable entity ID. Keep selection from changing the camera. Expose `focusEntity(id)` as an explicit command that updates the camera target and preserves the prior camera state for clear-selection restoration.

- [ ] **Step 4: Implement resource and resize cleanup**

Use `ResizeObserver` for the canvas, render on initialisation and control changes, and dispose geometries, materials, renderer, observer, and controls on unmount. On WebGL context or renderer initialisation failure, invoke `onRendererUnavailable` instead of throwing through React.

- [ ] **Step 5: Add the React canvas host**

`CodeCityCanvas.tsx` must lazy-load the renderer inside `useEffect`, render a labelled `<canvas>`, and keep the initial render SSR-safe. The host owns no model transformation; it receives the scene record and emits stable callbacks.

- [ ] **Step 6: Run renderer checks**

Run:

```bash
bun test packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts
bun run --cwd packages/report-ui typecheck
```

Expected: PASS. Direct WebGL visual evidence is deferred to the route smoke task; unit tests do not claim a GPU success.

- [ ] **Step 7: Verification checkpoint**

After explicit commit approval, use `feat: add lazy three code city renderer`.

## Task 6: Build the React view, inspector, lenses, and fallback

**Files:**
- Create: `packages/report-ui/src/code-city/viewModel.ts`
- Create: `packages/report-ui/src/code-city/CodeCityView.tsx`
- Create: `packages/report-ui/src/code-city/CodeCityInspector.tsx`
- Create: `packages/report-ui/src/code-city/CodeCityFallback.tsx`
- Create: `packages/report-ui/src/code-city/CodeCityView.css`
- Create: `packages/report-ui/src/code-city/__tests__/viewModel.test.ts`

**Interfaces:**
- Consumes: `CodeCityModel`, `CodeCityScene`, lens/selection/evidence helpers, and canvas callbacks.
- Produces: `CodeCityView` with props `{ model: CodeCityModel; evidenceBasePath: string }` and accessible inspector/fallback output.

- [ ] **Step 1: Define testable view models**

Create pure functions with exact signatures:

```ts
export type CodeCityInspectorModel = {
	readonly title: string;
	readonly path: string | null;
	readonly districtLabel: string | null;
	readonly sourceSets: readonly string[];
	readonly metrics: ReadonlyArray<{ readonly label: string; readonly value: string }>;
	readonly evidence: readonly { readonly label: string; readonly href: string }[];
};

export function buildCodeCityInspectorModel(
	model: CodeCityModel,
	selection: CodeCitySelection,
	basePath: string,
): CodeCityInspectorModel | null;

export function buildCodeCityFallbackRows(
	model: CodeCityModel,
	basePath: string,
): ReadonlyArray<{
	readonly id: string;
	readonly district: string;
	readonly path: string;
	readonly loc: string;
	readonly health: string;
	readonly impact: string;
	readonly href: string | null;
	}>;
```

- [ ] **Step 2: Write view-model tests**

Assert that a selected building produces LOC, health, ownership, impact, source-set, district, and evidence-link rows; an unselected state returns `null`; missing values render `Unavailable`; and fallback rows remain sorted by the model's building order.

- [ ] **Step 3: Implement the lens control bar and legend**

Render real buttons for Footprint, Health, Impact, Change, Ownership, and Complexity. Default state is `health`. Add `aria-pressed`, a visible active label, and a legend explaining each channel's unit/source from `model.legend`.

- [ ] **Step 4: Implement the inspector**

Render a labelled complementary panel. Show selected entity identity, path, district, source set, LOC, health, ownership, impact, change/complexity values, coverage state, and only non-null evidence links. Render **Focus** and **Clear selection** buttons. Focus must call the canvas command; selecting must not.

- [ ] **Step 5: Implement the fallback table/list**

Render a semantic table with district, file path, LOC, health, impact, and evidence link columns. Give every row a keyboard-focusable evidence/action link. Use the fallback when WebGL is unavailable or when the view explicitly enters dense-data mode. Keep it visible in print styles and when reduced motion is requested.

- [ ] **Step 6: Implement `CodeCityView` orchestration**

Compose the scene adapter, canvas, controls, inspector, and fallback. Keep model/layout immutable. On renderer failure, show the fallback with a plain-language status. Use `useMemo` for scene and selection results, but do not put Three.js objects in React state.

- [ ] **Step 7: Add responsive and theme-aware styles**

Use existing report tokens (`--color-card`, `--color-border`, `--color-text`, and related variables). Keep the map/inspector two-column at desktop widths, stack them on narrow screens, make controls keyboard-visible, and disable non-essential camera easing/pulses for `prefers-reduced-motion`.

- [ ] **Step 8: Run view-model tests and typecheck**

Run:

```bash
bun test packages/report-ui/src/code-city/__tests__/viewModel.test.ts
bun run --cwd packages/report-ui typecheck
```

Expected: PASS. After explicit commit approval, use `feat: add code city inspector and fallback view`.

## Task 7: Add the static `/code-city` route and navigation

**Files:**
- Create: `apps/site/src/pages/code-city.astro`
- Modify: `apps/site/src/layouts/Dashboard.astro`
- Modify: `apps/site/src/lib/reloadRoutes.ts`
- Modify: `apps/site/src/lib/__tests__/reloadRoutes.test.ts`

**Interfaces:**
- Consumes: `getEntry/getCollection` canonical content entries and `toCodeCitySnapshotInput`.
- Produces: a static Astro page that passes `CodeCityModel` and `route("/")` to `CodeCityView`.

- [ ] **Step 1: Add the route bypass test**

Extend `reloadRoutes.test.ts`:

```ts
test("bypasses the client router for the WebGL Code City route", () => {
	expect(shouldBypassClientRouter("/code-city")).toBe(true);
	expect(shouldBypassClientRouter("/code-city?lens=health")).toBe(true);
});
```

Run the focused test and expect it to fail before adding the matcher.

- [ ] **Step 2: Assemble the model in the Astro route**

Load `reportContext`, `filesMain`, `filesTest`, `units`, `dependencies`, `hotspots`, and `impact` collections. Pass their `.data` values to `toCodeCitySnapshotInput`, call `buildCodeCityModel`, and catch `CodeCityInputError` for a report error state. Do not call `resolveDataDir`, `readFileSync`, or any TXT/HTML reader from the page.

The route must render an explicit unsupported state for `reportMode: "landscape"` and a typed invalid-data state for non-v2 input. For valid single-repository input, render:

```astro
<Dashboard title="Code City" projectName={projectName}>
  <CodeCityView
    client:load
    model={model}
    evidenceBasePath={route("/")}
  />
</Dashboard>
```

Use `client:load`, not `client:only`, so the semantic controls/fallback can be server-rendered before the lazy WebGL module starts.

- [ ] **Step 3: Add navigation**

Add `{ href: route("/code-city"), label: "Code City" }` to the single-repository Structure section in `Dashboard.astro`, using the existing `stack` icon rather than introducing a new icon dependency.

- [ ] **Step 4: Add the reload matcher**

Add `route("/code-city")` to `reloadRouteMatchers`. Keep existing topology and temporal matchers unchanged.

- [ ] **Step 5: Run route checks**

Run:

```bash
bun test apps/site/src/lib/__tests__/reloadRoutes.test.ts
bun run --cwd apps/site typecheck
```

Expected: PASS. After explicit commit approval, use `feat: add static code city route`.

## Task 8: Add route-state, accessibility, dense-data, and build verification

**Files:**
- Modify: `packages/report-ui/src/code-city/CodeCityView.tsx`
- Modify: `packages/report-ui/src/code-city/CodeCityFallback.tsx`
- Modify: `packages/report-ui/src/code-city/CodeCityView.css`
- Modify: `apps/site/src/pages/code-city.astro`
- Create: `packages/report-ui/src/code-city/__tests__/routeState.test.ts`

**Interfaces:**
- Consumes: the valid/partial/invalid model states and renderer status from Tasks 2, 5, and 7.
- Produces: explicit user-visible states with no console-only diagnostics and a documented dense-data transition.

- [ ] **Step 1: Write route-state tests**

Test a pure `resolveCodeCityRouteState` function with exact result tags:

```ts
export type CodeCityRouteState =
	| { readonly tag: "ready"; readonly model: CodeCityModel }
	| { readonly tag: "partial"; readonly model: CodeCityModel }
	| { readonly tag: "unsupported-landscape"; readonly title: string }
	| { readonly tag: "invalid"; readonly message: string }
	| { readonly tag: "empty"; readonly model: CodeCityModel };
```

Assert that optional shard gaps produce `partial`, invalid required input produces `invalid`, and a valid model with no buildings produces `empty`.

- [ ] **Step 2: Implement explicit route states**

Render the snapshot title, missing shard names, diagnostic count, and a useful next action. Never render a blank canvas for invalid input. Keep evidence links available in the partial and fallback states.

- [ ] **Step 3: Add dense-data behaviour**

Use the measured scene node/edge count and renderer initialisation status to switch to the table/list fallback with a visible explanation. Preserve all model rows in the fallback and expose the selected district/building as a filter rather than deleting records.

- [ ] **Step 4: Exercise keyboard and print behaviour**

Verify tab order reaches lens buttons, map status, inspector actions, and evidence links. Add print CSS that hides the GPU canvas and prints the fallback table. Confirm `prefers-reduced-motion` disables camera easing.

- [ ] **Step 5: Run focused checks**

Run:

```bash
bun test packages/report-ui/src/code-city/__tests__/routeState.test.ts
bun run --cwd packages/report-ui typecheck
bun run --cwd apps/site typecheck
```

Expected: PASS. After explicit commit approval, use `feat: harden code city fallback states`.

## Task 9: Prove the static route, WebGL interaction, and LOD directly

**Files:**
- Modify: `docs/product-roadmap.md` only after all evidence below is captured.
- Create: `docs/adr/0019-adopt-code-city-webgl-decision-surface.md` only after the adoption decision is supported by evidence.

**Interfaces:**
- Consumes: the completed route, fixture model, and verification commands from Tasks 1–8.
- Produces: direct browser/runtime evidence and updated roadmap/ADR status; no new product contract.

- [ ] **Step 1: Run focused and full automated gates**

Run:

```bash
bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts
bun test packages/report-ui/src/code-city/__tests__
bun test apps/site/src/lib/__tests__/codeCitySnapshot.test.ts
bun test apps/site/src/lib/__tests__/reloadRoutes.test.ts
bun run --cwd packages/report-ui typecheck
bun run --cwd apps/site typecheck
bun run build
```

Expected: all focused suites and the site build pass. Root-wide typecheck remains a separate gate; if it reports the known pre-existing `apps/app/astro.config.mjs` `cache` option error, record that boundary rather than attributing it to Code City.

- [ ] **Step 2: Start a fresh site server with a visible fixture dataset**

Use the repo-root `datasets/` setup described in `AGENTS.md`, restart the site after changing `apps/site/.env`, and open `/code-city` with a hard reload. Do not use an old `/tmp` dataset for acceptance evidence.

- [ ] **Step 3: Capture browser interaction evidence**

Verify directly that:

1. the initial scene is orthographic/isometric;
2. shallow orbit, pan, and zoom work within limits;
3. selecting a district/building leaves the camera fixed;
4. **Focus** reframes only when clicked;
5. lenses change materials/accents but not coordinates;
6. selection-path routes appear and unrelated routes remain subdued;
7. the inspector shows LOC/health/ownership/impact and links to existing pages;
8. clearing selection restores the prior camera state;
9. a hard reload and a route navigation do not leave a broken WebGL island.

- [ ] **Step 4: Capture fallback and dense-data evidence**

Disable WebGL or force renderer initialisation failure, verify the table/list fallback, inspect keyboard navigation, print preview, reduced motion, and an optional-shard partial model. Use a representative dense dataset to verify documented LOD/fallback behaviour and that no records disappear from the table.

- [ ] **Step 5: Record bundle and interaction measurements**

Record the built Code City chunk size, first usable interaction timing, and repeated-layout equality for the same snapshot. Keep the measurements with the implementation handoff; do not add a marketing claim without a measured artifact.

- [ ] **Step 6: Update roadmap and adoption ADR**

After the direct evidence passes, update Phase 1.5 in `docs/product-roadmap.md` from feasibility-only to the verified UI status, preserving the remaining landscape/hosted follow-ons. Create ADR-0019 with the decision to adopt or narrow the WebGL decision surface, its evidence boundary, and the explicit fallback/no-native-renderer constraints.

- [ ] **Step 7: Final verification checkpoint**

Run `git diff --check` and inspect the final changed-file list. After explicit commit approval, use `feat: ship repo-scoped code city ui`.

## Plan self-review

### Spec coverage

- Route/shell and single-repository scope: Tasks 2 and 7.
- Canonical JSON boundary and missing-data diagnostics: Tasks 2 and 8.
- Context parcels, deterministic geometry, LOC mass, and dependency routes: Task 3.
- Health/Impact/Change/Ownership/Complexity/Footprint lenses: Task 4 and Task 6.
- Inspector-first selection, camera preservation, and explicit Focus: Tasks 5 and 6.
- Plain Three.js and constrained orthographic camera: Task 5.
- Table/list, no-WebGL, accessibility, print, reduced motion, and dense data: Tasks 6 and 8.
- Shared static/hosted package boundary: Task 1 and Task 5.
- Automated checks, direct browser evidence, bundle/latency/layout measurements: Task 9.
- Native renderer, runtime parsing, landscape-first route, and new shards remain out of scope in every task.

### Placeholder scan

No placeholder markers or vague implementation steps remain. Every task names files, interfaces, commands, expected outcomes, and a reviewable checkpoint.

### Type consistency

- `CodeCityScene` and its node/edge types are defined in Task 1 and consumed unchanged by Tasks 3, 5, and 6.
- `CodeCityLensId`, `CodeCitySelection`, and `resolveCodeCityEvidenceHref` are defined in Task 4 and consumed by Tasks 5–8.
- `CodeCitySnapshotCollections` and `toCodeCitySnapshotInput` are defined in Task 2 and consumed by Task 7.
- `CodeCityView` props are fixed as `{ model: CodeCityModel; evidenceBasePath: string }` in Task 6 and used exactly in Task 7.
- Route-state tags are defined in Task 8 and are the only states used by the route/error UI.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-16-code-city-ui.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task with review checkpoints. This requires `superpowers:subagent-driven-development`; use it only if delegation is explicitly approved.
2. **Inline Execution** — execute the tasks in this session with `superpowers:executing-plans` and verification checkpoints.
