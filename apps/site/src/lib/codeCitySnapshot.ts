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

const hasCanonicalShard = (
	context: CanonicalReportContext,
	fileName: string,
): boolean | null => {
	if (!context.canonicalShards) return null;
	return Object.values(context.canonicalShards).includes(fileName);
};

const optionalShardIsPresent = (
	context: CanonicalReportContext,
	fileName: string,
	legacyEvidence: boolean,
): boolean => hasCanonicalShard(context, fileName) ?? legacyEvidence;

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
	const hotspotsPresent = optionalShardIsPresent(
		collections.context,
		"hotspots.json",
		fileHotspots.length > 0 ||
			unitHotspots.length > 0 ||
			componentHotspots.length > 0,
	);

	return {
		context: collections.context,
		filesMain: { files: records(collections.filesMain) },
		...(optionalShardIsPresent(
			collections.context,
			"files_test.json",
			filesTest.length > 0,
		)
			? { filesTest: { files: filesTest } }
			: {}),
		...(optionalShardIsPresent(
			collections.context,
			"units.json",
			units.length > 0,
		)
			? { units: { units } }
			: {}),
		...(optionalShardIsPresent(
			collections.context,
			"component_dependencies.json",
			dependencies.length > 0,
		)
			? { componentDependencies: { dependencies } }
			: {}),
		...(hotspotsPresent
			? {
					hotspots: {
						...(fileHotspots.length > 0 ? { fileHotspots } : {}),
						...(unitHotspots.length > 0 ? { unitHotspots } : {}),
						...(componentHotspots.length > 0 ? { componentHotspots } : {}),
					},
				}
			: {}),
		...(optionalShardIsPresent(
			collections.context,
			"impact.json",
			collections.impact !== undefined,
		)
			? { impact: collections.impact ?? {} }
			: {}),
	};
}
