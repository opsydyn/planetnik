# Utils — Java → Astro Parity Map

Report utilities split into two categories:
1. **Data/logic helpers** — keep as-is, used by data exporters and Astro data loaders
2. **HTML rendering helpers** — replace with Astro components

---

## Already Ported (keep as-is)

| Java Class | Java Path | TS File | Notes |
|---|---|---|---|
| `ReportUtils` | `reports/utils/ReportUtils.java` | `ReportUtils.ts` | Number formatting, HTML escaping — data-side stays |
| `DateUtils` | `reports/utils/DateUtils.java` | `DateUtils.ts` | Date formatting for analysis results |
| `FilesReportUtils` | `reports/utils/FilesReportUtils.java` | `FilesReportUtils.ts` | File metric aggregation helpers |
| `DuplicationReportUtils` | `reports/utils/DuplicationReportUtils.java` | `DuplicationReportUtils.ts` | Duplication statistics helpers |
| `UtilsReportUtils` | `reports/utils/UtilsReportUtils.java` | `UtilsReportUtils.ts` | Unit/method metrics helpers |
| `ContributorsReportUtils` | `reports/utils/ContributorsReportUtils.java` | `ContributorsReportUtils.ts` | Contributor data formatting |
| `ScopeRendererItem` | `reports/utils/ScopeRendererItem.java` | `ScopeRendererItem.ts` | Data model for scope items |
| `ScopesRenderer` | `reports/utils/ScopesRenderer.java` | `ScopesRenderer.ts` | Scope rendering — mixed data+HTML |
| `RiskDistributionStatsReportUtils` | `reports/utils/RiskDistributionStatsReportUtils.java` | *(in generators/)* | Risk stats rendering — mixed |

## HTML/Visualization Helpers (replace with Astro components)

| Java Class | Java Path | TS File (legacy) | Astro Component |
|---|---|---|---|
| `ChartUtils` | `reports/utils/ChartUtils.java` | `ChartUtils.ts` | `<PieChart>`, `<BarChart>` — use data-vis library |
| `PieChartUtils` | `reports/utils/PieChartUtils.java` | `PieChartUtils.ts` | `<PieChart>` — inline SVG pie charts |
| `DataImageUtils` | `reports/utils/DataImageUtils.java` | `DataImageUtils.ts` | Embedded icons for languages/roles — use SVG icon set |
| `GraphvizDependencyRenderer` | `reports/utils/GraphvizDependencyRenderer.java` | `GraphvizDependencyRenderer.ts` | `<DependencyGraph>` — render with D3/force layout |
| `HtmlTemplateUtils` | `reports/utils/HtmlTemplateUtils.java` | `HtmlTemplateUtils.ts` | Astro layouts replace HTML templates |

## Not Ported (Java-only, no TS equivalent needed)

| Java Class | Java Path | Notes |
|---|---|---|
| `AnimalIcons` | `reports/utils/AnimalIcons.java` | Fun animal icons per component — port as icon utility if desired |
| `PromptsUtils` | `reports/utils/PromptsUtils.java` | Generates AI prompts from analysis — port if AI features planned |
| `ZipUtils` | `reports/utils/ZipUtils.java` | ZIP export for trend history — use Node.js `archiver` or `zlib` |
| `ZipEntryContent` | `reports/utils/ZipEntryContent.java` | Data model for ZIP entries — trivial |
| `ToStringFunction` | `reports/utils/ToStringFunction.java` | Functional interface — not needed in TS |
