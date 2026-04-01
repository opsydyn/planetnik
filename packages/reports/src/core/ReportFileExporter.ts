import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPORTS_HTML_FOOTER, REPORTS_HTML_HEADER } from "./ReportConstants.js";
import { ReportRenderer } from "./ReportRenderer.js";
import type { RichTextReport } from "./RichTextReport.js";

export class ReportFileExporter {
	static exportHtml(
		folder: string,
		subFolder: string,
		report: RichTextReport,
		customHeader: string = "",
	): void {
		const outputDir = join(folder, subFolder);
		if (!existsSync(outputDir)) {
			mkdirSync(outputDir, { recursive: true });
		}

		const fileName = report.getFileName();
		const filePath = join(outputDir, fileName);

		const parts: string[] = [];
		const client = {
			append(text: string) {
				parts.push(text);
			},
		};

		const renderer = new ReportRenderer();
		renderer.render(report, client);

		const title = report.displayName || "Report";
		const header = REPORTS_HTML_HEADER.replace("{{TITLE}}", title).replace(
			"{{CUSTOM_HEADER}}",
			customHeader,
		);

		const html = header + parts.join("\n") + REPORTS_HTML_FOOTER;
		writeFileSync(filePath, html, "utf-8");
	}

	static exportReportsIndex(
		reportsFolder: string,
		reports: RichTextReport[],
		projectName: string = "",
	): void {
		if (!existsSync(reportsFolder)) {
			mkdirSync(reportsFolder, { recursive: true });
		}

		const links = reports
			.map((r) => {
				const href = `html/${r.getFileName()}`;
				const label = r.displayName || r.id;
				return `<li><a href="${href}">${label}</a></li>`;
			})
			.join("\n");

		const title = projectName
			? `${projectName} — Analysis Reports`
			: "Analysis Reports";
		const header = REPORTS_HTML_HEADER.replace("{{TITLE}}", title).replace(
			"{{CUSTOM_HEADER}}",
			"",
		);
		const body = `<h1>${title}</h1>\n<ul>\n${links}\n</ul>`;
		const html = header + body + REPORTS_HTML_FOOTER;

		writeFileSync(join(reportsFolder, "index.html"), html, "utf-8");
	}
}
