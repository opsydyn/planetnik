import { ProgressFeedback } from "@planetnik/common";
import type { Dependency } from "./Dependency.js";

export class DependencyProgressFeedback extends ProgressFeedback {
	currentDependencies: Dependency[] = [];

	setCurrentDependencies(dependencies: Dependency[]): void {
		this.currentDependencies = [...dependencies];
	}
}
