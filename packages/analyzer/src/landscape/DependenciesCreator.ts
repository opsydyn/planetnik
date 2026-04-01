import { ComponentDependency } from "../dependencies/ComponentDependency.js";

export class DependenciesCreator {
	private dependencies: ComponentDependency[] = [];
	private dependenciesMap: Map<string, ComponentDependency> = new Map();

	add(from: string, to: string): void {
		const key1 = `${from}::${to}`;
		const key2 = `${to}::${from}`;

		if (this.dependenciesMap.has(key1)) {
			this.dependenciesMap.get(key1)!.increment(1);
		} else if (this.dependenciesMap.has(key2)) {
			this.dependenciesMap.get(key2)!.increment(1);
		} else {
			const dependency = new ComponentDependency(from, to);
			this.dependenciesMap.set(key1, dependency);
			this.dependencies.push(dependency);
		}
	}

	getDependencies(): ComponentDependency[] {
		return this.dependencies;
	}

	getIndirectDependencies(): ComponentDependency[] {
		const toMap = new Map<string, string[]>();

		for (const dependency of this.dependencies) {
			const to = dependency.toComponent;
			const from = dependency.fromComponent;
			if (!toMap.has(to)) {
				toMap.set(to, []);
			}
			toMap.get(to)!.push(from);
		}

		const indirect = new DependenciesCreator();

		for (const [, sources] of toMap) {
			for (const from1 of sources) {
				for (const from2 of sources) {
					if (from1.toLowerCase() !== from2.toLowerCase()) {
						indirect.add(from1, from2);
					}
				}
			}
		}

		const indirectDependencies = indirect.getDependencies();
		for (const dep of indirectDependencies) {
			dep.count = Math.floor(dep.count / 2);
		}

		return indirectDependencies;
	}
}
