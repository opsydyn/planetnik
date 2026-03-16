# ADR-0003: Backend-Only Parity — Astro Frontend Replaces Java HTML Reports

## Status

Accepted

## Context

Java Sokrates generates static HTML reports directly from Java code: `RichTextReport` builds HTML fragments, report generators produce full pages with inline SVG charts, Graphviz DOT diagrams, zoomable circle visualizations, and racing bar chart animations. This is ~40+ classes across `reports/generators/`, `reports/landscape/`, and rendering utilities.

We have already ported a significant number of these HTML rendering utilities into `packages/reports/` (SimpleOneBarChart, GraphvizDependencyRenderer, ScopesRenderer, ChartUtils, PieChartUtils, DuplicationReportUtils, FilesReportUtils, UtilsReportUtils, ContributorsReportUtils, DataImageUtils, etc.) to maintain 1:1 parity.

However, the Płanetnik frontend will be an **Astro web application** with modern data visualization libraries (yet to be decided — candidates include visx, D3, Observable Plot, Recharts). This makes porting the remaining Java HTML report generators unnecessary — they would be throwaway work.

The remaining TODO list had ~40 items split roughly 50/50 between core backend logic and HTML/visualization rendering.

## Decision

**Płanetnik will only port Sokrates' core backend**: analysis engine, data models, data exporters (JSON), config handling, and CLI. All visualization and HTML report generation will be built fresh in the Astro frontend, consuming the JSON data exports.

### What stays in scope (core backend)

| Category | Items | Why |
|---|---|---|
| Data Exporters | `DataExportUtils`, dependency/duplication/file/trend/unit exporters and their info classes (~19) | JSON output that feeds the Astro frontend |
| String Operations | `StringOperation` interface, factory, 9 implementations | Used by `MetaRulesProcessor` for analysis logic |
| Aspect/Decomposition | `MetaRulesProcessor`, `GroupingRule`, `MetaDependencyRule`, `DerivedConcern`, `DependenciesFinder` | Core analysis logic for component grouping and dependency detection |
| Duplication | `DuplicationDependenciesHelper`, `AspectDuplication`, `ExtensionDuplication`, `DuplicateRangePair(s)` | Data models and analysis logic |
| Scoping/Conventions | `ConcernConventions`, `CustomConventionsHelper`, `CustomScopingConventions`, `CustomExtensionConventions` | Config processing for analysis |
| Analysis orchestration | `AnalysisEngine` interface | Orchestrates analysis pipeline |
| Catalogs | `StandardSecurityAspects` | Predefined analysis patterns |
| File History | `ComponentUpdateHistory`, `FileHistoryComponentsHelper` | Per-component change tracking |
| Core | `CodeConfigurationUtils`, `ReferenceAnalysisResult` | Config utils and trend baselines |
| Cleaners | `CodeBlockParser`, `CommentsCleanerUtils` | Source code preprocessing |
| Contributors | `ContributorsImport`, `GitContributorsUtil` | Data import and extraction |
| Search | `CleanedFoundText`, `SearchResultDependencies` | Search result models |

### What moves out of scope (Astro replaces)

| Category | Items | Why out of scope |
|---|---|---|
| Report generators | `ReportGenerator`, `ReportsContainer`, `SummaryUtils`, `Scope`, `Figure`, `ReportRenderingClient` | HTML rendering abstractions — Astro components replace these |
| Landscape HTML reports | All `LandscapeReport*` classes, `LandscapeVisualsGenerator`, `RacingLanguagesBarChartsExporter`, `RacingRepositoriesBarChartsExporter` | HTML page generators — Astro pages replace these |
| Visualization | `VisualizationTools`, `ForceGraphExporter`, `RacingComponentsBarChartsExporter` | Data viz libraries in Astro replace these |
| Report utilities | `AnimalIcons`, `PromptsUtils`, `ZipUtils` | UI concerns handled by Astro |
| Common/Infrastructure | `BarChart`, `PieChart`, `VisualizationTemplate`, `ExplorerTemplate`, `GraphvizUtil`, `GraphvizSettings` | Chart/template rendering — Astro + viz library replaces these |
| Landscape CLI visuals | `CorrelationDiagramGenerator`, `Counter`, `ExtractStringListValue`, `Force3DGraphExporter` | Visualization helpers |

### What we already ported but may deprecate later

The report utility classes already in `packages/reports/` (SimpleOneBarChart, GraphvizDependencyRenderer, ScopesRenderer, etc.) remain for now — they support the CLI's ability to generate standalone HTML reports. Once the Astro frontend is functional, these may be deprecated in favor of the frontend's visualization layer.

## Consequences

- **Reduced scope**: ~20 fewer classes to port, focusing effort on what matters
- **Cleaner architecture**: Backend produces JSON data, frontend consumes it — no HTML generation in the backend
- **Data exporters become critical path**: The JSON export format becomes the contract between backend and frontend
- **Landscape data classes stay**: `LandscapeAnalysisResults`, `ContributorRepositoryInfo`, etc. (data models) are still needed — only the HTML rendering classes are dropped
- **Existing report utils not wasted**: They still work for CLI-based HTML report generation as a fallback
