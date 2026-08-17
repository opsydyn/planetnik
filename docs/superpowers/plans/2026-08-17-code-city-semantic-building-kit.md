# Code City Semantic Building Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add a deterministic, semantic-first Minecraft-like building kit to the existing single-repository Code City view without changing the canonical JSON boundary or weakening the HTML fallback.

**Architecture:** Extend the renderer-neutral CodeCityScene records with pure visual tokens derived from CodeCityModel. Convert those tokens into reusable voxel-style recipes, then materialise them in a lazy Three.js client renderer using shared procedural materials and instanced primitives. Keep React responsible for lens/selection/fallback state and keep Astro loaders unaware of renderer details.

**Tech Stack:** Bun, TypeScript, React 19, Astro, Three.js 0.185.x, bun:test, existing @planetnik/common CodeCityModel and packages/report-ui Code City island.

## Global Constraints

- Canonical v2 JSON remains the only product input; do not add TXT, HTML, runtime source parsing, or a new exporter shard.
- Stable geometry and visual tokens remain unchanged when the active lens changes.
- Dependency landmarks use only canonical district/component dependency edges; do not invent file-level topology.
- Three.js remains lazy-loaded and client-only; do not introduce React Three Fiber or a native renderer.
- The complete table/list fallback remains authoritative for WebGL failure, dense data, keyboard use, print, and unavailable signals.
- Every visible distinction maps to a canonical field or a documented deterministic derived value.
- Textures use a shared procedural/generated atlas; do not add downloaded texture packs or one texture per file.
- Repeated primitives are instanced or shared; do not allocate unique complex geometry per building.
- Seeded ordering and tie-breaks remain deterministic for the same model and layout seed.
- Preserve the existing single-repository /code-city route and static/hosted boundary.
- Use Bun-native commands and update package barrels for every public module.
- Preserve unrelated dirty snapshot/roadmap modernization changes in the working tree.
- Do not mark ADR-0019 accepted until the direct browser interaction/performance matrix is green.

---

## File and boundary map

- packages/report-ui/src/code-city/visualTokens.ts — pure extension, source-set, percentile, and hub-tier mapping.
- packages/report-ui/src/code-city/sceneTypes.ts — serialisable scene-node visual token types.
- packages/report-ui/src/code-city/sceneAdapter.ts — derive visual tokens without changing coordinates or routes.
- packages/report-ui/src/code-city/materials.ts — pure material-family/pattern specs and lens surface-treatment mapping.
- packages/report-ui/src/code-city/textureAtlas.ts — browser-only shared procedural texture atlas lifecycle.
- packages/report-ui/src/code-city/kitRecipe.ts — pure voxel primitive recipes and detail-level selection.
- packages/report-ui/src/code-city/threeKit.ts — Three.js materialisation and instanced primitive ownership.
- packages/report-ui/src/code-city/threeRenderer.ts — renderer orchestration, camera, picking, selection, routes, and kit updates.
- packages/report-ui/src/code-city/lens.ts, viewModel.ts, CodeCityInspector.tsx, and CodeCityFallback.tsx — lens and HTML explanation parity.
- packages/report-ui/src/code-city/CodeCityView.css — semantic legend and fallback styling.
- packages/report-ui/src/code-city/index.ts and packages/report-ui/src/index.ts — public exports.
- packages/report-ui/src/code-city/__tests__/visualTokens.test.ts — pure visual token contract.
- packages/report-ui/src/code-city/__tests__/materials.test.ts — pure material/pattern contract.
- packages/report-ui/src/code-city/__tests__/kitRecipe.test.ts — pure primitives and LOD contract.
- Existing Code City tests remain the regression suite.
- .superpowers/sdd/2026-08-16-code-city-ui/ remains an ignored fixture/evidence workspace.
- docs/adr/0019-adopt-code-city-webgl-decision-surface.md changes only after direct evidence is complete.

---

### Task 1: Add the pure visual-token contract

**Files:**
- Create: packages/report-ui/src/code-city/visualTokens.ts
- Modify: packages/report-ui/src/code-city/sceneTypes.ts
- Modify: packages/report-ui/src/code-city/sceneAdapter.ts
- Modify: packages/report-ui/src/code-city/index.ts
- Modify: packages/report-ui/src/index.ts
- Create: packages/report-ui/src/code-city/__tests__/visualTokens.test.ts
- Modify: packages/report-ui/src/code-city/__tests__/sceneAdapter.test.ts
- Modify: packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts (manual scene fixtures need the new visual field)

**Interfaces:**
- Consumes: CodeCityModel, CodeCityBuilding, CodeCityDistrict, CodeCityDependencyEdge, and CodeCityLayoutHints.
- Produces: serialisable CodeCitySceneNode.visual values consumed by Tasks 2–4.

Define these exported types in visualTokens.ts:

    export type CodeCityMaterialFamily =
      | "brick" | "ironstone" | "glazed_tile" | "plaster" | "paperwood" | "slate"
    export type CodeCityParcelStyle = "civic" | "derived"
    export type CodeCityBuildingArchetype = "block" | "tower" | "stepped" | "annex"
    export type CodeCityRoofStyle = "flat" | "pitched" | "stepped" | "capped"
    export type CodeCityLandmarkTier = "none" | "connected" | "hub" | "super_hub"
    export type CodeCityTexturePattern = "solid" | "banded" | "checker" | "gridded"

    export type CodeCityVisualContext = {
      readonly districtIncidentWeights: ReadonlyMap<string, number>
      readonly districtRanks: ReadonlyMap<string, number>
      readonly locHighCutoff: number
      readonly unitHighCutoff: number
    }

    export type CodeCityDistrictVisual = {
      readonly kind: "district"
      readonly parcelStyle: CodeCityParcelStyle
      readonly landmarkTier: CodeCityLandmarkTier
      readonly texturePattern: CodeCityTexturePattern
    }

    export type CodeCityBuildingVisual = {
      readonly kind: "building"
      readonly materialFamily: CodeCityMaterialFamily
      readonly archetype: CodeCityBuildingArchetype
      readonly roofStyle: CodeCityRoofStyle
      readonly texturePattern: CodeCityTexturePattern
      readonly floorCount: number
      readonly facadeSegments: number
      readonly multiDistrict: boolean
    }

    export type CodeCitySceneNodeVisual = CodeCityDistrictVisual | CodeCityBuildingVisual

Add readonly visual: CodeCitySceneNodeVisual to CodeCitySceneNode. Keep these fields in packages/report-ui; do not add them to packages/common or canonical JSON schemas.

Implement pure functions:

    export function resolveCodeCityMaterialFamily(extension: string): CodeCityMaterialFamily
    export function buildCodeCityVisualContext(model: CodeCityModel): CodeCityVisualContext
    export function resolveCodeCityDistrictVisual(
      district: CodeCityDistrict,
      context: CodeCityVisualContext,
    ): CodeCityDistrictVisual
    export function resolveCodeCityBuildingVisual(
      building: CodeCityBuilding,
      context: CodeCityVisualContext,
    ): CodeCityBuildingVisual

The context calculates renderable incident edge weight per district, stable
district ranking, LOC and unit-count 75th-percentile cutoffs, and bounded floor
and façade counts. Use these exact initial rules:

- ts, tsx, js, jsx → brick; rs → ironstone; json, yaml, yml, toml → glazed_tile; css, scss, html → plaster; md, mdx, txt → paperwood; everything else → slate.
- tower + capped for LOC at or above the 75th percentile.
- stepped + stepped for lower-LOC files at or above the 75th-percentile unit count.
- annex + pitched when neither high bucket applies and a source set contains test.
- block + flat otherwise.
- checker texture for test files, banded for non-test files with at least one unit, and solid otherwise.
- multiDistrict when building.districtIds.length > 1.
- no positive incident weight → none; the highest-ranked positive district → super_hub; the next positive districts up to five total major landmarks → hub; remaining positive districts → connected.
- component districts → civic; derived/path districts → derived.
- component districts → civic + gridded parcel texture; derived/path districts → derived + solid parcel texture.

- [ ] Step 1: Write failing token tests.

Cover extension families, test files, multi-district files, weighted and
unresolved edges, percentile boundaries, and permutations of model arrays.
Assert exact visual token objects and stable tie-breaking.

- [ ] Step 2: Run the focused tests to verify RED.

    bun test packages/report-ui/src/code-city/__tests__/visualTokens.test.ts packages/report-ui/src/code-city/__tests__/sceneAdapter.test.ts

Expected: FAIL because the visual token module and scene-node field do not
exist.

- [ ] Step 3: Implement token functions and adapter wiring.

Keep ranking helpers private to visualTokens.ts, call
buildCodeCityVisualContext once per buildCodeCityScene invocation, and add
visual tokens without changing existing node coordinates, sizes, parents, or
route points. Update manually constructed CodeCityScene fixtures in
threeRenderer.test.ts with explicit visual tokens so the scene contract stays
serialisable and required rather than optional.

- [ ] Step 4: Run focused tests and typecheck.

    bun test packages/report-ui/src/code-city/__tests__/visualTokens.test.ts packages/report-ui/src/code-city/__tests__/sceneAdapter.test.ts
    bun run --cwd packages/report-ui typecheck

Expected: all focused tests pass and typecheck exits 0.

- [ ] Step 5: Commit.

    git add packages/report-ui/src/code-city/visualTokens.ts packages/report-ui/src/code-city/sceneTypes.ts packages/report-ui/src/code-city/sceneAdapter.ts packages/report-ui/src/code-city/index.ts packages/report-ui/src/index.ts packages/report-ui/src/code-city/__tests__/visualTokens.test.ts packages/report-ui/src/code-city/__tests__/sceneAdapter.test.ts
    git commit -m "feat: add semantic code city visual tokens"

### Task 2: Add procedural material specifications and a shared texture atlas

**Files:**
- Create: packages/report-ui/src/code-city/materials.ts
- Create: packages/report-ui/src/code-city/textureAtlas.ts
- Modify: packages/report-ui/src/code-city/index.ts
- Modify: packages/report-ui/src/index.ts
- Create: packages/report-ui/src/code-city/__tests__/materials.test.ts

**Interfaces:**
- Consumes: CodeCityMaterialFamily, CodeCityTexturePattern, and CodeCityLensVisual.
- Produces: pure material specs and a disposable browser atlas for Task 4.

Define:

    export type CodeCitySurfaceTreatment =
      | "neutral" | "wear" | "impact" | "scaffold"
      | "banner" | "machinery" | "unavailable"

    export type CodeCityMaterialSpec = {
      readonly family: CodeCityMaterialFamily
      readonly pattern: CodeCityTexturePattern
      readonly baseColor: string
      readonly accentColor: string
      readonly roughness: number
      readonly metalness: number
    }

    export function resolveCodeCityMaterialSpec(
      family: CodeCityMaterialFamily,
      pattern: CodeCityTexturePattern,
    ): CodeCityMaterialSpec

    export function resolveCodeCitySurfaceTreatment(
      lens: CodeCityLensVisual,
    ): CodeCitySurfaceTreatment

Define the browser-only atlas boundary:

    export type CodeCityTextureAtlas = {
      readonly get: (pattern: CodeCityTexturePattern) => CanvasTexture
      readonly dispose: () => void
    }

    export function createCodeCityTextureAtlas(
      documentRef: Document,
    ): CodeCityTextureAtlas | null

The atlas creates one generated texture per pattern, sets SRGBColorSpace, and
disposes every texture once. It returns null when no canvas context is available
so flat materials can still render.

- [ ] Step 1: Write failing pure material tests.

Assert each material family and pattern has a stable contrast-safe spec, each
lens resolves to one surface treatment, and lens changes never alter family or
pattern.

- [ ] Step 2: Run the material tests to verify RED.

    bun test packages/report-ui/src/code-city/__tests__/materials.test.ts

Expected: FAIL because the material modules do not exist.

- [ ] Step 3: Implement pure specs and the browser atlas.

Keep colour/roughness/metalness in materials.ts, DOM/canvas creation in
textureAtlas.ts, and use deterministic block patterns with no external asset
URLs.

- [ ] Step 4: Verify material and existing renderer contracts.

    bun test packages/report-ui/src/code-city/__tests__/materials.test.ts packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts
    bun run --cwd packages/report-ui typecheck

Expected: all tests pass and typecheck exits 0.

- [ ] Step 5: Commit.

    git add packages/report-ui/src/code-city/materials.ts packages/report-ui/src/code-city/textureAtlas.ts packages/report-ui/src/code-city/index.ts packages/report-ui/src/index.ts packages/report-ui/src/code-city/__tests__/materials.test.ts
    git commit -m "feat: add procedural code city materials"

### Task 3: Add pure voxel kit recipes and detail levels

**Files:**
- Create: packages/report-ui/src/code-city/kitRecipe.ts
- Modify: packages/report-ui/src/code-city/index.ts
- Modify: packages/report-ui/src/index.ts
- Create: packages/report-ui/src/code-city/__tests__/kitRecipe.test.ts

**Interfaces:**
- Consumes: CodeCitySceneNode visual tokens and CodeCitySurfaceTreatment.
- Produces: serialisable primitive recipes consumed by Task 4.

Define:

    export type CodeCityDetailLevel = "overview" | "district" | "building" | "dense"

    export type CodeCityKitPrimitive =
      | { readonly kind: "base"; readonly width: number; readonly depth: number; readonly height: number }
      | { readonly kind: "roof"; readonly style: CodeCityRoofStyle }
      | { readonly kind: "floor_band"; readonly index: number }
  | { readonly kind: "window_row"; readonly index: number; readonly segments: number }
  | { readonly kind: "cupola"; readonly tier: "connected" }
  | { readonly kind: "dome"; readonly tier: CodeCityLandmarkTier }
      | { readonly kind: "tower"; readonly tier: CodeCityLandmarkTier }
      | { readonly kind: "bridge"; readonly direction: "north" | "east" | "south" | "west" }
      | { readonly kind: "buttress"; readonly side: "north" | "east" | "south" | "west" }
      | { readonly kind: "beacon"; readonly treatment: CodeCitySurfaceTreatment }

    export type CodeCityKitRecipe = {
      readonly nodeId: string
      readonly detail: CodeCityDetailLevel
      readonly primitives: readonly CodeCityKitPrimitive[]
    }

    export function resolveCodeCityDetailLevel(
      node: CodeCitySceneNode,
      selectedId: string | null,
      selectedDistrictIds: readonly string[],
      denseDataMode: boolean,
    ): CodeCityDetailLevel

    export function buildCodeCityKitRecipe(
      node: CodeCitySceneNode,
      detail: CodeCityDetailLevel,
      surfaceTreatment: CodeCitySurfaceTreatment,
    ): CodeCityKitRecipe

Recipe rules:

- every node always has one base primitive;
- overview includes roof and district landmarks but no window rows;
- district detail adds bands/windows for buildings in the selected district;
- building detail adds the selected building’s bands, windows, buttresses, and treatment beacon;
- dense detail keeps base/roof and only the largest landmarks;
- hub/super_hub produce dome/tower primitives, connected produces a cupola primitive, and none produces none;
- route bridges come from existing renderable edge records in Task 4, not fabricated by this recipe;
- recipes never change node coordinates or sizes.

- [ ] Step 1: Write failing recipe tests.

Cover every archetype, landmark tier, detail level, unavailable treatment, and
JSON serialisability. Assert stable primitive ordering: base, roof, bands,
windows, landmarks, supports, beacon.

- [ ] Step 2: Run recipe tests to verify RED.

    bun test packages/report-ui/src/code-city/__tests__/kitRecipe.test.ts

Expected: FAIL because the recipe module does not exist.

- [ ] Step 3: Implement pure detail and recipe functions.

Use only scene dimensions and visual tokens; do not import Three.js into this
module.

- [ ] Step 4: Verify recipes and the existing scene adapter.

    bun test packages/report-ui/src/code-city/__tests__/kitRecipe.test.ts packages/report-ui/src/code-city/__tests__/sceneAdapter.test.ts
    bun run --cwd packages/report-ui typecheck

Expected: all tests pass and typecheck exits 0.

- [ ] Step 5: Commit.

    git add packages/report-ui/src/code-city/kitRecipe.ts packages/report-ui/src/code-city/index.ts packages/report-ui/src/index.ts packages/report-ui/src/code-city/__tests__/kitRecipe.test.ts
    git commit -m "feat: define code city voxel kit recipes"

### Task 4: Materialise the kit in the lazy Three.js renderer

**Files:**
- Create: packages/report-ui/src/code-city/threeKit.ts
- Modify: packages/report-ui/src/code-city/threeRenderer.ts
- Modify: packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts
- Modify: packages/report-ui/src/code-city/CodeCityCanvas.tsx (pass denseDataMode and preserve the existing lazy lifecycle)
- Modify: packages/report-ui/src/code-city/CodeCityView.tsx (pass denseDataMode to the canvas)

**Interfaces:**
- Consumes: kit recipes, texture atlas, material specs, lens visuals, scene, and selection result.
- Produces: a disposable Three.js kit while preserving the existing renderer controller: setLensVisuals, setSelectionResult, focusEntity, dispose.

Define this renderer-local boundary. The denseDataMode input is passed from
CodeCityView so the renderer and HTML fallback share the same density decision:

    export type CodeCityKitRenderer = {
      readonly update: (input: {
        readonly scene: CodeCityScene
        readonly selectionResult: CodeCitySelectionResult
        readonly lensVisuals: CodeCityLensVisuals
        readonly detailTargetId: string | null
        readonly denseDataMode: boolean
      }) => void
      readonly group: Group
      readonly dispose: () => void
    }

    export function createCodeCityKitRenderer(
      options: {
        readonly threeScene: ThreeScene
        readonly documentRef: Document | null
      },
    ): CodeCityKitRenderer | null

Materialise shared block/slab/roof geometries, low-poly domes/towers, and
instanced/shared façade modules. The kit owns only objects it creates and uses
one idempotent cleanup path. Keep labels, route strips, raycasting, camera
limits, and selection-path highlighting in threeRenderer.ts.

Update threeRenderer.ts to create the kit after WebGL initialisation, pass the
explicit focus target into kit updates, update materials/recipes on lens and
selection changes without rebuilding coordinates, and retain all existing
status/unavailable paths.

- [ ] Step 1: Write failing renderer-contract tests.

Assert visual tokens exist on every node, detail resolution returns overview
for normal unselected data, building/district for explicit focus, and dense
for dense data. Assert lens changes do not alter node centers, sizes, or
landmark tiers.

- [ ] Step 2: Run focused renderer tests to verify RED.

    bun test packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts packages/report-ui/src/code-city/__tests__/kitRecipe.test.ts

Expected: FAIL because the kit renderer and detail integration do not exist.

- [ ] Step 3: Implement the Three.js kit and renderer integration.

Use shared material buckets and InstancedMesh for repeated modules. Do not add a
second render loop. Make render() and dispose() idempotent.

- [ ] Step 4: Verify renderer, scene, typecheck, and builds.

    bun test packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts packages/report-ui/src/code-city/__tests__/kitRecipe.test.ts packages/report-ui/src/code-city/__tests__/sceneAdapter.test.ts
    bun run --cwd packages/report-ui typecheck
    bun run --cwd packages/report-ui build

Expected: all tests pass, typecheck exits 0, and Three.js remains in a lazy
client chunk rather than server-only modules.

- [ ] Step 5: Commit.

    git add packages/report-ui/src/code-city/threeKit.ts packages/report-ui/src/code-city/threeRenderer.ts packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts packages/report-ui/src/code-city/CodeCityCanvas.tsx packages/report-ui/src/code-city/CodeCityView.tsx
    git commit -m "feat: render semantic code city building kits"

### Task 5: Expose lens treatments and semantic explanations in HTML

**Files:**
- Modify: packages/report-ui/src/code-city/lens.ts
- Modify: packages/report-ui/src/code-city/viewModel.ts
- Modify: packages/report-ui/src/code-city/CodeCityInspector.tsx
- Modify: packages/report-ui/src/code-city/CodeCityFallback.tsx
- Modify: packages/report-ui/src/code-city/CodeCityView.tsx
- Modify: packages/report-ui/src/code-city/CodeCityView.css
- Modify: packages/report-ui/src/code-city/__tests__/components.test.tsx
- Modify: packages/report-ui/src/code-city/__tests__/viewModel.test.ts
- Modify: packages/report-ui/src/code-city/__tests__/lens.test.ts

**Interfaces:**
- Consumes: visual tokens from Task 1 and surface treatments from Task 2.
- Produces: accessible text explanations and fallback parity for WebGL distinctions.

Extend CodeCityLensVisual with:

    readonly surfaceTreatment: CodeCitySurfaceTreatment
    readonly nonColorCue: string

Extend CodeCityInspectorModel with:

    readonly visualFacts: readonly { readonly label: string; readonly value: string }[]

Extend CodeCityFallbackRowModel and the presentational CodeCityFallbackRow with:

    readonly form: string
    readonly landmark: string

For a selected building or district, expose material family, archetype or
parcel style, roof style/landmark tier where relevant, texture pattern, and a
plain-language explanation of the active lens treatment.

Add a Visual encoding inspector section, a structure legend explaining
material/silhouette/scale/lens separation, and compact form/landmark values in
fallback rows. Preserve all row ordering, evidence links, and unavailable text.

- [ ] Step 1: Write failing lens/view/component assertions.

Assert every lens has a treatment and non-colour cue, inspector models include
visual facts for building and district selections, and fallback rows preserve
every entity while exposing form/landmark text.

- [ ] Step 2: Run focused UI tests to verify RED.

    bun test packages/report-ui/src/code-city/__tests__/lens.test.ts packages/report-ui/src/code-city/__tests__/viewModel.test.ts packages/report-ui/src/code-city/__tests__/components.test.tsx

Expected: FAIL because treatment and visual-fact fields are absent.

- [ ] Step 3: Implement lens, view-model, inspector, fallback, and CSS changes.

Pair every colour/texture/shape cue with text. Do not hide evidence routes or
use visual decoration as a substitute for canonical values.

- [ ] Step 4: Run the full Code City suite and typechecks.

    bun test packages/report-ui/src/code-city/__tests__
    bun run --cwd packages/report-ui typecheck
    bun run --cwd apps/site typecheck

Expected: all Code City tests pass; typechecks report zero errors and zero
warnings.

- [ ] Step 5: Commit.

    git add packages/report-ui/src/code-city/lens.ts packages/report-ui/src/code-city/viewModel.ts packages/report-ui/src/code-city/CodeCityInspector.tsx packages/report-ui/src/code-city/CodeCityFallback.tsx packages/report-ui/src/code-city/CodeCityView.tsx packages/report-ui/src/code-city/CodeCityView.css packages/report-ui/src/code-city/__tests__/components.test.tsx packages/report-ui/src/code-city/__tests__/viewModel.test.ts packages/report-ui/src/code-city/__tests__/lens.test.ts
    git commit -m "feat: explain semantic code city visuals"

### Task 6: Prove browser interaction, density, and performance evidence

**Files:**
- Modify: .superpowers/sdd/2026-08-16-code-city-ui/task-9-report.md (ignored evidence workspace only)
- Modify: docs/adr/0019-adopt-code-city-webgl-decision-surface.md only when every required direct check is evidenced
- Modify: docs/product-roadmap.md only with a narrowly staged acceptance update
- Create/update: ignored fixture evidence under .superpowers/sdd/2026-08-16-code-city-ui/

**Interfaces:**
- Consumes: existing complete/partial/dense fixtures, the static route, and Tasks 1–5.
- Produces: direct screenshots/DOM evidence, runtime measurements, and honest documentation; no product runtime code.

Use the existing Task 9 fixture generator and route. Record dataset, URL,
snapshot ID, counts, active lens, and renderer status. Run this matrix
directly in the browser:

1. constrained orbit remains inside polar/azimuth limits;
2. pan and zoom work without changing scene coordinates;
3. selection preserves camera state and opens the inspector;
4. Focus reframes only after explicit activation and clear selection restores the prior camera;
5. each lens changes surface treatment while centers, sizes, archetypes, and landmark tiers remain stable;
6. selected dependency routes brighten while unrelated routes stay subdued;
7. evidence links navigate to existing report pages;
8. hard reload and internal navigation leave a working island;
9. forced WebGL failure shows the complete table;
10. keyboard selection, print, and reduced motion preserve semantic text/fallback;
11. partial fixture shows neutral unavailable treatments and complete rows;
12. dense fixture shows documented detail reduction/table mode with equal row coverage;
13. repeated renders of one fixture have equal scene tokens/arrangement;
14. record lazy chunk size, mesh/instance count, draw calls, and a reproducible first-usable observation without publishing an unsupported budget.

- [ ] Step 1: Add the evidence checklist to the ignored report.

List all matrix items as unverified with the exact fixture and URL before
browsing. Do not mark rows passed from unit tests alone.

- [ ] Step 2: Start the fixture-backed site and capture the baseline.

Use the existing repo-root fixture command, navigate to
http://127.0.0.1:54123/planetnik/code-city, and save a viewport screenshot,
DOM snapshot, and route summary. If sandbox binding fails, record the
environment limitation instead of classifying the route as a product failure.

- [ ] Step 3: Execute interaction and fallback checks.

Use visible DOM/screenshot state for each action, capture before/after camera
and scene-token observations, and stop after a bounded retry if a lower-level
probe hangs. Record every unverified item explicitly.

- [ ] Step 4: Run automated density, build, and bundle checks.

    bun test packages/common/src/code-city/__tests__/CodeCityModel.test.ts packages/report-ui/src/code-city/__tests__ apps/site/src/lib/__tests__/codeCitySnapshot.test.ts apps/site/src/lib/__tests__/reloadRoutes.test.ts
    bun run --cwd packages/report-ui typecheck
    bun run --cwd apps/site typecheck
    bun run --cwd packages/report-ui build
    bun run --cwd apps/site build

Record the lazy Three.js chunk, geometry/instance counts, repeated-layout
comparison, and complete/partial/dense row counts in the evidence report.

- [ ] Step 5: Update ADR and roadmap only when justified.

If every required direct check passes, update ADR-0019 to the exact
evidence-supported status, retain follow-on boundaries, and stage only the
ADR/roadmap hunks. If any interaction remains unverified, keep ADR-0019
provisional and leave Task 9 open.

- [ ] Step 6: Commit only justified documentation.

    git add docs/adr/0019-adopt-code-city-webgl-decision-surface.md docs/product-roadmap.md
    git commit -m "docs: record semantic code city evidence"

Do not stage ignored evidence artifacts or unrelated dirty files. If no
documentation status change is justified, make no commit for this task.

---

## Final verification gate

After the final implementation slice, run:

    bun test
    bun run --cwd packages/report-ui typecheck
    bun run --cwd apps/site typecheck
    bun run --cwd packages/report-ui build
    bun run --cwd apps/site build
    git diff --check

The handoff must separate automated results, direct browser evidence, and
unverified interaction/performance items. A rendered scene alone is not
evidence that the visual asset system or interaction contract is complete.
