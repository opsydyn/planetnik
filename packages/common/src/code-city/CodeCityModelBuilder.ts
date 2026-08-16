import {
	CodeCityInputError,
	type CanonicalFileRecord,
	type CanonicalReportContext,
	type CodeCityBuilding,
	type CodeCityCoverage,
	type CodeCityDiagnostic,
	type CodeCityDistrict,
	type CodeCityLegend,
	type CodeCityModel,
	type CodeCitySignals,
	type CodeCitySnapshotInput,
	type CodeCitySourceSet,
} from "./CodeCityModel.js";

type FileDraft = {
	readonly id: string;
	relativePath: string;
	extension: string;
	sourceSets: Set<CodeCitySourceSet>;
	components: Set<string>;
	concerns: Set<string>;
	linesOfCode: number;
	commitsCount: number | null;
	contributorIds: Set<string>;
};

type DistrictDraft = {
	readonly id: string;
	readonly label: string;
	readonly pathPrefix: string;
	readonly buildingIds: Set<string>;
	loc: number;
	commits: number | null;
	contributorIds: Set<string>;
};

const OPTIONAL_SHARDS = [
	"files_test.json",
	"units.json",
	"component_dependencies.json",
	"hotspots.json",
	"impact.json",
] as const;

const LEGEND: CodeCityLegend = {
	channels: [
		{
			id: "footprint",
			label: "Footprint",
			unit: "LOC",
			source: "files_main.json/files_test.json",
		},
		{
			id: "complexity",
			label: "Complexity",
			unit: "McCabe index",
			source: "units.json",
		},
		{
			id: "health",
			label: "Health",
			unit: "score",
			source: "hotspots.json",
		},
		{
			id: "change_pressure",
			label: "Change pressure",
			unit: "commits",
			source: "files_main.json/files_test.json/hotspots.json",
		},
		{
			id: "ownership",
			label: "Ownership",
			unit: "contributors",
			source: "files_main.json/files_test.json",
		},
		{
			id: "impact",
			label: "Impact",
			unit: "score",
			source: "impact.json",
		},
	],
};

function assertValidInput(input: CodeCitySnapshotInput): {
	readonly context: CanonicalReportContext;
} {
	const context = input?.context;
	if (!context || context.dataVersion !== 2) {
		throw new CodeCityInputError(
			"invalid_context",
			"Code City requires a v2 report context",
		);
	}

	if (
		typeof context.repositoryId !== "string" ||
		context.repositoryId.trim().length === 0
	) {
		throw new CodeCityInputError(
			"missing_repository",
			"Code City requires a repository identity",
		);
	}

	if (!input.filesMain || !Array.isArray(input.filesMain.files)) {
		throw new CodeCityInputError(
			"missing_files_main",
			"Code City requires the files_main shard",
		);
	}

	return { context };
}

function normalisePath(value: string): string {
	return value
		.trim()
		.replaceAll("\\", "/")
		.replace(/^(?:\.\/)+/, "")
		.replace(/\/{2,}/g, "/");
}

function pathDistrictId(relativePath: string): string {
	const normalisedPath = normalisePath(relativePath);
	const [firstSegment] = normalisedPath.split("/");
	return `path:${firstSegment || "root"}`;
}

function finiteNonNegative(value: number | undefined): number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? value
		: 0;
}

function optionalCount(value: number | undefined): number | null {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? value
		: null;
}

function sortedUnique(values: Iterable<string>): string[] {
	return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function emptySignals(): CodeCitySignals {
	return {
		footprint: { loc: 0, buildingCount: 0 },
		complexity: { maxMcCabe: null, unitCount: 0 },
		health: { score: null, severity: null, dominantDimension: null },
		change: { commits: null, temporalLinks: null },
		ownership: { contributorIds: [], contributorCount: 0 },
		impact: { score: null, dimension: null, sourceId: null },
	};
}

function signalsForFile(file: FileDraft): CodeCitySignals {
	return {
		...emptySignals(),
		footprint: {
			loc: file.linesOfCode,
			buildingCount: 1,
		},
		change: {
			commits: file.commitsCount,
			temporalLinks: null,
		},
		ownership: {
			contributorIds: sortedUnique(file.contributorIds),
			contributorCount: file.contributorIds.size,
		},
	};
}

function signalsForDistrict(district: DistrictDraft): CodeCitySignals {
	return {
		...emptySignals(),
		footprint: {
			loc: district.loc,
			buildingCount: district.buildingIds.size,
		},
		change: {
			commits: district.commits,
			temporalLinks: null,
		},
		ownership: {
			contributorIds: sortedUnique(district.contributorIds),
			contributorCount: district.contributorIds.size,
		},
	};
}

function mergeFileRecord(
	draft: FileDraft,
	record: CanonicalFileRecord,
	sourceSet: CodeCitySourceSet,
): void {
	draft.sourceSets.add(sourceSet);
	if (record.relativePath) {
		const relativePath = normalisePath(record.relativePath);
		if (relativePath.length > 0) draft.relativePath = relativePath;
	}
	if (record.extension?.trim()) draft.extension = record.extension.trim();
	draft.linesOfCode = Math.max(draft.linesOfCode, finiteNonNegative(record.linesOfCode));
	const commitsCount = optionalCount(record.commitsCount);
	if (commitsCount !== null) {
		draft.commitsCount =
			draft.commitsCount === null
				? commitsCount
				: Math.max(draft.commitsCount, commitsCount);
	}
	for (const component of record.components ?? []) {
		if (component.trim()) draft.components.add(component.trim());
	}
	for (const concern of record.concerns ?? []) {
		if (concern.trim()) draft.concerns.add(concern.trim());
	}
	for (const contributor of record.contributors ?? []) {
		if (contributor.trim()) draft.contributorIds.add(contributor.trim());
	}
}

function collectFiles(input: CodeCitySnapshotInput): {
	readonly files: Map<string, FileDraft>;
	readonly diagnostics: CodeCityDiagnostic[];
} {
	const files = new Map<string, FileDraft>();
	const diagnostics: CodeCityDiagnostic[] = [];
	const shards: Array<
		[CodeCitySourceSet, readonly CanonicalFileRecord[], string]
	> = [["main", input.filesMain.files ?? [], "files_main.json"]];
	if (input.filesTest) {
		shards.push(["test", input.filesTest.files ?? [], "files_test.json"]);
	}

	for (const [sourceSet, records, shard] of shards) {
		for (const [index, record] of records.entries()) {
			const id = typeof record.id === "string" ? record.id.trim() : "";
			const relativePath =
				typeof record.relativePath === "string"
					? normalisePath(record.relativePath)
					: "";
			if (!id || !relativePath) {
				diagnostics.push({
					code: "malformed_record",
					severity: "warning",
					shard,
					entityId: id || `record:${index}`,
					detail: "File records require a stable id and relativePath",
				});
				continue;
			}

			let draft = files.get(id);
			if (!draft) {
				draft = {
					id,
					relativePath,
					extension:
						typeof record.extension === "string"
							? record.extension.trim()
							: "",
					sourceSets: new Set<CodeCitySourceSet>(),
					components: new Set<string>(),
					concerns: new Set<string>(),
					linesOfCode: 0,
					commitsCount: null,
					contributorIds: new Set<string>(),
				};
				files.set(id, draft);
			}
			mergeFileRecord(draft, record, sourceSet);
		}
	}

	for (const file of files.values()) {
		if (!file.extension) {
			const extension = file.relativePath.split(".").at(-1);
			file.extension = extension && extension !== file.relativePath ? extension : "";
		}
	}

	return { files, diagnostics };
}

function createCoverage(
	input: CodeCitySnapshotInput,
	diagnostics: readonly CodeCityDiagnostic[],
	derivedDistrictIds: readonly string[],
	counts: CodeCityCoverage["counts"],
): CodeCityCoverage {
	const presentShards = ["report_context.json", "files_main.json"];
	const optionalInputs: readonly [string, unknown][] = [
		["files_test.json", input.filesTest],
		["units.json", input.units],
		["component_dependencies.json", input.componentDependencies],
		["hotspots.json", input.hotspots],
		["impact.json", input.impact],
	];
	const missingOptionalShards: string[] = [];
	for (const [shard, value] of optionalInputs) {
		if (value === undefined) missingOptionalShards.push(shard);
		else presentShards.push(shard);
	}

	return {
		presentShards,
		missingOptionalShards,
		diagnostics,
		derivedDistrictIds,
		counts,
	};
}

function snapshotFromContext(context: CanonicalReportContext) {
	return {
		repositoryId: context.repositoryId!.trim(),
		title:
			typeof context.title === "string" && context.title.trim()
				? context.title.trim()
				: context.repositoryId!.trim(),
		...(context.snapshotId?.trim()
			? { snapshotId: context.snapshotId.trim() }
			: {}),
		...(context.generatedAt?.trim()
			? { generatedAt: context.generatedAt.trim() }
			: {}),
	};
}

export function buildCodeCityModel(input: CodeCitySnapshotInput): CodeCityModel {
	const { context } = assertValidInput(input);
	const { files, diagnostics } = collectFiles(input);
	const districtDrafts = new Map<string, DistrictDraft>();
	const buildings: CodeCityBuilding[] = [];

	for (const file of files.values()) {
		const districtId = pathDistrictId(file.relativePath);
		const pathPrefix = districtId.slice("path:".length);
		let district = districtDrafts.get(districtId);
		if (!district) {
			district = {
				id: districtId,
				label: pathPrefix,
				pathPrefix,
				buildingIds: new Set<string>(),
				loc: 0,
				commits: null,
				contributorIds: new Set<string>(),
			};
			districtDrafts.set(districtId, district);
		}
		district.buildingIds.add(file.id);
		district.loc += file.linesOfCode;
		if (file.commitsCount !== null) {
			district.commits =
				district.commits === null
					? file.commitsCount
					: district.commits + file.commitsCount;
		}
		for (const contributor of file.contributorIds) {
			district.contributorIds.add(contributor);
		}
		buildings.push({
			id: file.id,
			relativePath: file.relativePath,
			extension: file.extension,
			sourceSets: sortedUnique(file.sourceSets) as CodeCitySourceSet[],
			components: sortedUnique(file.components),
			districtIds: [districtId],
			primaryDistrictId: districtId,
			metrics: signalsForFile(file),
			evidence: [],
		});
	}

	const districts: CodeCityDistrict[] = [...districtDrafts.values()].map(
		(district) => ({
			id: district.id,
			kind: "path",
			label: district.label,
			decompositionKey: null,
			pathPrefix: district.pathPrefix,
			buildingIds: [...district.buildingIds].sort((left, right) =>
				left.localeCompare(right),
			),
			metrics: signalsForDistrict(district),
			evidence: [],
			derived: true,
		}),
	);
	const sortedBuildings = buildings.sort((left, right) =>
		left.id.localeCompare(right.id),
	);
	const sortedDistricts = districts.sort((left, right) =>
		left.id.localeCompare(right.id),
	);
	const derivedDistrictIds = sortedDistricts.map(({ id }) => id);
	const counts = {
		files: sortedBuildings.length,
		districts: sortedDistricts.length,
		units: 0,
		edges: 0,
		diagnostics: diagnostics.length,
	};

	return {
		contractVersion: 1,
		snapshot: snapshotFromContext(context),
		districts: sortedDistricts,
		buildings: sortedBuildings,
		units: [],
		edges: [],
		coverage: createCoverage(input, diagnostics, derivedDistrictIds, counts),
		layout: {
			contractVersion: 1,
			seed: `code-city-v1:${context.repositoryId!.trim()}`,
			districtOrder: sortedDistricts.map(({ id }) => id),
			buildingOrder: sortedBuildings.map(({ id }) => id),
			unitOrder: [],
		},
		legend: LEGEND,
	};
}
