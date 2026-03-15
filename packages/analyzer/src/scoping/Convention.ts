import type { SourceFileFilterType } from "../core/SourceFileFilter.js"

export interface Convention extends SourceFileFilterType {
  note: string
}

export function createConvention(pathPattern: string, contentPattern: string = "", note: string = ""): Convention {
  return {
    pathPattern,
    contentPattern,
    exception: false,
    note,
  }
}
