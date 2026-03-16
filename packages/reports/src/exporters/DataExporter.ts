import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { CodeAnalysisResults } from "@planetnik/analyzer"
import { fileExportInfoFromSourceFile } from "./FileExportInfo.js"

export class DataExporter {
  private analysisResults: CodeAnalysisResults
  private reportsFolder: string

  constructor(analysisResults: CodeAnalysisResults, reportsFolder: string) {
    this.analysisResults = analysisResults
    this.reportsFolder = reportsFolder
  }

  exportData(): void {
    const dataFolder = join(this.reportsFolder, "data")
    if (!existsSync(dataFolder)) {
      mkdirSync(dataFolder, { recursive: true })
    }

    this.exportFileLists(dataFolder)
    this.exportMetrics(dataFolder)
    this.exportJson(dataFolder)
    this.exportUnits(dataFolder)
    this.exportDuplicates(dataFolder)
    this.exportDependencies(dataFolder)
  }

  private exportFileLists(dataFolder: string): void {
    const mainFiles = this.analysisResults.mainAspectAnalysisResults
    if (!mainFiles) return

    const allFiles = this.analysisResults.codeConfiguration?.main.sourceFiles ?? []
    const exportInfos = allFiles.map(fileExportInfoFromSourceFile)
    writeFileSync(join(dataFolder, "files.json"), JSON.stringify(exportInfos, null, 2), "utf-8")

    // Export simple file list
    const fileList = allFiles.map((f) => `${f.relativePath}\t${f.linesOfCode}\t${f.extension}`).join("\n")
    writeFileSync(join(dataFolder, "files.txt"), fileList, "utf-8")
  }

  private exportMetrics(dataFolder: string): void {
    const metrics = this.analysisResults.metricsList.metrics
    const lines = metrics.map((m) => `${m.id}\t${m.value}`).join("\n")
    writeFileSync(join(dataFolder, "metrics.txt"), lines, "utf-8")
  }

  private exportJson(dataFolder: string): void {
    const summary = {
      metadata: this.analysisResults.codeConfiguration?.metadata,
      filesCount: this.analysisResults.mainAspectAnalysisResults?.filesCount ?? 0,
      linesOfCode: this.analysisResults.mainAspectAnalysisResults?.linesOfCode ?? 0,
      duplication: {
        percentage: this.analysisResults.duplicationAnalysisResults.overallDuplication.getDuplicationPercentage(),
        duplicatedLines: this.analysisResults.duplicationAnalysisResults.overallDuplication.duplicatedLinesOfCode,
        cleanedLines: this.analysisResults.duplicationAnalysisResults.overallDuplication.cleanedLinesOfCode,
      },
    }
    writeFileSync(join(dataFolder, "analysisResults.json"), JSON.stringify(summary, null, 2), "utf-8")
  }

  private exportUnits(dataFolder: string): void {
    const units = this.analysisResults.unitsAnalysisResults.allUnits
    const lines = units
      .map(
        (u) =>
          `${u.sourceFile?.relativePath ?? ""}\t${u.shortName}\t${u.linesOfCode}\t${u.mcCabeIndex}\t${u.startLine}`,
      )
      .join("\n")
    writeFileSync(join(dataFolder, "units.txt"), lines, "utf-8")
  }

  private exportDuplicates(dataFolder: string): void {
    const duplicates = this.analysisResults.duplicationAnalysisResults.allDuplicates
    const exportData = duplicates.map((d) => ({
      blockSize: d.blockSize,
      displayContent: d.displayContent,
      files: d.duplicatedFileBlocks.map((b) => ({
        path: b.sourceFile?.relativePath ?? "",
        startLine: b.startLine,
        endLine: b.endLine,
        cleanedStartLine: b.cleanedStartLine,
        cleanedEndLine: b.cleanedEndLine,
      })),
    }))
    writeFileSync(join(dataFolder, "duplicates.json"), JSON.stringify(exportData, null, 2), "utf-8")
  }

  private exportDependencies(dataFolder: string): void {
    const dependencies = this.analysisResults.allDependencies
    if (dependencies.length === 0) return

    const exportData = dependencies.map((d) => ({
      from: d.from,
      to: d.to,
      evidence: d.evidence,
    }))
    writeFileSync(join(dataFolder, "dependencies.json"), JSON.stringify(exportData, null, 2), "utf-8")

    // Export units as JSON too
    const units = this.analysisResults.unitsAnalysisResults.allUnits
    if (units.length > 0) {
      const unitExport = units.map((u) => ({
        shortName: u.shortName,
        longName: u.longName ?? u.shortName,
        linesOfCode: u.linesOfCode,
        mcCabeIndex: u.mcCabeIndex,
        numberOfParameters: u.numberOfParameters ?? 0,
        startLine: u.startLine,
        endLine: u.endLine,
        relativeFileName: u.sourceFile?.relativePath ?? "",
        components: u.sourceFile?.logicalComponents.map((c) => c.name) ?? [],
      }))
      writeFileSync(join(dataFolder, "units.json"), JSON.stringify(unitExport, null, 2), "utf-8")
    }
  }
}
