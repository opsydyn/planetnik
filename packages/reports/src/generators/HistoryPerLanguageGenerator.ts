import type { HistoryPerExtension, MergeExtension } from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"

export enum HistoryMode {
  COMMITS = "COMMITS",
  CONTRIBUTORS = "CONTRIBUTORS",
}

export class HistoryPerLanguageGenerator {
  static readonly MAX_HISTORY_WINDOW_SIZE = 20
  static readonly MAX_NUMBER_OF_EXTENSIONS = 100

  private mode: HistoryMode
  private history: HistoryPerExtension[]
  private mergeExtensions: MergeExtension[] = []
  private extensionFilter: string[] | null = null
  private currentYear: number
  private max = 1
  private firstYear = 0

  private constructor(mode: HistoryMode, history: HistoryPerExtension[]) {
    this.mode = mode
    this.history = history
    this.currentYear = new Date().getFullYear()
  }

  static createCommits(history: HistoryPerExtension[], extensions?: string[]): HistoryPerLanguageGenerator {
    const gen = new HistoryPerLanguageGenerator(HistoryMode.COMMITS, history)
    if (extensions) gen.extensionFilter = extensions
    return gen
  }

  static createContributors(history: HistoryPerExtension[], extensions?: string[]): HistoryPerLanguageGenerator {
    const gen = new HistoryPerLanguageGenerator(HistoryMode.CONTRIBUTORS, history)
    if (extensions) gen.extensionFilter = extensions
    return gen
  }

  setMergeExtensions(mergeExtensions: MergeExtension[]): void {
    this.mergeExtensions = mergeExtensions
  }

  addHistoryPerLanguage(report: RichTextReport): void {
    const mergedHistory = this.mergeHistory()
    this.max = Math.max(1, ...mergedHistory.map((h) => this.getValue(h)))
    this.firstYear = Math.min(...mergedHistory.map((h) => this.getYearInt(h)).filter((y) => y > 0))

    report.startTable()
    this.addHeader(report)
    const extensions = this.getExtensions()
    for (const ext of extensions.slice(0, HistoryPerLanguageGenerator.MAX_NUMBER_OF_EXTENSIONS)) {
      this.addExtensionRow(report, ext)
    }
    report.endTable()
  }

  addHistoryPerComponent(report: RichTextReport): void {
    const mergedHistory = this.mergeHistory()
    this.max = Math.max(1, ...mergedHistory.map((h) => this.getValue(h)))
    this.firstYear = Math.min(...mergedHistory.map((h) => this.getYearInt(h)).filter((y) => y > 0))

    report.startTable()
    this.addHeader(report)
    const extensions = this.getExtensions()
    for (const ext of extensions.slice(0, HistoryPerLanguageGenerator.MAX_NUMBER_OF_EXTENSIONS)) {
      this.addComponentRow(report, ext)
    }
    report.endTable()
  }

  private mergeHistory(): HistoryPerExtension[] {
    const mergedMap = new Map<string, HistoryPerExtension>()
    const mergedList: HistoryPerExtension[] = []

    for (const h of this.history) {
      const mergedExt = this.getMergedExtension(h.extension)
      const key = `${mergedExt}::${h.year}`

      const existing = mergedMap.get(key)
      if (existing) {
        existing.commitsCount += h.commitsCount
        for (const c of h.contributors) {
          existing.contributors.add(c)
        }
      } else {
        const newItem: HistoryPerExtension = {
          extension: mergedExt,
          year: h.year,
          commitsCount: h.commitsCount,
          contributors: new Set(h.contributors),
        }
        mergedMap.set(key, newItem)
        mergedList.push(newItem)
      }
    }

    return mergedList
  }

  private getValue(h: HistoryPerExtension): number {
    return this.mode === HistoryMode.COMMITS ? h.commitsCount : h.contributors.size
  }

  private getYearInt(h: HistoryPerExtension): number {
    const n = Number.parseInt(h.year, 10)
    return Number.isNaN(n) ? 0 : n
  }

  private getExtensions(): string[] {
    let list: string[]
    if (this.extensionFilter && this.extensionFilter.length > 0) {
      list = [...this.extensionFilter]
    } else {
      const exts = new Set<string>()
      for (const h of this.history) exts.add(h.extension)
      list = [...exts]
    }

    list.sort((a, b) => this.getSortValue(b) - this.getSortValue(a))
    return list
  }

  private getSortValue(extension: string): number {
    const thisYear = this.getCountForYear(extension, this.currentYear) ?? 0
    const prevYear = this.getCountForYear(extension, this.currentYear - 1) ?? 0
    return thisYear + prevYear
  }

  private getCountForYear(name: string, year: number): number | null {
    const yearStr = `${year}`
    const matches = this.history.filter((h) => h.extension.toLowerCase() === name.toLowerCase() && h.year === yearStr)
    if (matches.length === 0) return null
    return matches.reduce((sum, item) => sum + this.getValue(item), 0)
  }

  private addHeader(report: RichTextReport): void {
    report.startTableRow()
    report.addTableCell("", "border: none; text-align: center")
    for (let year = this.endYear(); year >= this.startYear(); year--) {
      report.addTableCell(`${year}`, "border: none; padding: 0; font-size: 60%; text-align: center")
    }
    report.addTableCell("", "border: none; text-align: center")
    report.endTableRow()
  }

  private addExtensionRow(report: RichTextReport, extension: string): void {
    report.startTableRow()
    report.addTableCell(
      extension,
      "text-align: center; color: grey; font-size: 80%; vertical-align: bottom; border: none;",
    )
    for (let year = this.endYear(); year >= this.startYear(); year--) {
      this.addCell(report, extension, year)
    }
    report.addTableCell(
      extension,
      "text-align: left; color: grey; font-size: 80%; vertical-align: middle; border: none;",
    )
    report.endTableRow()
  }

  private addComponentRow(report: RichTextReport, extension: string): void {
    report.startTableRow()
    report.addTableCell(
      extension,
      "text-align: right; color: grey; font-size: 80%; vertical-align: middle; border: none;",
    )
    for (let year = this.endYear(); year >= this.startYear(); year--) {
      this.addCell(report, extension, year)
    }
    report.endTableRow()
  }

  private addCell(report: RichTextReport, name: string, year: number): void {
    const value = this.getCountForYear(name, year)
    const recent = year >= this.currentYear - 1
    const bgColor = this.mode === HistoryMode.COMMITS ? "#343434" : "skyblue"

    if (value !== null) {
      const height = 1 + Math.floor((64.0 * value) / this.max)
      report.startTableCell("border: none; padding: 1px; text-align: center; vertical-align: bottom")
      report.addContentInDiv(`${value}`, "margin: auto; color: grey; font-size: 60%")
      report.addContentInDivWithTooltip(
        "",
        "",
        `margin: auto; width: 32px; background-color: ${bgColor}; opacity: ${recent ? "1.0" : "0.5"}; height:${height}px`,
      )
      report.endTableCell()
    } else {
      report.startTableCell("border: none; padding: 1px; text-align: center; vertical-align: bottom")
      report.addContentInDivWithTooltip("", "", "margin: auto; width: 32px; background-color: lightgrey; height: 1px")
      report.endTableCell()
    }
  }

  private endYear(): number {
    return this.currentYear
  }

  private startYear(): number {
    return Math.max(this.firstYear, this.endYear() - HistoryPerLanguageGenerator.MAX_HISTORY_WINDOW_SIZE)
  }

  private getMergedExtension(extension: string): string {
    for (const merge of this.mergeExtensions) {
      if (merge.secondary.toLowerCase() === extension.toLowerCase()) {
        return merge.primary.toLowerCase()
      }
    }
    return extension.toLowerCase()
  }
}
