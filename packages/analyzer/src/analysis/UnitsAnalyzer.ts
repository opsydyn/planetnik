import type { SourceFile } from "../aspects/SourceFile.js"
import { AnalysisConfig } from "../core/AnalysisConfig.js"
import type { CodeConfiguration } from "../core/CodeConfiguration.js"
import type { MetricsList } from "../metrics/MetricsList.js"
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"
import type { FilesAnalysisResults } from "../results/FilesAnalysisResults.js"
import type { UnitsAnalysisResults } from "../results/UnitsAnalysisResults.js"
import type { UnitInfo } from "../units/UnitInfo.js"
import { UnitsExtractor } from "../units/UnitsExtractor.js"
import { UnitUtils } from "../units/UnitUtils.js"
import { AnalysisUtils } from "./AnalysisUtils.js"
import { SAMPLE_SIZE } from "./FileSizeAnalyzer.js"

export class UnitsAnalyzer {
  private codeConfiguration: CodeConfiguration
  private metricsList: MetricsList
  private unitsAnalysisResults: UnitsAnalysisResults
  private filesAnalysisResults: FilesAnalysisResults
  private textSummary: string[]

  constructor(results: CodeAnalysisResults) {
    this.filesAnalysisResults = results.filesAnalysisResults
    this.unitsAnalysisResults = results.unitsAnalysisResults
    this.codeConfiguration = results.codeConfiguration!
    this.metricsList = results.metricsList
    this.textSummary = results.textSummary
  }

  analyze(): void {
    const main = this.codeConfiguration.main
    const allUnits = new UnitsExtractor().getUnits(main.sourceFiles as SourceFile[])
    const linesOfCode = UnitUtils.getLinesOfCode(allUnits)

    this.addBasicUnitMetrics(allUnits, linesOfCode, main.getLinesOfCode())

    this.unitsAnalysisResults.totalNumberOfUnits = allUnits.length
    this.unitsAnalysisResults.linesOfCodeInUnits = linesOfCode

    const unitSizeThresholds = AnalysisConfig.getUnitSizeThresholds(this.codeConfiguration.analysis)
    const complexityThresholds = AnalysisConfig.getConditionalComplexityThresholds(this.codeConfiguration.analysis)

    // Unit size distribution
    this.unitsAnalysisResults.unitSizeRiskDistribution = UnitUtils.getUnitSizeDistribution(allUnits, unitSizeThresholds)

    this.unitsAnalysisResults.unitSizeRiskDistributionPerExtension = UnitUtils.getUnitSizeDistributionPerExtension(
      allUnits,
      unitSizeThresholds,
    )

    this.unitsAnalysisResults.unitSizeRiskDistributionPerComponent = UnitUtils.getUnitSizeDistributionPerComponent(
      this.codeConfiguration.logicalDecompositions,
      allUnits,
      unitSizeThresholds,
    )

    // Conditional complexity distribution
    const complexityDist = UnitUtils.getConditionalComplexityDistribution(allUnits, complexityThresholds)
    this.unitsAnalysisResults.conditionalComplexityRiskDistribution = complexityDist

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("CONDITIONAL_COMPLEXITY_HIGH_PLUS_RISK_COUNT"))
      .setValue(complexityDist.highRiskCount + complexityDist.veryHighRiskCount)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("CONDITIONAL_COMPLEXITY_HIGH_PLUS_RISK_LOC"))
      .setValue(complexityDist.highRiskValue + complexityDist.veryHighRiskValue)

    this.unitsAnalysisResults.conditionalComplexityRiskDistributionPerExtension =
      UnitUtils.getConditionalComplexityDistributionPerExtension(allUnits, complexityThresholds)

    this.unitsAnalysisResults.conditionalComplexityRiskDistributionPerComponent =
      UnitUtils.getConditionalComplexityDistributionPerComponent(
        this.codeConfiguration.logicalDecompositions,
        allUnits,
        complexityThresholds,
      )

    const sampleSize = this.codeConfiguration.analysis.maxTopListSize
    this.addAllUnits(allUnits)
    this.addLongestUnits(allUnits, sampleSize)
    this.addMostComplexUnits(allUnits, sampleSize)
    this.addFilesWithMostUnits(this.filesAnalysisResults.allFiles, SAMPLE_SIZE)

    this.updateFilesWithUnitInfo(allUnits)
  }

  private addBasicUnitMetrics(allUnits: UnitInfo[], linesOfCode: number, mainLoc: number): void {
    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("NUMBER_OF_UNITS"))
      .setDescription("Number of units")
      .setValue(allUnits.length)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("LINES_OF_CODE_IN_UNITS"))
      .setDescription("Lines of code in units")
      .setValue(linesOfCode)

    this.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("LINES_OF_CODE_OUTSIDE_UNITS"))
      .setDescription("Lines of code outside units")
      .setValue(mainLoc - linesOfCode)
  }

  private updateFilesWithUnitInfo(allUnits: UnitInfo[]): void {
    for (const sourceFile of this.filesAnalysisResults.allFiles) {
      let unitsCount = 0
      let mcCabeSum = 0
      let unitsLoc = 0
      for (const unit of allUnits) {
        if (unit.sourceFile?.relativePath === sourceFile.relativePath) {
          unitsCount++
          mcCabeSum += unit.mcCabeIndex
          unitsLoc += unit.linesOfCode
        }
      }
      sourceFile.unitsCount = unitsCount
      sourceFile.unitsMcCabeIndexSum = mcCabeSum
      sourceFile.linesOfCodeInUnits = unitsLoc
    }
  }

  private addAllUnits(allUnits: UnitInfo[]): void {
    const sorted = [...allUnits].sort((a, b) => b.linesOfCode - a.linesOfCode)
    this.unitsAnalysisResults.allUnits = sorted
  }

  private addLongestUnits(allUnits: UnitInfo[], sampleSize: number): void {
    const sorted = [...allUnits].sort((a, b) => b.linesOfCode - a.linesOfCode)
    for (let i = 0; i < Math.min(sampleSize, sorted.length); i++) {
      this.unitsAnalysisResults.longestUnits.push(sorted[i]!)
    }
  }

  private addMostComplexUnits(allUnits: UnitInfo[], sampleSize: number): void {
    const sorted = [...allUnits].sort((a, b) => b.mcCabeIndex - a.mcCabeIndex)
    for (let i = 0; i < Math.min(sampleSize, sorted.length); i++) {
      this.unitsAnalysisResults.mostComplexUnits.push(sorted[i]!)
    }
  }

  private addFilesWithMostUnits(sourceFiles: SourceFile[], sampleSize: number): void {
    const filesWithUnits = sourceFiles.filter((f) => f.unitsCount > 0)
    filesWithUnits.sort((a, b) => b.unitsCount - a.unitsCount)
    for (let i = 0; i < Math.min(sampleSize, filesWithUnits.length); i++) {
      this.filesAnalysisResults.filesWithMostUnits.push(filesWithUnits[i]!)
    }
  }
}
