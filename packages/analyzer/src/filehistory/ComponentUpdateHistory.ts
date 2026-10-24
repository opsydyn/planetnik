import type { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import type { SourceFile } from "../aspects/SourceFile.js"
import type { FileModificationHistory } from "./FileModificationHistory.js"

export class ComponentUpdateHistory {
  component: NamedSourceCodeAspect
  dates: string[] = []
  private dateSourceFileMap = new Map<string, SourceFile[]>()

  constructor(component: NamedSourceCodeAspect) {
    this.component = component
  }

  addDate(date: string): void {
    if (!this.dates.includes(date)) {
      this.dates.push(date)
      this.dates.sort()
    }
  }

  addDates(histories: FileModificationHistory | FileModificationHistory[]): void {
    const list = Array.isArray(histories) ? histories : [histories]
    for (const history of list) {
      for (const date of history.dates) {
        const sourceFile = this.component.sourceFiles.find(
          (f) => f.relativePath === history.path && f.logicalComponents.some((c) => c.name === this.component.name),
        )
        if (sourceFile) {
          this.addSourceFileDate(date, sourceFile)
        }
      }
    }
  }

  private addSourceFileDate(date: string, sourceFile: SourceFile): void {
    this.addDate(date)
    let files = this.dateSourceFileMap.get(date)
    if (!files) {
      files = []
      this.dateSourceFileMap.set(date, files)
    }
    if (!files.includes(sourceFile)) {
      files.push(sourceFile)
    }
  }

  getSourceFilesForDate(date: string): SourceFile[] {
    return this.dateSourceFileMap.get(date) ?? []
  }
}
