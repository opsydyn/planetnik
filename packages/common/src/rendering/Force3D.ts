export interface Force3DNode {
	readonly id: string;
	readonly size: number;
}

export interface Force3DLink {
	readonly source: string;
	readonly target: string;
	readonly count: number;
}

export interface Force3DObject {
	readonly nodes: readonly Force3DNode[];
	readonly links: readonly Force3DLink[];
}
