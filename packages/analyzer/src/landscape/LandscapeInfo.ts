import type { SokratesRepositoryLink } from "./SokratesRepositoryLink.js"
import type { SubLandscapeLink } from "./SubLandscapeLink.js"

export class LandscapeInfo {
  subLandscapes: SubLandscapeLink[] = []
  repositories: SokratesRepositoryLink[] = []
}
