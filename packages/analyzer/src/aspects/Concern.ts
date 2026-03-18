import { NamedSourceCodeAspect } from "./NamedSourceCodeAspect.js"
import type { SourceFileFilter } from "../core/SourceFileFilter.js"

export class Concern extends NamedSourceCodeAspect {
  constructor(name: string = "", sourceFileFilters: ReturnType<typeof SourceFileFilter.make>[] = []) {
    super(name, sourceFileFilters)
  }
}

export class DerivedConcern extends Concern {
  constructor(name: string = "") {
    super(name)
  }
}
