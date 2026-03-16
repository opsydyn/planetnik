# Generators — Java → Astro Parity Map

These TS files are 1:1 ports of Java HTML report generators that render into `RichTextReport`.
In Planetnik, the Astro frontend replaces all HTML generation (see [ADR-0003](../../../../docs/adr/0003-backend-only-parity-astro-frontend.md)).

Each entry below maps a Java class to the Astro page/component that should replace it.

---

## Overview & Core

| Java Class | Java Path | TS File (legacy) | Astro Route |
|---|---|---|---|
| `OverviewReportGenerator` | `generators/statichtml/OverviewReportGenerator.java` | `OverviewReportGenerator.ts` | `/overview` |
| `BasicSourceCodeReportGenerator` | `generators/statichtml/BasicSourceCodeReportGenerator.java` | `BasicSourceCodeReportGenerator.ts` | `/` (dashboard layout, orchestrates all pages) |
| `MetricsListReportGenerator` | `generators/statichtml/MetricsListReportGenerator.java` | `MetricsReportGenerator.ts` | `/metrics` |

## Components & Dependencies

| Java Class | Java Path | TS File (legacy) | Astro Route |
|---|---|---|---|
| `LogicalComponentsReportGenerator` | `generators/statichtml/LogicalComponentsReportGenerator.java` | `LogicalComponentsReportGenerator.ts` | `/components` |
| `ForceGraphExporter` | `generators/statichtml/ForceGraphExporter.java` | *not ported* | `/components/graph` — 3D force-directed dependency graph |
| `RacingComponentsBarChartsExporter` | `generators/statichtml/RacingComponentsBarChartsExporter.java` | *not ported* | `/components/trends` — animated bar chart of component metrics over time |

## File Analysis

| Java Class | Java Path | TS File (legacy) | Astro Route |
|---|---|---|---|
| `FileSizeReportGenerator` | `generators/statichtml/FileSizeReportGenerator.java` | `FileSizeReportGenerator.ts` | `/files/size` |
| `FileAgeReportGenerator` | `generators/statichtml/FileAgeReportGenerator.java` | `FileHistoryReportGenerator.ts` | `/files/age` |
| `FileChurnReportGenerator` | `generators/statichtml/FileChurnReportGenerator.java` | `FileChurnReportGenerator.ts` | `/files/churn` |
| `FileTemporalDependenciesReportGenerator` | `generators/statichtml/FileTemporalDependenciesReportGenerator.java` | `FileTemporalDependenciesReportGenerator.ts` | `/files/temporal` |

## Code Quality & Complexity

| Java Class | Java Path | TS File (legacy) | Astro Route |
|---|---|---|---|
| `UnitsSizeReportGenerator` | `generators/statichtml/UnitsSizeReportGenerator.java` | `UnitsSizeReportGenerator.ts` | `/units/size` |
| `ConditionalComplexityReportGenerator` | `generators/statichtml/ConditionalComplexityReportGenerator.java` | `ConditionalComplexityReportGenerator.ts` | `/units/complexity` |
| `DuplicationReportGenerator` | `generators/statichtml/DuplicationReportGenerator.java` | `DuplicationReportGenerator.ts` | `/duplication` |

## Contributors & History

| Java Class | Java Path | TS File (legacy) | Astro Route |
|---|---|---|---|
| `ContributorsReportGenerator` | `generators/statichtml/ContributorsReportGenerator.java` | `ContributorsReportGenerator.ts` | `/contributors` |
| `ContributorsReportUtils` | `generators/statichtml/ContributorsReportUtils.java` | *in utils/* | Shared components for contributor pages |
| `CommitsReportGenerator` | `generators/statichtml/CommitsReportGenerator.java` | `CommitsReportGenerator.ts` | `/commits` |
| `CommitTrendsExtractors` | `generators/statichtml/CommitTrendsExtractors.java` | *not ported* | Data extraction helper — move to analyzer or Astro data loader |
| `HistoryPerLanguageGenerator` | `generators/statichtml/HistoryPerLanguageGenerator.java` | `HistoryPerLanguageGenerator.ts` | `/history/languages` — racing bar charts for language evolution |

## Features, Controls & Findings

| Java Class | Java Path | TS File (legacy) | Astro Route |
|---|---|---|---|
| `ConcernsReportGenerator` | `generators/statichtml/ConcernsReportGenerator.java` | `ConcernsReportGenerator.ts` | `/concerns` |
| `ControlsReportGenerator` | `generators/statichtml/ControlsReportGenerator.java` | `ControlsReportGenerator.ts` | `/controls` (traffic light goals dashboard) |
| `FindingsReportGenerator` | `generators/statichtml/FindingsReportGenerator.java` | `FindingsReportGenerator.ts` | `/findings` |

## Trends

| Java Class | Java Path | TS File (legacy) | Astro Route |
|---|---|---|---|
| `TrendReportGenerator` | `generators/statichtml/TrendReportGenerator.java` | `TrendReportGenerator.ts` | `/trends` |

## Visualization Helpers (no direct Astro page)

| Java Class | Java Path | Notes |
|---|---|---|
| `VisualizationTools` | `generators/statichtml/VisualizationTools.java` | SVG/Graphviz download links — replace with Astro download component |
| `FilesExplorerGenerators` | `generators/statichtml/FilesExplorerGenerators.java` | Interactive file explorer — replace with Astro component using tree view |
| `RiskDistributionReportUtils` | — | `RiskDistributionReportUtils.ts` exists, shared rendering helper |
