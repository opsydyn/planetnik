import type { SourceFile } from "../aspects/SourceFile.js";
import {
	SourceFileFilter,
	type SourceFileFilterType,
} from "../core/SourceFileFilter.js";
import type { Convention } from "./Convention.js";

export class ConventionUtils {
	static addConventions(
		conventions: Convention[],
		sourceFileFilters: SourceFileFilterType[],
		sourceFiles: SourceFile[],
	): void {
		// Sort conventions by content pattern length (shorter first)
		const sorted = [...conventions].sort(
			(a, b) =>
				(a.contentPattern?.length ?? 0) - (b.contentPattern?.length ?? 0),
		);

		for (const file of sourceFiles) {
			for (const convention of sorted) {
				if (ConventionUtils.isNotAdded(convention, sourceFileFilters)) {
					if (
						SourceFileFilter.matches(convention, file.relativePath, file.lines)
					) {
						sourceFileFilters.push({
							pathPattern: convention.pathPattern,
							contentPattern: convention.contentPattern,
							exception: convention.exception,
							note: convention.note,
						});
						break;
					}
				}
			}
		}
	}

	private static isNotAdded(
		convention: Convention,
		filters: SourceFileFilterType[],
	): boolean {
		return !filters.some(
			(f) =>
				f.pathPattern === convention.pathPattern &&
				f.contentPattern === convention.contentPattern,
		);
	}
}
