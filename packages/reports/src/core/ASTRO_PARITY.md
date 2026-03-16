# Core — Java → Astro Parity Map

The `core/` directory contains the report rendering abstraction layer.
In Java Sokrates, `RichTextReport` builds HTML strings. In Astro, this entire abstraction is replaced by Astro components and layouts.

---

| Java Class | TS File | Astro Replacement |
|---|---|---|
| `RichTextReport` | `RichTextReport.ts` | Astro layouts + component composition |
| `RichTextFragment` | `RichTextFragment.ts` | Individual Astro components (paragraphs, tables, sections) |
| `ReportRenderer` | `ReportRenderer.ts` | Astro rendering pipeline (SSG/SSR) |
| `ReportConstants` | `ReportConstants.ts` | Astro config / CSS custom properties |
| `ReportFileExporter` | `ReportFileExporter.ts` | Astro build output — static files auto-generated |

These files can be **deleted** once Astro pages are in place. They exist now only because other TS generators import them.
