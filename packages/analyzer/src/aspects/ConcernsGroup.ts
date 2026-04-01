import type { Concern } from "./Concern.js";

export class ConcernsGroup {
	name: string;
	concerns: Concern[];
	metaConcerns: Array<{
		pathPattern: string;
		contentPattern: string;
		use: string;
	}> = [];

	constructor(name: string = "") {
		this.name = name;
		this.concerns = [];
	}
}
