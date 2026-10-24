import type { LandscapeAnalysisResults } from "./LandscapeAnalysisResults.js"

export class SubLandscapeLink {
  name: string = ""
  indexFilePath: string = ""
  landscapeAnalysisResults: LandscapeAnalysisResults | null = null

  constructor(name: string = "", indexFilePath: string = "") {
    this.name = name
    this.indexFilePath = indexFilePath
  }
}
