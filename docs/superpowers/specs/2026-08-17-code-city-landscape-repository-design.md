# Landscape Repository Code City — Design

**Date:** 2026-08-17  
**Status:** Approved for implementation  
**Depends on:** [Code City WebGL UI design](2026-08-16-code-city-ui-design.md)

## Goal

Expose the existing Code City decision surface inside each landscape repository
drilldown without introducing landscape-wide aggregation or a second renderer.

The public route is:

```text
/landscape/repositories/[repo]/code-city
```

The route must use the same canonical v2 model and shared renderer as the
single-repository `/code-city` route. A landscape-root Code City remains out of
scope.

## Architecture

The Astro route obtains its repository identity and static paths from the
existing landscape repository collection. It reads that repository's canonical
JSON files from the existing landscape repository data directory, converts the
records through the shared `toCodeCitySnapshotInput` boundary, and builds a
`CodeCityModel` with the existing `buildCodeCityModel` function.

The route renders the existing `CodeCityView` island with an evidence base path
under the repository drilldown. The existing landscape repository dashboard
shell gains one `Code City` item in its `Structure` section. The route is also
added to the full-reload matcher used by WebGL/graph-heavy pages.

## Canonical input boundary

The route reads only these repository-local JSON contracts:

- `report_context.json` — required v2 single-repository identity and manifest;
- `files_main.json` — required file building records;
- `files_test.json`, `units.json`, `component_dependencies.json`,
  `hotspots.json`, and `impact.json` — optional shards, included only when the
  manifest/data makes them present.

No TXT, HTML, source, or runtime parsing is introduced. The adapter preserves
declared-but-empty optional shards and leaves unavailable signals neutral,
matching the existing Code City contract.

## Route states and evidence

- **Ready:** required v2 context and `files_main.json` produce a model with the
  existing map, lenses, inspector, and table fallback.
- **Partial:** the model is valid but optional canonical shards are missing; the
  existing partial summary and accessible fallback explain the missing data.
- **Empty:** the required shard is valid but contains no files; the route uses
  the existing empty state.
- **Invalid:** the repository lacks a usable v2 context or required files; the
  route shows a bounded diagnostic and links back to the repository dashboard.

Evidence links resolve relative to the repository route so existing component,
file, unit, hotspot, and impact links remain inside the selected repository.

The global landscape `/code-city` route continues to show its explicit
unsupported-landscape state; it is not added to the landscape-root menu.

## Testing and acceptance

The slice must add focused coverage for:

1. the repository Code City href and route mapping;
2. canonical repository JSON to `CodeCitySnapshotInput`, including empty
   optional-shard preservation and invalid required input;
3. the landscape repository navigation entry and WebGL reload matcher;
4. Astro/site typechecking and production build;
5. a local fixture-backed route smoke showing the repository menu item, Code
   City summary, and repository-scoped evidence base.

The implementation must not claim landscape aggregation, hosted-runtime
integration, or interaction coverage beyond the evidence actually captured.
