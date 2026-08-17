import { describe, expect, test } from "bun:test";
import type { CodeCityModel, CodeCitySignals } from "@planetnik/common";
import { buildCodeCityScene } from "../../index.js";

const signals = (loc: number): CodeCitySignals => ({
	footprint: { loc, buildingCount: 1 },
	complexity: { maxMcCabe: null, unitCount: 0 },
	health: { score: null, severity: null, dominantDimension: null },
	change: { commits: null, temporalLinks: null },
	ownership: { contributorIds: [], contributorCount: 0 },
	impact: { score: null, dimension: null, sourceId: null },
});

const modelFixture = (): CodeCityModel => ({
	contractVersion: 1,
	snapshot: { repositoryId: "repo:fixture", title: "Fixture" },
	districts: [
		{
			id: "district:core",
			kind: "component",
			label: "Core",
			decompositionKey: "primary",
			pathPrefix: null,
			buildingIds: ["file:alpha", "file:beta"],
			metrics: signals(180),
			evidence: [],
			derived: false,
		},
		{
			id: "district:web",
			kind: "component",
			label: "Web",
			decompositionKey: "primary",
			pathPrefix: null,
			buildingIds: ["file:alpha", "file:gamma"],
			metrics: signals(110),
			evidence: [],
			derived: false,
		},
	],
	buildings: [
		{
			id: "file:alpha",
			relativePath: "src/alpha.ts",
			extension: "ts",
			sourceSets: ["main"],
			components: ["core", "web"],
			districtIds: ["district:core", "district:web"],
			primaryDistrictId: "district:core",
			metrics: signals(320),
			evidence: [],
		},
		{
			id: "file:beta",
			relativePath: "src/beta.ts",
			extension: "ts",
			sourceSets: ["main"],
			components: ["core"],
			districtIds: ["district:core"],
			primaryDistrictId: "district:core",
			metrics: signals(20),
			evidence: [],
		},
		{
			id: "file:gamma",
			relativePath: "src/gamma.ts",
			extension: "ts",
			sourceSets: ["main"],
			components: ["web"],
			districtIds: ["district:web"],
			primaryDistrictId: "district:web",
			metrics: signals(10_000_000),
			evidence: [],
		},
	],
	units: [],
	edges: [
		{
			id: "edge:core-web",
			kind: "component_dependency",
			decompositionKey: "primary",
			sourceDistrictId: "district:core",
			targetDistrictId: "district:web",
			count: 4,
			locFrom: 180,
			evidenceCount: 2,
			resolution: "both",
			evidence: [],
		},
		{
			id: "edge:unresolved",
			kind: "component_dependency",
			decompositionKey: "primary",
			sourceDistrictId: "district:core",
			targetDistrictId: null,
			count: 1,
			locFrom: null,
			evidenceCount: null,
			resolution: "source",
			evidence: [],
		},
	],
	coverage: {
		presentShards: ["files_main.json"],
		missingOptionalShards: [],
		diagnostics: [],
		derivedDistrictIds: [],
		counts: { files: 3, districts: 2, units: 0, edges: 2, diagnostics: 0 },
	},
	layout: {
		contractVersion: 1,
		seed: "code-city-v1:fixture",
		districtOrder: ["district:core", "district:web"],
		buildingOrder: ["file:alpha", "file:beta", "file:gamma"],
		unitOrder: [],
	},
	legend: { channels: [] },
});

const permutedModelFixture = (): CodeCityModel => {
	const model = modelFixture();
	return {
		...model,
		districts: [...model.districts].reverse(),
		buildings: [...model.buildings].reverse(),
		edges: [...model.edges].reverse(),
	};
};

describe("buildCodeCityScene", () => {
	test("builds stable district and building positions", () => {
		const first = buildCodeCityScene(modelFixture());
		const permuted = buildCodeCityScene(permutedModelFixture());

		expect(first).toEqual(permuted);
		expect(first.nodes.filter((node) => node.kind === "district")).toHaveLength(2);
		expect(first.nodes.filter((node) => node.kind === "building")).toHaveLength(3);
		expect(first.bounds.width).toBeGreaterThan(0);
		expect(first.bounds.depth).toBeGreaterThan(0);
	});

	test("keeps multi-affiliated buildings unique in their valid primary district", () => {
		const scene = buildCodeCityScene(modelFixture());
		const districts = new Set(
			scene.nodes.filter((node) => node.kind === "district").map((node) => node.id),
		);
		const alpha = scene.nodes.filter((node) => node.id === "file:alpha");
		const buildings = scene.nodes.filter((node) => node.kind === "building");

		expect(alpha).toHaveLength(1);
		expect(alpha[0]?.parentId).toBe("district:core");
		for (const building of buildings) expect(districts.has(building.parentId ?? "")).toBe(true);
	});

	test("retains unresolved component edges without drawing them", () => {
		const scene = buildCodeCityScene(modelFixture());
		const resolved = scene.edges.find((edge) => edge.id === "edge:core-web");
		const unresolved = scene.edges.find((edge) => edge.id === "edge:unresolved");

		expect(resolved).toMatchObject({
			sourceId: "district:core",
			targetId: "district:web",
			renderable: true,
		});
		expect(resolved?.points).toHaveLength(3);
		expect(unresolved).toEqual({
			id: "edge:unresolved",
			sourceId: "district:core",
			targetId: "",
			renderable: false,
			points: [],
			weight: 1,
		});
	});

	test("produces JSON-serialisable scene records", () => {
		const scene = buildCodeCityScene(modelFixture());
		expect(JSON.parse(JSON.stringify(scene))).toEqual(scene);
	});

	test("attaches renderer-neutral visual tokens without changing the scene contract", () => {
		const scene = buildCodeCityScene(modelFixture());

		expect(scene.nodes.find((node) => node.id === "district:core")?.visual).toEqual({
			kind: "district",
			parcelStyle: "civic",
			landmarkTier: "super_hub",
			texturePattern: "gridded",
		});
		expect(scene.nodes.find((node) => node.id === "file:alpha")?.visual).toEqual({
			kind: "building",
			materialFamily: "brick",
			archetype: "tower",
			roofStyle: "capped",
			texturePattern: "solid",
			floorCount: 5,
			facadeSegments: 1,
			multiDistrict: true,
		});
	});
});
