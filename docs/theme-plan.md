# Dark Theme And Theme Switcher Plan

## Goal

Add a light, dark, and system theme switcher to `apps/site` with these constraints:

- Astro owns the theme at the document level.
- React islands inherit the effective theme cleanly.
- No flash of incorrect theme on first paint.
- No hydration mismatch between server and client.
- The implementation works with `ClientRouter` and Astro page swaps.

## Current State

The site is still effectively light-theme only.

- [Dashboard.astro](/Users/alan/Projects/planetnik/apps/site/src/layouts/Dashboard.astro) defines the core color tokens inline in `:root`.
- [toggle-theme.ts](/Users/alan/Projects/planetnik/apps/site/public/toggle-theme.ts) already contains a useful preference model:
  - `light`
  - `dark`
  - `machine`
- React chart components still use hardcoded light-theme tokens in [theme.ts](/Users/alan/Projects/planetnik/apps/site/src/components/charts/theme.ts).

That means there is no single theme system yet. Astro owns layout colors, but React charts and islands do not consume theme from the same source.

## Decision

Use this architecture:

1. Astro sets the effective theme on `<html>`.
2. Global CSS variables define all design tokens for both themes.
3. React components consume CSS-variable-backed theme tokens.
4. A tiny inline head bootstrap script applies the correct theme before first paint.
5. A small client script manages user preference and keeps the UI toggle in sync after Astro swaps.

The important boundary is:

- Astro is the source of truth for the active theme.
- React reads theme state and theme tokens.
- React does not own or mutate global theme state directly.

## Theme Model

Use two attributes on `<html>`:

- `data-theme="light" | "dark"`
- `data-theme-preference="light" | "dark" | "system"`

This avoids ambiguity:

- `data-theme` is always the effective applied theme.
- `data-theme-preference` preserves user intent.

Also set:

- `style.colorScheme = "light"` or `"dark"`

That helps form controls, built-in browser UI, and reduces flicker.

## No-Flash Strategy

The no-flash path should be:

1. Add a very small inline script in the `<head>` of [Dashboard.astro](/Users/alan/Projects/planetnik/apps/site/src/layouts/Dashboard.astro).
2. That script runs before styles paint.
3. It reads stored preference from `localStorage`.
4. It resolves `system` via `matchMedia("(prefers-color-scheme: dark)")`.
5. It sets `document.documentElement.dataset.theme`.
6. It sets `document.documentElement.dataset.themePreference`.
7. It sets `document.documentElement.style.colorScheme`.

This script must not wait for:

- `DOMContentLoaded`
- React hydration
- Astro island hydration

It should be plain inline JS in the head.

## CSS Token Strategy

Move global theme tokens out of light-only `:root` assumptions and into theme-aware variables.

Recommended structure:

- `:root` for shared sizing and non-theme constants
- `html[data-theme="light"]` for light color tokens
- `html[data-theme="dark"]` for dark color tokens

Example token families:

- `--color-bg`
- `--color-card`
- `--color-text`
- `--color-text-muted`
- `--color-border`
- `--color-accent`
- `--color-sidebar`
- `--color-sidebar-text`
- `--color-sidebar-active`
- `--color-sidebar-hover`
- `--chart-accent`
- `--chart-accent-light`
- `--chart-text`
- `--chart-text-muted`
- `--chart-border`
- `--chart-card`
- `--chart-bg`
- `--chart-bar-bg`
- `--chart-green`
- `--chart-yellow`
- `--chart-orange`
- `--chart-red`
- `--chart-palette-1` through `--chart-palette-6`

The layout should consume the same token families that charts use.

## React Propagation Strategy

The cleanest propagation path is not React context first. It is CSS variables first.

### Preferred approach

Refactor [theme.ts](/Users/alan/Projects/planetnik/apps/site/src/components/charts/theme.ts) so it exports CSS-variable-backed tokens instead of fixed hex values.

For example:

- `accent: "var(--chart-accent)"`
- `text: "var(--chart-text)"`
- `border: "var(--chart-border)"`

That keeps current chart component APIs mostly unchanged while letting the theme flow from Astro to React naturally.

### When React actually needs the current mode

Only introduce a small hook if a component needs to branch by theme mode, for example:

- canvas rendering
- theme-specific gradients
- image asset swaps

Use a lightweight helper such as:

- `useEffectiveTheme()`

It should read `document.documentElement.dataset.theme` after mount and subscribe to a custom theme-change event.

Do not build a large React theme provider unless we actually need component logic to branch on theme in many places.

## Theme Toggle UX

Use the existing preference model from [toggle-theme.ts](/Users/alan/Projects/planetnik/apps/site/public/toggle-theme.ts), but modernize the integration.

### UI

Add a compact theme control in both:

- desktop sidebar header
- mobile top bar

Use three states:

- `Light`
- `Dark`
- `System`

The control should be visible and persistent, but not noisy.

### Behavior

- Persist preference in `localStorage`.
- Reapply after `astro:after-swap`.
- Listen for OS theme changes only when preference is `system`.
- Dispatch a custom event after theme changes, for example:
  - `window.dispatchEvent(new CustomEvent("planetnik:theme-change", { detail: { theme, preference } }))`

That gives React islands an idiomatic subscription point without making them owners of theme state.

## Astro Integration

Update [Dashboard.astro](/Users/alan/Projects/planetnik/apps/site/src/layouts/Dashboard.astro) in three parts:

1. Head bootstrap script
2. global theme token definitions
3. theme toggle UI mount points

Important:

- keep the bootstrap inline in the head
- keep the interactive toggle script small and resilient to `ClientRouter`
- avoid SSR branching on `window`

## Implementation Phases

### S

Foundations only.

- Add head bootstrap script in [Dashboard.astro](/Users/alan/Projects/planetnik/apps/site/src/layouts/Dashboard.astro)
- Add `data-theme` and `data-theme-preference` handling
- Add light/dark CSS variable sets
- Add `color-scheme`

Success criteria:

- no theme flash on reload
- no hydration warnings
- light and dark body/layout colors work

### M

Wire the toggle.

- Refactor [toggle-theme.ts](/Users/alan/Projects/planetnik/apps/site/public/toggle-theme.ts) into the site’s actual theme controller
- Add the theme toggle UI to the layout
- Rebind safely after `astro:after-swap`
- Emit a custom theme-change event

Success criteria:

- user can switch themes from any page
- preference persists
- system mode follows OS changes

### L

Propagate into React charts and cards.

- Refactor [theme.ts](/Users/alan/Projects/planetnik/apps/site/src/components/charts/theme.ts) to CSS-variable tokens
- Verify charts, force graphs, tables, tooltips, and drawers all inherit correctly
- Fix any chart-specific contrast issues

Success criteria:

- charts render correctly in both themes
- no chart hardcodes remain for light-only colors
- tooltip and help layers remain legible

### XL

Polish and theming coverage.

- syntax highlighting / code blocks
- image and logo treatment if needed
- SVG or canvas-specific adjustments
- theme-aware screenshots and docs

## Risks

### 1. Hydration mismatch

Risk:

- server renders light while client immediately flips to dark

Mitigation:

- do not derive effective theme in React render
- apply theme in the head bootstrap before paint

### 2. Chart contrast regressions

Risk:

- some visx and SVG layers may use light-specific fills or borders

Mitigation:

- move chart colors to CSS variables
- test coupling, force graph, heatmap, donut, and bar charts explicitly

### 3. Astro swap drift

Risk:

- toggle UI state gets stale after `ClientRouter` page swaps

Mitigation:

- use `astro:after-swap`
- keep the controller idempotent

## Testing Checklist

- hard refresh in light preference
- hard refresh in dark preference
- first load with `system` while OS is light
- first load with `system` while OS is dark
- change OS theme while app is open in `system`
- navigate with `ClientRouter`
- verify React charts after navigation
- verify tooltips and mobile drawers
- verify no hydration warnings in console

## Recommended First Slice

Start with the foundation only:

1. add head bootstrap
2. add theme variables
3. make layout colors theme-aware

Do not start with chart refactors first. The document-level theme must be correct before React propagation is worth touching.
