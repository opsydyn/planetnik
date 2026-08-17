# Phase 1 compatibility-removal fixture matrix

Last verified: 2026-08-16

This is the executable proof for the Phase 1 exit criterion that legacy TXT
projections can be removed without breaking the core report products. The
fixtures deliberately omit every `*.txt` projection; they retain the v2
`report_context.json` manifest and populate the canonical JSON shards used by
the route readers and Astro content loaders.

The matrix is intentionally reader-boundary evidence rather than a browser
smoke test. Static pages and hosted API routes consume the readers listed here,
so a route can only pass when its canonical input is present. The test also
asserts that the fixture contains no `*.txt` projection, including
`metrics.txt` and `contributors.txt`.

## Hosted runtime readers

Fixture and test: `apps/runtime/src/lib/__tests__/compatibility-removal-fixture.test.ts`

| Surface | Route families covered | Rows |
| --- | --- | ---: |
| Single repository | `/`, contributors (summary/detail), topology, metrics, duplication, dependencies, controls, impact, hotspots, commits, files (`size`, `age`, `churn`, `temporal`), units (`size`, `complexity`), components, coupling | 19 |
| Landscape root | overview, repositories, contributors, teams, topology, tags, security | 8 |
| Landscape repository drill-down | repository summary, metrics, commits, dependencies, duplication, hotspots, files (`size`, `age`, `churn`, `temporal`), units (`size`, `complexity`), contributors (summary/detail), topology, impact, controls, components, coupling | 19 |

The hosted trends route is an intentional snapshot-history empty state and is
not projection-backed; its existing empty-state test remains the contract.

## Static Astro loaders

Fixture and test: `apps/site/src/lib/__tests__/planetnik-loader.test.ts`

| Surface | Loader collections covered | Rows |
| --- | --- | ---: |
| Single repository | context, analysis, files (main/test), units, duplicates, dependencies, metrics, controls, hotspots, impact, findings, contributors, people dependencies, commits per extension, contributor timeline, contributor details, contributor impact, temporal dependencies | 19 |
| Landscape | context, overview, repositories, contributors, teams, topology, tags, tag matrix, dependency alerts, dependency health | 10 |

## Verification command

```bash
bun test \
  apps/runtime/src/lib/__tests__/report-datasets.test.ts \
  apps/runtime/src/lib/__tests__/compatibility-removal-fixture.test.ts \
  apps/site/src/lib/__tests__/planetnik-loader.test.ts
```

The focused command passed with 64 tests and 124 expectations on the date
above. The full repository suite also passed (`946` tests). TXT parsing and
export remain available for v1 datasets and migration; this matrix proves
that they are no longer required by the current core route surfaces.
