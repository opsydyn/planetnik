import { describe, expect, test } from "bun:test";
import type {
	CodeCityModel,
	CodeCitySnapshotInput,
} from "../CodeCityModel.js";
import { CodeCityInputError } from "../CodeCityModel.js";
import { buildCodeCityModel } from "../CodeCityModelBuilder.js";

const minimalInput = (): CodeCitySnapshotInput => ({
	context: {
		dataVersion: 2,
		reportMode: "single_repository",
		title: "Fixture Repo",
		repositoryId: "repo:fixture",
		snapshotId: "snapshot-1",
		generatedAt: "2026-08-16T00:00:00.000Z",
	},
	filesMain: {
		files: [
			{
				id: "file:src/index.ts",
				relativePath: "src/index.ts",
				extension: "ts",
				linesOfCode: 120,
				components: ["runtime"],
				concerns: ["api"],
				commitsCount: 8,
				contributorsCount: 2,
				contributors: ["alan@example.com", "sam@example.com"],
			},
		],
	},
});

const relationshipInput = (): CodeCitySnapshotInput => ({
	...minimalInput(),
	filesMain: {
		files: [
			{
				id: "file:src/runtime.ts",
				relativePath: "src/runtime.ts",
				extension: "ts",
				linesOfCode: 120,
				components: ["runtime"],
				commitsCount: 8,
				contributors: ["alan@example.com"],
			},
			{
				id: "file:src/reports.ts",
				relativePath: "src/reports.ts",
				extension: "ts",
				linesOfCode: 80,
				components: ["reports"],
				commitsCount: 3,
				contributors: ["sam@example.com"],
			},
		],
	},
	units: {
		units: [
			{
				id: "unit:src/runtime.ts:1",
				shortName: "run",
				longName: "runtime.run",
				relativeFileName: "src/runtime.ts",
				linesOfCode: 24,
				mcCabeIndex: 7,
				numberOfParameters: 2,
				startLine: 1,
				endLine: 24,
				components: ["runtime"],
			},
			{
				id: "unit:src/missing.ts:1",
				shortName: "missing",
				longName: "missing",
				relativeFileName: "src/missing.ts",
				linesOfCode: 1,
				mcCabeIndex: 1,
				numberOfParameters: 0,
				startLine: 1,
				endLine: 1,
			},
		],
	},
	componentDependencies: {
		dependencies: [
			{
				decompositionKey: "primary",
				fromComponent: "runtime",
				toComponent: "reports",
				fromComponentId: "component:primary:runtime",
				toComponentId: "component:primary:reports",
				count: 5,
				locFrom: 120,
				evidenceCount: 2,
			},
			{
				decompositionKey: "primary",
				fromComponent: "",
				toComponent: "reports",
				count: 1,
			},
		],
	},
});

const signalInput = (): CodeCitySnapshotInput => ({
	...relationshipInput(),
	hotspots: {
		fileHotspots: [
			{
				id: "file:src/runtime.ts",
				kind: "file",
				name: "src/runtime.ts",
				route: "/files/churn",
				score: 72,
				severity: "high",
				temporalLinks: 6,
				dominantDimension: "changePressure",
			},
		],
		unitHotspots: [
			{
				id: "unit:src/runtime.ts:1",
				kind: "unit",
				name: "run",
				route: "/units/complexity",
				score: 88,
				severity: "critical",
				temporalLinks: 3,
				dominantDimension: "structuralRisk",
			},
		],
		componentHotspots: [
			{
				id: "component:primary:runtime",
				kind: "component",
				name: "runtime",
				route: "/components",
				score: 64,
				severity: "medium",
				temporalLinks: 9,
				dominantDimension: "coordinationCost",
			},
		],
	},
	impact: {
		impact_opportunities: [
			{
				id: "file:src/runtime.ts",
				kind: "file",
				name: "src/runtime.ts",
				route: "/impact",
				impact_score: 81,
				dominant_dimension: "change_enablement",
			},
		],
	},
});

const permutedInput = (): CodeCitySnapshotInput => {
	const input = signalInput();
	return {
		...input,
		filesMain: { files: [...(input.filesMain.files ?? [])].reverse() },
		...(input.units
			? { units: { units: [...(input.units.units ?? [])].reverse() } }
			: {}),
		...(input.componentDependencies
			? {
					componentDependencies: {
						dependencies: [
							...(input.componentDependencies.dependencies ?? []),
						].reverse(),
					},
				}
			: {}),
		...(input.hotspots
			? {
					hotspots: {
						fileHotspots: [...(input.hotspots.fileHotspots ?? [])].reverse(),
						unitHotspots: [...(input.hotspots.unitHotspots ?? [])].reverse(),
						componentHotspots: [
							...(input.hotspots.componentHotspots ?? []),
						].reverse(),
					},
				}
			: {}),
		...(input.impact
			? {
					impact: {
						impact_opportunities: [
							...(input.impact.impact_opportunities ?? []),
						].reverse(),
					},
				}
			: {}),
	};
};

const emptyModel = (): CodeCityModel => ({
	contractVersion: 1,
	snapshot: {
		repositoryId: "repo:fixture",
		title: "Fixture Repo",
	},
	districts: [],
	buildings: [],
	units: [],
	edges: [],
	coverage: {
		presentShards: [],
		missingOptionalShards: [],
		diagnostics: [],
		derivedDistrictIds: [],
		counts: {
			files: 0,
			districts: 0,
			units: 0,
			edges: 0,
			diagnostics: 0,
		},
	},
	layout: {
		contractVersion: 1,
		seed: "code-city-v1:fixture",
		districtOrder: [],
		buildingOrder: [],
		unitOrder: [],
	},
	legend: {
		channels: [],
	},
});

describe("CodeCityModel public contract", () => {
	test("minimal canonical input is fully typed", () => {
		const input = minimalInput();
		expect(input.context.dataVersion).toBe(2);
		expect(input.filesMain.files).toHaveLength(1);
	});

	test("model values round-trip through JSON", () => {
		const model = emptyModel();
		expect(JSON.parse(JSON.stringify(model))).toEqual(model);
	});
});

describe("buildCodeCityModel base contract", () => {
	test("rejects a non-v2 context", () => {
		expect(() =>
			buildCodeCityModel({
				...minimalInput(),
				context: { ...minimalInput().context, dataVersion: 1 },
			}),
		).toThrowError(CodeCityInputError);
	});

	test("rejects missing repository identity and files main", () => {
		expect(() =>
			buildCodeCityModel({
				...minimalInput(),
				context: { ...minimalInput().context, repositoryId: "" },
			}),
		).toThrowError(CodeCityInputError);
		expect(() =>
			buildCodeCityModel({
				...minimalInput(),
				filesMain: undefined as never,
			}),
		).toThrowError(CodeCityInputError);
	});

	test("builds a file building and a root path district", () => {
		const model = buildCodeCityModel(minimalInput());
		expect(model.snapshot.repositoryId).toBe("repo:fixture");
		expect(model.buildings).toHaveLength(1);
		expect(model.buildings[0]).toMatchObject({
			id: "file:src/index.ts",
			relativePath: "src/index.ts",
			primaryDistrictId: "path:src",
		});
		expect(model.districts[0]).toMatchObject({
			id: "path:src",
			kind: "path",
			buildingIds: ["file:src/index.ts"],
			derived: true,
		});
	});
});

describe("buildCodeCityModel relationships", () => {
	test("derives component districts and attaches units and edges", () => {
		const model = buildCodeCityModel(relationshipInput());
		expect(model.districts.map(({ id }) => id)).toEqual([
			"component:primary:reports",
			"component:primary:runtime",
		]);
		expect(
			model.buildings.find((building) => building.id === "file:src/runtime.ts")
				?.districtIds,
		).toEqual(["component:primary:runtime"]);
		expect(model.units[0]).toMatchObject({
			id: "unit:src/runtime.ts:1",
			fileId: "file:src/runtime.ts",
		});
		expect(model.edges[0]).toMatchObject({
			kind: "component_dependency",
			sourceDistrictId: "component:primary:runtime",
			targetDistrictId: "component:primary:reports",
			count: 5,
		});
	});

	test("reports orphan units and unresolved dependency endpoints", () => {
		const model = buildCodeCityModel(relationshipInput());
		expect(model.coverage.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "orphan_unit",
					entityId: "unit:src/missing.ts:1",
				}),
				expect.objectContaining({ code: "unresolved_edge" }),
			]),
		);
	});
});

describe("buildCodeCityModel signals", () => {
	test("joins hotspot and impact evidence to matching entities", () => {
		const model = buildCodeCityModel(signalInput());
		const building = model.buildings.find(
			({ id }) => id === "file:src/runtime.ts",
		);
		const unit = model.units.find(({ id }) => id === "unit:src/runtime.ts:1");
		const district = model.districts.find(
			({ id }) => id === "component:primary:runtime",
		);
		expect(building?.metrics).toMatchObject({
			health: {
				score: 72,
				severity: "high",
				dominantDimension: "changePressure",
			},
			change: { temporalLinks: 6 },
			impact: {
				score: 81,
				dimension: "change_enablement",
				sourceId: "file:src/runtime.ts",
			},
		});
		expect(building?.evidence).toContainEqual({
			kind: "file",
			id: "file:src/runtime.ts",
			route: "/files/churn",
		});
		expect(unit?.metrics.health).toMatchObject({
			score: 88,
			severity: "critical",
			dominantDimension: "structuralRisk",
		});
		expect(unit?.evidence).toContainEqual({
			kind: "unit",
			id: "unit:src/runtime.ts:1",
			route: "/units/complexity",
		});
		expect(district?.metrics.health).toMatchObject({
			score: 64,
			severity: "medium",
			dominantDimension: "coordinationCost",
		});
		expect(district?.derived).toBe(false);
	});

	test("keeps missing optional shards explicit", () => {
		const model = buildCodeCityModel(minimalInput());
		expect(model.buildings[0]?.metrics.health.score).toBeNull();
		expect(model.coverage.missingOptionalShards).toEqual([
			"files_test.json",
			"units.json",
			"component_dependencies.json",
			"hotspots.json",
			"impact.json",
		]);
	});

	test("reports signal records that cannot be joined", () => {
		const model = buildCodeCityModel({
			...minimalInput(),
			hotspots: {
				fileHotspots: [{ id: "file:missing.ts", kind: "file" }],
			},
			impact: {
				impact_opportunities: [
					{ id: "file:missing.ts", kind: "file", impact_score: 30 },
				],
			},
		});
		expect(model.coverage.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "orphan_hotspot",
					entityId: "file:missing.ts",
				}),
				expect.objectContaining({
					code: "orphan_impact",
					entityId: "file:missing.ts",
				}),
			]),
		);
	});
});

describe("buildCodeCityModel determinism", () => {
	test("is invariant to input array order and round-trips through JSON", () => {
		const model = buildCodeCityModel(signalInput());
		const permuted = buildCodeCityModel(permutedInput());
		expect(model).toEqual(permuted);
		expect(JSON.parse(JSON.stringify(model))).toEqual(model);
	});

	test("uses a stable repository seed independent of snapshot id", () => {
		const first = buildCodeCityModel(minimalInput());
		const second = buildCodeCityModel({
			...minimalInput(),
			context: { ...minimalInput().context, snapshotId: "snapshot-2" },
		});
		expect(first.layout.seed).toMatch(/^code-city-v1:[0-9a-f]{8}$/);
		expect(first.layout.seed).toBe(second.layout.seed);
	});

	test("keeps entity collections and layout orders sorted by stable id", () => {
		const model = buildCodeCityModel(signalInput());
		for (const collection of [
			model.districts,
			model.buildings,
			model.units,
			model.edges,
		]) {
			expect(collection.map(({ id }) => id)).toEqual(
				[...collection].map(({ id }) => id).sort(),
			);
		}
		expect(model.layout.districtOrder).toEqual(
			model.districts.map(({ id }) => id),
		);
		expect(model.layout.buildingOrder).toEqual(
			model.buildings.map(({ id }) => id),
		);
		expect(model.layout.unitOrder).toEqual(model.units.map(({ id }) => id));
	});

	test("unions main and test files by stable id", () => {
		const model = buildCodeCityModel({
			...minimalInput(),
			filesTest: {
				files: [
					{
						id: "file:src/index.ts",
						relativePath: "./src\\index.ts",
						extension: "ts",
						linesOfCode: 120,
					},
					{
						id: "file:test/index.test.ts",
						relativePath: "test/index.test.ts",
						extension: "ts",
						linesOfCode: 20,
					},
				],
			},
		});
		expect(model.buildings).toHaveLength(2);
		expect(model.buildings.find(({ id }) => id === "file:src/index.ts")?.sourceSets)
			.toEqual(["main", "test"]);
		expect(model.coverage.presentShards).toContain("files_test.json");
	});

	test("keeps malformed records structured and shard-scoped", () => {
		const model = buildCodeCityModel({
			...minimalInput(),
			filesMain: {
				files: [
					...(minimalInput().filesMain.files ?? []),
					{ id: "file:broken", relativePath: "" },
				],
			},
		});
		expect(model.coverage.diagnostics).toContainEqual({
			code: "malformed_record",
			severity: "warning",
			shard: "files_main.json",
			entityId: "file:broken",
			detail: "File records require a stable id and relativePath",
		});
	});
});
