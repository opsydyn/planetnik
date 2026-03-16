# Code Explorer — JavaFX → Astro Web Parity Map

Java Sokrates has a desktop JavaFX application (`codeexplorer/`) for interactive code browsing.
In Planetnik, the Astro web app replaces this entirely with browser-based equivalents.

Source: `sokrates/codeexplorer/src/main/java/nl/obren/sokrates/codeexplorer/`

---

## Application Shell

| Java Class | Java Path | Astro Equivalent |
|---|---|---|
| `CodeExplorerLauncher` | `codeexplorer/CodeExplorerLauncher.java` | Astro app entry point — `apps/site/` |
| `CodeBrowserPane` | `codeexplorer/CodeBrowserPane.java` | Main layout with sidebar nav + tabbed content |
| `CodeExplorerToolbar` | `codeexplorer/common/CodeExplorerToolbar.java` | Top toolbar component with actions and filters |

## Code Viewing & File Browsing

| Java Class | Java Path | Astro Route / Component |
|---|---|---|
| `CodePreviewEditor` | `codeexplorer/preview/CodePreviewEditor.java` | `/explorer/file/[path]` — split-pane code viewer |
| `CodePreviewView` | `codeexplorer/preview/CodePreviewView.java` | `<CodeViewer>` — syntax-highlighted code display |
| `SimpleCodePreviewView` | `codeexplorer/preview/SimpleCodePreviewView.java` | `<SimpleCodeViewer>` — lightweight code display |
| `FileListPane` | `codeexplorer/io/FileListPane.java` | `<FileList>` — filterable file list with LOC/extension |
| `AspectFilesBrowserPane` | `codeexplorer/aspects/AspectFilesBrowserPane.java` | `/explorer/components/[name]` — files grouped by component |
| `AspectsTablePane` | `codeexplorer/aspects/AspectsTablePane.java` | `<AspectsTable>` — sortable table of components with metrics |

## Search

| Java Class | Java Path | Astro Route / Component |
|---|---|---|
| `SearchPane` | `codeexplorer/search/SearchPane.java` | `/search` — main search interface with regex support |
| `SearchCleanerPane` | `codeexplorer/search/SearchCleanerPane.java` | Search preprocessing panel |
| `SearchDependenciesPane` | `codeexplorer/search/SearchDependenciesPane.java` | `/search/dependencies` — dependency-aware search |
| `SearchStatsPane` | `codeexplorer/search/SearchStatsPane.java` | `<SearchStats>` — result distribution statistics |
| `SearchSummaryPane` | `codeexplorer/search/SearchSummaryPane.java` | `<SearchSummary>` — result summary card |
| `SearchVizPane` | `codeexplorer/search/SearchVizPane.java` | `<SearchVisualization>` — visual search results |
| `SearchResultsDistributionTablePane` | `codeexplorer/search/SearchResultsDistributionTablePane.java` | `<SearchDistributionTable>` — tabular distribution |
| `SearchResultCellRenderer` | `codeexplorer/search/SearchResultCellRenderer.java` | `<SearchResultItem>` — individual result card |
| `PredefinedFiltersMenuPopulator` | `codeexplorer/search/PredefinedFiltersMenuPopulator.java` | `<FilterPresets>` — dropdown with common search patterns |

## Dependencies & Architecture

| Java Class | Java Path | Astro Route / Component |
|---|---|---|
| `DependenciesPane` | `codeexplorer/dependencies/DependenciesPane.java` | `/explorer/dependencies` — dependency browser |
| `DependenciesMatrix` | `codeexplorer/dependencies/DependenciesMatrix.java` | `<DependencyMatrix>` — NxN component dependency heatmap |
| `DependenciesView` | `codeexplorer/dependencies/DependenciesView.java` | `<DependencyGraph>` — force-directed graph |
| `DuplicatesPane` | `codeexplorer/duplication/DuplicatesPane.java` | `/explorer/duplication` — duplication browser |

## Units Analysis

| Java Class | Java Path | Astro Route / Component |
|---|---|---|
| `UnitsPane` | `codeexplorer/units/UnitsPane.java` | `/explorer/units` — sortable/filterable unit browser |

## Configuration

| Java Class | Java Path | Astro Route / Component |
|---|---|---|
| `CodeConfigurationView` | `codeexplorer/configuration/CodeConfigurationView.java` | `/settings` — analysis config viewer |
| `ConfigurationEditorView` | `codeexplorer/configuration/ConfigurationEditorView.java` | `/settings/edit` — config editor (JSON) |
| `NewAnalysisDialog` | `codeexplorer/configuration/NewAnalysisDialog.java` | `/new` — new analysis wizard |

## Console & UI Utilities

| Java Class | Java Path | Notes |
|---|---|---|
| `Console` | `codeexplorer/console/Console.java` | Interface — analysis log output |
| `TextAreaConsole` | `codeexplorer/console/TextAreaConsole.java` | `<AnalysisLog>` — streaming log component |
| `WebViewConsole` | `codeexplorer/console/WebViewConsole.java` | Not needed — Astro handles rich rendering natively |
| `ProgressFeedbackPane` | `codeexplorer/common/ProgressFeedbackPane.java` | `<ProgressBar>` — analysis progress indicator |
| `TableViewUtils` | `codeexplorer/common/TableViewUtils.java` | Use Tanstack Table or similar |
| `NumericBarCellFactory` | `codeexplorer/common/NumericBarCellFactory.java` | CSS inline bars in table cells |
| `PathCellRenderer` | `codeexplorer/common/PathCellRenderer.java` | `<FilePath>` — clickable file path component |
| `UXUtils` | `codeexplorer/common/UXUtils.java` | General UX helpers — inline in Astro |
| `SvgIcons` | `codeexplorer/common/SvgIcons.java` | Use Astro Icon or SVG sprite sheet |
| `ChartUtils` | `codeexplorer/charts/ChartUtils.java` | Use data-vis library |
| `FileSizeDistributionChartPanel` | `codeexplorer/charts/FileSizeDistributionChartPanel.java` | `<FileSizeDistribution>` — histogram component |
