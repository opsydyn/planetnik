import { describe, expect, mock, test } from "bun:test";
import type { CodeCitySnapshotCollections } from "../codeCitySnapshot.js";
import { toCodeCitySnapshotInput } from "../codeCitySnapshot.js";

const fixtureCollections = (): CodeCitySnapshotCollections => ({
	context: {
		dataVersion: 2,
		mode: "single_repository",
		reportMode: "single_repository",
		title: "Fixture",
		repositoryId: "repo:fixture",
	},
	filesMain: [
		{ data: { id: "file:main-a", relativePath: "src/a.ts", linesOfCode: 10 } },
		{ data: { id: "file:main-b", relativePath: "src/b.ts", linesOfCode: 20 } },
	],
	filesTest: [{ data: { id: "file:test", relativePath: "test/a.ts", linesOfCode: 5 } }],
	units: [{ data: { id: "unit:a", shortName: "a", relativeFileName: "src/a.ts" } }],
	dependencies: [
		{
			data: {
				decompositionKey: "package",
				fromComponent: "a",
				toComponent: "b",
			},
		},
	],
	hotspots: [
		{ data: { id: "file:hotspot", kind: "file", name: "src/a.ts" } },
		{ data: { id: "component:hotspot", kind: "component", name: "a" } },
	],
	impact: { impact_opportunities: [{ id: "file:impact", kind: "file", name: "src/a.ts" }] },
});

describe("toCodeCitySnapshotInput", () => {
	test("converts canonical collection entries into CodeCitySnapshotInput", () => {
		const input = toCodeCitySnapshotInput(fixtureCollections());

		expect(input.context.dataVersion).toBe(2);
		expect(input.filesMain.files).toHaveLength(2);
		expect(input.filesTest?.files).toHaveLength(1);
		expect(input.units?.units).toHaveLength(1);
		expect(input.componentDependencies?.dependencies).toHaveLength(1);
		expect(input.hotspots?.fileHotspots).toHaveLength(1);
		expect(input.hotspots?.componentHotspots).toHaveLength(1);
		expect(input.impact?.impact_opportunities).toHaveLength(1);
	});

	test("omits empty optional shards and unknown hotspot kinds", () => {
		const input = toCodeCitySnapshotInput({
			...fixtureCollections(),
			filesMain: [{ data: { id: "file:main", relativePath: "src/main.ts" } }],
			filesTest: [],
			units: [],
			dependencies: [],
			hotspots: [{ data: { id: "unknown", kind: "other" } }],
			impact: undefined,
		});

		expect(input.filesMain.files).toHaveLength(1);
		expect(input.filesTest).toBeUndefined();
		expect(input.units).toBeUndefined();
		expect(input.componentDependencies).toBeUndefined();
		expect(input.hotspots).toBeUndefined();
		expect(input.impact).toBeUndefined();
	});

	test("preserves optional shards declared by the v2 manifest when their records are empty", () => {
		const input = toCodeCitySnapshotInput({
			...fixtureCollections(),
			context: {
				...fixtureCollections().context,
				canonicalShards: {
					filesMain: "files_main.json",
					units: "units.json",
					componentDependencies: "component_dependencies.json",
					hotspots: "hotspots.json",
				},
			},
			filesTest: [],
			units: [],
			dependencies: [],
			hotspots: [],
			impact: undefined,
		});

		expect(input.filesTest).toBeUndefined();
		expect(input.units).toEqual({ units: [] });
		expect(input.componentDependencies).toEqual({ dependencies: [] });
		expect(input.hotspots).toEqual({});
		expect(input.impact).toBeUndefined();
	});

	test("preserves repository identity and empty shard presence after Astro content parsing", async () => {
		mock.module("astro:content", () => ({
			defineCollection: <T>(definition: T): T => definition,
		}));
		const { collections } = await import("../../content.config.js");
		const reportContextCollection = collections.reportContext as unknown as {
			readonly schema: {
				readonly parse: (value: unknown) => CodeCitySnapshotCollections["context"];
			};
		};
		const context = reportContextCollection.schema.parse({
			mode: "single_repository",
			reportMode: "single_repository",
			title: "Parsed fixture",
			rootRoute: "/",
			dataVersion: 2,
			repositoryId: "repo:parsed-fixture",
			canonicalShards: {
				filesMain: "files_main.json",
				units: "units.json",
			},
			source: "test",
			hasLandscape: false,
			hasSingleRepositoryAnalysis: true,
			primaryNavigation: [],
		});
		const input = toCodeCitySnapshotInput({
			...fixtureCollections(),
			context,
			units: [],
		});

		expect(input.context.repositoryId).toBe("repo:parsed-fixture");
		expect(input.context.canonicalShards).toEqual({
			filesMain: "files_main.json",
			units: "units.json",
		});
		expect(input.units).toEqual({ units: [] });
	});
});
