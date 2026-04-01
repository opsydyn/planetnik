import type { RichTextReport } from "../core/RichTextReport.js";

export class FindingsReportGenerator {
	static addFindingsToReport(
		report: RichTextReport,
		findingsHtml: string | null,
	): void {
		report.startSection("Intro", "");
		report.startUnorderedList();
		report.addListItem(
			"Free-form notes and pieces of code from explorations of the source code.",
		);
		report.endUnorderedList();
		report.endSection();

		if (!findingsHtml || findingsHtml.trim() === "") {
			report.addParagraph("No manual findings have been added.");
			return;
		}

		// Extract summary items
		const summaryRegex = /<summary>(.*?)<\/summary>/gs;
		const summaries: string[] = [];
		for (
			let match = summaryRegex.exec(findingsHtml);
			match !== null;
			match = summaryRegex.exec(findingsHtml)
		) {
			summaries.push(match[1]!);
		}

		if (summaries.length > 0) {
			report.addLevel2Header("Summary");
			report.startUnorderedList();
			for (const item of summaries) {
				report.addListItem(item);
			}
			report.endUnorderedList();
			report.addLineBreak();
		}

		report.addLevel2Header("Details");

		// Transform custom tags to HTML divs
		let html = findingsHtml;
		html = html.replace(/<finding>/g, "<div class='section'>");
		html = html.replace(/<\/finding>/g, "</div>");
		html = html.replace(
			/<summary>/g,
			"<div class='sectionHeader sectionTitle'>",
		);
		html = html.replace(/<\/summary>/g, "</div>");
		html = html.replace(/<body>/g, "<div class='sectionBody'>");
		html = html.replace(/<\/body>/g, "</div>");

		report.addHtmlContent(html);
	}
}
