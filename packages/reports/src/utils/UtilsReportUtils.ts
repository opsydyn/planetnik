import type { UnitInfo } from "@planetnik/analyzer";
import { DataImageUtils } from "./DataImageUtils.js";

export class UtilsReportUtils {
	static getUnitsTable(
		units: UnitInfo[],
		fragmentType: string,
		cacheFiles: boolean,
		saveCodeFragments: boolean,
	): string {
		let table = "<div style='width: 100%; overflow-x: scroll'>\n";
		table += "<table style='width: 80%'>\n";
		table +=
			"<th>Unit</th><th># lines</th><th>McCabe index</th><th># params</th>\n";

		let index = 0;
		for (const unit of units) {
			if (!unit.sourceFile) continue;
			table += "<tr>\n";
			index++;

			const relativePath = unit.sourceFile.relativePath;
			const extension = unit.sourceFile.extension;

			const fileLink = cacheFiles
				? `<a style='color: grey' target='_blank' href='../src/main/${relativePath}.html'>${relativePath}</a>`
				: relativePath;

			const unitNameFragment = saveCodeFragments
				? `<a target='_blank' href='../src/fragments/${fragmentType}/${fragmentType}_${index}.${extension}.html'>${unit.shortName}</a>`
				: unit.shortName;

			table +=
				`<td style='white-space: nowrap; overflow: hidden'>` +
				`<div><div style='display: inline-block; vertical-align: top; margin-top: 3px; margin-right: 4px;'>` +
				`${DataImageUtils.getLangDataImageDiv30(extension)}` +
				`</div><div style='display: inline-block;'><b>${unitNameFragment}</b><br/>in ${fileLink}</div></div></td>\n`;
			table += `<td>${unit.linesOfCode}</td>\n`;
			table += `<td>${unit.mcCabeIndex}</td>\n`;
			table += `<td>${unit.numberOfParameters}</td>\n`;
			table += "</tr>\n";
		}

		table += "</table>\n</div>\n";
		return table;
	}
}
