import type { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js";
import { SourceCodeAspectUtils } from "../aspects/SourceCodeAspectUtils.js";
import type { MetricsList } from "../metrics/MetricsList.js";
import { NumericMetric } from "../metrics/NumericMetric.js";
import type { AspectAnalysisResults } from "../results/AspectAnalysisResults.js";

export class AnalysisUtils {
	static analyze(
		group: string,
		aspect: NamedSourceCodeAspect | null,
		_textOperations: unknown,
		_progressFeedback: unknown,
		aspectAnalysisResults: AspectAnalysisResults,
		metricsList: MetricsList,
		textSummary: string[],
		_start: number,
	): void {
		if (!aspect) return;
		aspectAnalysisResults.aspect = aspect;

		const separator = "/";
		const prefix = group ? `${group}${separator}` : "";
		const name = `${prefix}${aspect.name}`;

		metricsList
			.addMetric()
			.setId(AnalysisUtils.getMetricId(`NUMBER_OF_FILES_${name}`))
			.setValue(aspect.sourceFiles.length);

		metricsList
			.addMetric()
			.setId(AnalysisUtils.getMetricId(`LINES_OF_CODE_${name}`))
			.setValue(aspect.getLinesOfCode());

		aspectAnalysisResults.filesCount = aspect.sourceFiles.length;
		aspectAnalysisResults.linesOfCode = aspect.getLinesOfCode();

		textSummary.push(
			`${aspect.sourceFiles.length} are in the ${name}'s scope (${aspect.getLinesOfCode()} lines of code)`,
		);

		for (const aspectPerExtension of SourceCodeAspectUtils.getAspectsPerExtensions(
			aspect,
		)) {
			const extensionMetricName = `${name}_EXT_${aspectPerExtension.name.replace("*.", "")}`;
			metricsList
				.addMetric()
				.setId(
					AnalysisUtils.getMetricId(`NUMBER_OF_FILES_${extensionMetricName}`),
				)
				.setValue(aspectPerExtension.sourceFiles.length);

			metricsList
				.addMetric()
				.setId(
					AnalysisUtils.getMetricId(`LINES_OF_CODE_${extensionMetricName}`),
				)
				.setValue(aspectPerExtension.getLinesOfCode());

			aspectAnalysisResults.fileCountPerExtension.push(
				new NumericMetric(
					aspectPerExtension.name,
					aspectPerExtension.sourceFiles.length,
				),
			);
			aspectAnalysisResults.linesOfCodePerExtension.push(
				new NumericMetric(
					aspectPerExtension.name,
					aspectPerExtension.getLinesOfCode(),
				),
			);
		}
	}

	static getMetricId(name: string): string {
		let result = name.replace(/ /g, "_").replace(/-/g, "_");
		result = result.replace(/[(].*?[)]/g, "");
		while (result.includes("__")) {
			result = result.replace(/__/g, "_");
		}
		if (result.endsWith("_")) {
			result = result.slice(0, -1);
		}
		return result.trim().toUpperCase();
	}

	static info(
		textSummary: string[],
		_progressFeedback: unknown,
		line: string,
		_start: number,
	): void {
		textSummary.push(line);
	}

	static detailedInfo(
		textSummary: string[],
		_progressFeedback: unknown,
		line: string,
		_start: number,
	): void {
		textSummary.push(line);
	}
}
