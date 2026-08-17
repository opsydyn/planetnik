# Code City Audience Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit Onboarding, Architecture Review, and Stakeholder presentation layer plus an optional evidence-backed story rail to the existing Code City view.

**Architecture:** Keep `CodeCityModel`, scene coordinates, renderer-neutral scene records, lenses, selection, and evidence routes unchanged. Add pure audience, story, URL, and brief view-models under `packages/report-ui/src/code-city`, then wire small React controls into `CodeCityView`; Astro routes pass serialisable initial URL state. The renderer receives only narrow, deterministic emphasis settings and remains a lazy client-only concern.

**Tech Stack:** Bun 1.3.11, TypeScript, React 19, Astro 7, `@planetnik/common`, `@planetnik/report-ui`, Three.js, Bun test, and the existing static fixture/build harness.

## Global Constraints

- Use the existing canonical v2 JSON → `CodeCityModel` boundary; do not add a new exporter or parser.
- Preserve the same city coordinates, entity IDs, building forms, landmark tiers, lenses, and evidence routes in every audience mode.
- Keep audience copy deterministic and evidence-backed; do not introduce LLM-generated or untraceable claims.
- Story camera movement is opt-in inside the story rail; manual selection and audience changes never move the camera.
- WebGL remains progressive enhancement; the complete table/fallback, print, keyboard, dense-data, and no-WebGL paths remain authoritative.
- Keep Three.js imports client-only and keep Astro loaders unaware of audience presentation state.
- Audience and story URL state use only safe optional query parameters: `audience` and `story`.
- Missing signals remain unavailable; never convert missing values into guessed scores, labels, or architecture.
- Do not add landscape-root aggregation, cross-repository storytelling, file-level dependency synthesis, or hosted Astro page sharing.
- Preserve existing unrelated working-tree files and stage only this feature, its tests, and its documentation.

## File Map

The implementation is split by responsibility so each unit can be reviewed and tested independently:

- `packages/report-ui/src/code-city/audience.ts` — audience IDs, mode catalog, and pure presentation derivation.
- `packages/report-ui/src/code-city/audienceUrl.ts` — safe query parsing and URL serialisation for audience/story state.
- `packages/report-ui/src/code-city/story.ts` — deterministic story-step derivation and story reducer.
- `packages/report-ui/src/code-city/brief.ts` — deterministic architecture-brief facts and copy.
- `packages/report-ui/src/code-city/CodeCityAudienceSwitch.tsx` — accessible audience mode control.
- `packages/report-ui/src/code-city/CodeCityStoryRail.tsx` — optional story controls and progress UI.
- `packages/report-ui/src/code-city/CodeCityArchitectureBrief.tsx` — copyable/shareable summary UI.
- `packages/report-ui/src/code-city/CodeCityView.tsx` — owns audience, story, selection, URL, and renderer presentation state.
- `packages/report-ui/src/code-city/viewModel.ts` — audience-aware inspector metric ordering and labels.
- `packages/report-ui/src/code-city/CodeCityCanvas.tsx` and `threeRenderer.ts` — narrow label/route emphasis settings only.
- `packages/report-ui/src/code-city/CodeCityView.css` — responsive, print, reduced-motion, switch, rail, and brief styles.
- `packages/report-ui/src/code-city/__tests__/` — pure contracts and component tests following existing direct React invocation patterns.
- `apps/site/src/pages/code-city.astro` and `apps/site/src/pages/landscape/repositories/[repo]/code-city.astro` — pass serialisable initial query state into the island.
- `docs/product-roadmap.md` and `docs/adr/0019-adopt-code-city-webgl-decision-surface.md` — update sequencing/evidence only after the browser acceptance slice is recorded.

---

### Task 1: Define deterministic audience contracts

**Files:**
- Create: `packages/report-ui/src/code-city/audience.ts`
- Test: `packages/report-ui/src/code-city/__tests__/audience.test.ts`
- Modify: `packages/report-ui/src/code-city/index.ts`
- Modify: `packages/report-ui/src/index.ts`

**Interfaces:**
- `CodeCityAudienceId = "onboarding" | "architecture-review" | "stakeholder"`.
- `CodeCityAudienceMetricId = "footprint" | "health" | "ownership" | "impact" | "change" | "complexity" | "coverage"`.
- `CodeCityAudiencePresentation = { audience, label, openingQuestion, orientation, firstAction, labelDensity, routeEmphasis, inspectorMetricOrder, coverageNote }`.
- `resolveCodeCityAudience(value: string | null | undefined): CodeCityAudienceId` falls back to `"onboarding"`.
- `getCodeCityAudiencePresentation(audience: CodeCityAudienceId): CodeCityAudiencePresentation` returns the static mode contract.
- `buildCodeCityAudiencePresentation(model: CodeCityModel, audience: CodeCityAudienceId): CodeCityAudiencePresentation` adds a truthful coverage note from `model.coverage` without changing the model.

- [ ] **Step 1: Write the failing audience contract tests**

Add a minimal `CodeCityModel` fixture with one component district, one building, one resolved edge, a stable layout, and complete coverage. Assert the public contract directly:

```ts
test("unknown values use the onboarding audience", () => {
  expect(resolveCodeCityAudience("unknown")).toBe("onboarding")
  expect(resolveCodeCityAudience(null)).toBe("onboarding")
})

test("architecture review prioritises boundary evidence", () => {
  const mode = getCodeCityAudiencePresentation("architecture-review")
  expect(mode).toMatchObject({
    openingQuestion: "Where are the boundaries and pressures?",
    routeEmphasis: "selection",
    firstAction: "Inspect a hub or boundary crossing",
  })
  expect(mode.inspectorMetricOrder.slice(0, 3)).toEqual(["impact", "health", "ownership"])
})

test("presentation reports missing coverage without inventing a value", () => {
  const model = modelFixture({ missingOptionalShards: ["impact"] })
  const presentation = buildCodeCityAudiencePresentation(model, "stakeholder")
  expect(presentation.coverageNote).toContain("impact")
  expect(presentation.coverageNote).toContain("unavailable")
})
```

- [ ] **Step 2: Run the audience tests and confirm RED**

Run:

```bash
bun test packages/report-ui/src/code-city/__tests__/audience.test.ts
```

Expected: FAIL because `audience.ts` and its exports do not exist yet.

- [ ] **Step 3: Implement the pure mode catalog**

Define the three mode records in one immutable catalog. Use these exact values:

```ts
const AUDIENCE_PRESENTATIONS = {
  onboarding: {
    label: "Onboarding",
    openingQuestion: "How is this repository organised?",
    orientation: "Districts are bounded contexts; buildings are canonical files.",
    firstAction: "Select a district",
    labelDensity: "generous",
    routeEmphasis: "quiet",
    inspectorMetricOrder: ["footprint", "ownership", "health", "impact", "change", "complexity", "coverage"],
  },
  "architecture-review": {
    label: "Architecture Review",
    openingQuestion: "Where are the boundaries and pressures?",
    orientation: "Parcels show contexts; routes show resolved component relationships.",
    firstAction: "Inspect a hub or boundary crossing",
    labelDensity: "balanced",
    routeEmphasis: "selection",
    inspectorMetricOrder: ["impact", "health", "ownership", "change", "complexity", "footprint", "coverage"],
  },
  stakeholder: {
    label: "Stakeholder",
    openingQuestion: "What deserves attention?",
    orientation: "The skyline summarises structure, pressure, and delivery impact.",
    firstAction: "Open the top concern",
    labelDensity: "calm",
    routeEmphasis: "consequential",
    inspectorMetricOrder: ["impact", "health", "change", "ownership", "footprint", "complexity", "coverage"],
  },
} as const
```

Add the coverage-note function so complete coverage says `All available signals are represented.` and partial coverage names the sorted missing shards as unavailable.

- [ ] **Step 4: Run focused tests and package typecheck**

Run:

```bash
bun test packages/report-ui/src/code-city/__tests__/audience.test.ts
bun run --cwd packages/report-ui typecheck
```

Expected: all audience assertions pass; package typecheck exits 0.

- [ ] **Step 5: Commit the audience contract**

```bash
git add packages/report-ui/src/code-city/audience.ts \
  packages/report-ui/src/code-city/__tests__/audience.test.ts \
  packages/report-ui/src/code-city/index.ts packages/report-ui/src/index.ts
git commit -m "feat: define code city audience contracts"
```

---

### Task 2: Add the audience switch and mode-aware inspector presentation

**Files:**
- Create: `packages/report-ui/src/code-city/CodeCityAudienceSwitch.tsx`
- Test: `packages/report-ui/src/code-city/__tests__/audienceComponents.test.tsx`
- Modify: `packages/report-ui/src/code-city/CodeCityView.tsx`
- Modify: `packages/report-ui/src/code-city/viewModel.ts`
- Modify: `packages/report-ui/src/code-city/CodeCityView.css`
- Modify: `packages/report-ui/src/code-city/index.ts`
- Modify: `packages/report-ui/src/index.ts`
- Modify: `packages/report-ui/src/code-city/__tests__/viewModel.test.ts`

**Interfaces:**
- `CodeCityAudienceSwitchProps = { audience: CodeCityAudienceId; onChange: (audience: CodeCityAudienceId) => void }`.
- `CodeCityViewProps` gains `initialAudience?: CodeCityAudienceId`; default is `"onboarding"`.
- `buildCodeCityInspectorModel(model, selection, basePath, lens = "health", presentation?: CodeCityAudiencePresentation): CodeCityInspectorModel | null` keeps the existing call shape valid and reorders/renames metrics only when a presentation is supplied.

- [ ] **Step 1: Write failing component and inspector tests**

Test the direct React element shape used by the existing component tests:

```tsx
test("audience switch exposes all modes with an active state", () => {
  const changes: CodeCityAudienceId[] = []
  const rendered = CodeCityAudienceSwitch({
    audience: "onboarding",
    onChange: (next) => changes.push(next),
  })
  const buttons = rendered.props.children as ReactElement[]
  expect(buttons).toHaveLength(3)
  expect(buttons[0]?.props).toMatchObject({ children: "Onboarding", "aria-pressed": true })
  buttons[1]?.props.onClick()
  expect(changes).toEqual(["architecture-review"])
})

test("stakeholder inspector puts impact and health first", () => {
  const inspector = buildCodeCityInspectorModel(modelFixture(), { kind: "district", id: "district:app" }, "/", "health", getCodeCityAudiencePresentation("stakeholder"))
  expect(inspector?.metrics.slice(0, 2).map(({ label }) => label)).toEqual(["Impact", "Health"])
})
```

- [ ] **Step 2: Run tests and confirm RED**

```bash
bun test packages/report-ui/src/code-city/__tests__/audienceComponents.test.tsx packages/report-ui/src/code-city/__tests__/viewModel.test.ts
```

Expected: FAIL because the switch is missing and the inspector builder does not accept the presentation contract.

- [ ] **Step 3: Implement the accessible switch and presentation wiring**

Use a real button group with a labelled `role="group"`, `aria-pressed`, and visible active styling. In `CodeCityView`, derive the presentation with `buildCodeCityAudiencePresentation(model, audience)`, render a compact “What you’re seeing” panel, pass the presentation to `buildCodeCityInspectorModel`, and default the initial mode to onboarding. Do not remount `CodeCityCanvas` when the mode changes.

Update `viewModel.ts` so `metricsFor` orders the existing metric records by `presentation.inspectorMetricOrder`; keep metric values and unavailable handling unchanged. Add mode-aware explanatory text to the view, not fabricated metric values.

- [ ] **Step 4: Run focused tests and package typecheck**

```bash
bun test packages/report-ui/src/code-city/__tests__/audienceComponents.test.tsx packages/report-ui/src/code-city/__tests__/viewModel.test.ts
bun run --cwd packages/report-ui typecheck
```

Expected: all tests pass and package typecheck exits 0.

- [ ] **Step 5: Commit the audience switch**

```bash
git add packages/report-ui/src/code-city/CodeCityAudienceSwitch.tsx \
  packages/report-ui/src/code-city/__tests__/audienceComponents.test.tsx \
  packages/report-ui/src/code-city/CodeCityView.tsx \
  packages/report-ui/src/code-city/viewModel.ts \
  packages/report-ui/src/code-city/CodeCityView.css \
  packages/report-ui/src/code-city/index.ts packages/report-ui/src/index.ts \
  packages/report-ui/src/code-city/__tests__/viewModel.test.ts
git commit -m "feat: add code city audience switch"
```

---

### Task 3: Apply audience route and label emphasis without changing geometry

**Files:**
- Modify: `packages/report-ui/src/code-city/CodeCityCanvas.tsx`
- Modify: `packages/report-ui/src/code-city/threeRenderer.ts`
- Test: `packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts`
- Modify: `packages/report-ui/src/code-city/CodeCityView.tsx`

**Interfaces:**
- `CodeCityRendererPresentation = Pick<CodeCityAudiencePresentation, "routeEmphasis" | "labelDensity">`.
- `CodeCityCanvasProps` gains `presentation: CodeCityRendererPresentation`.
- `CodeCityRendererOptions` gains the same `presentation` value.
- `CodeCityRendererController` gains `setPresentation(presentation: CodeCityRendererPresentation): void`.
- `resolveCodeCityHighlightedRouteIds(scene, selectionResult, routeEmphasis = "selection"): readonly string[]` preserves the current selected-route behaviour for existing callers.
- `resolveCodeCityVisibleLabelIds(scene, selectionResult, labelDensity = "balanced"): readonly string[]` preserves the current label visibility for existing callers.

- [ ] **Step 1: Add RED tests for route and label emphasis**

Use a scene fixture with four renderable edges of different weights and district/building nodes. Assert deterministic behaviour:

```ts
test("consequential emphasis adds the highest weighted routes but stays bounded", () => {
  const ids = resolveCodeCityHighlightedRouteIds(sceneFixture(), emptySelection(), "consequential")
  expect(ids).toEqual(["edge:largest", "edge:second"])
})

test("quiet emphasis keeps routes hidden until a selection exists", () => {
  expect(resolveCodeCityHighlightedRouteIds(sceneFixture(), emptySelection(), "quiet")).toEqual([])
})

test("label density never changes scene coordinates", () => {
  const scene = sceneFixture()
  expect(resolveCodeCityVisibleLabelIds(scene, emptySelection(), "generous")).toContain("district:app")
  expect(scene.nodes.map(({ id, center }) => [id, center])).toEqual(sceneFixture().nodes.map(({ id, center }) => [id, center]))
})
```

For `consequential`, include selected incident routes plus at most 12 additional renderable routes sorted by descending `weight`, then ascending edge ID. For `quiet`, use selected incident routes only; for `selection`, use selected incident routes and no ambient routes. Label density must only affect visibility, never scene records or positions.

- [ ] **Step 2: Run renderer tests and confirm RED**

```bash
bun test packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts
```

Expected: FAIL because the helpers and renderer presentation setter do not exist.

- [ ] **Step 3: Implement narrow renderer presentation updates**

Thread the presentation through `CodeCityCanvas` refs and `createCodeCityRenderer`. Update route materials and label visibility in `updateMaterials`; do not alter `buildCodeCityScene`, camera limits, geometry tokens, or lens material families. Keep `setPresentation` idempotent and dispose-safe.

- [ ] **Step 4: Verify geometry and renderer contracts**

```bash
bun test packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts packages/report-ui/src/code-city/__tests__/sceneAdapter.test.ts
bun run --cwd packages/report-ui typecheck
```

Expected: all renderer and scene tests pass; package typecheck exits 0. The existing camera and selection tests must remain green.

- [ ] **Step 5: Commit renderer emphasis**

```bash
git add packages/report-ui/src/code-city/CodeCityCanvas.tsx \
  packages/report-ui/src/code-city/threeRenderer.ts \
  packages/report-ui/src/code-city/CodeCityView.tsx \
  packages/report-ui/src/code-city/__tests__/threeRenderer.test.ts
git commit -m "feat: add audience-aware code city emphasis"
```

---

### Task 4: Build deterministic story steps and story state reducer

**Files:**
- Create: `packages/report-ui/src/code-city/story.ts`
- Test: `packages/report-ui/src/code-city/__tests__/story.test.ts`
- Modify: `packages/report-ui/src/code-city/index.ts`
- Modify: `packages/report-ui/src/index.ts`

**Interfaces:**
- `CodeCityStoryStepId = "orient" | "name" | "connect" | "prove"`.
- `CodeCityStoryStep = { id, title, body, target: CodeCitySelection, relatedDistrictId: string | null, evidence: readonly { label, href }[], availability: "available" | "unavailable", unavailableReason: string | null }`.
- `CodeCityStory = { audience: CodeCityAudienceId, steps: readonly CodeCityStoryStep[] }`.
- `CodeCityStoryState = { tag: "idle" } | { tag: "active"; stepIndex: number; focused: boolean } | { tag: "completed" }`.
- `CodeCityStoryEvent = { type: "start" } | { type: "next" } | { type: "back" } | { type: "skip" } | { type: "exit" } | { type: "focus" } | { type: "complete" }`.
- `buildCodeCityStory(model, audience, basePath): CodeCityStory`.
- `reduceCodeCityStoryState(state, event, stepCount): CodeCityStoryState`.

- [ ] **Step 1: Write failing story derivation and reducer tests**

Use a complete fixture with three districts and two resolved edges. Assert the exact stable rules:

```ts
test("story steps are stable when source arrays are permuted", () => {
  const first = buildCodeCityStory(modelFixture(), "architecture-review", "/repo")
  const second = buildCodeCityStory(permutedModelFixture(), "architecture-review", "/repo")
  expect(second).toEqual(first)
})

test("connect selects the highest-count resolved edge with an ID tie-break", () => {
  const story = buildCodeCityStory(modelFixture(), "architecture-review", "/repo")
  expect(story.steps.find(({ id }) => id === "connect")).toMatchObject({
    target: { kind: "district", id: "district:app" },
    relatedDistrictId: "district:shared",
    availability: "available",
  })
})

test("story reducer supports start, back, skip, focus, exit, and completion", () => {
  let state: CodeCityStoryState = { tag: "idle" }
  state = reduceCodeCityStoryState(state, { type: "start" }, 4)
  state = reduceCodeCityStoryState(state, { type: "focus" }, 4)
  expect(state).toEqual({ tag: "active", stepIndex: 0, focused: true })
  state = reduceCodeCityStoryState(state, { type: "next" }, 4)
  expect(state).toEqual({ tag: "active", stepIndex: 1, focused: false })
  expect(reduceCodeCityStoryState(state, { type: "exit" }, 4)).toEqual({ tag: "idle" })
})
```

Use these deterministic selection rules: `name` targets the first district in `model.layout.districtOrder`; `connect` chooses the highest positive `count` edge with both district IDs present, breaking ties by edge ID; `prove` reuses the connect target when available, otherwise the name target. Evidence is resolved with `resolveCodeCityEvidenceHref` and never fabricated.

- [ ] **Step 2: Run story tests and confirm RED**

```bash
bun test packages/report-ui/src/code-city/__tests__/story.test.ts
```

Expected: FAIL because `story.ts` is missing.

- [ ] **Step 3: Implement the pure story model and reducer**

Derive copy from the audience mode and measured model values. Keep unavailable steps in the returned sequence with `availability: "unavailable"` so the rail can explain the gap and advance to the next supported step. The reducer must clamp indices, clear `focused` after navigation, and treat `next` on the final step as `completed`.

- [ ] **Step 4: Run story tests, package typecheck, and export checks**

```bash
bun test packages/report-ui/src/code-city/__tests__/story.test.ts
bun run --cwd packages/report-ui typecheck
```

Expected: all story assertions pass and all new public types/functions are available from both code-city and package-root exports.

- [ ] **Step 5: Commit the story contract**

```bash
git add packages/report-ui/src/code-city/story.ts \
  packages/report-ui/src/code-city/__tests__/story.test.ts \
  packages/report-ui/src/code-city/index.ts packages/report-ui/src/index.ts
git commit -m "feat: define code city story state"
```

---

### Task 5: Add the optional story rail and reversible focus flow

**Files:**
- Create: `packages/report-ui/src/code-city/CodeCityStoryRail.tsx`
- Test: `packages/report-ui/src/code-city/__tests__/storyRail.test.tsx`
- Modify: `packages/report-ui/src/code-city/CodeCityView.tsx`
- Modify: `packages/report-ui/src/code-city/CodeCityView.css`
- Modify: `packages/report-ui/src/code-city/index.ts`
- Modify: `packages/report-ui/src/index.ts`

**Interfaces:**
- `CodeCityStoryRailProps = { story: CodeCityStory; state: CodeCityStoryState; onEvent: (event: CodeCityStoryEvent) => void; onFocusStep: () => void }`.
- `CodeCityViewProps` gains `initialStoryId?: CodeCityStoryStepId | null`.
- The rail exposes `Explain this city`, `Back`, `Next`, `Skip`, `Replay`, `Exit`, `Focus this step`, and `Return to overview` with stable labels and disabled states.

- [ ] **Step 1: Write failing rail tests**

Test the direct element tree and callback semantics:

```tsx
test("idle rail offers an explicit explain action", () => {
  const events: CodeCityStoryEvent[] = []
  const rendered = CodeCityStoryRail({
    story: storyFixture(),
    state: { tag: "idle" },
    onEvent: (event) => events.push(event),
    onFocusStep: () => undefined,
  })
  expect(textContent(rendered)).toContain("Explain this city")
  findButton(rendered, "Explain this city").props.onClick()
  expect(events).toEqual([{ type: "start" }])
})

test("active rail exposes progress and reversible focus", () => {
  const rendered = CodeCityStoryRail({
    story: storyFixture(),
    state: { tag: "active", stepIndex: 1, focused: true },
    onEvent: () => undefined,
    onFocusStep: () => undefined,
  })
  expect(textContent(rendered)).toContain("Step 2 of 4")
  expect(textContent(rendered)).toContain("Return to overview")
})
```

- [ ] **Step 2: Run rail tests and confirm RED**

```bash
bun test packages/report-ui/src/code-city/__tests__/storyRail.test.tsx
```

Expected: FAIL because the rail component is missing.

- [ ] **Step 3: Implement the rail and story ownership in `CodeCityView`**

Keep story state in `CodeCityView`. On story start, save the current selection in a ref. On step navigation, select the step target but do not move the camera. `Focus this step` calls `canvasRef.current?.focusEntity(step.target?.id ?? null)` and marks the reducer state focused. `Return to overview` calls `focusEntity(null)`, restores the saved selection, and clears focused state. `Exit` restores the same context and returns to idle.

Render unavailable reasons in the rail, announce mode/story transitions through the existing `aria-live` status, and keep the story rail dismissible. Add keyboard-visible focus styles and responsive stacking; do not add continuous animation.

- [ ] **Step 4: Run focused component tests and typecheck**

```bash
bun test packages/report-ui/src/code-city/__tests__/storyRail.test.tsx packages/report-ui/src/code-city/__tests__/audienceComponents.test.tsx packages/report-ui/src/code-city/__tests__/viewMode.test.tsx
bun run --cwd packages/report-ui typecheck
```

Expected: all component tests pass and package typecheck exits 0.

- [ ] **Step 5: Commit the story rail**

```bash
git add packages/report-ui/src/code-city/CodeCityStoryRail.tsx \
  packages/report-ui/src/code-city/__tests__/storyRail.test.tsx \
  packages/report-ui/src/code-city/CodeCityView.tsx \
  packages/report-ui/src/code-city/CodeCityView.css \
  packages/report-ui/src/code-city/index.ts packages/report-ui/src/index.ts
git commit -m "feat: add code city explanation rail"
```

---

### Task 6: Add architecture briefs and safe URL-addressable presentation state

**Files:**
- Create: `packages/report-ui/src/code-city/audienceUrl.ts`
- Create: `packages/report-ui/src/code-city/brief.ts`
- Create: `packages/report-ui/src/code-city/CodeCityArchitectureBrief.tsx`
- Test: `packages/report-ui/src/code-city/__tests__/audienceUrl.test.ts`
- Test: `packages/report-ui/src/code-city/__tests__/brief.test.ts`
- Test: `packages/report-ui/src/code-city/__tests__/briefComponent.test.tsx`
- Modify: `packages/report-ui/src/code-city/CodeCityView.tsx`
- Modify: `packages/report-ui/src/code-city/CodeCityView.css`
- Modify: `packages/report-ui/src/code-city/index.ts`
- Modify: `packages/report-ui/src/index.ts`
- Modify: `apps/site/src/pages/code-city.astro`
- Modify: `apps/site/src/pages/landscape/repositories/[repo]/code-city.astro`

**Interfaces:**
- `CodeCityUrlState = { audience: CodeCityAudienceId; story: CodeCityStoryStepId | null }`.
- `parseCodeCityUrlState(url: URL): CodeCityUrlState` uses onboarding and null story for invalid values.
- `buildCodeCityUrl(pathname: string, state: CodeCityUrlState): string` writes only non-default `audience` and non-null `story` parameters with `URLSearchParams`.
- `CodeCityBriefFact = { label: string; value: string; evidence: readonly { label: string; href: string }[] }`.
- `CodeCityArchitectureBrief = { title: string; lead: string; facts: readonly CodeCityBriefFact[]; nextAction: string }`.
- `buildCodeCityArchitectureBrief(model, presentation, story, basePath): CodeCityArchitectureBrief`.
- `CodeCityArchitectureBriefProps = { brief: CodeCityArchitectureBrief; onCopy: () => void; copied: boolean }`.

- [ ] **Step 1: Write failing URL and brief tests**

Assert invalid query handling and deterministic, evidence-backed facts:

```ts
test("URL state ignores unsupported audience and story values", () => {
  const state = parseCodeCityUrlState(new URL("https://example.test/code-city?audience=bad&story=bad"))
  expect(state).toEqual({ audience: "onboarding", story: null })
})

test("URL builder omits defaults and preserves supported state", () => {
  expect(buildCodeCityUrl("/code-city", { audience: "onboarding", story: null })).toBe("/code-city")
  expect(buildCodeCityUrl("/code-city", { audience: "architecture-review", story: "connect" })).toBe("/code-city?audience=architecture-review&story=connect")
})

test("brief facts use stable model rankings and resolve evidence under the report base", () => {
  const brief = buildCodeCityArchitectureBrief(modelFixture(), presentationFixture(), storyFixture(), "/repo")
  expect(brief.facts.map(({ label }) => label)).toEqual(["Largest context", "Strongest boundary", "Evidence"])
  expect(brief.facts.flatMap(({ evidence }) => evidence.map(({ href }) => href))).toEqual([
    "/repo/components#app",
    "/repo/components#shared",
  ])
})
```

Use deterministic rankings: largest context by LOC then district ID; strongest boundary by positive edge count then edge ID; evidence facts only include links returned by `resolveCodeCityEvidenceHref`. Mode copy changes the lead and next action but never the measured values.

- [ ] **Step 2: Run URL/brief tests and confirm RED**

```bash
bun test packages/report-ui/src/code-city/__tests__/audienceUrl.test.ts packages/report-ui/src/code-city/__tests__/brief.test.ts packages/report-ui/src/code-city/__tests__/briefComponent.test.tsx
```

Expected: FAIL because the URL, brief, and component modules are missing.

- [ ] **Step 3: Implement pure URL and brief contracts**

Use `URLSearchParams`, never string concatenation. Keep all brief facts serialisable and preserve missing-signal wording as `Unavailable`; do not create a “top concern” when no measured health, impact, or change value exists. The brief component must render copyable text and visible evidence links; clipboard failure leaves the text visible and announces that manual copying is available.

- [ ] **Step 4: Wire initial query state and client URL updates**

In both Astro routes, parse `Astro.url` with `parseCodeCityUrlState` and pass `initialAudience` and `initialStoryId` to `CodeCityView`. In the React island, initialise state from those props and call `history.replaceState` with `buildCodeCityUrl(window.location.pathname, nextState)` after audience or story changes. Do not trigger a route reload or bypass the existing WebGL reload matcher.

- [ ] **Step 5: Run focused tests, site typecheck, and package build**

```bash
bun test packages/report-ui/src/code-city/__tests__/audienceUrl.test.ts packages/report-ui/src/code-city/__tests__/brief.test.ts packages/report-ui/src/code-city/__tests__/briefComponent.test.tsx
bun run --cwd packages/report-ui typecheck
bun run --cwd apps/site typecheck
bun run --cwd packages/report-ui build
```

Expected: all focused tests pass; both typechecks and the package build exit 0.

- [ ] **Step 6: Commit URL state and brief**

```bash
git add packages/report-ui/src/code-city/audienceUrl.ts \
  packages/report-ui/src/code-city/brief.ts \
  packages/report-ui/src/code-city/CodeCityArchitectureBrief.tsx \
  packages/report-ui/src/code-city/__tests__/audienceUrl.test.ts \
  packages/report-ui/src/code-city/__tests__/brief.test.ts \
  packages/report-ui/src/code-city/__tests__/briefComponent.test.tsx \
  packages/report-ui/src/code-city/CodeCityView.tsx \
  packages/report-ui/src/code-city/CodeCityView.css \
  packages/report-ui/src/code-city/index.ts packages/report-ui/src/index.ts \
  apps/site/src/pages/code-city.astro \
  'apps/site/src/pages/landscape/repositories/[repo]/code-city.astro'
git commit -m "feat: add code city briefs and shareable audience state"
```

---

### Task 7: Complete responsive polish, browser acceptance, and project documentation

**Files:**
- Modify: `packages/report-ui/src/code-city/CodeCityView.css`
- Test: `packages/report-ui/src/code-city/__tests__/components.test.tsx`
- Test: `packages/report-ui/src/code-city/__tests__/viewMode.test.tsx`
- Modify: `docs/product-roadmap.md`
- Modify: `docs/adr/0019-adopt-code-city-webgl-decision-surface.md`
- Create ignored fixture: `/private/tmp/planetnik-code-city-audience-fixture/`

**Interfaces:**
- No new public model interface is introduced in this task.
- CSS must provide `.code-city__audience`, `.code-city__story`, `.code-city__brief`, responsive stacking, `prefers-reduced-motion`, and print rules without hiding the brief/table evidence.

- [ ] **Step 1: Add component and fallback parity assertions**

Extend direct React tests to assert that the rendered view exposes a labelled Audience group, “What you’re seeing” copy, story controls, and a brief/table equivalent. Keep existing inspector, fallback, selection-filter, and route-state assertions green.

- [ ] **Step 2: Add responsive, print, and reduced-motion styles**

Keep the current map/inspector stacking breakpoints. Add a compact audience switch and story rail that stack before the lens controls at 1000px, remain keyboard-visible at 600px, and remain readable in the table/brief print representation. Reduced motion must disable story pulses and easing but retain focus outlines, status announcements, and evidence tethers as static emphasis.

- [ ] **Step 3: Generate a disposable deterministic fixture**

Create a temporary landscape fixture with one repository containing the existing complete canonical Code City shards plus a partial copy with `impact.json` absent. Do not write generated data into the repository. Start the site with:

```bash
PLANETNIK_DATASETS_ROOT=/private/tmp/planetnik-code-city-audience-fixture \
PLANETNIK_DATASET=landscape-fixture \
bun run dev:site -- --host 127.0.0.1 --port 4321
```

Use the in-app browser at the encoded repository route and capture the initial map and table states before changing the fixture.

- [ ] **Step 4: Run the direct browser interaction matrix**

Record evidence for both `/planetnik/code-city` and `/planetnik/landscape/repositories/<encoded-repo>/code-city`:

1. switch through all three audiences and confirm coordinates, selection, camera, and evidence links remain stable;
2. confirm each mode's opening question and first action are visible;
3. start the story, advance, go back, focus a step, return to overview, skip, replay, and exit;
4. confirm the evidence tether connects visual emphasis, inspector copy, and the existing evidence route;
5. reload a URL containing `audience=architecture-review&story=connect` and confirm state restoration;
6. verify partial coverage explains unavailable data without inventing a concern;
7. switch to Table view and verify the same selected entity and brief facts remain available;
8. verify keyboard focus, reduced motion, print output, and forced WebGL fallback preserve the story/evidence path;
9. verify the dense fixture remains explicit and complete rather than silently dropping records.

Do not claim interaction or visual success for a row that was not directly observed.

- [ ] **Step 5: Run full workspace gates and inspect artifacts**

```bash
bun test
bun run typecheck
PLANETNIK_DATASETS_ROOT=/private/tmp/planetnik-code-city-audience-fixture \
PLANETNIK_DATASET=landscape-fixture \
bun run --cwd apps/site build
git diff --check
```

Confirm the static output contains both Code City routes, the renderer chunk remains lazy, and no generated fixture or scratch file is staged. Record exact pass counts, build warnings, bundle size, and browser evidence boundaries in the task report.

- [ ] **Step 6: Reconcile roadmap and provisional ADR**

Update Phase 1.5 in `docs/product-roadmap.md` to describe the audience-aware narrative layer as delivered only if the direct matrix is green. Update ADR-0019's evidence boundary with the observed rows; keep its status provisional until the pre-existing renderer interaction matrix is fully evidenced. If any browser row remains open, document it as open rather than upgrading the ADR.

- [ ] **Step 7: Commit the acceptance and documentation slice**

```bash
git add packages/report-ui/src/code-city/CodeCityView.css \
  packages/report-ui/src/code-city/__tests__/components.test.tsx \
  packages/report-ui/src/code-city/__tests__/viewMode.test.tsx \
  docs/product-roadmap.md docs/adr/0019-adopt-code-city-webgl-decision-surface.md
git diff --cached --check
git commit -m "feat: complete code city audience experience"
```

---

## Final handoff gates

After Task 7, run the verification-before-completion and finishing-a-development-branch skills. Confirm:

```bash
git status --short --branch
git log -5 --oneline --decorate
bun test
bun run typecheck
```

Only after those commands and the direct browser report are green should the implementation be described as complete. Present the integration choice to the user; do not push or merge without explicit approval for that final action.
