export type CodeCityScenePoint = {
	readonly x: number;
	readonly y: number;
	readonly z: number;
};

export type CodeCitySceneNode = {
	readonly id: string;
	readonly kind: "district" | "building";
	readonly label: string;
	readonly parentId: string | null;
	readonly center: { readonly x: number; readonly z: number };
	readonly size: {
		readonly width: number;
		readonly depth: number;
		readonly height: number;
	};
	readonly districtKey: string;
};

export type CodeCitySceneEdge = {
	readonly id: string;
	readonly sourceId: string;
	readonly targetId: string;
	readonly renderable: boolean;
	readonly points: readonly CodeCityScenePoint[];
	readonly weight: number;
};

export type CodeCityScene = {
	readonly contractVersion: 1;
	readonly nodes: readonly CodeCitySceneNode[];
	readonly edges: readonly CodeCitySceneEdge[];
	readonly bounds: {
		readonly width: number;
		readonly depth: number;
		readonly height: number;
	};
};
