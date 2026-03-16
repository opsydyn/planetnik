# Landscape — Java → Astro Parity Map

Landscape reports provide multi-repository analysis across an organization's codebase.
In Java Sokrates, these are HTML report generators. In Planetnik, Astro replaces all rendering.

The **data models** (`data/` subfolder) are already ported and stay as-is.
The **utils** (`utils/` subfolder) are partially ported — some are data logic (keep), some are HTML helpers (replace).

---

## Data Models (ported — keep as-is)

| Java Class | Java Path | TS File | Notes |
|---|---|---|---|
| `LandscapeDataExport` | `landscape/statichtml/LandscapeDataExport.java` | `data/LandscapeDataExport.ts` | Core data model for landscape analysis |
| `RepositoryExport` | `landscape/statichtml/RepositoryExport.java` | `data/RepositoryExport.ts` | Per-repository export data |
| `ContributorExport` | `landscape/statichtml/ContributorExport.java` | `data/ContributorExport.ts` | Per-contributor export data |
| `ContributorRepositoryInfoExport` | `landscape/statichtml/ContributorRepositoryInfoExport.java` | `data/ContributorRepositoryInfoExport.ts` | Contributor-to-repo relationship |

## Utils (partially ported — logic stays, HTML moves to Astro)

| Java Class | Java Path | TS File | Notes |
|---|---|---|---|
| `LandscapeGeneratorUtils` | `landscape/utils/LandscapeGeneratorUtils.java` | `utils/LandscapeGeneratorUtils.ts` | Mixed data+HTML — split: data logic stays, HTML → Astro |
| `FeaturesOfInterestAggregator` | `landscape/utils/FeaturesOfInterestAggregator.java` | `utils/FeaturesOfInterestAggregator.ts` | Pure data aggregation — keep |
| `RepositoryConcernData` | `landscape/utils/RepositoryConcernData.java` | `utils/RepositoryConcernData.ts` | Data holder — keep |
| `TagStats` | `landscape/utils/TagStats.java` | `utils/TagStats.ts` | Tag statistics — keep |
| `TagMap` | — | `utils/TagMap.ts` | TS-only addition — keep |
| `ContributorPerExtensionHelper` | `landscape/utils/ContributorPerExtensionHelper.java` | *not ported* | Calculates contributor metrics per file extension — port to analyzer |
| `ContributorsExtractor` | `landscape/utils/ContributorsExtractor.java` | *not ported* | Interface for contributor extraction by time slot — port to analyzer |
| `Counter` | `landscape/utils/Counter.java` | *not ported* | Simple counter utility — trivial, inline where needed |
| `ExtractStringListValue` | `landscape/utils/ExtractStringListValue.java` | *not ported* | String list extraction helper — trivial, inline |

## Report Generators (replace with Astro pages)

| Java Class | Java Path | TS File (legacy) | Astro Route |
|---|---|---|---|
| `LandscapeReportGenerator` | `landscape/statichtml/LandscapeReportGenerator.java` | `LandscapeReportGenerator.ts` | `/landscape` (main orchestrator page) |
| `LandscapeContributorsReport` | `landscape/statichtml/LandscapeContributorsReport.java` | *not ported* | `/landscape/contributors` |
| `LandscapeIndividualContributorsReports` | `landscape/statichtml/LandscapeIndividualContributorsReports.java` | *not ported* | `/landscape/contributors/[email]` (per-person detail page) |
| `LandscapeReportContributorsTab` | `landscape/statichtml/LandscapeReportContributorsTab.java` | *not ported* | `/landscape` tab component — contributor summary |
| `LandscapeReportPeopleTopologyTab` | `landscape/statichtml/LandscapeReportPeopleTopologyTab.java` | *not ported* | `/landscape` tab component — people network graph |
| `LandscapeRepositoriesReport` | `landscape/statichtml/LandscapeRepositoriesReport.java` | *not ported* | `/landscape/repositories` |
| `LandscapeRepositoriesTagsReport` | `landscape/statichtml/LandscapeRepositoriesTagsReport.java` | *not ported* | `/landscape/repositories/tags` |
| `LandscapeRepositoriesTagsMatrixReport` | `landscape/statichtml/LandscapeRepositoriesTagsMatrixReport.java` | *not ported* | `/landscape/repositories/tags-matrix` |
| `LandscapeRepositoriesTagsLine` | `landscape/statichtml/LandscapeRepositoriesTagsLine.java` | *not ported* | Shared tag rendering component |
| `LandscapeAnalysisCommands` | `landscape/statichtml/LandscapeAnalysisCommands.java` | *not ported* | CLI command processing — port to `apps/cli` |

## Visualization (replace with data-vis library components)

| Java Class | Java Path | Astro Component |
|---|---|---|
| `LandscapeVisualsGenerator` | `landscape/statichtml/LandscapeVisualsGenerator.java` | Shared Astro visualization components |
| `Force3DGraphExporter` | `landscape/statichtml/Force3DGraphExporter.java` | `<Force3DGraph>` — 3D force graph (three.js or similar) |
| `CorrelationDiagramGenerator` | `landscape/utils/CorrelationDiagramGenerator.java` | `<CorrelationDiagram>` — scatter plot with stats overlay |
| `RacingLanguagesBarChartsExporter` | `landscape/statichtml/RacingLanguagesBarChartsExporter.java` | `<RacingBarChart>` — animated language evolution |
| `RacingRepositoriesBarChartsExporter` | `landscape/statichtml/RacingRepositoriesBarChartsExporter.java` | `<RacingBarChart>` — animated repository metrics |
