import { resolve } from "node:path";
import type { ProgressFeedback } from "@planetnik/common";
import type { SourceFile } from "../aspects/SourceFile.js";
import { DependenciesAnalysis } from "./DependenciesAnalysis.js";
import type { Dependency } from "./Dependency.js";
import { DependencyAnchor } from "./DependencyAnchor.js";
import { DependencyUtils } from "./DependencyUtils.js";

export abstract class HeuristicFilePathDependenciesExtractor {
	extractDependencies(
		files: SourceFile[],
		progressFeedback: ProgressFeedback,
	): DependenciesAnalysis {
		const analysis = new DependenciesAnalysis();
		const dependencies: Dependency[] = [];
		analysis.dependencies = dependencies;
		const anchors = this.getDependencyAnchors(files);

		DependencyUtils.findErrors(anchors, analysis.errors);

		let i = 0;
		for (const sourceAnchor of anchors) {
			if (progressFeedback.canceled()) break;
			progressFeedback.setText(sourceAnchor.anchor);

			for (const targetAnchor of anchors) {
				if (sourceAnchor !== targetAnchor) {
					for (const sourceFile of sourceAnchor.sourceFiles) {
						this.extractDependenciesToTargetAnchor(
							dependencies,
							sourceFile,
							sourceAnchor,
							targetAnchor,
						);
					}
				}
			}

			progressFeedback.progress(i++, anchors.length);
		}

		return analysis;
	}

	protected abstract extractDependenciesToTargetAnchor(
		dependencies: Dependency[],
		sourceFile: SourceFile,
		sourceAnchor: DependencyAnchor,
		targetAnchor: DependencyAnchor,
	): void;

	getDependencyAnchors(files: SourceFile[]): DependencyAnchor[] {
		const anchors: DependencyAnchor[] = [];

		for (const sourceFile of files) {
			const anchor = new DependencyAnchor();
			anchor.anchor = resolve(sourceFile.relativePath);
			anchor.sourceFiles.push(sourceFile);
			anchors.push(anchor);
		}

		return anchors;
	}
}
