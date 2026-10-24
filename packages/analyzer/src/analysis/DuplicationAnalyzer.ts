import type { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import type { CodeConfiguration } from "../core/CodeConfiguration.js"
import { DuplicatedFileBlock } from "../duplication/DuplicatedFileBlock.js"
import { DuplicationAggregator } from "../duplication/DuplicationAggregator.js"
import { DuplicationEngine } from "../duplication/DuplicationEngine.js"
import type { DuplicationInstance } from "../duplication/DuplicationInstance.js"
import { DuplicationUtils } from "../duplication/DuplicationUtils.js"
import { UnitDuplicatesExtractor } from "../duplication/UnitDuplicatesExtractor.js"
import type { DuplicationMetric } from "../metrics/DuplicationMetric.js"
import type { MetricsList } from "../metrics/MetricsList.js"
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"
import type { DuplicationAnalysisResults } from "../results/DuplicationAnalysisResults.js"
import { AnalysisUtils } from "./AnalysisUtils.js"

export class DuplicationAnalyzer {
  private codeConfiguration: CodeConfiguration
  private metricsList: MetricsList
  private duplicationResults: DuplicationAnalysisResults
  private main: NamedSourceCodeAspect
  private analysisResults: CodeAnalysisResults

  constructor(results: CodeAnalysisResults) {
    this.duplicationResults = results.duplicationAnalysisResults
    this.codeConfiguration = results.codeConfiguration!
    this.metricsList = results.metricsList
    this.analysisResults = results
    this.main = this.codeConfiguration.main
  }

  analyze(): void {
    if (this.skipDuplicationAnalysis()) {
      return
    }

    const duplicates = new DuplicationEngine().findDuplicates(
      this.main.sourceFiles,
      this.codeConfiguration.analysis.minDuplicationBlockLoc,
    )

    // Find duplicated units
    const duplicatedUnits = new UnitDuplicatesExtractor().findDuplicatedUnits(
      this.analysisResults.unitsAnalysisResults.allUnits,
      this.codeConfiguration.analysis.minDuplicationBlockLoc,
    )
    this.duplicationResults.unitDuplicates = duplicatedUnits

    // Consolidate duplicates
    const mergedConsolidated = this.consolidate(this.merge(duplicates))
    const consolidatedInstances = Array.from(mergedConsolidated.values())
    consolidatedInstances.sort((a, b) => b.blockSize - a.blockSize)
    this.duplicationResults.allDuplicates = consolidatedInstances

    // Count metrics
    const numberOfDuplicates = mergedConsolidated.size
    const numberOfDuplicatedLines = DuplicationUtils.getNumberOfDuplicatedLines(duplicates)
    const totalNumberOfCleanedLines = DuplicationUtils.getTotalNumberOfCleanedLines(this.main.sourceFiles)
    const numberOfFilesWithDuplicates = DuplicationAggregator.getDuplicationPerSourceFile(duplicates).length

    this.duplicationResults.overallDuplication.numberOfDuplicates = numberOfDuplicates
    this.duplicationResults.overallDuplication.cleanedLinesOfCode = totalNumberOfCleanedLines
    this.duplicationResults.overallDuplication.duplicatedLinesOfCode = numberOfDuplicatedLines
    this.duplicationResults.overallDuplication.numberOfFilesWithDuplicates = numberOfFilesWithDuplicates

    this.addSystemDuplicationMetrics(
      numberOfDuplicates,
      numberOfDuplicatedLines,
      totalNumberOfCleanedLines,
      numberOfFilesWithDuplicates,
    )

    // Per-source-file aggregation
    const duplicationPerSourceFile = DuplicationAggregator.getDuplicationPerSourceFile(duplicates)

    // Per-extension
    const duplicationPerExtension = DuplicationAggregator.getDuplicationPerExtension(
      this.main.sourceFiles,
      duplicationPerSourceFile,
    )
    for (const metric of duplicationPerExtension) {
      this.duplicationResults.duplicationPerExtension.push(metric)
      this.addExtensionDuplicationMetrics(metric)
    }

    // Per-component
    const duplicationPerComponent = DuplicationAggregator.getDuplicationPerLogicalComponent(
      this.codeConfiguration.logicalDecompositions,
      this.main.sourceFiles,
      duplicationPerSourceFile,
    )
    this.duplicationResults.duplicationPerComponent = duplicationPerComponent

    // Top lists
    this.addMostFrequentDuplicates(duplicates)
    this.addLongestDuplicates(mergedConsolidated)
  }

  private addLongestDuplicates(mergedConsolidated: Map<string, DuplicationInstance>): void {
    const sorted = Array.from(mergedConsolidated.values()).sort((a, b) => b.blockSize - a.blockSize)
    const max = Math.min(this.codeConfiguration.analysis.maxTopListSize, sorted.length)
    for (let i = 0; i < max; i++) {
      const instance = sorted[i]
      if (instance) {
        this.duplicationResults.longestDuplicates.push(instance)
      }
    }
  }

  private addMostFrequentDuplicates(duplicates: DuplicationInstance[]): void {
    const sorted = [...duplicates].sort((a, b) => b.duplicatedFileBlocks.length - a.duplicatedFileBlocks.length)
    const max = Math.min(this.codeConfiguration.analysis.maxTopListSize, sorted.length)
    for (let i = 0; i < max; i++) {
      const instance = sorted[i]
      if (instance && instance.duplicatedFileBlocks.length > 2) {
        this.duplicationResults.mostFrequentDuplicates.push(instance)
      }
    }
  }

  private merge(duplicates: DuplicationInstance[]): Map<string, DuplicationInstance> {
    const merged = new Map<string, DuplicationInstance>()
    for (const d of duplicates) {
      for (const file1 of d.duplicatedFileBlocks) {
        for (const file2 of d.duplicatedFileBlocks) {
          if (file1 === file2 && file1.startLine === file2.startLine) continue
          const key = this.getPairKey(file1, file2, 0)
          if (!merged.has(key)) {
            const instance = {
              blockSize: d.blockSize,
              displayContent: "",
              duplicatedFileBlocks: [] as DuplicatedFileBlock[],
            }
            const path1 = file1.sourceFile?.relativePath ?? ""
            const path2 = file2.sourceFile?.relativePath ?? ""
            if (path1 <= path2) {
              instance.duplicatedFileBlocks.push(this.copyBlock(file1))
              instance.duplicatedFileBlocks.push(this.copyBlock(file2))
            } else {
              instance.duplicatedFileBlocks.push(this.copyBlock(file2))
              instance.duplicatedFileBlocks.push(this.copyBlock(file1))
            }
            merged.set(key, instance)
          }
        }
      }
    }
    return merged
  }

  private consolidate(merged: Map<string, DuplicationInstance>): Map<string, DuplicationInstance> {
    const result = new Map(merged)
    for (const key of merged.keys()) {
      if (!result.has(key)) continue
      const instance = result.get(key)!
      if (instance.duplicatedFileBlocks.length < 2) continue

      const block1 = instance.duplicatedFileBlocks[0]
      const block2 = instance.duplicatedFileBlocks[1]
      if (!block1 || !block2) continue
      let offset = 1

      while (true) {
        const nextKey = this.getPairKey(block1, block2, offset)
        const nextInstance = result.get(nextKey)
        if (!nextInstance) break

        let nextBlock1 = nextInstance.duplicatedFileBlocks[0]
        let nextBlock2 = nextInstance.duplicatedFileBlocks[1]
        if (!nextBlock1 || !nextBlock2) break

        if (nextBlock1.sourceFile?.relativePath !== block1.sourceFile?.relativePath) {
          const temp = nextBlock1
          nextBlock1 = nextBlock2
          nextBlock2 = temp
        }

        block1.endLine = nextBlock1.endLine
        block1.cleanedEndLine = nextBlock1.cleanedEndLine
        block2.endLine = nextBlock2.endLine
        block2.cleanedEndLine = nextBlock2.cleanedEndLine

        result.delete(nextKey)
        instance.blockSize = block1.cleanedEndLine - block1.cleanedStartLine + 1
        offset++
      }
    }
    return result
  }

  private copyBlock(block: DuplicatedFileBlock): DuplicatedFileBlock {
    const copy = new DuplicatedFileBlock()
    copy.startLine = block.startLine
    copy.endLine = block.endLine
    copy.cleanedStartLine = block.cleanedStartLine
    copy.cleanedEndLine = block.cleanedEndLine
    copy.sourceFile = block.sourceFile
    copy.sourceFileCleanedLinesOfCode = block.sourceFileCleanedLinesOfCode
    return copy
  }

  private getPairKey(block1: DuplicatedFileBlock, block2: DuplicatedFileBlock, offset: number): string {
    const relPath1 = block1.sourceFile?.relativePath ?? ""
    const relPath2 = block2.sourceFile?.relativePath ?? ""
    let file1: DuplicatedFileBlock
    let file2: DuplicatedFileBlock
    let path1: string
    let path2: string

    if (relPath1 < relPath2) {
      file1 = block1
      file2 = block2
      path1 = relPath1
      path2 = relPath2
    } else if (relPath1 === relPath2 && block1.cleanedStartLine < block2.cleanedStartLine) {
      file1 = block1
      file2 = block2
      path1 = relPath1
      path2 = relPath2
    } else {
      file1 = block2
      file2 = block1
      path1 = relPath2
      path2 = relPath1
    }

    return `${path1}:${file1.cleanedStartLine + offset}::${path2}:${file2.cleanedStartLine + offset}`
  }

  private skipDuplicationAnalysis(): boolean {
    return (
      this.codeConfiguration.analysis.skipDuplication ||
      this.main.getLinesOfCode() > this.codeConfiguration.analysis.locDuplicationThreshold
    )
  }

  private addExtensionDuplicationMetrics(metric: DuplicationMetric): void {
    const suffix = `_${metric.key}`
    this.metricsList
      .addMetric()
      .setId(`${AnalysisUtils.getMetricId("DUPLICATION_NUMBER_OF_DUPLICATED_LINES")}${suffix}`)
      .setDescription("Number of duplicated lines")
      .setValue(metric.duplicatedLinesOfCode)

    this.metricsList
      .addMetric()
      .setId(`${AnalysisUtils.getMetricId("DUPLICATION_NUMBER_OF_CLEANED_LINES")}${suffix}`)
      .setDescription("Number of lines after cleaning for duplication calculations")
      .setValue(metric.cleanedLinesOfCode)

    if (metric.cleanedLinesOfCode > 0) {
      this.metricsList
        .addMetric()
        .setId(`${AnalysisUtils.getMetricId("DUPLICATION_PERCENTAGE")}${suffix}`)
        .setDescription("Duplication percentage")
        .setValue((100.0 * metric.duplicatedLinesOfCode) / metric.cleanedLinesOfCode)
    }
  }

  private addSystemDuplicationMetrics(
    numberOfDuplicates: number,
    numberOfDuplicatedLines: number,
    totalNumberOfCleanedLines: number,
    numberOfFilesWithDuplicates: number,
  ): void {
    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("DUPLICATION_NUMBER_OF_DUPLICATES"))
      .setDescription("Number of duplicates")
      .setValue(numberOfDuplicates)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("DUPLICATION_NUMBER_OF_FILES_WITH_DUPLICATES"))
      .setDescription("Number of files with duplicates")
      .setValue(numberOfFilesWithDuplicates)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("DUPLICATION_NUMBER_OF_DUPLICATED_LINES"))
      .setDescription("Number of duplicated lines")
      .setValue(numberOfDuplicatedLines)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("DUPLICATION_NUMBER_OF_CLEANED_LINES"))
      .setDescription("Number of lines after cleaning for duplication calculations")
      .setValue(totalNumberOfCleanedLines)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("DUPLICATION_PERCENTAGE"))
      .setDescription("Duplication percentage")
      .setValue(totalNumberOfCleanedLines > 0 ? (100.0 * numberOfDuplicatedLines) / totalNumberOfCleanedLines : 0)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("UNIT_DUPLICATES_COUNT"))
      .setDescription("Unit duplicates")
      .setValue(this.analysisResults.duplicationAnalysisResults.unitDuplicates.length)
  }
}
