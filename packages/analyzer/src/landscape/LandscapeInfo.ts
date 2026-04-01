import type { RepositoryLink } from "./RepositoryLink.js";
import type { SubLandscapeLink } from "./SubLandscapeLink.js";

export class LandscapeInfo {
	subLandscapes: SubLandscapeLink[] = [];
	repositories: RepositoryLink[] = [];
}
