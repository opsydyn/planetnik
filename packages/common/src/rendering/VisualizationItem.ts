export class VisualizationItem {
	readonly name: string;
	readonly size: number;
	readonly color: string;
	readonly children: VisualizationItem[];

	constructor(name: string, size: number, color: string = "") {
		this.name = name;
		this.size = size;
		this.color = color;
		this.children = [];
	}
}
