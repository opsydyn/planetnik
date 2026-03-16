import { LogicalDecomposition } from "../aspects/LogicalDecomposition.js"
import { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import type { SourceFile } from "../aspects/SourceFile.js"
import { AnalysisConfig } from "../core/AnalysisConfig.js"
import type { Thresholds } from "../core/Thresholds.js"
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"

export class FileHistoryScopingUtils {
  static getLogicalDecompositionsFileUpdateFrequency(analysisResults: CodeAnalysisResults): LogicalDecomposition[] {
    return wrapDecomposition(getByUpdateFrequency(analysisResults))
  }

  static getLogicalDecompositionsByAge(analysisResults: CodeAnalysisResults): LogicalDecomposition[] {
    return wrapDecomposition(getByAge(analysisResults))
  }

  static getLogicalDecompositionsByFreshness(analysisResults: CodeAnalysisResults): LogicalDecomposition[] {
    return wrapDecomposition(getByFreshness(analysisResults))
  }
}

function wrapDecomposition(decomposition: LogicalDecomposition): LogicalDecomposition[] {
  decomposition.componentsFolderDepth = 0
  return [decomposition]
}

function getByUpdateFrequency(analysisResults: CodeAnalysisResults): LogicalDecomposition {
  const allFiles = analysisResults.mainAspectAnalysisResults.aspect.sourceFiles
  const decomposition = new LogicalDecomposition("frequency of changes")
  const config = analysisResults.codeConfiguration
  const thresholds = config ? AnalysisConfig.getFileUpdateFrequencyThresholds(config.analysis) : null
  if (!thresholds) return decomposition

  return categorizeFiles(
    decomposition,
    allFiles,
    thresholds,
    "changes",
    (file) => file.fileModificationHistory?.dates.length ?? 0,
  )
}

function getByAge(analysisResults: CodeAnalysisResults): LogicalDecomposition {
  const allFiles = analysisResults.mainAspectAnalysisResults.aspect.sourceFiles
  const decomposition = new LogicalDecomposition("file age")
  const config = analysisResults.codeConfiguration
  const thresholds = config ? AnalysisConfig.getFileAgeThresholds(config.analysis) : null
  if (!thresholds) return decomposition

  return categorizeFiles(
    decomposition,
    allFiles,
    thresholds,
    "days old",
    (file) => file.fileModificationHistory?.daysSinceFirstUpdate() ?? 0,
  )
}

function getByFreshness(analysisResults: CodeAnalysisResults): LogicalDecomposition {
  const allFiles = analysisResults.mainAspectAnalysisResults.aspect.sourceFiles
  const decomposition = new LogicalDecomposition("file freshness")
  const config = analysisResults.codeConfiguration
  const thresholds = config ? AnalysisConfig.getFileAgeThresholds(config.analysis) : null
  if (!thresholds) return decomposition

  return categorizeFiles(
    decomposition,
    allFiles,
    thresholds,
    "days old",
    (file) => file.fileModificationHistory?.daysSinceLatestUpdate() ?? 0,
  )
}

function categorizeFiles(
  decomposition: LogicalDecomposition,
  allFiles: SourceFile[],
  thresholds: Thresholds,
  suffix: string,
  getValue: (file: SourceFile) => number,
): LogicalDecomposition {
  const negligible = new NamedSourceCodeAspect(`0-${thresholds.low} ${suffix}`)
  const low = new NamedSourceCodeAspect(`${thresholds.low + 1}-${thresholds.medium} ${suffix}`)
  const medium = new NamedSourceCodeAspect(`${thresholds.medium + 1}-${thresholds.high} ${suffix}`)
  const high = new NamedSourceCodeAspect(`${thresholds.high + 1}-${thresholds.veryHigh} ${suffix}`)
  const veryHigh = new NamedSourceCodeAspect(`${thresholds.veryHigh + 1}+ ${suffix}`)

  decomposition.components.push(negligible, low, medium, high, veryHigh)

  for (const file of allFiles) {
    if (!file.fileModificationHistory) continue
    const value = getValue(file)
    const path = file.relativePath

    if (value <= thresholds.low) {
      negligible.files.push(path)
    } else if (value <= thresholds.medium) {
      low.files.push(path)
    } else if (value <= thresholds.high) {
      medium.files.push(path)
    } else if (value <= thresholds.veryHigh) {
      high.files.push(path)
    } else {
      veryHigh.files.push(path)
    }
  }

  return decomposition
}
