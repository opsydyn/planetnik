import type { CodeAnalysisResults } from "@planetnik/analyzer";
import type { RichTextReport } from "../core/RichTextReport.js";
import { RiskDistributionReportUtils } from "./RiskDistributionReportUtils.js";

export class ConditionalComplexityReportGenerator {
	static addConditionalComplexityToReport(
		report: RichTextReport,
		results: CodeAnalysisResults,
	): void {
		const unitsResults = results.unitsAnalysisResults;
		const distribution = unitsResults.conditionalComplexityRiskDistribution;

		report.addParagraph(
			"The distribution of complexity of units (measured with McCabe index).",
			"margin-top: 12px; color: grey",
		);

		// Intro
		report.startSection("Intro", "");
		report.startUnorderedList();
		report.addListItem(
			"Conditional complexity (also called cyclomatic complexity) measures the number of possible paths through a program function.",
		);
		report.addListItem(
			"Conditional complexity is calculated by counting all conditions (if, loops, switches, and/or, try/catch...).",
		);
		report.addListItem(
			"Conditional complexity is measured at the unit level (methods, functions...).",
		);
		report.addListItem(
			"Units are classified: 1-5 (simple), 6-10 (medium complex), 11-25 (complex), 26+ (very complex).",
		);
		report.endUnorderedList();
		report.endSection();

		// Overall distribution
		report.startSection("Conditional Complexity Overall", "");
		const totalUnits = unitsResults.totalNumberOfUnits;
		const locInUnits = unitsResults.linesOfCodeInUnits;
		const mainLoc = results.mainAspectAnalysisResults.linesOfCode;
		const pct =
			mainLoc > 0 ? ((100.0 * locInUnits) / mainLoc).toFixed(1) : "0.0";

		report.startUnorderedList();
		report.addListItem(
			`There are <b>${totalUnits}</b> units with <b>${locInUnits}</b> lines of code (${pct}% of main code).`,
		);
		report.startUnorderedList();
		report.addListItem(
			`<b>${distribution.veryHighRiskCount}</b> very complex units (<b>${distribution.veryHighRiskValue}</b> LOC)`,
		);
		report.addListItem(
			`<b>${distribution.highRiskCount}</b> complex units (<b>${distribution.highRiskValue}</b> LOC)`,
		);
		report.addListItem(
			`<b>${distribution.mediumRiskCount}</b> medium complex units (<b>${distribution.mediumRiskValue}</b> LOC)`,
		);
		report.addListItem(
			`<b>${distribution.lowRiskCount}</b> simple units (<b>${distribution.lowRiskValue}</b> LOC)`,
		);
		report.addListItem(
			`<b>${distribution.negligibleRiskCount}</b> very simple units (<b>${distribution.negligibleRiskValue}</b> LOC)`,
		);
		report.endUnorderedList();
		report.endUnorderedList();
		RiskDistributionReportUtils.addRiskDistributionTable(report, distribution);
		report.endSection();

		// Per extension
		if (
			unitsResults.conditionalComplexityRiskDistributionPerExtension.length > 0
		) {
			report.startSection("Conditional Complexity per Extension", "");
			for (const dist of unitsResults.conditionalComplexityRiskDistributionPerExtension) {
				RiskDistributionReportUtils.addRiskDistributionTable(report, dist);
			}
			report.endSection();
		}

		// Per logical component
		if (
			unitsResults.conditionalComplexityRiskDistributionPerComponent.length > 0
		) {
			report.startSection("Conditional Complexity per Logical Component", "");
			for (
				let i = 0;
				i <
				unitsResults.conditionalComplexityRiskDistributionPerComponent.length;
				i++
			) {
				const stats =
					unitsResults.conditionalComplexityRiskDistributionPerComponent[i]!;
				const decompName =
					results.logicalDecompositionsAnalysisResults[i]?.key ??
					`Decomposition ${i + 1}`;
				report.startSubSection(`${decompName}`, "");
				for (const dist of stats) {
					RiskDistributionReportUtils.addRiskDistributionTable(report, dist);
				}
			}
			report.endSection();
		}

		// Most complex units
		if (unitsResults.mostComplexUnits.length > 0) {
			report.startSection(
				`Most Complex Units (Top ${unitsResults.mostComplexUnits.length})`,
				"",
			);
			report.startDiv("max-height: 400px; overflow-y: auto");
			report.startTable();
			report.addTableHeaderLeft("Unit", "File", "Lines", "McCabe Index");
			for (const unit of unitsResults.mostComplexUnits) {
				report.startTableRow();
				report.addTableCell(unit.shortName);
				report.addTableCell(unit.sourceFile?.relativePath ?? "");
				report.addTableCell(`${unit.linesOfCode}`);
				report.addTableCell(`${unit.mcCabeIndex}`);
				report.endTableRow();
			}
			report.endTable();
			report.endDiv();
			report.endSection();
		}
	}
}
