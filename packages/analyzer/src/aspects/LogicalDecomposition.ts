import type { SourceFileFilter } from "../core/SourceFileFilter.js"
import type { NamedSourceCodeAspect } from "./NamedSourceCodeAspect.js"

export class LogicalDecomposition {
  name: string
  scope: string = "main"
  filters: ReturnType<typeof SourceFileFilter.make>[] = []
  componentsFolderDepth: number = 1
  minComponentsCount: number = 0
  components: NamedSourceCodeAspect[] = []
  includeRemainingFiles: boolean = true
  includeExternalComponents: boolean = true
  dependencyLinkThreshold: number = 1
  duplicationLinkThreshold: number = 50
  temporalLinkThreshold: number = 1
  maxSearchDepthLines: number = 200

  constructor(name: string = "") {
    this.name = name
  }
}
