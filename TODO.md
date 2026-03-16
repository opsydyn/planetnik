# Planetnik — Parity TODO

Tracking remaining gaps between Java Sokrates and the TypeScript Planetnik port.
Goal: **100% parity on core backend** — analysis engine, data models, data exporters, CLI.
Visual/HTML report generation is out of scope per [ADR-0003](docs/adr/0003-backend-only-parity-astro-frontend.md).

Current state: **501 tests, 36 test files, 1194 assertions** — all green.

---

## Status: Core Backend Parity Complete

All core backend items have been ported:

- [x] **Data Exporters** — `DataExporter`, `DataExportUtils`, `DependenciesExporter`, `DuplicationExporter`, `FileListExporter`, `UnitListExporter`, `MetricsTrendExporter` + all DTO interfaces
- [x] **String Operations** — `ComplexOperation` handles all ops (extract, remove, replace, append, prepend, trim, uppercase, lowercase) with multi-param support
- [x] **Aspect/Decomposition** — `MetaRulesProcessor`, `GroupingRule`, `MetaDependencyRule`, `DerivedConcern`, `DependenciesFinder`, `DependencyFinderPattern`
- [x] **Duplication subsystem** — `DuplicationDependenciesHelper`, `AspectDuplication`, `ExtensionDuplication`, `DuplicateRangePair(s)`
- [x] **Scoping/Conventions** — `ConcernConventions`, `CustomConventionsHelper`, `CustomScopingConventions`, `CustomExtensionConventions`
- [x] **Analysis Orchestration** — `CodeAnalyzer` pipeline with all 9 analyzers (Basics, LogicalDecomposition, Concerns, FileSize, Units, FileHistory, Contributors, Duplication, Controls)
- [x] **Catalogs** — `StandardSecurityAspects`
- [x] **File History** — `ComponentUpdateHistory`, `FileHistoryComponentsHelper`
- [x] **Core** — `CodeConfigurationUtils`, `ReferenceAnalysisResult`
- [x] **Cleaners** — `CodeBlockParser`, `CommentsCleanerUtils`
- [x] **Contributors** — `ContributorsImport`, `GitContributorsUtil`
- [x] **Search** — `CleanedFoundText`, `SearchResultDependencies`

---

## Next: Astro Frontend Architecture

Ready to plan the Astro web app that will consume the exported JSON data.
Key data files produced by the export layer:
- `analysisResults.json` — summary metrics
- `files_main.json` / `files_test.json` — file listings with component/concern mapping
- `units.json` — function/method-level metrics
- `duplicates.json` / `unit_duplicates.json` — duplication instances
- `dependencies.json` — logical dependency graph
- `metrics.txt` — all metric values
- `contributors.txt` — contributor statistics
- `temporal_dependencies*.txt` — file co-change data
- Per-component/aspect file lists

---

## Out of Scope

- **Language analyzer implementations** (`lang/` package) — deferred, using `DefaultLanguageAnalyzer` for now
- **HTML report generators** — Astro frontend replaces Java HTML rendering (see [ADR-0003](docs/adr/0003-backend-only-parity-astro-frontend.md))
- **Landscape HTML reports** — all `LandscapeReport*` classes, visualization generators
- **Chart/visualization rendering** — `VisualizationTools`, `ForceGraphExporter`, racing bar charts, etc.
- **Report utilities** — `AnimalIcons`, `PromptsUtils`, `ZipUtils`, HTML templates
- **JavaFX GUI** (`codeexplorer`) — Astro web UI in Phase 2
- **Performance optimization** — correctness first
