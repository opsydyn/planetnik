# A2UI Capability Assessment

## Goal

Document the actual A2UI capability envelope available in Planetnik today, based on the installed CopilotKit renderer packages in this repo, and separate that from newer public examples that describe a more advanced or newer integration layer.

## Scope

This assessment covers:

- the A2UI-related packages currently used by `apps/app`
- what `@copilotkit/a2ui-renderer@^1.54.1` actually supports in this workspace
- where the installed package differs from the latest public A2UI and CopilotKit documentation
- what Planetnik should treat as safe-to-use now versus upgrade-only territory

This assessment does **not**:

- decide the final upgrade path for newer CopilotKit A2UI APIs
- replace the broader phased plan in [A2UI Roadmap](./a2ui-roadmap.md)
- reopen the hosted-versus-static product split

## Executive Summary

Planetnik's current A2UI stack is capable enough for the runtime-backed investigation surfaces that now exist in `apps/app`, but it should be understood as a **v0.8-era renderer stack**, not the newer higher-level A2UI layer shown in the latest public documentation.

In practice, this means:

- the installed renderer is built on `@a2ui/lit/0.8`
- the safe protocol target today is **A2UI v0.8 stable**, not v0.9 draft
- the current package supports rendering, actions, local data binding, theming, and manual custom component registration
- the current package does **not** expose the newer catalog-first helper APIs shown in newer CopilotKit examples, such as `createCatalog` and `CatalogRenderers`
- Planetnik should keep its current A2UI usage version-aware and avoid assuming that every new docs example exists in the installed package

## Current Package Reality

`apps/app/package.json` currently pins:

- `@copilotkit/a2ui-renderer@^1.54.1`
- `@copilotkit/react-core@^1.54.1`
- `@copilotkit/react-ui@^1.54.1`

Inspection of the installed renderer package in `node_modules` shows that the renderer is built on `@a2ui/lit/0.8` and that its convenience viewer internally emits the v0.8 message flow:

- `beginRendering`
- `surfaceUpdate`
- `dataModelUpdate`
- `deleteSurface`

This matters because the latest public A2UI documentation increasingly emphasizes the newer v0.9 names:

- `createSurface`
- `updateComponents`
- `updateDataModel`
- `deleteSurface`

Planetnik should therefore treat the current app-side renderer as a **v0.8 renderer with stable practical value**, not as a full v0.9 implementation.

## What Works Today

### Rendering primitives

The installed package exposes a usable React rendering stack:

- `A2UIProvider`
- `A2UIRenderer`
- `A2UIViewer`
- `useA2UI`
- `useA2UIActions`
- `useA2UIState`
- `useA2UIStore`
- `useA2UIStoreSelector`
- `useA2UIComponent`
- `ComponentRegistry`
- `ThemeProvider`
- `defaultTheme`
- `litTheme`
- `initializeDefaultCatalog`
- `registerDefaultCatalog`

This is enough to:

- process incoming A2UI server messages
- store multiple surfaces by `surfaceId`
- render a surface tree from the current processor state
- dispatch user actions out of the surface
- provide component-level access to theme, data bindings, and action dispatch

### Built-in default catalog

The installed default catalog includes these built-in components.

#### Content

- `Text`
- `Image`
- `Icon`
- `Video`
- `AudioPlayer`
- `Divider`

#### Layout and containers

- `Row`
- `Column`
- `List`
- `Card`
- `Tabs`
- `Modal`

#### Interactive and input

- `Button`
- `TextField`
- `CheckBox`
- `Slider`
- `DateTimeInput`
- `MultipleChoice`

This is already enough for the current Planetnik patterns:

- short summary cards
- grouped diagnosis surfaces
- tabs for alternate report lenses
- buttons for follow-up actions
- lightweight user input where needed

### Data model and binding

The renderer supports a separated surface data model and component tree.

The current hook and provider surface supports:

- `processMessages(...)`
- `getSurface(...)`
- `getSurfaces()`
- `getData(...)`
- `setData(...)`
- `resolvePath(...)`

At the component level, `useA2UIComponent(...)` provides:

- `resolveString(...)`
- `resolveNumber(...)`
- `resolveBoolean(...)`
- `setValue(...)`
- `getValue(...)`
- `sendAction(...)`

This gives Planetnik working support for:

- separate surface state per `surfaceId`
- dynamic field resolution from the data model
- local updates to bound values
- form-like interactions without leaving the surface immediately

### Actions

The current package supports dispatching user interactions through:

- `onAction` on `A2UIProvider`
- `onAction` on `A2UIViewer`
- `dispatch(...)` in the provider action layer

`A2UIViewer` additionally normalizes the event into a simple shape:

- `actionName`
- `sourceComponentId`
- `timestamp`
- `context`

This maps well to the current Planetnik runtime-backed surface design where actions like `stage_followup` and `navigate` are intercepted by the app and bridged into the hosted intelligence flow.

### Theming and styling

The local renderer includes a real theme layer:

- `ThemeProvider`
- `useTheme`
- `useThemeOptional`
- `litTheme`
- `defaultTheme`

The renderer theme supports:

- per-component class maps
- `additionalStyles`
- markdown styling hints
- surface style interpretation for keys such as `primaryColor` and `font`

This means the current package is not locked to a fixed plain HTML appearance.

It can be aligned to Planetnik branding, but the best control path is the lower-level provider and renderer stack rather than only the viewer convenience wrapper.

### Extensibility

The local package supports custom component registration through `ComponentRegistry`.

Capabilities include:

- `register(...)`
- `unregister(...)`
- `has(...)`
- `getRegisteredTypes()`
- `clear()`
- lazy loading with `React.lazy`
- `Suspense` loading fallback behavior

Unknown components do not hard-crash the renderer. The component node path logs a warning and returns `null`, which gives Planetnik a safer degradation path than a total surface failure.

## What Is Partial or Missing

### Validation is limited

The current package appears to support only limited validation behavior.

What is present:

- `TextField` supports `validationRegexp`
- `TextField` tracks validity internally

What is not present in the installed package surface:

- no general `checks` model
- no client-side validation function graph like `required`, `and`, `or`, `email`, or `regex` as described in newer A2UI docs
- no richer button-disabling logic based on validation checks

Planetnik should therefore treat non-trivial validation as an application concern for now, not as something fully solved by the installed renderer package.

### No newer catalog-first helper API

The latest CopilotKit documentation increasingly shows a higher-level custom catalog workflow with helpers such as:

- `createCatalog(...)`
- `CatalogRenderers`
- provider-level `a2ui={{ catalog, theme }}` examples

These helper APIs were **not** found in the installed `@copilotkit/a2ui-renderer@1.54.1` export surface inspected in this repo.

That does not mean custom Planetnik components are impossible. It means that, today, they are implemented through the lower-level `ComponentRegistry` model rather than a newer docs-first catalog authoring helper layer.

### No visible `sendDataModel` support in the local API

The newer A2UI documentation describes `sendDataModel` and richer client-to-server model synchronization patterns.

That capability was not surfaced as a first-class local renderer API in the installed package version.

Planetnik should therefore continue to prefer explicit action payloads and app-controlled context handoff rather than assuming the renderer will automatically send synchronized data model state in the newer style.

### Viewer customization is narrower than provider customization

`A2UIViewer` is extremely useful for the current Planetnik architecture because it accepts:

- `root`
- `components`
- `data`
- `onAction`
- `styles`
- `className`

However, it does **not** expose the same degree of theme and registry customization that the lower-level provider path enables.

The current viewer implementation uses an internal viewer theme and auto-initializes the default catalog.

That makes it excellent for fast surface delivery, but not the best long-term path if Planetnik wants deeply custom renderer behavior or a large custom catalog.

## Public Docs vs Installed Package

| Area | Latest public docs imply | Installed `1.54.1` reality | Planetnik implication |
| --- | --- | --- | --- |
| Protocol shape | v0.9-style `createSurface` / `updateComponents` / `updateDataModel` | v0.8-style `beginRendering` / `surfaceUpdate` / `dataModelUpdate` | Keep runtime payloads and assumptions v0.8-shaped for now |
| Custom catalogs | `createCatalog(...)`, `CatalogRenderers`, provider-level catalog injection | Manual `ComponentRegistry` registration | Custom Planetnik components are possible, but with lower-level plumbing |
| Choice inputs | `ChoicePicker` in newer docs | `MultipleChoice` in installed renderer | Use installed component naming and schema, not latest-doc naming |
| Validation | function-based `checks`, reusable client functions, richer validation flow | limited `validationRegexp` support on `TextField` | Keep important validation in app/runtime logic |
| Data sync | `sendDataModel` and newer metadata-driven patterns | not exposed as a clear local renderer feature | Prefer explicit action context and app-managed handoff |
| Theming | newer docs show provider-level `a2ui={{ theme, catalog }}` examples | `ThemeProvider`, `litTheme`, `defaultTheme`, viewer-internal theme | Use provider/renderer path for deeper brand control |
| Auto-rendering story | newer docs emphasize more automatic CopilotKit A2UI activation | installed renderer is a reusable rendering package, not a complete new docs-era integration layer | Avoid assuming docs examples map 1:1 to the current package |

## Recommended Planetnik Posture

### Treat the current stack as production-capable v0.8 A2UI

The current package is not a dead-end prototype.

It is already strong enough for:

- runtime-backed investigation cards
- staged follow-up controls
- report summaries
- compact multi-component diagnostic surfaces
- light read-write workflows

Planetnik should continue to use it confidently within its actual version boundaries.

### Keep runtime-generated payloads v0.8-shaped

Until the app-side renderer stack is intentionally upgraded, Planetnik should keep:

- v0.8 message names
- v0.8 component vocabulary
- v0.8 input expectations
- explicit app-managed action handling

This avoids mixing a v0.9 mental model into a v0.8 renderer path.

### Use `A2UIViewer` where convenience wins

The current `A2UIViewer` is a strong fit when Planetnik already has:

- a root component ID
- a component list
- a plain JS data object
- app-side action bridging logic

That is exactly the current runtime-backed report surface pattern.

### Drop to `A2UIProvider` and `A2UIRenderer` when control matters

For deeper control, Planetnik should prefer the lower-level provider stack when it needs:

- custom theme injection
- a non-default component registry
- custom lazy components
- more direct control over surface lifecycle

### Preserve imperative fallback flows

The current action-based intelligence model remains an important fallback.

Planetnik should continue to preserve:

- direct navigation actions
- text-based answers
- chart-first fallbacks
- manual handoff into existing hosted intelligence paths

This is especially important because the installed renderer does not yet provide the richer validation and docs-era catalog ergonomics that would justify forcing every interaction through A2UI.

## Best-Fit Use Cases Right Now

The current stack is a good fit for:

- pressure summaries
- hotspot triage surfaces
- impact opportunity cards
- security summary surfaces
- action recommendation cards
- lightweight form or threshold input inside a bounded surface
- hosted intelligence follow-up staging

It is a weaker fit for:

- heavily validated multi-step forms
- workflows that depend on docs-era `checks`
- generic adoption of v0.9 draft features
- assuming full newer CopilotKit built-in-agent A2UI ergonomics without an upgrade

## Hold for a Focused Upgrade Spike

Planetnik should treat the following as upgrade-spike territory, not assumptions about the currently installed package:

- v0.9 payload generation as a default path
- `createCatalog(...)` or `CatalogRenderers`
- `ChoicePicker`-style newer catalog naming
- check/function-based client validation
- `sendDataModel`-driven investigation workflows
- newer provider-level automatic A2UI wiring examples from the latest CopilotKit docs

## Practical Decision

For the current repo state, the right default is:

1. keep using the installed renderer as a v0.8-capable A2UI surface engine
2. build on the current runtime-backed surface pattern that already works
3. avoid assuming that the newest docs map directly onto `1.54.1`
4. schedule a separate upgrade reconnaissance before adopting the newer catalog-first guidance wholesale

## References

- [A2UI Roadmap](./a2ui-roadmap.md)
- [A2UI Protocol v0.8 (stable)](https://a2ui.org/specification/v0.8-a2ui/)
- [A2UI Protocol v0.9 (draft)](https://a2ui.org/specification/v0.9-a2ui/)
- [A2UI Renderer Development Guide](https://a2ui.org/guides/renderer-development/)
- [A2UI Theming Guide](https://a2ui.org/guides/theming/)
- [A2UI Catalogs](https://a2ui.org/concepts/catalogs/)
- [CopilotKit A2UI Guide](https://docs.copilotkit.ai/generative-ui/a2ui)
- [CopilotKit Built-in Agent A2UI Notes](https://docs.copilotkit.ai/built-in-agent/generative-ui/a2ui)
- [CopilotKit AG-UI Backend Overview](https://docs.copilotkit.ai/backend/ag-ui)
