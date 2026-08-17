import { describe, expect, test } from "bun:test";
import type { CodeCityBuilding, CodeCitySignals } from "@planetnik/common";
import { resolveCodeCityLens } from "../lens.js";
import { buildCodeCityScene } from "../sceneAdapter.js";

const signals = (overrides: Partial<CodeCitySignals> = {}): CodeCitySignals => ({
	footprint: { loc: 240, buildingCount: 1 },
	complexity: { maxMcCabe: 24, unitCount: 3 },
	health: { score: 87, severity: "critical", dominantDimension: "change" },
	change: { commits: 18, temporalLinks: 6 },
	ownership: { contributorIds: ["ada", "lin"], contributorCount: 2 },
	impact: { score: 73, dimension: "coupling", sourceId: "impact:alpha" },
	...overrides,
});

const building = (metrics = signals()): CodeCityBuilding => ({
	id: "file:alpha",
	relativePath: "src/alpha.ts",
	extension: "ts",
	sourceSets: ["main"],
	components: ["core"],
	districtIds: ["district:core"],
	primaryDistrictId: "district:core",
	metrics,
	evidence: [],
});

const sceneFor = (entity: CodeCityBuilding) =>
	buildCodeCityScene({
		contractVersion: 1,
		snapshot: { repositoryId: "repo:fixture", title: "Fixture" },
		districts: [
			{
				id: "district:core",
				kind: "component",
				label: "Core",
				decompositionKey: "primary",
				pathPrefix: null,
				buildingIds: [entity.id],
				metrics: signals(),
				evidence: [],
				derived: false,
			},
		],
		buildings: [entity],
		units: [],
		edges: [],
		coverage: {
			presentShards: ["files_main.json"],
			missingOptionalShards: [],
			diagnostics: [],
			derivedDistrictIds: [],
			counts: { files: 1, districts: 1, units: 0, edges: 0, diagnostics: 0 },
		},
		layout: {
			contractVersion: 1,
			seed: "code-city-v1:fixture",
			districtOrder: ["district:core"],
			buildingOrder: [entity.id],
			unitOrder: [],
		},
		legend: { channels: [] },
	});

describe("resolveCodeCityLens", () => {
	test("uses Health as the default semantic lens", () => {
		const visual = resolveCodeCityLens(building(), "health");

		expect(visual).toMatchObject({
			lens: "health",
			available: true,
			label: "Health: 87 (critical)",
			unavailableReason: null,
			surfaceTreatment: "impact",
			nonColorCue: "Health uses impact markers to show health severity without changing the building form.",
		});
	});

	test("gives every lens a named surface treatment and non-colour cue", () => {
		const lenses = [
			"footprint",
			"complexity",
			"health",
			"change_pressure",
			"ownership",
			"impact",
		] as const;

		for (const lens of lenses) {
			const visual = resolveCodeCityLens(building(), lens);
			expect(visual.surfaceTreatment).toBeTruthy();
			expect(visual.nonColorCue).toBeTruthy();
		}
	});

	test("keeps missing health neutral instead of treating null as zero", () => {
		const visual = resolveCodeCityLens(
			building(signals({ health: { score: null, severity: null, dominantDimension: null } })),
			"health",
		);

		expect(visual).toMatchObject({
			available: false,
			label: "Health unavailable",
			unavailableReason: "Health unavailable",
			surfaceTreatment: "unavailable",
			nonColorCue: "Health has no overlay because the signal is unavailable.",
		});
		expect(visual.fill).toBe(visual.accent);
	});

	test("maps health severity to distinct material tones", () => {
		const critical = resolveCodeCityLens(building(), "health");
		const low = resolveCodeCityLens(
			building(signals({ health: { score: 12, severity: "low", dominantDimension: null } })),
			"health",
		);

		expect(low.available).toBe(true);
		expect(low.label).toBe("Health: 12 (low)");
		expect(low.fill).not.toBe(critical.fill);
		expect(low.accent).not.toBe(critical.accent);
	});

	test("exposes the impact score without inventing an absent score", () => {
		const visual = resolveCodeCityLens(building(), "impact");

		expect(visual).toMatchObject({
			available: true,
			label: "Impact: 73 (coupling)",
			unavailableReason: null,
		});
	});

	test("marks zero-contributor ownership unavailable", () => {
		const visual = resolveCodeCityLens(
			building(signals({ ownership: { contributorIds: [], contributorCount: 0 } })),
			"ownership",
		);

		expect(visual).toMatchObject({
			available: false,
			label: "Ownership unavailable",
			unavailableReason: "Ownership unavailable",
		});
	});

	test("is stable for every semantic lens and does not alter scene coordinates", () => {
		const entity = building();
		const scene = sceneFor(entity);
		const positions = structuredClone(scene.nodes);
		const lenses = [
			"footprint",
			"complexity",
			"health",
			"change_pressure",
			"ownership",
			"impact",
		] as const;

		for (const lens of lenses) {
			expect(resolveCodeCityLens(entity, lens)).toEqual(resolveCodeCityLens(entity, lens));
		}
		expect(resolveCodeCityLens(entity, "health").fill).not.toBe(
			resolveCodeCityLens(entity, "impact").fill,
		);
		expect(scene.nodes).toEqual(positions);
	});
});
