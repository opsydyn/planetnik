import type { Dependency } from "./Dependency.js";
import type { DependencyError } from "./DependencyError.js";
import type { MetaDependencyRule } from "./MetaDependencyRule.js";

export class DependenciesAnalysis {
	dependencies: Dependency[] = [];
	errors: DependencyError[] = [];
	metaRules: MetaDependencyRule[] = [];
}
