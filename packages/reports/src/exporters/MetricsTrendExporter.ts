import type { CodeAnalysisResults } from "@planetnik/analyzer";
import { RegexUtils } from "@planetnik/common";

export interface ValueSnapshotPair {
	snapshot: string;
	value: number;
}

export interface MetricsTrendInfo {
	id: string;
	description: string;
	values: ValueSnapshotPair[];
}

export class MetricsTrendExporter {
	private analysisResultsList: CodeAnalysisResults[] = [];
	private labels: string[] = [];

	constructor(
		currentAnalysisResults: CodeAnalysisResults,
		referenceResults: { label: string; results: CodeAnalysisResults }[] = [],
	) {
		this.analysisResultsList.push(currentAnalysisResults);
		this.labels.push("Current");

		for (const ref of referenceResults) {
			this.analysisResultsList.push(ref.results);
			this.labels.push(ref.label);
		}
	}

	getMetricTrends(
		idFilterRegex?: string,
		excludeRegex?: string,
	): MetricsTrendInfo[] {
		const trends: MetricsTrendInfo[] = [];

		if (this.analysisResultsList.length === 0) return trends;

		const current = this.analysisResultsList[0]!;
		const currentMetrics = current.metricsList.metrics;

		for (const metric of currentMetrics) {
			const id = metric.id;
			if (
				!MetricsTrendExporter.shouldIncludeId(idFilterRegex, excludeRegex, id)
			)
				continue;

			const trendInfo: MetricsTrendInfo = {
				id,
				description: metric.description,
				values: [],
			};

			for (let i = 0; i < this.analysisResultsList.length; i++) {
				const results = this.analysisResultsList[i]!;
				const found = results.metricsList.getMetricById(id);
				const value = found ? found.value : 0;

				trendInfo.values.push({
					snapshot: this.labels[i]!,
					value,
				});
			}

			trends.push(trendInfo);
		}

		return trends;
	}

	static shouldIncludeId(
		idFilterRegex: string | undefined,
		excludeRegex: string | undefined,
		id: string,
	): boolean {
		if (idFilterRegex && !RegexUtils.matchesEntirely(idFilterRegex, id))
			return false;
		if (excludeRegex && RegexUtils.matchesEntirely(excludeRegex, id))
			return false;
		return true;
	}

	getText(idFilterRegex?: string, excludeRegex?: string): string {
		const trends = this.getMetricTrends(idFilterRegex, excludeRegex);
		if (trends.length === 0) return "";

		const lines: string[] = [];

		const headerValues = trends[0]!.values.map((v) => v.snapshot).join("\t");
		lines.push(`Metric\t${headerValues}`);

		for (const info of trends) {
			const values = info.values.map((v) => String(v.value)).join("\t");
			lines.push(`${info.id}\t${values}`);
		}

		return `${lines.join("\n")}\n`;
	}
}
