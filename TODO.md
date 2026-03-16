# Planetnik — Parity TODO

Tracking remaining gaps between Java Sokrates and the TypeScript Planetnik port.
Goal: **100% parity on core backend** — analysis engine, data models, data exporters, CLI.
Visual/HTML report generation is out of scope per [ADR-0003](docs/adr/0003-backend-only-parity-astro-frontend.md).

Current state: **439 tests, 34 test files, 1038 assertions** — all green.

---

## High Priority — Core functionality gaps

### 1. Data Exporters (~19 classes)
The JSON export layer that feeds the Astro frontend. Java `reports/dataexporters/` has full export infrastructure.

- [ ] `DataExportUtils` — central export orchestration
- [ ] **Dependencies** — `DependenciesExporter`, `DependenciesExportInfo`, `DependencyExportInfo`, `DependencyAnchorExportInfo`, `SourceFileDependencyExportInfo`
- [ ] **Duplication** — `DuplicationExporter`, `DuplicationExportInfo`, `DuplicateExportInfo`, `DuplicateFileBlockExportInfo`
- [ ] **Files** — `FileListExporter`, `FilesExportInfo`
- [ ] **Trends** — `MetricsTrendExporter`, `MetricsTrendInfo`, `ReferenceResultsLoader`, `ValueSnapshotPair`
- [ ] **Units** — `UnitListExporter`, `UnitsExportInfo`, `UnitInfoExport`

### 2. String Operations (~10 classes)
Used by `MetaRulesProcessor` for analysis logic. Only `ComplexOperation` and `OperationStatement` exist in TS.

- [ ] `StringOperation` — base interface
- [ ] `StringOperationFactory` — creates operation instances from config
- [ ] **Implementations:** `AppendOperation`, `ExtractRegexOperation`, `LowerCaseOperation`, `NoOpsOperation`, `PrependOperation`, `RemoveRegexOperation`, `ReplaceOperation`, `TrimOperation`, `UpperCaseOperation`

### 3. Aspect/Decomposition (analysis logic)
Core analysis logic for component grouping, meta-rules, and dependency detection.

- [ ] `MetaRulesProcessor` — processes meta-rules for derived decompositions
- [ ] `GroupingRule` — rules for grouping components
- [ ] `MetaDependencyRule` — meta-level dependency rules
- [ ] `DerivedConcern` — derived cross-cutting concerns
- [ ] `DependenciesFinder` + `DependencyFinderPattern` — pattern-based dependency detection

---

## Medium Priority — Gaps in existing subsystems

### 4. Duplication subsystem
Data models and analysis logic for duplication tracking.

- [ ] `DuplicationDependenciesHelper` — duplication-based dependency detection
- [ ] `AspectDuplication` + `ExtensionDuplication` — aspect/extension-level duplication tracking
- [ ] `DuplicateRangePair` + `DuplicateRangePairs` — range-based duplicate tracking

### 5. Scoping/Conventions
Config processing for custom analysis scoping rules.

- [ ] `ConcernConventions` — concern naming conventions
- [ ] `CustomConventionsHelper` — custom convention processing
- [ ] `CustomScopingConventions` + `CustomExtensionConventions` — user-defined scoping rules

### 6. Analysis Orchestration
- [ ] `AnalysisEngine` — orchestration interface for analysis pipeline

---

## Low Priority — Minor utilities and edge cases

### 7. Catalogs
- [ ] `StandardSecurityAspects` — predefined security concern patterns

### 8. File History
- [ ] `ComponentUpdateHistory` — per-component change tracking
- [ ] `FileHistoryComponentsHelper` — component-level history aggregation

### 9. Core
- [ ] `CodeConfigurationUtils` — config utility methods
- [ ] `ReferenceAnalysisResult` — reference/baseline analysis for trends

### 10. Cleaners
- [ ] `CodeBlockParser` — nested code block parsing
- [ ] `CommentsCleanerUtils` — shared comment cleaning helpers

### 11. Contributors
- [ ] `ContributorsImport` — external contributor data import
- [ ] `GitContributorsUtil` — git contributor extraction helpers

### 12. Search
- [ ] `CleanedFoundText` — cleaned search results
- [ ] `SearchResultDependencies` — dependency-aware search results

---

## Out of Scope

- **Language analyzer implementations** (`lang/` package) — deferred, using `DefaultLanguageAnalyzer` for now
- **HTML report generators** — Astro frontend replaces Java HTML rendering (see [ADR-0003](docs/adr/0003-backend-only-parity-astro-frontend.md))
- **Landscape HTML reports** — all `LandscapeReport*` classes, visualization generators
- **Chart/visualization rendering** — `VisualizationTools`, `ForceGraphExporter`, racing bar charts, etc.
- **Report utilities** — `AnimalIcons`, `PromptsUtils`, `ZipUtils`, HTML templates
- **JavaFX GUI** (`codeexplorer`) — Astro web UI in Phase 2
- **Performance optimization** — correctness first
