# Planetnik — Parity TODO

Tracking remaining gaps between Java Sokrates and the TypeScript Planetnik port.
Goal: **100% parity on everything except language analyzer implementations.**

Current state: **439 tests, 34 test files, 1038 assertions** — all green.

---

## High Priority — Core functionality gaps

### 1. Data Exporters (~19 classes)
The Java `reports/dataexporters/` package has full export infrastructure for dependencies, duplication, files, trends, and units. The TS side only has `DataExporter.ts` and `FileExportInfo.ts`.

- [ ] `DataExportUtils` — central export orchestration
- [ ] **Dependencies** — `DependenciesExporter`, `DependenciesExportInfo`, `DependencyExportInfo`, `DependencyAnchorExportInfo`, `SourceFileDependencyExportInfo`
- [ ] **Duplication** — `DuplicationExporter`, `DuplicationExportInfo`, `DuplicateExportInfo`, `DuplicateFileBlockExportInfo`
- [ ] **Files** — `FileListExporter`, `FilesExportInfo`
- [ ] **Trends** — `MetricsTrendExporter`, `MetricsTrendInfo`, `ReferenceResultsLoader`, `ValueSnapshotPair`
- [ ] **Units** — `UnitListExporter`, `UnitsExportInfo`, `UnitInfoExport`

### 2. Report Core Infrastructure (~7 classes)
Base classes and orchestration for the report generation pipeline.

- [ ] `AnalysisEngine` — orchestrates analysis + report generation
- [ ] `ReportGenerator` — abstract base class for all generators
- [ ] `ReportsContainer` — holds all generated reports
- [ ] `SummaryUtils` — summary section generation
- [ ] `Scope` — report scope definition
- [ ] `Figure` — figure/chart container
- [ ] `ReportRenderingClient` — rendering callback interface

### 3. String Operations (~10 classes)
The Java `operations/` package has a `StringOperation` interface with factory and implementations. Only `ComplexOperation` and `OperationStatement` exist in TS.

- [ ] `StringOperation` — base interface
- [ ] `StringOperationFactory` — creates operation instances from config
- [ ] **Implementations:** `AppendOperation`, `ExtractRegexOperation`, `LowerCaseOperation`, `NoOpsOperation`, `PrependOperation`, `RemoveRegexOperation`, `ReplaceOperation`, `TrimOperation`, `UpperCaseOperation`

### 4. Landscape Report Generators (~20 classes)
The Java landscape reporting is extensive. Only `LandscapeReportGenerator.ts` and data/utils exist in TS.

- [ ] `LandscapeContributorsReport` — contributor analysis across repos
- [ ] `LandscapeIndividualContributorsReports` — per-contributor detail pages
- [ ] `LandscapeReportContributorsTab` — contributors tab in main report
- [ ] `LandscapeReportPeopleTopologyTab` — people topology visualization
- [ ] `LandscapeRepositoriesReport` — repositories overview
- [ ] `LandscapeRepositoriesTagsReport` — tags-based repo grouping
- [ ] `LandscapeRepositoriesTagsMatrixReport` — tags matrix view
- [ ] `LandscapeRepositoriesTagsLine` — single tag line rendering
- [ ] `LandscapeAnalysisCommands` — landscape CLI command helpers
- [ ] **Landscape utils:** `ContributorPerExtensionHelper`, `ContributorsExtractor`, `CorrelationDiagramGenerator`, `Counter`, `ExtractStringListValue`, `Force3DGraphExporter`, `LandscapeVisualsGenerator`, `RacingLanguagesBarChartsExporter`, `RacingRepositoriesBarChartsExporter`

---

## Medium Priority — Gaps in existing subsystems

### 5. Report Generators (visualization helpers)
- [ ] `RacingComponentsBarChartsExporter` — animated bar chart racing
- [ ] `VisualizationTools` — zoomable circles, sunburst, tree visualization
- [ ] `ForceGraphExporter` — force-directed graph export

### 6. Report Utilities (minor)
- [ ] `AnimalIcons` — contributor avatar icons
- [ ] `PromptsUtils` — AI prompt section generation (ChatGPT/Claude links)
- [ ] `ZipUtils` + `ZipEntryContent` — zip archive generation for reports

### 7. Aspect/Decomposition
- [ ] `ComponentGroup` — grouping of components for visualization
- [ ] `MetaRulesProcessor` — processes meta-rules for derived decompositions
- [ ] `GroupingRule` — rules for grouping components
- [ ] `MetaDependencyRule` — meta-level dependency rules
- [ ] `DerivedConcern` — derived cross-cutting concerns
- [ ] `DependenciesFinder` + `DependencyFinderPattern` — pattern-based dependency detection

### 8. Common/Infrastructure
- [ ] `BarChart` + `PieChart` — chart data model classes (used by ChartUtils, DuplicationReportUtils)
- [ ] `VisualizationTemplate` + `ExplorerTemplate` — HTML templates for interactive visualizations
- [ ] `GraphvizUtil` + `GraphvizSettings` — Graphviz rendering configuration

### 9. Duplication subsystem
- [ ] `DuplicationDependenciesHelper` — duplication-based dependency detection
- [ ] `AspectDuplication` + `ExtensionDuplication` — aspect/extension-level duplication tracking
- [ ] `DuplicateRangePair` + `DuplicateRangePairs` — range-based duplicate tracking

### 10. Scoping/Conventions
- [ ] `ConcernConventions` — concern naming conventions
- [ ] `CustomConventionsHelper` — custom convention processing
- [ ] `CustomScopingConventions` + `CustomExtensionConventions` — user-defined scoping rules

---

## Low Priority — Minor utilities and edge cases

### 11. Catalogs
- [ ] `StandardSecurityAspects` — predefined security concern patterns (module is empty in TS)

### 12. File History
- [ ] `ComponentUpdateHistory` — per-component change tracking
- [ ] `FileHistoryComponentsHelper` — component-level history aggregation

### 13. Core
- [ ] `CodeConfigurationUtils` — config utility methods
- [ ] `ReferenceAnalysisResult` — reference/baseline analysis for trends

### 14. Cleaners
- [ ] `CodeBlockParser` — nested code block parsing
- [ ] `CommentsCleanerUtils` — shared comment cleaning helpers

### 15. Contributors
- [ ] `ContributorsImport` — external contributor data import
- [ ] `GitContributorsUtil` — git contributor extraction helpers

### 16. Search
- [ ] `CleanedFoundText` — cleaned search results
- [ ] `SearchResultDependencies` — dependency-aware search results

---

## Out of Scope (Phase 1)

- **Language analyzer implementations** (`lang/` package) — deferred, using `DefaultLanguageAnalyzer` for now
- **JavaFX GUI** (`codeexplorer`) — will become Astro + visx web UI in Phase 2
- **X3D/Force3D rendering** — data structures ported, rendering deferred
- **Performance optimization** — correctness first
