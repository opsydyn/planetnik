import { FragmentType } from "./RichTextFragment.js"
import type { Link, RichTextReport } from "./RichTextReport.js"

export interface ReportRenderingClient {
  append(text: string): void
}

export class ReportRenderer {
  render(report: RichTextReport, client: ReportRenderingClient): void {
    this.renderHeader(report, client)
    for (const fragment of report.getFragments()) {
      if (!fragment.show) continue
      this.renderFragment(client, fragment)
    }
  }

  private renderHeader(report: RichTextReport, client: ReportRenderingClient): void {
    if (report.breadcrumbs.length > 0) {
      client.append(ReportRenderer.renderBreadcrumbsInDiv(report.breadcrumbs))
    }

    if (report.displayName) {
      client.append(`<h1>${report.displayName}</h1>`)
    }

    if (report.description) {
      client.append(`<p class="text-muted">${report.description}</p>`)
    }
  }

  private renderFragment(client: ReportRenderingClient, fragment: { type: FragmentType; fragment: string }): void {
    switch (fragment.type) {
      case FragmentType.HTML:
        client.append(fragment.fragment)
        break
      case FragmentType.SVG:
        client.append(fragment.fragment)
        break
      case FragmentType.GRAPHVIZ:
        // Graphviz rendering would require a DOT-to-SVG converter
        // For now, output as a code block
        client.append(`<pre class="graphviz">${fragment.fragment}</pre>`)
        break
    }
  }

  static renderBreadcrumbsInDiv(breadcrumbs: Link[]): string {
    const items = breadcrumbs.map((b) => `<a href="${b.href}">${b.label}</a>`).join(" &gt; ")
    return `<div class="breadcrumbs">${items}</div>`
  }
}
