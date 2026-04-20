# A2UI Upgrade Reconnaissance

## Goal

Map the practical upgrade path from Planetnik's current CopilotKit frontend stack to the newer `1.56.2` / V2-era package surface, with special focus on the A2UI report surface work that now exists in `apps/app`.

This document is intentionally narrower than [A2UI Capability Assessment](./a2ui-capability-assessment.md): that assessment describes what the current stack can do, while this reconnaissance identifies what changes if we move forward.

## Current Repo Baseline

### Package reality

| Workspace | Current manifest state | Important note |
| --- | --- | --- |
| `apps/app` | `@copilotkit/a2ui-renderer@^1.54.1`, `@copilotkit/react-core@^1.54.1`, `@copilotkit/react-ui@^1.54.1` | Main hosted intelligence frontend |
| `apps/site` | `@copilotkit/react-core@^1.54.1`, `@copilotkit/react-ui@^1.54.1` | Mirrors the older chat import style |
| `apps/runtime` | `@copilotkit/runtime@^1.54.1` | Lockfile already resolves runtime to `1.56.2` |
| `apps/copilot-runtime` | `@copilotkit/runtime@^1.8.0` | Separate historical outlier, not the current hosted intelligence runtime path |

### Current code touchpoints

#### Chat layer

`apps/app` and `apps/site` currently use the older split frontend package model:

- `CopilotKit` from `@copilotkit/react-core`
- `CopilotChat` from `@copilotkit/react-ui`
- `@copilotkit/react-ui/styles.css`
- legacy-but-still-supported hooks such as:
  - `useCopilotAction`
  - `useCopilotReadable`
  - `useCopilotChatInternal`
  - `useCopilotChatSuggestions`

#### A2UI layer

The new Planetnik A2UI work is concentrated in a very small blast radius:

- `apps/app/src/components/intelligence/ReportA2uiSurface.tsx`
  - imports `A2UIViewer`
  - imports `A2UIActionEvent`
  - renders from `root`, `components`, and `data`
  - handles actions through the viewer convenience callback
- `apps/app/src/components/intelligence/useReportA2uiSurfaceState.ts`
  - stores `A2UIActionEvent` as the last dispatched surface action

That is good news: the A2UI upgrade problem is real, but it is not spread all over the repo like confetti after a questionable sprint demo.

## Verified External Findings

### Frontend V2 is real, but backend changes are not required

The published CopilotKit migration guidance says:

- frontend packages consolidate to `@copilotkit/react-core/v2`
- `@copilotkit/react-ui` UI components move into `@copilotkit/react-core/v2`
- styles move to `@copilotkit/react-core/v2/styles.css`
- backend packages such as `@copilotkit/runtime` do **not** require a matching V2 migration

So V2 is a frontend API migration, not a runtime protocol migration.

### `@copilotkit/react-ui@1.56.2` still exists

This matters a lot.

`@copilotkit/react-ui` is still published at `1.56.2`, which means there is still a compatibility lane for apps that have not moved to V2 imports yet.

The published `1.56.2` package still exposes the exact UI symbols Planetnik uses today, including:

- `CopilotChat`
- `UserMessage`
- `useCopilotChatSuggestions`
- `styles.css`

That means a plain version-alignment step is possible without immediately adopting `react-core/v2`.

### Non-V2 `@copilotkit/react-core@1.56.2` still carries Planetnik's current hooks

The non-V2 `@copilotkit/react-core@1.56.2` export surface still includes the symbols Planetnik currently depends on, including:

- `CopilotKit`
- `useCopilotAction`
- `useCopilotReadable`
- `useCopilotChatInternal`
- `useCopilotChatSuggestions`

That is the strongest evidence that a **low-risk version normalization** is possible for the chat layer.

### V2 should be treated as an API migration, not a path alias swap

The published `@copilotkit/react-core/v2` export surface clearly includes the newer consolidated UI model:

- `CopilotKitProvider`
- `CopilotChat`
- `CopilotSidebar`
- `CopilotPopup`
- `useAgent`
- `useFrontendTool`
- `useSuggestions`
- `createA2UIMessageRenderer`

What it did **not** surface in the returned export list:

- `useCopilotAction`
- `useCopilotReadable`
- `useCopilotChatInternal`
- `useCopilotChatSuggestions`

That does not prove those older APIs are impossible in V2 via some other path, but it does mean Planetnik should not treat V2 as a trivial import rewrite. The safe posture is to assume that V2 requires real hook migration work.

### `@copilotkit/a2ui-renderer@1.56.2` is materially different from `1.54.1`

The latest published A2UI renderer differs in three important ways.

#### 1. It moves onto the newer A2UI core

The package now depends on:

- `@a2ui/web_core@0.9.0`

That is a meaningful shift away from the older local `@a2ui/lit` / v0.8-era mental model documented in the current assessment.

#### 2. The export surface is catalog-first and provider-first

The published `1.56.2` export surface includes:

- `A2UIProvider`
- `A2UIRenderer`
- `useA2UI`
- `createCatalog`
- `CatalogRenderers`
- `basicCatalog`
- `useA2UIError`
- `createA2UICatalog` and `extractA2UISchema` as deprecated compatibility helpers

#### 3. The convenience viewer API Planetnik currently uses is not visible there

The published `1.56.2` export surface did **not** show:

- `A2UIViewer`
- `A2UIActionEvent`

The nearest published replacements are:

- `A2UIRenderer` instead of `A2UIViewer`
- `A2UIClientEventMessage` / `OnActionCallback` / `Action` instead of `A2UIActionEvent`

This is the sharpest upgrade edge in the whole reconnaissance.

## What The Latest A2UI Model Expects

The latest renderer model is no longer "here is a root node plus a component array, please render this directly."

The published `1.56.2` types describe a provider-driven flow:

- `A2UIProvider` accepts:
  - `onAction`
  - `theme`
  - `catalog`
- `A2UIRenderer` renders by `surfaceId`
- `useA2UI()` exposes:
  - `processMessages(messages)`
  - `getSurface(surfaceId)`
  - `clearSurfaces()`
  - `version`

In other words, the latest renderer wants surface state to be loaded into its store first, and then rendered by ID.

That is different from Planetnik's current app-side pattern, which is:

- fetch a runtime response containing `root`, `components`, and `data`
- pass that directly to `A2UIViewer`
- normalize the action callback into `actionName`, `sourceComponentId`, and `context`

## Compatibility Matrix

| Area | Current Planetnik usage | `1.56.2` compatibility | Risk |
| --- | --- | --- | --- |
| Chat container | `CopilotKit` + `CopilotChat` from split packages | still supported on non-V2 package entry points | low |
| Chat hooks | `useCopilotAction`, `useCopilotReadable`, `useCopilotChatInternal`, `useCopilotChatSuggestions` | still exported from non-V2 `@copilotkit/react-core@1.56.2` | low |
| V2 frontend imports | older package split | docs point to `@copilotkit/react-core/v2`; current hooks are not visible in returned V2 export list | medium to high |
| A2UI viewer | `A2UIViewer` | not visible in published `1.56.2` exports | high |
| A2UI event type | `A2UIActionEvent` | not visible in published `1.56.2` exports | high |
| Runtime package version | manifest says `^1.54.1` while lock resolves `1.56.2` | should be normalized to reduce surprise | low |
| Repo outlier runtime | `apps/copilot-runtime` on `^1.8.0` | independent issue, but worth documenting | low to medium |

## Practical Upgrade Options

### Option A: Normalize versions first, keep current chat code, postpone A2UI renderer migration

This is the lowest-drama path.

#### Option A changes

- bump `@copilotkit/react-core` and `@copilotkit/react-ui` in:
  - `apps/app`
  - `apps/site`
- bump `@copilotkit/runtime` in `apps/runtime` to `^1.56.2`
- keep existing source imports and chat code unchanged
- **do not** immediately move to `@copilotkit/react-core/v2`
- either:
  - keep direct `@copilotkit/a2ui-renderer` pinned at `1.54.1` temporarily, or
  - defer the whole dependency bump in `apps/app` until the A2UI adapter work is ready

#### Why it works

Because the non-V2 package line at `1.56.2` still supports the current chat imports and hook APIs.

#### Option A benefits

- removes the runtime manifest/lock mismatch
- keeps app and site close to the current published CopilotKit line
- minimizes code churn in the intelligence chat
- separates routine version hygiene from the harder A2UI surface migration

#### Option A risks

If `apps/app` keeps a direct `@copilotkit/a2ui-renderer@1.54.1` while newer CopilotKit packages pull `1.56.2` transitively, the app may temporarily carry two A2UI renderer versions.

That is acceptable as a short-lived bridge, but it is not a lovely long-term state.

### Option B: Full `1.56.2` alignment including the A2UI surface code

This is the real A2UI migration path.

#### Option B changes

- upgrade all CopilotKit frontend and runtime package pins to `1.56.2`
- replace direct `A2UIViewer` usage in `ReportA2uiSurface.tsx`
- replace `A2UIActionEvent` typing in `ReportA2uiSurface.tsx` and `useReportA2uiSurfaceState.ts`
- introduce a wrapper based on:
  - `A2UIProvider`
  - `useA2UI().processMessages(...)`
  - `A2UIRenderer`
  - `OnActionCallback`

#### Open implementation question

Planetnik's current runtime route returns a viewer-shaped payload:

- `root`
- `components`
- `data`

The latest renderer appears to want message ingestion plus `surfaceId` rendering.

So the migration has two plausible sub-paths:

1. **App-side adapter path**
   - keep the runtime route as-is
   - synthesize the needed message stream in the frontend
   - feed that into `useA2UI().processMessages(...)`
2. **Runtime contract upgrade path**
   - change the runtime route to emit the newer message model directly
   - let the frontend stay thinner

#### Option B benefits

- one coherent dependency line
- aligns the app with the latest catalog-first A2UI model
- opens the door to `createCatalog(...)` and custom `CatalogRenderers`
- reduces future surprise when following newer docs

#### Option B risks

- higher implementation risk than a normal dependency bump
- current action normalization behavior may need to be rebuilt from raw event messages
- the runtime surface contract may need to change together with the frontend

### Option C: V2 frontend migration

This is the strategic cleanup path, not the tactical one.

#### Option C changes

- move UI imports to `@copilotkit/react-core/v2`
- replace `CopilotKit` with `CopilotKitProvider`
- move CSS import to `@copilotkit/react-core/v2/styles.css`
- migrate current hook usage toward the newer V2/headless equivalents

#### Why this is not the first move

Planetnik's current hosted intelligence code depends on older hook names that remain available in non-V2 `react-core@1.56.2` but were not visible in the published V2 export surface we inspected.

That means V2 should be treated as a **separate migration project** rather than a free bonus that comes with the version bump.

#### Best use for this option

Do this only after:

- runtime manifest skew is fixed
- the A2UI renderer question is settled
- the hosted intelligence chat behavior is stable again

## Recommended Sequence

### 1. Normalize the easy skew first

Recommended near-term cleanup:

- update `apps/runtime` to `@copilotkit/runtime@^1.56.2`
- update `apps/app` and `apps/site` to `@copilotkit/react-core@^1.56.2` and `@copilotkit/react-ui@^1.56.2`
- keep existing chat imports in place for now

This is the low-risk move that turns the current lockfile reality into explicit manifest reality.

### 2. Run a focused A2UI adapter spike

Before upgrading the direct `@copilotkit/a2ui-renderer` usage in `apps/app`, prove these two things in a small branch or isolated component:

- a runtime-fetched investigation surface can be loaded into `useA2UI().processMessages(...)`
- `A2UIRenderer` plus `A2UIProvider` can preserve the current action flow for:
  - `stage_followup`
  - `navigate`

If that spike fails cleanly, Planetnik still has a justified reason to keep the direct A2UI renderer on the older viewer-based API a bit longer.

### 3. Treat V2 as an optional follow-on migration

Do not bundle this into the A2UI spike unless there is a concrete product reason.

The repo already has one meaningful migration in flight when A2UI moves off `A2UIViewer`. Adding a hook-model rewrite on top of that would be ambitious in the most excitingly dangerous way.

### 4. Decide what to do with `apps/copilot-runtime`

`apps/copilot-runtime` is on `@copilotkit/runtime@^1.8.0`, which is an unrelated outlier.

That does not block the hosted intelligence work in `apps/runtime`, but it should be explicitly classified as one of:

- still active and needing alignment
- intentionally legacy
- removable

## Decision Gates

Before doing the full A2UI package upgrade in `apps/app`, answer these questions explicitly:

1. Can the current runtime `root` / `components` / `data` payload be losslessly adapted to the new message-ingestion model?
2. Does the latest action callback provide enough detail to preserve Planetnik's current follow-up staging UX without ugly custom decoding?
3. Does Planetnik want to keep runtime-owned A2UI payload generation on the old shape for a while, or invest in a runtime-side contract upgrade now?
4. Is V2 import migration actually buying a feature Planetnik needs, or just reducing documentation envy?

## Practical Recommendation

The best near-term path is:

1. normalize the non-A2UI CopilotKit package versions to `1.56.2`
2. keep the current chat code on the non-V2 import path for now
3. treat the direct A2UI renderer upgrade as a **contained adapter project**
4. defer full `react-core/v2` migration until after the A2UI story is stable

In plain language:

- **chat upgrade:** likely easy
- **runtime version cleanup:** definitely easy
- **A2UI upgrade:** real work
- **V2 migration:** separate work

That is the practical split that matters.

## References

- [A2UI Capability Assessment](./a2ui-capability-assessment.md)
- [CopilotKit Built-in Agent A2UI](https://docs.copilotkit.ai/built-in-agent/generative-ui/a2ui)
- [CopilotKit Migrate to V2](https://docs.copilotkit.ai/migration-guides/migrate-to-v2)
- [CopilotKit Built-in Agent Migrate to V2](https://docs.copilotkit.ai/built-in-agent/troubleshooting/migrate-to-v2)
- [`@copilotkit/a2ui-renderer` on npm](https://www.npmjs.com/package/@copilotkit/a2ui-renderer)
- [`@copilotkit/react-ui` on npm](https://www.npmjs.com/package/@copilotkit/react-ui)
- [`@copilotkit/a2ui-renderer@1.56.2` package metadata](https://unpkg.com/@copilotkit/a2ui-renderer@1.56.2/package.json)
- [`@copilotkit/a2ui-renderer@1.56.2` type exports](https://unpkg.com/@copilotkit/a2ui-renderer@1.56.2/dist/index.d.mts)
- [`@copilotkit/react-core@1.56.2` type exports](https://unpkg.com/@copilotkit/react-core@1.56.2/dist/index.d.mts)
- [`@copilotkit/react-core@1.56.2` V2 type exports](https://unpkg.com/@copilotkit/react-core@1.56.2/dist/v2/index.d.mts)
- [`@copilotkit/react-ui@1.56.2` type exports](https://unpkg.com/@copilotkit/react-ui@1.56.2/dist/index.d.mts)
- [`@copilotkit/runtime@1.56.2` package metadata](https://unpkg.com/@copilotkit/runtime@1.56.2/package.json)
