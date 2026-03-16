import { FragmentType, RichTextFragment } from "./RichTextFragment.js"

export interface Link {
  label: string
  href: string
}

export class RichTextReport {
  private fragments: RichTextFragment[] = []

  id: string = ""
  fileName: string = ""
  displayName: string = ""
  group: string = ""
  description: string = ""
  logoLink: string = ""
  renderLogo: boolean = true
  parentUrl: string = ""
  breadcrumbs: Link[] = []
  embedded: boolean = false

  constructor(id?: string, fileName?: string) {
    if (id) this.id = id
    if (fileName) this.fileName = fileName
  }

  getFragments(): RichTextFragment[] {
    return this.fragments
  }

  getFileName(): string {
    if (this.fileName) return this.fileName
    if (!this.displayName) return "report.html"
    return `${this.displayName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.html`
  }

  // --- Headers ---
  addLevel1Header(text: string): void {
    this.addHtml(`<h1>${text}</h1>`)
  }

  addLevel2Header(text: string): void {
    this.addHtml(`<h2>${text}</h2>`)
  }

  addLevel3Header(text: string): void {
    this.addHtml(`<h3>${text}</h3>`)
  }

  addLevel4Header(text: string): void {
    this.addHtml(`<h4>${text}</h4>`)
  }

  // --- Text ---
  addParagraph(text: string, style: string = ""): void {
    this.addHtml(style ? `<p style="${style}">${text}</p>` : `<p>${text}</p>`)
  }

  addEmphasisedParagraph(text: string): void {
    this.addHtml(`<p><em>${text}</em></p>`)
  }

  addQuoteParagraph(quote: string, source: string): void {
    this.addHtml(`<blockquote>${quote}<footer>— ${source}</footer></blockquote>`)
  }

  // --- Lists ---
  startUnorderedList(style: string = ""): void {
    this.addHtml(style ? `<ul style="${style}">` : "<ul>")
  }

  endUnorderedList(): void {
    this.addHtml("</ul>")
  }

  startListItem(): void {
    this.addHtml("<li>")
  }

  endListItem(): void {
    this.addHtml("</li>")
  }

  addListItem(text: string): void {
    this.addHtml(`<li>${text}</li>`)
  }

  // --- Tables ---
  startTable(style: string = ""): void {
    this.addHtml(style ? `<table style="${style}">` : '<table class="table table-striped">')
  }

  endTable(): void {
    this.addHtml("</table>")
  }

  startTableRow(style: string = ""): void {
    this.addHtml(style ? `<tr style="${style}">` : "<tr>")
  }

  endTableRow(): void {
    this.addHtml("</tr>")
  }

  startTableCell(style: string = ""): void {
    this.addHtml(style ? `<td style="${style}">` : "<td>")
  }

  endTableCell(): void {
    this.addHtml("</td>")
  }

  addTableCell(text: string, style: string = ""): void {
    this.addHtml(style ? `<td style="${style}">${text}</td>` : `<td>${text}</td>`)
  }

  addTableCellWithTitle(text: string, style: string, title: string): void {
    this.addHtml(`<td style="${style}" title="${title}">${text}</td>`)
  }

  addTableHeader(...columns: string[]): void {
    this.addHtml("<tr>")
    for (const col of columns) {
      this.addHtml(`<th style="text-align: center">${col}</th>`)
    }
    this.addHtml("</tr>")
  }

  addTableHeaderLeft(...columns: string[]): void {
    this.addHtml("<tr>")
    for (const col of columns) {
      this.addHtml(`<th>${col}</th>`)
    }
    this.addHtml("</tr>")
  }

  addMultiColumnTableCell(text: string, colspan: number): void {
    this.addHtml(`<td colspan="${colspan}">${text}</td>`)
  }

  // --- Divs ---
  startDiv(style: string = "", tooltip: string = ""): void {
    const attrs = [style ? `style="${style}"` : "", tooltip ? `title="${tooltip}"` : ""].filter(Boolean).join(" ")
    this.addHtml(attrs ? `<div ${attrs}>` : "<div>")
  }

  endDiv(): void {
    this.addHtml("</div>")
  }

  startSpan(style: string = ""): void {
    this.addHtml(style ? `<span style="${style}">` : "<span>")
  }

  endSpan(): void {
    this.addHtml("</span>")
  }

  startScrollingDiv(height: string = "300px"): void {
    this.addHtml(`<div style="max-height: ${height}; overflow-y: auto;">`)
  }

  // --- Sections ---
  startSection(title: string, subtitle: string): void {
    this.addHtml(`<div class="section">`)
    this.addLevel2Header(title)
    if (subtitle) this.addParagraph(subtitle)
  }

  endSection(): void {
    this.addHtml("</div>")
  }

  startSubSection(title: string, subtitle: string): void {
    this.addLevel3Header(title)
    if (subtitle) this.addParagraph(subtitle)
  }

  // --- Links ---
  addNewTabLink(label: string, href: string): void {
    this.addHtml(`<a href="${href}" target="_blank">${label}</a>`)
  }

  addAnchor(anchor: string): void {
    this.addHtml(`<a id="${anchor}"></a>`)
  }

  // --- Show/Hide ---
  addShowMoreBlock(visibleContent: string, hiddenContent: string, linkLabel: string): void {
    const id = `showmore_${this.fragments.length}`
    this.addHtml(`<div>${visibleContent}`)
    this.addHtml(
      `<a href="javascript:void(0)" onclick="document.getElementById('${id}').style.display='block';this.style.display='none'">${linkLabel}</a>`,
    )
    this.addHtml(`<div id="${id}" style="display:none">${hiddenContent}</div>`)
    this.addHtml("</div>")
  }

  startShowMoreBlock(linkLabel: string): void {
    const id = `showmore_${this.fragments.length}`
    this.addHtml(
      `<a href="javascript:void(0)" onclick="document.getElementById('${id}').style.display='block';this.style.display='none'">${linkLabel}</a>`,
    )
    this.addHtml(`<div id="${id}" style="display:none">`)
  }

  endShowMoreBlock(): void {
    this.addHtml("</div>")
  }

  // --- Tabs ---
  startTabGroup(): void {
    this.addHtml('<ul class="nav nav-tabs">')
  }

  endTabGroup(): void {
    this.addHtml("</ul>")
    this.addHtml('<div class="tab-content">')
  }

  addTab(id: string, label: string, active: boolean): void {
    this.addHtml(`<li class="${active ? "active" : ""}"><a data-toggle="tab" href="#${id}">${label}</a></li>`)
  }

  startTabContentSection(id: string, active: boolean): void {
    this.addHtml(`<div id="${id}" class="tab-pane fade ${active ? "in active" : ""}">`)
  }

  endTabContentSection(): void {
    this.addHtml("</div>")
  }

  // --- Misc ---
  addLineBreak(): void {
    this.addHtml("<br/>")
  }

  addHorizontalLine(): void {
    this.addHtml("<hr/>")
  }

  addHtmlContent(html: string): void {
    this.addHtml(html)
  }

  addContentInDiv(content: string, style: string = ""): void {
    this.addHtml(style ? `<div style="${style}">${content}</div>` : `<div>${content}</div>`)
  }

  addContentInDivWithTooltip(content: string, tooltip: string, style: string = ""): void {
    const attrs = [style ? `style="${style}"` : "", tooltip ? `title="${tooltip}"` : ""].filter(Boolean).join(" ")
    this.addHtml(`<div ${attrs}>${content}</div>`)
  }

  addSvgFigure(_title: string, svg: string): void {
    this.fragments.push(new RichTextFragment(svg, FragmentType.SVG))
  }

  addGraphvizFigure(descriptionOrId: string, graphvizCodeOrDescription: string, graphvizCode?: string): void {
    if (graphvizCode) {
      this.fragments.push(new RichTextFragment(graphvizCode, FragmentType.GRAPHVIZ, descriptionOrId))
    } else {
      this.fragments.push(new RichTextFragment(graphvizCodeOrDescription, FragmentType.GRAPHVIZ))
    }
  }

  renderToString(): string {
    return this.fragments.map((f) => f.fragment).join("")
  }

  // --- Internal ---
  private addHtml(html: string): void {
    this.fragments.push(new RichTextFragment(html, FragmentType.HTML))
  }
}
