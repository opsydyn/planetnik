import type {
	LandscapeConfiguration,
	MergeExtension,
} from "@planetnik/analyzer";

export interface NumericMetricEntry {
	name: string;
	value: number;
	description: string[];
}

export class LandscapeGeneratorUtils {
	static getLinesOfCodePerExtension(
		config: LandscapeConfiguration,
		linesOfCodePerExtension: NumericMetricEntry[],
	): NumericMetricEntry[] {
		const threshold = config.extensionThresholdLoc;
		const map = new Map<string, NumericMetricEntry>();
		for (const ext of linesOfCodePerExtension) {
			map.set(ext.name.replace(/.*\./, ""), ext);
		}

		const mapMerge = new Map<string, MergeExtension>();
		for (const merge of config.mergeExtensions) {
			mapMerge.set(merge.secondary, merge);
		}

		const merged: NumericMetricEntry[] = [];

		for (const ext of linesOfCodePerExtension) {
			const key = ext.name.replace(/.*\./, "").toLowerCase();
			if (mapMerge.has(key) && map.has(mapMerge.get(key)!.primary)) {
				const primary = map.get(mapMerge.get(key)!.primary)!;
				const secondary = map.get(key)!;
				primary.value = primary.value + secondary.value;
				primary.description.push(...secondary.description);
			} else {
				merged.push(ext);
			}
		}

		for (const ext of merged) {
			ext.name = ext.name.replace(/.*\./, "");
		}

		return merged.filter(
			(e) =>
				!config.ignoreExtensions.includes(e.name) &&
				!e.name.endsWith("=") &&
				!e.name.startsWith("h-") &&
				e.value >= threshold,
		);
	}
}
