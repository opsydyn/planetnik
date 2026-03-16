import type { SourceFile } from "../aspects/SourceFile.js"

export class SourceFileDependency {
  sourceFile: SourceFile
  codeFragment: string = ""

  constructor(sourceFile: SourceFile) {
    this.sourceFile = sourceFile
  }
}
