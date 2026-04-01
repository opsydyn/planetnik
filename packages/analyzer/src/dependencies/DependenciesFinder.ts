import type { DependencyFinderPattern } from "./DependencyFinderPattern.js";
import type { MetaDependencyRule } from "./MetaDependencyRule.js";

export class DependenciesFinder {
	useBuiltInDependencyFinders: boolean = true;
	rules: DependencyFinderPattern[] = [];
	metaRules: MetaDependencyRule[] = [];
}
