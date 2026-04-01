import type { ProgressFeedback } from "@planetnik/common";
import type { SourceFile } from "../aspects/SourceFile.js";
import { DependenciesAnalysis } from "./DependenciesAnalysis.js";
import type { Dependency } from "./Dependency.js";
import type { DependencyAnchor } from "./DependencyAnchor.js";
import { DependencyUtils } from "./DependencyUtils.js";
import { SourceFileDependency } from "./SourceFileDependency.js";

export abstract class HeuristicDependenciesExtractor {
	extractDependencies(
		files: SourceFile[],
		progressFeedback: ProgressFeedback,
	): DependenciesAnalysis {
		const analysis = new DependenciesAnalysis();
		const dependencies: Dependency[] = [];
		analysis.dependencies = dependencies;
		const anchors = this.getDependencyAnchors(files);

		let i = 0;
		for (const sourceAnchor of anchors.values()) {
			if (progressFeedback.canceled()) break;
			progressFeedback.setText(sourceAnchor.anchor);

			for (const targetAnchor of anchors.values()) {
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

			progressFeedback.progress(i++, anchors.size);
		}

		return analysis;
	}

	private extractDependenciesToTargetAnchor(
		dependencies: Dependency[],
		sourceFile: SourceFile,
		sourceAnchor: DependencyAnchor,
		targetAnchor: DependencyAnchor,
	): void {
		const content = sourceFile.content;
		if (content.includes(targetAnchor.anchor)) {
			const fragment = targetAnchor.getDependencyCodeFragment(content);
			if (fragment !== null) {
				const sfd = new SourceFileDependency(sourceFile);
				sfd.codeFragment = fragment;
				DependencyUtils.addDependency(
					dependencies,
					sfd,
					sourceAnchor,
					targetAnchor,
				);
			}
		}
	}

	getDependencyAnchors(files: SourceFile[]): Map<string, DependencyAnchor> {
		const anchorMap = new Map<string, DependencyAnchor>();

		for (const sourceFile of files) {
			const fileAnchors = this.extractDependencyAnchors(sourceFile);
			for (const anchor of fileAnchors) {
				const existing = anchorMap.get(anchor.anchor);
				if (existing) {
					existing.sourceFiles.push(...anchor.sourceFiles);
				} else {
					anchorMap.set(anchor.anchor, anchor);
				}
			}
		}

		return anchorMap;
	}

	abstract extractDependencyAnchors(sourceFile: SourceFile): DependencyAnchor[];
}
