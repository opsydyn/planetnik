import type { Contributor } from "@planetnik/analyzer"
import { FormattingUtils } from "@planetnik/common"
import type { RichTextReport } from "../core/RichTextReport.js"
import { HtmlTemplateUtils } from "./HtmlTemplateUtils.js"

export const MAX_CONTRIBUTOR_LIST_SIZE = 500

export class ContributorsReportUtils {
  static addContributors(report: RichTextReport, contributors: Contributor[], type: string): void {
    report.addLineBreak()
    report.startSubSection(type, "")

    const sorted = [...contributors].sort((a, b) => b.commitsCount - a.commitsCount)
    const max = sorted[0]?.commitsCount ?? 1
    const total = sorted.reduce((sum, c) => sum + c.commitsCount, 0)

    const active = sorted.filter((c) => c.commitsCount180Days > 0)
    const historical = sorted.filter((c) => c.commitsCount180Days === 0)

    const active30 = sorted.filter((c) => c.commitsCount30Days > 0)
    const active90 = sorted.filter((c) => c.commitsCount90Days > 0 && c.commitsCount30Days === 0)
    const active180 = sorted.filter((c) => c.commitsCount180Days > 0 && c.commitsCount90Days === 0)

    report.startDiv("")
    report.addLevel2Header(`Recent ${type} (${active.length})`)
    report.addParagraph("Committed in past 6 months", "color: grey")

    if (active30.length > 0) {
      report.addParagraph(`Past 30 days (${active30.length}):`, "font-size: 80%")
      for (const c of active30) {
        ContributorsReportUtils.addContributor(report, max, total, c)
      }
    } else {
      report.addParagraph(`No ${type.toLowerCase()} in past 30 days.`, "font-size: 80%")
    }

    report.addHorizontalLine()
    if (active90.length > 0) {
      report.addParagraph(`Past 31 to 90 days (${active90.length}):`, "font-size: 80%")
      for (const c of active90) {
        ContributorsReportUtils.addContributor(report, max, total, c)
      }
    } else {
      report.addParagraph(`No ${type.toLowerCase()} in past 31 to 90 days.`, "font-size: 80%")
    }

    report.addHorizontalLine()
    if (active180.length > 0) {
      report.addParagraph(`Past 91 to 180 days (${active180.length}):`, "font-size: 80%")
      for (const c of active180) {
        ContributorsReportUtils.addContributor(report, max, total, c)
      }
    } else {
      report.addParagraph(`No ${type.toLowerCase()} in past 91 to 180 days.`, "font-size: 80%")
    }

    report.addLevel2Header(`Historical ${type} (${historical.length})`)
    report.addParagraph(`Last ${type.toLowerCase()} more than 6 months ago`, "color: grey")
    for (const c of historical.slice(0, MAX_CONTRIBUTOR_LIST_SIZE)) {
      ContributorsReportUtils.addContributor(report, max, total, c)
    }

    report.endDiv()
    report.endSection()
  }

  static addContributor(report: RichTextReport, max: number, total: number, contributor: Contributor): void {
    const commitsCount = contributor.commitsCount
    const opacity = 0.2 + (0.8 * commitsCount) / max
    const percentage = (100.0 * commitsCount) / total
    const info = escapeHtml(
      `${contributor.email} ${commitsCount} commits (${FormattingUtils.getFormattedPercentage(percentage)}%), between ${contributor.firstCommitDate} and ${contributor.latestCommitDate}`,
    )

    const icon = contributor.isBot ? "bot" : "contributor"
    report.addHtmlContent(
      `<div style='margin: 4px; box-shadow: rgba(9, 30, 66, 0.25) 0px 4px 8px -2px, rgba(9, 30, 66, 0.08) 0px 0px 0px 1px; text-align: center; display: inline-block;opacity:${opacity}' title='${info}'>`,
    )
    report.addHtmlContent(ContributorsReportUtils.getIconSvg(icon, 64))
    report.addHtmlContent(
      "<div style='padding: 4px; font-size: 10px; width: 64px; overflow: hidden; max-height: 22px; min-height: 22px;'>",
    )
    report.addHtmlContent(contributor.email)
    report.addHtmlContent("</div></div>")
  }

  static getIconSvg(icon: string, size = 40): string {
    let svg = HtmlTemplateUtils.getResource(`/icons/${icon}.svg`)
    if (!svg) return ""
    svg = svg.replace(/height='.*?'/g, `height='${size}px'`)
    svg = svg.replace(/width='.*?'/g, `width='${size}px'`)
    return svg
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
