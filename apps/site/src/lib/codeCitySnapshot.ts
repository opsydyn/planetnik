import type {
	CanonicalComponentDependencyRecord,
	CanonicalFileRecord,
	CanonicalHotspotRecord,
	CanonicalImpactShard,
	CanonicalReportContext,
	CanonicalUnitRecord,
	CodeCitySnapshotInput,
} from "@planetnik/common";

export type CodeCityCollectionEntry<T> = { readonly data: T };

export type CodeCitySnapshotCollections = {
	readonly context: CanonicalReportContext;
	readonly filesMain: readonly CodeCityCollectionEntry<CanonicalFileRecord>[];
	readonly filesTest: readonly CodeCityCollectionEntry<CanonicalFileRecord>[];
	readonly units: readonly CodeCityCollectionEntry<CanonicalUnitRecord>[];
	readonly dependencies: readonly CodeCityCollectionEntry<CanonicalComponentDependencyRecord>[];
	readonly hotspots: readonly CodeCityCollectionEntry<CanonicalHotspotRecord>[];
	readonly impact: CanonicalImpactShard | undefined;
};

const records = <T>(entries: readonly CodeCityCollectionEntry<T>[]): T[] =>
	entries.map((entry) => entry.data);

export function toCodeCitySnapshotInput(
	collections: CodeCitySnapshotCollections,
): CodeCitySnapshotInput {
	const filesTest = records(collections.filesTest);
	const units = records(collections.units);
	const dependencies = records(collections.dependencies);
	const fileHotspots: CanonicalHotspotRecord[] = [];
	const unitHotspots: CanonicalHotspotRecord[] = [];
	const componentHotspots: CanonicalHotspotRecord[] = [];

	for (const { data } of collections.hotspots) {
		switch (data.kind) {
			case "file":
				fileHotspots.push(data);
				break;
			case "unit":
				unitHotspots.push(data);
				break;
			case "component":
				componentHotspots.push(data);
				break;
		}
	}

	return {
		context: collections.context,
		filesMain: { files: records(collections.filesMain) },
		...(filesTest.length > 0 ? { filesTest: { files: filesTest } } : {}),
		...(units.length > 0 ? { units: { units } } : {}),
		...(dependencies.length > 0
			? { componentDependencies: { dependencies } }
			: {}),
		...(fileHotspots.length > 0 || unitHotspots.length > 0 || componentHotspots.length > 0
			? {
					hotspots: {
						...(fileHotspots.length > 0 ? { fileHotspots } : {}),
						...(unitHotspots.length > 0 ? { unitHotspots } : {}),
						...(componentHotspots.length > 0 ? { componentHotspots } : {}),
					},
				}
			: {}),
		...(collections.impact ? { impact: collections.impact } : {}),
	};
}
