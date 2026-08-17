import type {
	CodeCityBuilding,
	CodeCityDependencyEdge,
	CodeCityDistrict,
	CodeCityModel,
} from "@planetnik/common";
import type {
	CodeCityScene,
	CodeCitySceneEdge,
	CodeCitySceneNode,
} from "./sceneTypes.js";
import {
	buildCodeCityVisualContext,
	resolveCodeCityBuildingVisual,
	resolveCodeCityDistrictVisual,
} from "./visualTokens.js";

const CELL_SIZE = 4;
const PARCEL_MARGIN = 2;
const PARCEL_GAP = 4;
const DISTRICT_HEIGHT = 0.5;
const ROUTE_HEIGHT = 1;
const ROUTE_APEX_HEIGHT = 2;

type DistrictPlacement = {
	readonly district: CodeCityDistrict;
	readonly center: { readonly x: number; readonly z: number };
	readonly width: number;
	readonly depth: number;
	readonly cellColumns: number;
};

const compareText = (left: string, right: string): number =>
	left < right ? -1 : left > right ? 1 : 0;

const stableHash = (value: string): number => {
	let hash = 2_166_136_261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16_777_619);
	}
	return hash >>> 0;
};

const orderByLayout = <T extends { readonly id: string }>(
	items: readonly T[],
	order: readonly string[],
	seed: string,
): T[] => {
	const positions = new Map(order.map((id, index) => [id, index]));
	return [...items].sort((left, right) => {
		const leftPosition = positions.get(left.id) ?? Number.MAX_SAFE_INTEGER;
		const rightPosition = positions.get(right.id) ?? Number.MAX_SAFE_INTEGER;
		if (leftPosition !== rightPosition) return leftPosition - rightPosition;

		const leftTieBreak = stableHash(`${seed}:${left.id}`);
		const rightTieBreak = stableHash(`${seed}:${right.id}`);
		if (leftTieBreak !== rightTieBreak) return leftTieBreak - rightTieBreak;
		return compareText(left.id, right.id);
	});
};

const uniqueById = <T extends { readonly id: string }>(items: readonly T[]): T[] => {
	const byId = new Map<string, T>();
	for (const item of items) {
		if (!byId.has(item.id)) byId.set(item.id, item);
	}
	return [...byId.values()];
};

const parcelDimensions = (buildingCount: number) => {
	const padding = Math.min(2, Math.max(1, Math.ceil(buildingCount / 4)));
	const capacity = Math.max(1, buildingCount + padding);
	const columns = Math.ceil(Math.sqrt(capacity));
	const rows = Math.ceil(capacity / columns);
	return {
		cellColumns: columns,
		width: columns * CELL_SIZE + PARCEL_MARGIN * 2,
		depth: rows * CELL_SIZE + PARCEL_MARGIN * 2,
	};
};

const buildingHeight = (loc: number): number =>
	Math.min(18, Math.max(1.25, 1 + Math.log2(Math.max(0, loc) + 1)));

const sceneEdge = (
	edge: CodeCityDependencyEdge,
	districts: ReadonlyMap<string, DistrictPlacement>,
): CodeCitySceneEdge => {
	const sourceId = edge.sourceDistrictId ?? "";
	const targetId = edge.targetDistrictId ?? "";
	const source = districts.get(sourceId);
	const target = districts.get(targetId);

	if (!source || !target) {
		return {
			id: edge.id,
			sourceId,
			targetId,
			renderable: false,
			points: [],
			weight: edge.count,
		};
	}

	const midpoint = {
		x: (source.center.x + target.center.x) / 2,
		z: (source.center.z + target.center.z) / 2,
	};
	return {
		id: edge.id,
		sourceId,
		targetId,
		renderable: true,
		points: [
			{ x: source.center.x, y: ROUTE_HEIGHT, z: source.center.z },
			{ x: midpoint.x, y: ROUTE_APEX_HEIGHT, z: midpoint.z },
			{ x: target.center.x, y: ROUTE_HEIGHT, z: target.center.z },
		],
		weight: edge.count,
	};
};

export function buildCodeCityScene(model: CodeCityModel): CodeCityScene {
	const visualContext = buildCodeCityVisualContext(model);
	const districts = orderByLayout(
		uniqueById(model.districts),
		model.layout.districtOrder,
		model.layout.seed,
	);
	const buildings = orderByLayout(
		uniqueById(model.buildings),
		model.layout.buildingOrder,
		model.layout.seed,
	);
	const buildingsByDistrict = new Map<string, CodeCityBuilding[]>();
	for (const building of buildings) {
		const districtBuildings = buildingsByDistrict.get(building.primaryDistrictId) ?? [];
		districtBuildings.push(building);
		buildingsByDistrict.set(building.primaryDistrictId, districtBuildings);
	}

	const dimensionByDistrict = new Map(
		districts.map((district) => [
			district.id,
			parcelDimensions(buildingsByDistrict.get(district.id)?.length ?? 0),
		]),
	);
	const parcelColumns = Math.max(1, Math.ceil(Math.sqrt(districts.length)));
	const maxParcelWidth = Math.max(
		0,
		...districts.map((district) => dimensionByDistrict.get(district.id)!.width),
	);
	const maxParcelDepth = Math.max(
		0,
		...districts.map((district) => dimensionByDistrict.get(district.id)!.depth),
	);
	const districtPlacements = new Map<string, DistrictPlacement>();

	for (const [index, district] of districts.entries()) {
		const dimensions = dimensionByDistrict.get(district.id)!;
		const column = index % parcelColumns;
		const row = Math.floor(index / parcelColumns);
		districtPlacements.set(district.id, {
			district,
			center: {
				x: column * (maxParcelWidth + PARCEL_GAP),
				z: row * (maxParcelDepth + PARCEL_GAP),
			},
			width: dimensions.width,
			depth: dimensions.depth,
			cellColumns: dimensions.cellColumns,
		});
	}

	const nodes: CodeCitySceneNode[] = [];
	for (const placement of districtPlacements.values()) {
		nodes.push({
			id: placement.district.id,
			kind: "district",
			label: placement.district.label,
			parentId: null,
			center: placement.center,
			size: {
				width: placement.width,
				depth: placement.depth,
				height: DISTRICT_HEIGHT,
			},
			districtKey: placement.district.id,
			visual: resolveCodeCityDistrictVisual(placement.district, visualContext),
		});
	}

	for (const building of buildings) {
		const placement = districtPlacements.get(building.primaryDistrictId);
		if (!placement) continue;
		const districtBuildings = buildingsByDistrict.get(building.primaryDistrictId)!;
		const buildingIndex = districtBuildings.findIndex(({ id }) => id === building.id);
		const column = buildingIndex % placement.cellColumns;
		const row = Math.floor(buildingIndex / placement.cellColumns);
		nodes.push({
			id: building.id,
			kind: "building",
			label: building.relativePath,
			parentId: building.primaryDistrictId,
			center: {
				x:
					placement.center.x - placement.width / 2 + PARCEL_MARGIN + CELL_SIZE * (column + 0.5),
				z:
					placement.center.z - placement.depth / 2 + PARCEL_MARGIN + CELL_SIZE * (row + 0.5),
			},
			size: {
				width: CELL_SIZE * 0.7,
				depth: CELL_SIZE * 0.7,
				height: buildingHeight(building.metrics.footprint.loc),
			},
			districtKey: building.primaryDistrictId,
			visual: resolveCodeCityBuildingVisual(building, visualContext),
		});
	}

	const edges = orderByLayout(uniqueById(model.edges), [], model.layout.seed).map(
		(edge) => sceneEdge(edge, districtPlacements),
	);
	const minimumX = Math.min(
		0,
		...nodes.map((node) => node.center.x - node.size.width / 2),
	);
	const maximumX = Math.max(
		0,
		...nodes.map((node) => node.center.x + node.size.width / 2),
	);
	const minimumZ = Math.min(
		0,
		...nodes.map((node) => node.center.z - node.size.depth / 2),
	);
	const maximumZ = Math.max(
		0,
		...nodes.map((node) => node.center.z + node.size.depth / 2),
	);
	const routeHeight = Math.max(0, ...edges.flatMap((edge) => edge.points.map((point) => point.y)));

	return {
		contractVersion: 1,
		nodes,
		edges,
		bounds: {
			width: maximumX - minimumX,
			depth: maximumZ - minimumZ,
			height: Math.max(routeHeight, ...nodes.map((node) => node.size.height)),
		},
	};
}
