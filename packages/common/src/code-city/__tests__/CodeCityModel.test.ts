import { describe, expect, test } from "bun:test";
import type {
	CodeCityModel,
	CodeCitySnapshotInput,
} from "../CodeCityModel.js";

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
