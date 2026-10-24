import type { RichTextReport } from "../core/RichTextReport.js"
import {
  escapeFindingsHtml,
  type FindingsAuthoringDocument,
  normalizeFindingsAuthoringDocument,
} from "../findings/FindingsAuthoring.js"

export class FindingsReportGenerator {
  static addFindingsToReport(report: RichTextReport, findings: FindingsAuthoringDocument | null): void {
    report.startSection("Intro", "")
    report.startUnorderedList()
    report.addListItem("Free-form notes and pieces of code from explorations of the source code.")
    report.endUnorderedList()
    report.endSection()

    const normalized = findings ? normalizeFindingsAuthoringDocument(findings) : null
    if (!normalized || normalized.items.length === 0) {
      report.addParagraph("No manual findings have been added.")
      return
    }

    report.addLevel2Header("Summary")
    report.startUnorderedList()
    for (const item of normalized.items) {
      report.addListItem(escapeFindingsHtml(item.summary))
    }
    report.endUnorderedList()
    report.addLineBreak()

    report.addLevel2Header("Details")

    const html = normalized.items
      .map(
        (item) =>
          `<div class='section'><div class='sectionHeader sectionTitle'>${escapeFindingsHtml(item.summary)}</div><div class='sectionBody'>${item.bodyHtml}</div></div>`,
      )
      .join("")
    report.addHtmlContent(html)
  }
}
