# Charts — Java → Astro Parity Map

Java Sokrates has minimal chart classes — most visualization is done via inline SVG in report generators.
In Astro, all charts will use a data-vis library (D3, Observable Plot, Chart.js, etc.).

---

| Java Class | Java Path | TS File (legacy) | Astro Component |
|---|---|---|---|
| `SimpleOneBarChart` | `reports/charts/SimpleOneBarChart.java` | `SimpleOneBarChart.ts` | `<BarChart>` — configurable single-bar with label, tooltip, color |
