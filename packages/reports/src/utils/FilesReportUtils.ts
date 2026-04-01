import type { SourceFile } from "@planetnik/analyzer";
import { DataImageUtils } from "./DataImageUtils.js";

export class FilesReportUtils {
	static getFilesTable(
		sourceFiles: SourceFile[],
		linkToFiles: boolean,
		showAge: boolean,
		showLineLength: boolean,
		maxHeight = 300,
	): string {
		let table = `<div style='width: 100%; overflow-x: scroll; overflow-y: scroll; max-height: ${maxHeight}px;'>\n`;
		table += "<table style='width: 80%'>\n";
		table += "<tr>";
		let header = "<th>File</th><th># lines</th><th># units</th>";
		if (showLineLength) {
			header += "<th># long lines</th>";
		}
		if (showAge) {
			header += "<th>created</th>";
			header += "<th>last modified</th>";
			header += "<th># changes<br>(days)</th>";
			header += "<th># contributors</th>";
			header += "<th>first<br>contributor</th>";
			header += "<th>latest<br>contributor</th>";
		}
		table += `${header}\n`;
		table += "<tr>";

		for (const sourceFile of sourceFiles) {
			table += "<tr>\n";

			const relativePath = sourceFile.relativePath;
			const fileName = relativePath.split("/").pop() ?? relativePath;
			const parent =
				relativePath.substring(0, relativePath.length - fileName.length - 1) ||
				"root";
			const extension = sourceFile.extension;

			let fileNameFragment: string;
			if (linkToFiles) {
				const href = `../src/main/${relativePath}`;
				fileNameFragment = `<a target='blank' href='${href}.html'>${fileName}</a>`;
			} else {
				fileNameFragment = fileName;
			}

			table += `<td><div style='white-space: nowrap; '><div style='display: inline-block; vertical-align: top; margin-top: 3px; margin-right: 4px;'>${DataImageUtils.getLangDataImageDiv30(extension)}</div><div style='display: inline-block;'><b>${fileNameFragment}</b><div style='white-space: nowrap; overflow: hidden'>in ${parent}</div></div></div></td>\n`;
			table += `<td style='text-align: center'>${sourceFile.linesOfCode}</td>\n`;
			if (sourceFile.unitsCount > 0) {
				table += `<td style='text-align: center'>${sourceFile.unitsCount}</td>\n`;
			} else {
				table += "<td style='text-align: center; color: lightgrey'>-</td>\n";
			}
			if (showLineLength) {
				table += `<td style='text-align: center'>${sourceFile.getLongLinesCount(120)}</td>\n`;
			}

			if (showAge) {
				const history = sourceFile.fileModificationHistory;
				if (history) {
					table += `<td style='text-align: center; white-space: nowrap; font-size: 80%'>${history.getOldestDate()}</td>\n`;
					table += `<td style='text-align: center; white-space: nowrap; font-size: 80%;'>${history.getLatestDate()}</td>\n`;
					table += `<td style='text-align: center'>${history.dates.length}</td>\n`;
					table += `<td style='text-align: center'>${history.countContributors()}</td>\n`;
					const oldest = history.getOldestContributor();
					const latest = history.getLatestContributor();
					table += `<td style='text-align: center; font-size: 80%; color: grey'>${abbreviate(oldest, 30)}</td>\n`;
					table += `<td style='text-align: center; font-size: 80%; color: grey'>${abbreviate(latest, 30)}</td>\n`;
				} else {
					table += "<td style='text-align: center'></td>\n".repeat(4);
				}
			}

			table += "</tr>\n";
		}

		table += "</table>\n</div>\n";
		return table;
	}
}

function abbreviate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.substring(0, maxLength - 3)}...`;
}
