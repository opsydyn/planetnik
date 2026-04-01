import type { LinkType } from "../core/Link.js";

export class PersonConfig {
	name: string = "";
	link: string = "";
	links: LinkType[] = [];
	image: string = "";
	emailPatterns: string[] = [];
}
