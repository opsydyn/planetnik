# Assessment: porting `apps/site` to FoldKit as a parallel `apps/foldkit-site`

Date: 2026-11-10. Reviewed against `planetnik@940add8` (local working tree) and
`opsydyn/fold-kit-experiments@HEAD` (read through the GitHub API) plus the
published npm metadata for `foldkit`, `@foldkit/ui`, `@opsydyn/astro-foldkit`
and `@opsydyn/foldkit-viz`.

Scope of this document: assessment only. No code was changed.

## Work receipt

- **result:** complete
- **claim:** The port is viable and smaller than it looks, because Astro stays and only the React island layer is replaced (~16.3k LOC of `.tsx` across `apps/site` and `packages/report-ui`, against ~47k LOC of `.astro`/`.ts` that ports unchanged). Three hard gaps (report data grid, `@xyflow/react` topology, CopilotKit intelligence) and one hard precondition (an `effect` 4.0.6 → 4.1.x catalog bump) govern the schedule.
- **evidence:** host-captured `gh api` reads of the FoldKit repo tree, package manifests and three of its own assessments; host-captured `npm view` for peer ranges; host-captured file/LOC/island counts over `apps/site` and `packages/report-ui`; direct read of `packages/astro-foldkit/src/{index,server,server-render,types}.ts`.
- **remaining uncertainty:** FoldKit SVG force-graph and data-grid behaviour at planetnik's real row/node counts is unmeasured. The chart-scaffolding module that Phase 3 needs has not been scoped.
- **next:** scope the shared chart-scaffolding module, then build the Phase 2 pilot page. Phase 0 is **done** — both preconditions verified; see the two amendments at the end of this document. One claim made in amendment 2's first draft (title clobbering) was wrong and is withdrawn there.

## 1. What is actually being replaced

The framing "replace Astro with FoldKit" overstates the change. `@opsydyn/astro-foldkit`
is an Astro *renderer*, not an Astro replacement: Astro keeps owning routing, the
document, content collections, assets and the build. FoldKit replaces **React islands**.

Measured surface (host-captured `find`/`wc`):

| Area | `.astro` | `.tsx` | `.ts` | `.css` |
| --- | --- | --- | --- | --- |
| `apps/site/src` | 80 files / 19,538 LOC | 28 / 7,663 | 81 / 14,325 | 8 / 1,671 |
| `packages/report-ui/src` | 29 / 6,655 | 34 / 8,628 | 48 / 7,262 | 8 / 2,921 |

So the React surface to be ported is ~16.3k LOC; the Astro pages, the loaders,
`content.config.ts` and `src/lib` (~47k LOC) are framework-free and port by copy.

Island density in `apps/site/src/pages`: 94 `client:` directives (50 `client:load`,
43 `client:visible`, 1 `client:only`). The components behind them are concentrated:
`HorizontalBarChart` (15), `DonutChart` (12), `DistributionChart` (12),
`TreemapChart` (3), then one each of `TopologyGraph`, `DependencyMatrix`,
`BigBallOfMudChart`, `GlobalSearch`, `PublicVideoToggle`. `packages/report-ui`
adds ~20 more of the same chart components inside its `views/*.astro`.

Crucially, data preparation already happens in Astro frontmatter and reaches the
island as serialized props — see `apps/site/src/pages/units/complexity.astro`,
which computes `distData`, `scatterData` and `complexityRows` in the frontmatter
and passes them to four islands. That is exactly the shape FoldKit's
`lazyApp` + `init(props)` contract expects, so the port is prop-for-prop rather
than a data-flow redesign.

## 2. Capability parity matrix

Verified against the FoldKit repo tree, `@opsydyn/foldkit-viz@0.16.0`'s export
map, `@foldkit/ui@0.170.0`'s export list, and FoldKit's own 74-app demo gallery
(`apps/web/src/apps/*`) and 50-component UI set (`apps/web/src/ui/*`).

| planetnik dependency | Used for | FoldKit-side answer | Verdict |
| --- | --- | --- | --- |
| `@visx/*` (axis, grid, group, heatmap, scale, shape, tooltip) | `HorizontalBarChart`, `DonutChart`, `DistributionChart`, `LineChart`, `ScatterPlot`, `Treemap`, `DependencyMatrix`, `CommitHeatmap` | `@opsydyn/foldkit-viz` publishes **geometry and scales**, not chart components. The polished components in the FoldKit demo (`apps/web/src/ui/*`) depend on an unpublished app-local `ui/shared` module | **PARTIAL — corrected by the spike**, see amendment 2 |
| `@base-ui/react` | dialogs, popovers, selects, tooltips in report shell | `@foldkit/ui@0.170.0` — headless accessible `dialog`, `select`, `popover`, `tooltip`, `combobox`, `listbox`, `menu`, `tabs`, `nav`, `switch`, `slider`, `checkbox`, `calendar`, `toast`, `disclosure`, `progress`, `meter`, `fieldset` | **Direct** |
| `three` + `CodeCityView.tsx` / `CodeCityCanvas.tsx` (~1.2k LOC) | WebGL code-city (ADR-0019) | `@opsydyn/effect-three` + `@opsydyn/effect-three-foldkit` (+ `-troika` labels), with `effect-three-city` and `packages/effect-three-samples/src/city` as working precedent | **Direct** — published |
| `fuse.js` (`GlobalSearch.tsx`, 380 LOC) | site-wide search (ADR-0005) | Framework-agnostic; re-host the same index in a FoldKit view | **Direct** |
| `@phosphor-icons/react` | icons | `astro-icon` (already a site dependency) or inline SVG | **Direct** |
| `@effect/atom-react` | UI state trial (ADR-0004) | Superseded — FoldKit's Model/update owns this | **Removed**, a real simplification |
| `d3-hierarchy` | treemap/tree layouts | `@opsydyn/foldkit-viz/hierarchy` (`hierarchy`, `treeLayout`, `packLayout`) | **Direct** |
| `@tanstack/react-table@9` (`ReportDataGridInner.tsx`, ~500 LOC) | the report data grid on most report pages | No equivalent package. FoldKit has `apps/web/src/ui/shared/accessible-table.ts` and a chart-local `dataTable` in `foldkit/cartesian` — neither is a sortable/filterable/paginated grid | **GAP — highest risk** |
| `@xyflow/react` + `@dagrejs/dagre` (`TopologyGraph.tsx`, ~1,460 LOC) | topology / dependency graph editor | `@opsydyn/foldkit-zloz` (+ `-elk`, `-force`) covers the diagram loop and **was published to npm at 0.3.0 on 2026-11-11** — see amendment 3. FoldKit's own React Flow parity review still lists open gaps: no per-item deletion flags, no viewport culling, no partial-overlap marquee, world-relative (not parent-relative) child coordinates | **AVAILABLE, with parity gaps** |
| `@react-sigma/core` + `sigma` + `graphology*` (`ForceGraphClient.tsx`, ~500 LOC; ADR-0008) | WebGL force-directed graphs | `@opsydyn/foldkit-viz/simulation` (Barnes-Hut) + the `force-graph` demo app and `ui/force-graph`. Rendering is SVG through `HtmlBuilder`, not WebGL | **PARTIAL — perf unmeasured** |
| `@copilotkit/react-core` + `react-ui` (`IntelligenceChat.tsx`, `IntelligencePanel.tsx`, `useChartActions.tsx`, `useNavigationAction.tsx`; ADR-0013/0014/0015) | intelligence view against `apps/copilot-runtime` | FoldKit's `agent-analysis` app is an AG-UI reference over a deterministic synthetic fixture; its own doc says it "does not claim full AG-UI client compliance, automatic retry, a backend run registry or provider integration" | **GAP — needs a new transport** |

## 3. Bounded-context review

**Proposed change:** add `apps/foldkit-site`, a second Astro app that progressively
takes over `apps/site`'s pages using FoldKit islands, leaving `apps/site` untouched.

**Affected contexts**

- `apps/site` — the app being stranglered. Static output, `base: "/planetnik"`, `experimental.incrementalBuild`, `build.concurrency: 1`, a `prebuild` step (`materialize-action-queue`), and Astro `env` schema for `PLANETNIK_*` data dirs.
- `packages/report-ui` — **shared with `apps/app`**, not site-private. `apps/app` is the hosted SSR app (better-auth, `@astrojs/node`, eden/elysia, `@copilotkit/a2ui-renderer`) and consumes report-ui from ~35 call sites.
- `packages/common`, `packages/analyzer` — `effect` consumers, reached by the version precondition.
- `apps/copilot-runtime` — the intelligence backend the CopilotKit islands talk to.

**Allowed dependencies:** `apps/foldkit-site` → `@planetnik/common`; `apps/foldkit-site` → a new `packages/report-view-foldkit`; both site apps → a shared data-layer package.

**Suspicious dependencies**

1. **`apps/foldkit-site` → `packages/report-ui`.** report-ui is co-owned by `apps/app`. If the new app edits it to suit FoldKit, it changes `apps/app`'s UI. It must not. The FoldKit views belong in a *new* package (`packages/report-view-foldkit`) that mirrors report-ui's export surface, so report-ui stays frozen for `apps/app`.
2. **Copying the data layer.** `src/loaders/planetnik-loader.ts` (25KB), `src/lib/*` (~14.3k LOC of `.ts`) and `content.config.ts` are the real asset here and the thing most likely to drift between two long-lived apps. There is already precedent for this failure: `apps/site/src/components` holds near-identical local copies of report-ui components (`TopologyGraph.tsx` 1,460 vs 1,456 LOC; `ForceGraphClient.tsx` 523 vs 466; `ReportDataGridInner.tsx` 476 vs 506). A second copy of the loaders would repeat that at 10× the size. **Extract the data layer into a package consumed by both apps before copying anything.**
3. **Two renderers in one app.** Verified safe by construction: `packages/astro-foldkit/src/server.ts` claims a component only when it carries `__foldkit === true` or `__foldkitPage === true`, so `@astrojs/react` keeps everything else. One constraint: `claimPageResult` throws on a second FoldKit `definePage` owner per Astro result — one FoldKit page owner per route.

**Data ownership and boundaries:** unchanged. Analysis JSON stays owned by `packages/analyzer`/the CLI; Astro content collections stay the read model; islands receive serialized props and own only view state. No transaction boundary is crossed.

**Anti-corruption needs:** the FoldKit island props contract is the seam. Define it in `packages/report-view-foldkit` as `effect/Schema` types, decoded in `init`, so a loader change breaks at the boundary rather than inside a view.

**Verdict: `safe with noted risk`** — conditional on (a) report-ui staying frozen, (b) the data layer being extracted rather than copied.

## 4. Decision challenge

**Trigger:** framework change, external dependency addition, shared package contract, deployment and CI change.

**Proposal and claims.** Claim 1: FoldKit + `foldkit-viz` can reproduce planetnik's report visuals. Claim 2: a parallel app is a safer migration path than in-place island swaps. Claim 3: the result is simpler — one state model (TEA) instead of React hooks plus `@effect/atom-react`, and one dependency family instead of visx + xyflow + sigma + base-ui + TanStack.

**What the existing platform already owns.** Astro already owns routing, SSG, content collections, assets, fonts and islands, and it keeps owning them. React already renders every chart today, working. Nothing in the current site is broken.

**Durable differentiated value left for this repo.** Three things, and only three: (1) removing the React/Effect state split that ADR-0004 called a trial; (2) collapsing five visualisation dependency families into one that the same author maintains; (3) putting chart geometry in pure, testable functions instead of component internals — which matters for a tool whose whole product is trustworthy measurement.

**Strongest counterargument.** Every FoldKit-side dependency is pre-1.0 and version-locked. `@opsydyn/astro-foldkit@0.9.3` pins `foldkit >=0.170.0 <0.171.0` — a single minor FoldKit release requires a matching integration release before planetnik can move. `foldkit-viz@0.16.0` pins `foldkit >=0.167.0 <0.171.0`. The `zloz` family that would replace `@xyflow/react` is **not published at all**. Against that, `@visx/*`, `@xyflow/react`, `sigma` and TanStack Table are shipping today and already pass planetnik's build. The port buys coherence and pays in release-coupling risk on a dependency with one maintainer.

**Claim-to-evidence map**

| Claim | Current evidence | Gap | Required evidence |
| --- | --- | --- | --- |
| Charts reproduce | `foldkit-viz@0.16.0` export map covers every scale/shape/layout the visx components use; 50 UI chart components and 74 demo apps exist in-repo | No planetnik chart has been rendered through it | Port `DistributionChart`, `DonutChart`, `ScatterPlot` and compare against the current page |
| Renderers coexist | **Resolved 2026-11-10.** Spike builds and both island kinds hydrate with independent state on one page | None | — (see amendment 2) |
| Report data grid | Only `accessible-table.ts` and a chart-local `dataTable` exist | No sort/filter/paginate grid, no virtualization | Build the grid for `/units/complexity`'s real row count and measure |
| Topology | `zloz` core + ELK/force adapters exist in-repo with a published parity review | Unpublished; review lists open interaction gaps | npm publication, or an explicit decision to vendor |
| Force graph perf | `simulation` (Barnes-Hut) + `force-graph` app | SVG rendering vs sigma's WebGL; FoldKit's own review states it did not measure performance | Node/edge counts from a real landscape run, rendered both ways |
| Intelligence | `agent-analysis` AG-UI demo with SSE endpoint | Fixture-backed, explicitly not a compliant AG-UI client; planetnik's backend is Mastra (ADR-0014) | A spike against `apps/copilot-runtime`, or a decision to keep this island in React |
| `effect` compatibility | **Resolved 2026-11-10.** Catalog bumped to `4.1.3`; typecheck, 1,350 tests and all ten build targets green | None | — (see amendment below) |

**Minimum credible slice.** `apps/site/src/pages/units/complexity.astro` ported to FoldKit in a new app. It pairs three charts (`DistributionChart`, `DonutChart`, `ScatterPlot`) with `ReportDataGrid`, so one page exercises both the thing that should be easy and the thing that has no equivalent. If the data grid cannot be built here, it cannot be built for the other ~15 report pages either.

**Stop conditions.** Any of these falsifies the plan as written:

1. ~~`effect@4.1.x` breaks `packages/analyzer` or `apps/cli`~~ — **cleared.** Both typecheck clean and all 575 of their tests pass on `4.1.3`.
2. The FoldKit report grid needs materially more code than the 500-LOC React one, or misses sort/filter/paginate at `/units/complexity`'s real row count → keep `ReportDataGrid` as a retained React island indefinitely and narrow the port's claim.
3. ~~A dual-renderer build fails~~ — **cleared.** The spike builds and runs both renderers on one page. Site build time/memory at planetnik's scale is still unmeasured.
4. ~~`zloz` is still unpublished when the topology slice starts~~ — **cleared 2026-11-11.** The family is on npm at 0.3.0. The remaining risk is parity, not availability: if the open interaction gaps block the topology page, it stays React.

**Verdict: `proceed`** — for Phase 0 through Phase 2 only (spike, seam, pilot slice). Phases 3+ are explicitly **not** authorised by this verdict; they are gated on the pilot's evidence and on the stop conditions above.

**Rationale.** The claims are cheap to falsify and the first three phases are reversible — a spike app and one ported page, with `apps/site` untouched and shipping. The expensive, irreversible commitments (the full chart migration, the topology rewrite, the intelligence transport) all sit behind evidence that does not exist yet. There is no reason to decide them now and good reason not to.

## 5. Strangler-fig plan

### Phase 0 — preconditions (throwaway, no new app committed)

1. ~~Bump the root catalog: `effect` 4.0.6 → 4.1.x~~ — **done 2026-11-10.** Verified green across all packages. See the amendment below.
2. Spike `apps/foldkit-site` as a scratch app: `astro@7.4.2`, `@opsydyn/astro-foldkit@0.9.3`, `@astrojs/react@7.1.1`, `foldkit@0.170.0`, `@opsydyn/foldkit-viz@0.16.0`. One page, one FoldKit `lazyApp` island, one React island. Confirm it builds and both hydrate.
3. Decide the hosting question (see Phase 7) before writing production code, because it changes the app's `base`.

### Phase 1 — the seam

4. Extract `apps/site/src/loaders`, `src/lib`, `src/data` and `content.config.ts` into `packages/report-data`, consumed by *both* apps. Keep `apps/site` green through this; it is a pure move. Without it the two apps drift, and the existing component duplication between `apps/site/src/components` and `packages/report-ui/src` is proof that they will.
5. Create `packages/report-view-foldkit` with `effect/Schema`-typed island props mirroring report-ui's export names. **Do not touch `packages/report-ui` — `apps/app` depends on it.**
6. Create `apps/foldkit-site` properly: copy `astro.config.mjs` (keeping the `env` schema, fonts, `incrementalBuild`, `concurrency: 1`), the `prebuild` script and `public/`. Swap `react()` for `foldkit()`, but keep `react()` registered for retained islands.

### Phase 2 — pilot slice (the falsifier)

7. Port `DistributionChart`, `DonutChart`, `ScatterPlot` onto `foldkit-viz/chart/cartesian` + `chart/theme`, as pure geometry plus a FoldKit view.
8. Build the report data grid in FoldKit over `@foldkit/ui`'s `listbox`/`combobox`/`tabs` primitives. Measure against the real row count.
9. Ship `/units/complexity` in `apps/foldkit-site` and diff it against the live page. **Checkpoint: re-read the stop conditions here.**

### Phase 3 — the bulk (chart pages)

10. The ~15 pages that are charts + grid only: `files/{age,churn,size,temporal}`, `units/{size,complexity}`, `commits`, `concerns`, `metrics`, `overview`, `contributors`, `duplication`, `controls`, `components`, `hotspots`, `impact`, `dependencies`, `trends`. `HorizontalBarChart`, `DonutChart` and `DistributionChart` alone cover 39 of the 94 island uses, so porting three components unlocks most of this phase.
11. `GlobalSearch` (fuse.js index is portable), `PublicVideoToggle`, `ThemeSwitcher`, icons → `astro-icon`.

### Phase 4 — code city

12. `CodeCityView`/`CodeCityCanvas`/`CodeCityInspector`/`CodeCityStoryRail` → `@opsydyn/effect-three` + `-foldkit` + `-troika`, using the repo's `effect-three-city` sample as the reference. Keep ADR-0019's decision surface intact.

### Phase 5 — graphs (gated)

13. `BigBallOfMudChart`, `SecurityBallChart`, `SharedPackagesGraph` → `foldkit-viz/simulation` + `shape/*`. Measure node counts first; if SVG cannot hold the largest real graph, keep sigma as a retained React island and record it.
14. `TopologyGraph` + `TemporalDependenciesExplorer` → `zloz`. **Unblocked as of 2026-11-11**: `@opsydyn/foldkit-zloz`, `-elk`, `-force` and `-mermaid` are on npm at 0.3.0. Scope this slice against the published parity gaps rather than assuming React Flow equivalence.

### Phase 6 — intelligence (gated, may never complete)

15. `IntelligenceChat`/`IntelligencePanel` → AG-UI, following `apps/web/src/apps/agent-analysis`, against a new AG-UI endpoint on `apps/copilot-runtime`. This supersedes ADR-0013 and needs its own ADR. The honest default is that this island stays React.

### Phase 7 — cutover

16. Per-page edge routing between the two apps is a hosting capability, not an app one. GitHub Pages (per `docs/deployment/how-to-deploy-the-site-with-github-actions.md`) cannot do it; the Azure/container path can. Until that is settled, "strangler fig" here means *the new app grows to parity while the old one serves*, with the swap happening at `base`/deploy level — not request-level interleaving. Decide this in Phase 0.
17. When parity holds: flip the deploy target, keep `apps/site` for one release, then delete it and fold `packages/report-view-foldkit` into the name `report-ui` once `apps/app` has also moved (or keep both permanently if `apps/app` stays React).

### Cross-cutting costs

- **Toolchain divergence.** FoldKit's repo uses `oxlint`/`oxfmt` and vitest; planetnik uses Biome and `bun:test`. Keep Biome and `bun:test` in `apps/foldkit-site`; FoldKit's packages do not require its linters. Expect FoldKit's published code style to read differently from the rest of planetnik.
- **`knip`.** `bun run knip --treat-config-hints-as-errors` will flag the transitional duplication. Add `apps/foldkit-site` to `knip.json` with the transition in mind rather than loosening the global config.
- **Testing.** FoldKit's pure geometry and `update` functions are directly unit-testable with `bun:test`, which suits CLAUDE.md's TDD convention better than the current component tests (`ReportDataGridInner.test.tsx`, `code-city/__tests__/*`). This is a genuine win and should be used as the acceptance mechanism for each ported component: port the geometry with tests first, then the view.

## 6. Recommendation

**`needs follow-up`.** Precondition (a), the `effect` 4.1.x catalog bump, is now
green across every package. Do not create `apps/foldkit-site` as a committed app
until (b), the dual-renderer spike, also builds. That spike can still kill the
plan cheaply, which is the point of doing it before the app exists.

One structural note that holds regardless of the verdict: extract the data layer
into a package before copying it. It is the largest and most valuable part of
`apps/site`, and two divergent copies of a 25KB loader plus 14k LOC of `lib` would
cost more than the entire React port.

## Amendment — 2026-11-10: `effect` catalog bump (complete)

The Phase 0 precondition is done. The root manifest now carries a named `effect`
catalog, and all thirteen effect-family references across the seven workspace
packages that use them resolve through it:

```json
"catalogs": {
  "effect": {
    "effect": "4.1.3",
    "@effect/atom-react": "4.1.3",
    "@effect/language-service": "^0.87.5",
    "@effect/platform-browser": "4.1.3",
    "@effect/platform-node": "4.1.3"
  }
}
```

The runtime packages are pinned exactly, because the family releases in lockstep
(`effect`, `@effect/platform-node`, `@effect/platform-browser` and
`@effect/atom-react` were all at `4.1.3` on this date). `@effect/language-service`
versions independently and stays a range. `4.1.3` satisfies FoldKit's `~4.1.0`
peer requirement, so the blocking constraint on `foldkit@0.170.0`,
`@foldkit/ui@0.170.0` and `@opsydyn/astro-foldkit@0.9.3` is cleared.

Verification, all host-captured:

| Check | Result |
| --- | --- |
| `bun install` | Lockfile updated; one resolved `effect@4.1.3`, no duplicate copies under `node_modules/.bun` |
| `tsc --noEmit` — `common`, `analyzer`, `reports`, `cli`, `runtime`, `report-ui` | No output, exit 0 |
| `astro check` — `apps/site` | 0 errors, 0 warnings, 28 hints (163 files) |
| `astro check` — `apps/app` | 0 errors, 0 warnings, 36 hints (155 files) |
| `bun run test` (filtered, 7 packages) | 1,204 pass / 0 fail |
| `bun test` in `apps/site` | 146 pass / 0 fail |
| `bun run build` (10 targets) | All exit 0; site built 52 pages |
| `bun x biome check` on the 8 edited manifests | Clean |

Two notes on the evidence rather than the change:

- **`apps/site` has no `test` script**, so its 146 tests across 32 files are not
  reached by `bun run test` at the root. They were run directly for this
  verification and pass. This is a pre-existing coverage hole in the root test
  command, not something the bump introduced.
- The site and docs builds emit `[WARN] [content] The collection "…" does not
  exist or is empty` and `[astro-icon] Failed to load icons from "src/icons"`.
  These reflect the absence of local analysis data and are unrelated to `effect`,
  but no pre-change baseline build was captured to prove they predate it.

Nothing was committed. The hints reported by `astro check` are CopilotKit
deprecation notices that predate this change.

## Amendment 2 — 2026-11-10: dual-renderer spike (complete)

A throwaway Astro app was built outside the repository with planetnik's own
versions (`astro@7.4.2`, `@astrojs/react@7.1.1`, `react@19.3.1`) alongside
`@opsydyn/astro-foldkit@0.9.3`, `foldkit@0.170.0`, `@opsydyn/foldkit-viz@0.16.0`
and `effect@4.1.3`, with `base: "/planetnik"` to mirror the site. It hosts three
islands on one page: a FoldKit counter, a FoldKit horizontal bar chart receiving
props from Astro frontmatter, and a React counter.

### What the spike confirmed

**Coexistence works, and works properly.** The build emits two distinct
`renderer-url` values and separate code-split chunks per island. All three
islands hydrate; the FoldKit counter and the React counter hold independent
state on the same page (verified at 2 and 1 respectively). No console errors.
The FoldKit island emits the documented `<div data-foldkit-island="true"></div>`
mount shell while the React island is server-rendered to real HTML, so the two
hydration models coexist without interfering.

**The chart path works, at comparable cost.** A horizontal bar chart — the
single most-used island in `apps/site` (15 call sites) — came to **152 LOC**
against the existing React/visx `HorizontalBarChart.tsx` at **240 LOC**, with
props arriving from Astro frontmatter exactly as they do today. Hover
interaction drives the SVG through the Model/update loop as expected. The
FoldKit version is, however, missing the tooltip, keyboard navigation and
theming that the React one has, so treat the two numbers as the same order of
magnitude rather than a saving.

### Corrections to this document's earlier claims

**`foldkit-viz` publishes geometry, not chart components.** This is the most
important correction. FoldKit's own `apps/web/src/ui/bar-chart` does not use
`chart/bars` or `foldkit/cartesian` at all — it imports `band`, `linear` and
`linearTicks` from `math/scale` and then relies on `apps/web/src/ui/shared`
for `svgRoot`, `xCategoryAxis`, `yGridlines`, `valueTooltip`,
`withAccessibleTable`, `withAriaLive`, `arrowKeyNav` and `layoutFor`. That
`shared` module is **app code in the demo repository, not a published package**
(~15 source files, ~25 KB; confirmed absent from the published `dist`). The
fifty polished chart components in the demo are therefore not consumable.

Phase 3 consequently needs a prior step: build or copy (the repo is MIT) a
shared chart-scaffolding module before porting the first chart page. Budget
that separately from the per-chart work.

**The bar geometry and the Cartesian renderers do not connect.** `chart/bars`
exports `barGeometry`, but `foldkit/cartesian`'s `barSeries` takes
`HistogramBin<T>`, not `BarRectangle<T>`, and `barGeometry` returns
`{frame, plot, domain, ticks}` rather than the `CartesianLayout` that
`chartFrame`, `grid` and `axis` require. `axis` is also numeric-only
(`format: (value: number) => string`), so categorical axes are caller-owned.
Bars are a geometry-plus-hand-rolled-SVG path today.

### Documentation defects worth reporting upstream

All three are in `opsydyn/fold-kit-experiments`, so they are fixable at source.
A fix for all three is committed on the branch
`docs/astro-foldkit-readme-schema-model`.

1. **`@opsydyn/astro-foldkit@0.9.3`'s README example is stale.** It shows
   `export const Model = null` for the `lazyApp` path. Against `foldkit@0.170.0`
   that throws `TypeError: Cannot read properties of null (reading 'ast')`
   during hydration, before first render — the island silently renders nothing
   while the rest of the page works. `Model` must be a real `effect/Schema`,
   as FoldKit's own skill asset and all 64 demo apps do. Typecheck does not
   catch it, because `AppConfigContract` types `Model` as `unknown`. The repo's
   own `docs/examples/package-skills.md` already records a baseline agent being
   misled by this same line; the skill was given a correct module and the README
   was left as it was.

2. **A custom `Props` silently drops `noMeta`.** `lazyApp<Props>` replaces the
   default `EmptyProps`, which is where the reserved `noMeta` prop is declared,
   so `<Chart client:load noMeta />` then fails with
   `Property 'noMeta' does not exist`. The skill asset works around it by
   re-declaring `readonly noMeta?: boolean | ''`, but nothing said so.

3. **The quickstart does not mention `noMeta`.** This is a discoverability gap,
   not a behavioural one — see the correction below.

### Correction to this amendment's first draft

An earlier draft of this document listed "FoldKit islands clobber the document
title" as a defect. **That was wrong, and the claim is withdrawn.** The
behaviour is intended and already documented: `@opsydyn/astro-foldkit` reserves
a `noMeta` prop for exactly this, and its README says, in terms, that without it
"the island's view tree will update the browser tab title on every render tick".
The spike reproduced the symptom only because it followed the quickstart
example, which does not use `noMeta`.

Re-tested with `noMeta` on both FoldKit islands: the page title stays
`Dual renderer spike` through counter clicks and chart hovers, while both
islands continue to update normally and the React island keeps independent
state. The mechanism works as designed.

What survives is the narrower point that the quickstart sends a new consumer
down the path that produces the symptom — which is why the upstream fix is a
documentation change, not a behavioural one. For planetnik this means pages
carrying four to eight islands need `noMeta` on each island that is not meant
to own the page title; it does not mean multi-island pages are a problem.

### Bundle weight

Measured from the built output (gzip):

| Chunk | gzip |
| --- | --- |
| FoldKit client runtime | 60.6 KB |
| `effect/Schema` chunk (pulled in by `defineMessageUnion`) | 39.5 KB |
| React client runtime | 64.3 KB |
| React island + helper | 4.6 KB |
| Both FoldKit islands | 4.5 KB |
| **Whole page, both renderers** | **169.1 KB** |

Two readings. During the transition, any page with both island kinds ships both
runtimes. Post-transition, FoldKit's floor (~100 KB gzip with Schema) is higher
than React's (~67 KB) — but FoldKit's floor already includes the charting
primitives that `@visx/*` adds on top of React's, so the comparison that decides
anything is total weight on a real report page, which this spike cannot measure.
The `effect/Schema` cost is opt-in: the counter, which uses a plain string-union
message type, does not pull it; the chart, which uses `defineMessageUnion`, does.

### What the spike did not cover

SSR via `definePage`; planetnik's real data volumes; the report data grid; build
time and memory at the site's scale (52 pages, `build.concurrency: 1`); and
anything about the topology, force-graph or intelligence islands. The spike app
lives outside the repository and nothing was added to `apps/`.

## Amendment 3 — 2026-11-11: the Zloz blocker is cleared

`@opsydyn/foldkit-zloz`, `-elk`, `-force` and `-mermaid` were published to npm at
**0.3.0** on 2026-11-11, each on the `latest` dist-tag with SLSA v1 provenance,
from the commit the `*-v0.3.0` tags point at. Verified by a registry install
outside the workspace: all four resolve and import in plain Node, and the core
installs with zero transitive dependencies and imports with no peers present.

For this port that changes one thing only: the topology slice (Phase 5, step 14)
is no longer blocked on availability. It is still gated on **parity**. FoldKit's
own React Flow review remains accurate — no per-item deletion flags, no viewport
culling, no partial-overlap marquee, and world-relative rather than
parent-relative child coordinates. `TopologyGraph.tsx` is ~1,460 LOC of
`@xyflow/react`, so that slice needs its own measurement before it is committed
to, exactly as the data grid did.

Nothing else in this assessment changes. The chart-scaffolding gap from
amendment 2 is still the governing cost for Phase 3.

## Amendment 4 — 2026-11-11: Phase 1 (the seam) is done

Three structural pieces now exist, with `apps/site` and `packages/report-ui`
still shipping unchanged behaviour.

**`packages/report-data`** — the data layer, extracted from `apps/site` rather
than copied, so the two apps cannot drift. 69 files: the loaders, the route and
derivation helpers, and the 28 content-collection definitions. 201 import lines
across 96 files in `apps/site` were rewritten to point at it.

The 877-line `content.config.ts` was split rather than duplicated: the loaders
and zod schemas moved into `report-data/lib/collections`, and each app keeps a
36-line `src/content.config.ts` that calls `defineCollection` per collection.
Astro requires that file in the app and `defineCollection` only exists on the
virtual `astro:content` module, so only the wiring is per-app. All 28
collections were verified present at runtime with working loaders and schemas.

**`packages/report-view-foldkit`** — the chart scaffolding amendment 2 showed
`foldkit-viz` does not publish, plus the first chart. `scaffold/layout` and
`scaffold/axes` are pure geometry (11 tests), `scaffold/render` holds the
FoldKit `HtmlBuilder` helpers, and `charts/horizontalBar` replaces the
React/visx `HorizontalBarChart` — the most-used island in `apps/site`, at 15
call sites. The split mirrors how `foldkit-viz` separates pure modules from its
`foldkit/` adapter, which is what makes the geometry testable without a DOM.

**`apps/foldkit-site`** — Astro 7.4.2 with both `foldkit()` and `react()`
registered, so unported islands can be retained rather than blocking a page. Its
index page prepares data in frontmatter and passes it to a FoldKit island,
exactly as `apps/site` does today. Verified in a browser: the chart renders from
`report-data`, hover drives the Model/update loop, the accessible table carries
the same values, the page title stays with Astro (`noMeta`), and the console is
clean.

Repository state: Biome clean, knip clean, 12 packages typecheck, **1,361 tests
pass**, 11 builds succeed. `apps/site` still builds the same 52 pages.

### What was deliberately left

- **Five modules stayed in `apps/site`** because they are app- or view-coupled,
  not data: `landscapeRepoContext` and `lib/search/*` read `astro:content`
  (shared packages here never do — `report-ui` reads collections nowhere);
  `landscapeCodeCityRoute` imports `@planetnik/report-ui`, which a data package
  must not depend on or `foldkit-site` would inherit React;
  `public-video-preferences` needs `@effect/platform-browser`; `iconography`
  needs an icon pack. `foldkit-site` will need equivalents for search and
  landscape context in Phase 3.
- **`report-data` does not meet the repository's own strictness bar.** Its
  `tsconfig.json` disables `exactOptionalPropertyTypes` and
  `noUncheckedIndexedAccess` and excludes `src/lib/__tests__`, matching the
  settings this code shipped under: `apps/site/tsconfig.json` extends
  `astro/tsconfigs/strict`, not `tsconfig.base.json`. Raising it surfaces **58
  pre-existing errors**. That is tracked in the package README as its own job,
  not smuggled into an extraction.
- **`apps/foldkit-site` has no tests yet** and no `test` script, because a
  script that always fails is worse than no script.

### Next

Phase 2, the pilot page `/units/complexity`. It needs `DistributionChart`,
`DonutChart` and `ScatterPlot` on the new scaffolding, and the report data grid
— still the gap with no FoldKit equivalent, and still the thing that can
falsify the port.

---

## Amendment 5 — Phase 2: the pilot page (2026-11-11)

`/units/complexity` is built in `apps/foldkit-site`, with the same four
visualisations as the `apps/site` page it mirrors. The frontmatter is a
transcription of the original: same collections, same buckets, same thresholds.
Only the components differ, which is what makes the comparison worth anything.

### What was built

**`packages/report-view-foldkit/src/tables/grid.ts`** — search, column filters,
sort and pagination as one pure function of rows and state. This is the whole of
what `@tanstack/react-table` was doing for `ReportDataGrid`, which needed four
row-model factories and five table features to express it. 18 tests.

Deriving the page rather than storing it removed **three of the React grid's
effects**: the ones repairing `pageIndex` after a filter shrank the result,
after the page size changed, and after a search changed. A page index past the
end is clamped where the page is derived, so it is a property of the function
rather than a repair applied afterwards.

**Four islands** — `charts/distribution`, `charts/donut`, `charts/scatter` and
`tables/dataGrid`. The donut's arc geometry comes from `@opsydyn/foldkit-viz`
(`shape/pie`, `shape/arc`), which is more than amendment 2 credited it with:
it publishes the shape geometry, just not the chart components.

### Verified against real data, not fixtures

The project's own CLI analysed this repository into a scratch dataset — **7,729
units** — and both apps were built against it. Every number on the page was
checked against the dataset independently rather than being read off the screen:
bucket counts 5160 / 1214 / 888 / 467 (sum 7,729), a global search for `parse`
giving 188 rows across 8 pages, a `succeed` column filter giving 47 rows.

Interactively confirmed: three-state sort cycle (none → ascending → descending →
none) with `aria-sort` and row order agreeing at each step, pagination to page 2
of 310, page-size select, column-filter toggle, filter resetting to page 1, and
hover driving the Model in all three charts. No console errors.

### The finding that matters: islands do not server-render

`lazyApp` islands emit a mount shell and nothing else. This is documented
behaviour, not a defect — `definePage` is the opt-in server-rendered path — but
it changes what the port costs, so the two pages were compared directly:

| | `apps/site` (React) | `apps/foldkit-site` (FoldKit) |
|---|---|---|
| Data grid, first page | **100 cells server-rendered** (25 rows × 4) | nothing |
| Donut / distribution / scatter | nothing — skeleton only | nothing |

The charts are **at parity**, and for a reason worth recording: `ChartCard`
gates rendering on `width > 0` from a `ResizeObserver`, which never runs during
SSR, so the React charts have never server-rendered either. They ship a loading
skeleton. The FoldKit charts need no skeleton, because a `viewBox` with no
width/height attribute scales in CSS — there is nothing to measure and no empty
first frame.

The grid is a **real regression**: its first 25 rows are in the HTML today and
would stop being. That is one component, on one path, and `definePage` addresses
it at the cost of the FoldKit app owning the whole page rather than sitting in
it as an island. Deciding that is Phase 3 work, not something to settle by
quietly accepting the loss.

### Defect found and fixed

`h.Disabled(false)` emits `disabled=""`, and an empty string is still a disabled
button to the browser. Every pagination control was dead on the first page —
`Next` and `Last` included, with 310 pages behind them. Fixed here by including
the attribute only when the button is actually disabled. FoldKit's own
`propsModule` documents `Disabled` as a property whose removal it resets, so
passing `false` producing the attribute looks like an upstream bug worth
reporting, with this as the reproduction.

A second defect, mine and cosmetic: the distribution chart's label column was a
fixed 110 units, so `26+ (very complex)` was clipped to `· (very complex)` at
the viewBox edge. The column is now sized to its longest label.

Worth knowing for anyone testing FoldKit: the runtime flushes renders
asynchronously. Reading the DOM immediately after dispatching an event reads the
previous frame — which first looked like three separate broken features, and was
none of them.

### What the pilot does not cover

- **Help tooltips.** `ChartCard` rendered a `HelpTooltip`; the islands put the
  same `chartHelp` text in the SVG description, where a screen reader reaches it
  but a sighted user cannot hover it. A FoldKit equivalent is unbuilt.
- **Tooltips do not follow the cursor.** Hover drives a readout under the chart
  instead. Deliberate — it is derived from the Model rather than from a
  portal — but it is a visible behaviour change, not a like-for-like port.
- **Cell types `link`, `code` and `status` are implemented but unexercised**;
  this page uses only `text`, `number` and `path`.
- **`apps/foldkit-site` still has no tests.** The grid's behaviour is covered by
  the pure module's 18 tests; nothing covers the islands' wiring.
- **The theme tokens come from `@planetnik/report-ui`'s published stylesheet.**
  Only CSS, so no React is pulled in, and it avoids duplicating 60 design
  tokens — but a tokens-only package is the right Phase 3 move.

### Repository state

0 lint errors, knip clean, 12 packages typecheck, **1,379 tests pass**, 11
builds succeed. `apps/site` still builds the same 52 pages.

### Verdict on the question the pilot was built to answer

The data grid *can* be built on FoldKit, and the version here is smaller and
better-tested than the one it replaces. The thing that nearly falsified the port
was not the grid — it was server rendering, which the grid exposed.

---

## Amendment 6 — `definePage` closes the SSR gap (2026-11-11)

Amendment 5 left one open question: islands do not server-render, and the data
grid's first page is in the HTML today. `definePage` answers it, and the answer
is better than parity.

### Server islands do not help, and it is worth knowing why

The obvious objection is Astro's server islands (`server:defer`). They do not
apply, and the reason is in the renderer rather than in the directive.
`renderToStaticMarkup` branches on one thing:

```js
if (isFoldkitPage(component)) return renderPage(...)
return { html: "<div data-foldkit-island=\"true\"></div>" }
```

A `lazyApp` component carries `__foldkit: true` and no `__foldkitPage`, so it
takes the second branch — a constant string, with the props never consulted.
Confirmed by calling the renderer directly against the grid island with real
props. No Astro directive reaches that decision, so deferring an island defers
an empty shell. Server islands would also require an adapter and on-demand
rendering, which a fully static report site does not have.

`definePage` is the only path to server-rendered FoldKit HTML.

### What it produces

| | bytes | `<td>` | `<circle>` | `<rect>` | grid footer in HTML |
|---|---|---|---|---|---|
| `apps/site` (React) | 2,404,809 | 100 | 0 | 0 | — |
| FoldKit islands | 1,609,290 | 0 | 0 | 0 | — |
| **FoldKit `definePage`** | 2,654,358 | **112** | **200** | **8** | **Page 1 of 310** |

It does not merely restore the grid's 25 rows. It server-renders **all three
charts as well** — 200 scatter points, the distribution bars, the donut arcs —
none of which React has ever rendered on the server, because `ChartCard` waits
for a `ResizeObserver`. The page's content, including "Page 1 of 310", is in
the HTML with JavaScript disabled.

The cost is 250KB over the React page: the Flags payload and the rendered
markup both ship. The island version is the smallest and the emptiest.

### What it costs structurally

A page owner owns the document body, so the page chrome that was Astro markup
moves into a FoldKit view, and the four components become submodels of one
application composed through `h.submodel`:

```
complexityPage/
  model.ts    Flags (the server→browser handoff) and the composed Model
  message.ts  GotDonutMessage | GotDistributionMessage | GotScatterMessage | GotGridMessage
  update.ts   each variant delegates to the component that owns that state
  view.ts     page chrome plus four h.submodel embeddings
  page.ts     definePage, with a synchronous Flags factory
```

The components did not fork to support this. Each exports its existing view
branded for embedding:

```ts
export const body = defineView<Model, Message>((model, h) => view(model, h).body)
```

One line per component, so the island path and the page path run the same code
and cannot drift. Both routes now also share one data-preparation module, for
the same reason.

Verified in the browser on the server-rendered page: hydration takes over the
existing DOM, search filters to 188 rows over 8 pages, pagination is correct,
and submodel routing is properly isolated — hovering the donut legend then
moving to a distribution bar sets the second and clears the first. No console
errors.

### One defect this surfaced

The tab title lost its project-name suffix. A page owner's `Document.title` is
written to `document.title` at hydration, so a title the Astro layout composes
is correct in the HTML and then overwritten a frame later. Fixed by giving the
page view the whole title rather than composing it in the layout. Worth
remembering: for a page owner, metadata belongs to the application, not to the
layout around it.

### Both routes are kept

`/units/complexity` (islands) and `/units/complexity-ssr` (`definePage`) are
both built, from the same data module. Keeping them side by side is what makes
the comparison above reproducible rather than a claim.

### Repository state

0 lint errors, knip clean, 12 packages typecheck, **1,379 tests pass**, 11
builds succeed. `apps/foldkit-site` builds 3 pages; `apps/site` still builds 52.

### What this changes about the plan

Phase 3 no longer has to choose between FoldKit and server-rendered reports. It
has to decide how much of a page should be one application. `definePage` is
all-or-nothing per route: a page owner owns its whole body, so a page that mixes
FoldKit with a retained React island cannot use it. For the strangler that means
a route moves to FoldKit in one step rather than component by component — which
is a real constraint on the migration order, not on the destination.

---

## Amendment 7 — correcting amendment 5's framing (2026-11-11)

Amendment 5 called server rendering "the thing that nearly falsified the port".
Measured, that was overstated, and the wording confused two separate things.

### This is a static site, and it stays one

Nothing here needs a server. The `definePage` route carries
`export const prerender = true` and is built to a static
`dist/units/complexity-ssr/index.html` with no adapter. The question was never
SSR-at-request-time versus static; it is whether the **static HTML already
contains the content** or an empty shell that JavaScript fills in. Calling that
"server rendering" was accurate to the renderer's vocabulary and misleading
about the deployment.

### Measured cost of putting content in the HTML

| | HTML | JS | total | content in HTML |
|---|---|---|---|---|
| islands | 1,609,290 | 353,902 | **1,982,779** | none |
| `definePage` | 2,654,358 | 356,326 | **3,030,271** | all of it |

The JavaScript is the same either way — the FoldKit runtime ships regardless —
so the entire difference is **+1.05MB of markup, a 53% heavier page**, for
content that is hydrated over moments later.

### The finding that outranks both

Both routes serialise **all 7,729 rows** into the page in order to display 25.
In the islands build that payload *is* the 1.6MB. In the `definePage` build the
Flags blob begins at byte 579 and the first `<td>` does not appear until byte
1,609,651, so the data is read before any rendered content either way.
`apps/site` has exactly the same problem inside its 2.4MB.

Shipping a 7,729-row dataset to paginate 25 rows is a much larger cost than
either rendering strategy, it predates this port, and no rendering choice fixes
it. It belongs on the list ahead of this decision.

### Revised position

Content-in-HTML is **a trade, not a blocker**:

- Worth it when the reports are crawled, linked or read without JavaScript, or
  when a blank first paint on a slow connection is unacceptable.
- Not worth it for an internal, JavaScript-always report site, where it buys
  little and costs a megabyte.

The grid's 25 server-rendered rows in `apps/site` are a real difference from
the islands build, but on a static internal site they are a small one. The
earlier framing should not be read as a reason to prefer `definePage` by
default.

### Is the island shell an upstream issue?

Deliberate, and defensible. `PageConfigContract` adds one thing to
`AppConfigContract`: `Flags: PageFlagsSchema`, a validated JSON-serialisable
handoff. An island's `Props` carries no such contract, so running `init(props)`
on the server could execute Commands or touch browser-only resources with no
validated payload for the client to resume from. The shell is the safe default.

It is still a gap worth raising: every other Astro renderer server-renders its
islands, and an integration that does not quietly forfeits the main benefit of
Astro on a static site. The shape of the request is "let an island opt into
pre-rendering when its props are a Schema" — the contract `definePage` already
has. That is a feature request against `@opsydyn/astro-foldkit`, not a bug.

---

## Amendment 8 — Idiomatic islands upstream, and where the speed actually is (2026-11-11)

Two questions: can `@opsydyn/astro-foldkit` be brought in line with how
idiomatic Astro renderers treat islands, and can the page be made faster than
either route currently is. Both were measured rather than reasoned about.

### Correction: the Flags contract is not the blocker

Amendment 7 said the island shell follows from `PageConfigContract` requiring a
`Flags` schema that `AppConfigContract` has no equivalent for. That is wrong,
and two checks against FoldKit 0.170.0 show it.

First, `renderToString` has four overloads, and the last one takes a config with
**no `Flags` at all**:

```ts
renderToString<Model, Message>(
  config: ApplicationConfig<Model, Message>,   // { init: () => …, view: … }
  options?: RenderOptions,
): Effect.Effect<RenderedApplication, RenderError>
```

An island config is `init: (props) => …`. Closing over the props satisfies that
signature in one expression. Rendering the pilot's own island modules through it
works today, with the package unchanged:

| probe | result |
|---|---|
| `renderToString({ init: () => Donut.init(props), view: Donut.view }, { isHydratable: false })` | 2,635 bytes, 4 `<path>` arcs |
| same for `Scatter`, `runtimeId: "scatter"` | 42,263 bytes, 200 `<circle>` |
| donut again, hydratable, **no Flags schema** | stamps `data-foldkit-app="donut"`, emits no flags script, no error |

Second, hydration does not insist on a Flags payload either.
`runtime/makeApplication.js` sets `isFlagsRequired: false` for a config that
declares no `Flags` codec, and `resolveHydrationHandoff` only demands the
payload when that flag is true.

So the server side of island rendering is already supported, and the Flags
schema is a convenience for round-trip fidelity, not an admission ticket. I had
the right conclusion ("the shell is deliberate") from the wrong reason.

### The actual blocker is one assertion, in FoldKit core

`runtime/hydrationHandoff.js`:

```js
export const findDocumentHydration = (container, isFlagsRequired) => {
  const stampedRoots = Array.fromIterable(document.querySelectorAll(`[${FOLDKIT_APP_ATTRIBUTE}]`))
  assertRuntimeIdsAreUnique(stampedRoots)
  assertSinglePageApplication(stampedRoots)
```

The query is **document-wide**, not scoped to the container, and
`assertSinglePageApplication` throws on `length > 1`. It does not throw softly:
every refusal calls `containRefusedPage`, which marks `document.body` inert and
opens a nondismissable modal shield. A second stamped root does not degrade the
page, it bricks it.

The justification is in the source comment:

> Distinct ids do not make two hydrated applications independent, which is not a
> supported arrangement: each page-owning application rewrites the document's
> metadata and installs document-wide navigation listeners.

That is sound for pages and does not describe islands. An island suppresses
metadata writes through `noMeta` — which exists for exactly this reason — and
receives navigation through the explicit `navigation` port that
`attachNavigationBridge` wires up, not through document-wide listeners. The two
behaviours the limit protects against are the two an island already does not
have.

This also relocates the request. It is not primarily an `astro-foldkit` feature
request; the adapter cannot route around a document-wide assertion in the
runtime it calls. Container-scoped hydration has to come from FoldKit.

### Three asks, in increasing cost

1. **Scope hydration to the container.** `findDocumentHydration` already
   receives `container`; let an embedded caller opt into
   `container.querySelectorAll` and skip `assertSinglePageApplication`. The
   per-root `runtimeId` uniqueness check stays — it is the one that genuinely
   prevents two roots stealing each other's state.
2. **An `embed`-shaped hydration entry.** `Runtime.embed` already models a
   host-owned lifecycle with dispose and ports. A `hydrate` option on it, or
   `Runtime.hydrateEmbedded`, would give N islands per document the adoption
   path `hydrate` gives one page. This is the change that makes FoldKit islands
   behave like React islands under Astro.
3. **Opt-in SSR in the adapter.** Only once (1) or (2) exists is there anything
   for `astro-foldkit` to expose, and then it is small: branch
   `renderToStaticMarkup` on an island that declares itself pre-renderable, and
   call the embedded-hydration entry in `client.ts` instead of `embed`.

Worth noting for whoever picks this up: `.superpowers/sdd/2026-08-18-astro-foldkit-opt-in-server-rendering`
and its design doc show island SSR was scoped out deliberately, not overlooked.
The design states the client-only island contract as a compatibility
requirement. Ask (3) reopens a settled decision, so it should be argued on the
measurements below, not on "every other renderer does it".

### Available today with no upstream change at all

Tier 1 and 2 are needed for *hydration*. Static pre-rendering needs neither.
`isHydratable: false` plus the existing `embed` path gives content in the HTML
now:

- server: `renderToString({ init: () => config.init(props), view: config.view }, { isHydratable: false })` in place of the hard-coded shell
- client: unchanged — `embed` replaces the container's contents on boot

The markup is rendered twice and the server copy is discarded at embed. Because
both come from the same pure `init` and `view` over the same props, the
replacement is byte-identical and the swap is invisible. No hydration contract,
no build id, no single-root limit, any number of islands. The cost is the double
render and the added markup.

### Where the speed actually is

The grid rows were extracted from the built pages and re-encoded. All numbers
are the real pilot dataset, 7,729 rows.

Served pages:

| route | raw | gzip | brotli |
|---|---|---|---|
| islands | 1,609,290 | **89,640** | 60,539 |
| definePage | 2,654,358 | **175,682** | 114,919 |

A second correction to amendment 7, which quoted raw bytes: compressed,
`definePage` is not 53% heavier, it is **96% heavier**. Markup compresses less
well than the repetitive JSON it replaces, so the raw comparison flattered it.

The four island props attributes on the islands page:

| island | raw | gzip |
|---|---|---|
| donut | 714 | 313 |
| distribution | 989 | 353 |
| scatter | 19,359 | 2,472 |
| **data grid** | **1,580,071** | **83,722** |

**The grid's props attribute is 98% of the raw page and 93% of the compressed
page. All three charts together are 3.1KB gzip.** Every rendering-strategy
question concerns the 7% and the payload question concerns the 93%.

Breaking that attribute down:

| component | raw | gzip |
|---|---|---|
| as served (HTML-escaped attribute) | 1,580,071 | 83,722 |
| unescaped, Astro's `[0, value]` wrapping | 1,115,297 | 78,366 |
| plain JSON array-of-objects | 960,717 | 76,572 |
| columnar JSON (one array per field) | 620,691 | **52,453** |
| first 25 rows only | 3,604 | **510** |

Astro's props channel costs 619,354 raw bytes of pure overhead on this payload —
464,774 from `&quot;` escaping and 154,580 from wrapping every one of the 30,916
scalars as `[0, value]`. Under gzip that overhead almost vanishes (7,150 bytes),
so it is worth knowing but not worth chasing. For contrast, `definePage`'s flags
ride in a `<script type="application/json">` and need no attribute escaping:
969,629 raw / 78,942 gzip for the same data.

Columnar encoding is a real win that survives compression: **-31% gzip** on the
payload, for a change confined to how `grid.ts` reads its rows.

The ladder, in what a browser actually downloads:

| | gzip | vs now |
|---|---|---|
| definePage | 175,682 | +96% |
| islands, as built | 89,640 | — |
| islands + columnar rows | ~65,500 | **-27%** |
| islands + 25 rows inline, rest fetched | ~13,600 | **-85%** |
| islands + 25 rows + all 3 charts pre-rendered | ~16,700 | **-81%** |

The last row is the recommendation, and it is worth saying what it combines:
the charts are pre-rendered because at 3.1KB they are nearly free and they are
what the reader looks at first; the grid ships one page of rows and fetches the
rest, because at 83.7KB it is the whole problem.

### Recommendation

1. **Fix the grid payload.** Ship the first page inline and fetch the remaining
   rows as a columnar JSON chunk on first interaction — search, sort or paging.
   85% off the compressed page, no upstream change, no rendering-strategy
   decision. This is the only item here that is worth doing on its own.
2. **Static pre-render the charts** via `isHydratable: false`. Roughly twelve
   lines in `renderToStaticMarkup`, no FoldKit change, and it puts the charts in
   the HTML — which neither `apps/site` nor the islands build manages today
   (`apps/site` ships a skeleton because `ChartCard` gates on a `ResizeObserver`
   width).
3. **Raise ask (1) or (2) with FoldKit**, not `astro-foldkit`, with the
   container-scoping argument and the `noMeta`/port evidence that the single-root
   justification does not cover islands.
4. **Drop `definePage` for this page.** It doubles the compressed weight to
   solve a problem that the payload fix solves better. Keep the route as the
   worked example it is.

Item 1 is a `report-view-foldkit` and page-data change. Items 2 and 3 are
upstream. Nothing here needs the two to land together.

---

## Amendment 9 — the grid payload, fixed (2026-11-11)

Amendment 8's first recommendation, implemented. The grid now inlines one page
of rows and fetches the rest from a static JSON file.

### What changed

| file | change |
|---|---|
| `packages/report-view-foldkit/src/tables/grid.ts` | `GridRowsPayload`, `encodeGridRows`, `decodeGridRows` (columnar codec) and `partialPage` (page metrics for a dataset still arriving) |
| `packages/report-view-foldkit/src/tables/dataGrid.ts` | `rowsUrl` / `totalRows` props; `pendingRows` / `loadError` in the Model; a `LoadRows` Command; `LoadedRows` / `FailedToLoadRows` / `RetriedRowLoad` messages; a loading state in the view |
| `apps/foldkit-site/src/pages/data/complexity-rows.json.ts` | new prerendered endpoint serving the columnar payload |
| `apps/foldkit-site/src/lib/complexityData.ts` | `complexityGridRows`, `complexityGridFields`, `loadUnits`, and one page inlined instead of all rows |
| `apps/foldkit-site/src/apps/complexityPage/{model,update}.ts` | forwards the grid's Commands, which the page previously discarded |
| `apps/foldkit-site/src/pages/units/complexity.astro` | passes the split payload; both `client:visible` islands moved to `client:load` (see below) |

19 new tests in `src/__tests__/gridRows.test.ts`, written first. The full suite
is 1400 passing; `bun run typecheck` and `bun run lint` are clean.

### Measured

Both builds on the same 8,203-row dataset, the second built by inlining all rows
again so the comparison is like for like.

| | all rows inline | one page inline | change |
|---|---|---|---|
| islands page, gzip | 90,855 | **6,292** | **-93.1%** |
| definePage page, gzip | 178,556 | **16,545** | **-90.7%** |
| rows chunk, gzip | — | 53,905 | separate request |

For a reader who loads the page and then uses the grid, totals fall 33.7%
(islands) and 60.5% (definePage). For one who reads the charts and the first
page and leaves — most readers of a report — the saving is the full 93%.

This also changes amendment 8's verdict on `definePage`. It cost +96% when the
rows travelled inline; it now costs 10KB gzip more than the islands build, which
is a different kind of decision.

### A second finding: `client:visible` cannot work for a FoldKit island

The scatter and the grid were `client:visible` and **never hydrated at all**.
Astro's directive explains itself:

```js
/**
* Hydrate this component when one of its children becomes visible
* We target the children because `astro-island` is set to `display: contents`
* which doesn't work with IntersectionObserver
*/
for (const child of el.children) io.observe(child)
```

A FoldKit island's only child is the empty mount shell the renderer emits. It
measures 0×0, a zero-area target never reports `isIntersecting`, and the
callback never runs. Both islands sat as empty shells with no error anywhere.

This is not caused by the payload change — the shell has always been empty — and
it is the sharpest argument yet for amendment 8's upstream ask. The previous
arguments were about bytes and crawlers. This one is a standard Astro directive
that silently does nothing, and an island that server-rendered would have size
and would work. Both islands are now `client:load`, which the smaller payload
makes cheap; the Astro page records why.

### Known limitations

- `/data/complexity-rows.json` is a fixed path with no content hash, so a CDN
  must revalidate it or a deploy can serve the previous build's rows against the
  new page. The endpoint sets only a content type; caching is the host's call.
- While the rows are in flight the grid's controls are disabled rather than
  operating over the 25 rows in hand. A grid cannot honestly sort or search a
  dataset it does not have, and the window is one request after paint.
- A failed fetch keeps the first page and offers Retry. That path has unit
  coverage for the state transitions but was not exercised against a real
  network failure.
- Only this page is split. Every other grid in `apps/site` still inlines its
  whole dataset, and `apps/site` itself is untouched.
- The dataset used for these measurements was rebuilt from the previous build's
  own rows, the original analysis directory having been cleared. It is the same
  data the earlier amendments measured, plus the 474 rows the content collection
  holds beyond what that build had inlined.

---

## Amendment 10 — the charts, pre-rendered (2026-11-11)

Amendment 8's second recommendation, implemented. The three charts now put
their marks in the HTML. This one needed an upstream change, so it lands in two
repositories.

### Upstream: `@opsydyn/astro-foldkit`

An island opts in through `lazyApp`'s new second argument:

```ts
export default lazyApp<Props>(() => import('./main'), { prerender: true })
```

`renderToStaticMarkup` then loads the module and fills the same mount shell it
has always emitted, instead of leaving it empty:

```ts
const renderIsland = async (component, props) => {
  const config = await component.load()
  const rendered = await renderFoldkitIslandMarkup(config, props)
  return { html: islandMount(rendered.html) }
}
```

`renderFoldkitIslandMarkup` closes the props into `renderToString`'s no-Flags
overload and passes `isHydratable: false`. That is the whole mechanism, and it
is what makes the change safe rather than clever:

- no Flags schema is needed, because the props Astro already serialises for the
  client are the same values;
- no root stamp is emitted, so `Runtime.hydrate`'s one-root rule never applies
  and any number of pre-rendered islands share a document;
- no build identity is involved, because nothing hydrates the markup;
- the client is untouched — `embed` replaces the mount's contents exactly as it
  replaced an empty mount.

Opting in and failing fails the render rather than falling back to the empty
mount: an island whose `init` touches a browser-only resource must leave the
option off, and an author who asked for markup should be told they did not get
it. 13 tests in `test/unit/server.test.ts` cover the branch, the per-props
output, the absent stamp, the absent build id and the fail-closed path; the
package's 99 tests, typecheck, lint and build are green, and the README
documents the option.

Three files changed: `src/types.ts` (the option and the marker),
`src/define-app.ts` (the second argument), `src/server-render.ts` (the
renderer), `src/server.ts` (the branch).

### Measured

| | gzip |
|---|---|
| all rows inline, no chart pre-render | 90,855 |
| rows split, no chart pre-render | 6,292 |
| **rows split + 3 charts pre-rendered** | **12,082** |

The charts cost 5,790 gzip bytes. Against the page this work started from, the
two changes together are **-86.7%**, and the HTML now contains 200 `<circle>`,
4 `<path>` and 8 `<rect>` where it previously contained none — including in
`apps/site`, whose React `ChartCard` gates on a `ResizeObserver` width and so
ships a skeleton.

Verified in a browser: marks identical before and after the islands boot, so
the replacement is invisible; the donut still responds to hover; the grid still
searches 8,203 rows down to 271.

### This needs a release before it can ship

`apps/foldkit-site` depends on the published `@opsydyn/astro-foldkit@0.9.3`,
which has no `prerender` option. The chart modules now pass one, so planetnik
will not typecheck against 0.9.3. Everything above was verified against a local
build of the upstream package copied over
`node_modules/.bun/@opsydyn+astro-foldkit@0.9.3+*/node_modules/@opsydyn/astro-foldkit/dist`,
and `bun install` erases that. The upstream repository releases through
release-please from conventional commits, so the sequence is: land the
`feat(astro-foldkit):` commit, take the release, bump
`apps/foldkit-site/package.json`.

### A correction about the loading state

While verifying this I reported a `definePage` hydration defect: the grid stuck
on "Loading all 8,203 rows…", with probes showing the Command running, the
response arriving in full, and the Model folding `LoadedRows` while the DOM
never changed. The donut was inert on the same page, which seemed to confirm it.

That was wrong, and so was the explanation offered the turn before (a stale
cached bundle). Both routes settle in 400ms and are fully interactive when
loaded in a **fresh foreground browser tab**. The stuck readings came from tabs
opened in the background or left idle, where the render loop does not run: the
Model updates and nothing paints, which looks exactly like a hydration failure
from the outside. No defect, in `definePage` or anywhere else.

Worth keeping as a testing note, since it cost an hour: a FoldKit page under
automation must be measured in a foreground tab, and "the Model changed but the
DOM did not" is the signature of a throttled tab before it is the signature of
a bug.

### Known limitations

- The scatter dominates the added markup: of roughly 48KB raw, about 42KB is
  its 200 `<circle>` elements. A chart with many marks is where pre-rendering
  stops being nearly free, and the option is per-island so that is a per-chart
  decision.
- Only `apps/foldkit-site`'s three charts opt in. The data grid does not,
  though it would work; its first page is 25 rows, which is cheap, and it was
  outside what was asked for.
- The render runs for every page build. On this page that is three extra
  FoldKit renders and the build stayed under a second, but a site with many
  pre-rendered islands pays it per page.

---

## Amendment 11 — corrected figures, and the dataset (2026-11-11)

Running the site on a dev server exposed two things the built-output
measurements had hidden.

### The dataset amendments 9 and 10 measured was wrong

Both said 8,203 rows. The real dataset is **7,729**.

`unitsLoader` keys each entry `` `${relativeFileName}:${startLine}` ``. The
units file reconstructed in amendment 9 gave every unit `startLine: 1`, so all
units in a file collapsed onto one id and the collection held 476 entries — one
per file. That did not show up in the builds, because Astro's content layer had
cached the original dataset's 7,729 entries and the reconstruction added 474 new
ids on top: 8,203 was a stale store plus a lossy reconstruction, not a dataset.

The units file now carries per-file start lines, so all 7,729 ids are distinct,
and it lives at `_planetnik/reports/data/` — the loader's default, and
gitignored — so the dev server and the build need no `PLANETNIK_DATA_DIR`.

### Corrected measurements

All three variants built from the same 7,729-row dataset:

| | raw | gzip |
|---|---|---|
| all rows inline, no chart pre-render | 1,609,145 | 89,638 |
| rows split, no chart pre-render | 35,167 | **6,302** |
| rows split + 3 charts pre-rendered | 83,198 | **12,098** |
| rows chunk (separate request) | 620,714 | 52,541 |

- splitting the rows: **-93.0%**
- pre-rendering the three charts: **+5,796 gzip bytes**
- both together: **-86.5%**
- a reader who then uses the grid: 89,638 → 64,639, **-27.9%**

These sit within a few hundred bytes of the figures in amendments 9 and 10, so
the conclusions there stand; the percentages were measured before and after on
one store either way. The absolute row count in those amendments is wrong, and
the 8,203 in their tables should read 7,729.

### An unexplained condition, stated as observed

A page sometimes does not boot when it is a **repeat navigation in a tab that
has already loaded a FoldKit page**: the markup is correct (it is server
output), the grid stays on its loading state, and nothing responds. Loading the
same URL in a fresh tab settles in 400ms every time, on both routes.

Amendment 10 attributed this to background tab throttling. That is not right
either — it reproduces in a visible, foregrounded tab. The earlier probe
evidence still holds: the Command runs, the response arrives in full, and the
Model folds `LoadedRows` while the DOM does not change. What makes a repeat
navigation different from a first one, across a document boundary, is not
established, and is worth isolating before relying on either route.

It does not affect a first visit, which is what a reader does.

### Running it

`.claude/launch.json` defines a `foldkit-site` configuration, so the dev server
starts with no arguments and serves `http://localhost:4321/planetnik`. The two
routes are `/units/complexity` (islands) and `/units/complexity-ssr`
(`definePage`). Open each in its own fresh tab.

---

## Amendment 12 — Astro bumped, and what it was worth (2026-11-11)

### What moved

| package | from | to |
|---|---|---|
| `astro` | 7.4.2 | 7.4.11 |
| `@astrojs/react` | 7.1.1 | 7.1.8 |
| `@astrojs/node` | 11.1.9 | 11.1.12 |
| `@astrojs/starlight` | 0.42.7 | 0.42.10 |
| `@astrojs/check` | 0.9.12 | already latest |

All patch or minor within the same major, across `apps/{app,docs,site,foldkit-site}`
and `packages/report-data`. All four Astro apps build, typecheck is clean, lint
is clean, and the 1400 tests pass. The pilot page was re-verified in the
browser on 7.4.11: settles in 400ms, charts pre-rendered, donut interactive,
search takes 7,729 rows down to 270.

### It bought almost nothing, which is the useful part

The islands page is **83,198 raw before and after**, and 12,098 → **11,935**
gzipped. 163 bytes, which is noise.

The two changes that looked promising did not apply:

- **7.4.10** stops the client build emitting and preloading duplicate
  stylesheets for hydrated islands that share modules. This page has four
  islands all importing `report-view-foldkit`, so it looked like a direct hit.
  It builds **one** stylesheet and the page carries **one** `<link>` — before
  and after. There was no duplication to remove.
- **7.4.3** drops scoped styles of unused components re-exported from barrel
  files. Nothing on this page matches that shape.

The rest of 7.4.3–7.4.11 is bug fixes, two of which touch islands and neither
of which this site hit: a `server:defer` TypeError on network failure (7.4.3)
and hydrated islands blocked under `security.csp.scriptDirective.strictDynamic`
(7.4.9). `experimental.parallelPrerender` from 7.4.0 shortens build time
without changing output, and is opt-in.

### The finding that matters for the plan

**Nothing between 7.4.2 and 7.4.11 touches the island props serialisation**,
the `astro-island` element, the client directives or the hydration runtime, and
there is no 7.5 or 8.0 — 7.4.11 is the top of the tree.

So the 619,354 raw bytes of encoding overhead measured on the grid's props
attribute in amendment 8 — 464,774 from `&quot;` escaping and 154,580 from
wrapping all 30,916 scalars as `[0, value]` — is not something Astro is about
to fix. Splitting the payload out of the attribute was the right move, not a
workaround for a problem that was about to go away on its own.

Take the bump as hygiene. It is not a lever, and nothing in the current Astro
line is.
