import type { IFuseOptions } from "fuse.js";
import type { SearchDocument } from "./types";

export const searchKeys = [
	{ name: "title", weight: 0.42 },
	{ name: "keywords", weight: 0.28 },
	{ name: "subtitle", weight: 0.16 },
	{ name: "description", weight: 0.1 },
	{ name: "route", weight: 0.04 },
] satisfies NonNullable<IFuseOptions<SearchDocument>["keys"]>;

export const fuseOptions: IFuseOptions<SearchDocument> = {
	includeMatches: true,
	includeScore: true,
	ignoreLocation: true,
	minMatchCharLength: 2,
	threshold: 0.32,
	keys: searchKeys,
};
