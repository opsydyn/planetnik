import type { SourceFile } from "../aspects/SourceFile.js"
import type { CodeConfiguration } from "../core/CodeConfiguration.js"
import type { FoundTag } from "../core/FoundTag.js"
import type { MetadataType } from "../core/Metadata.js"
import type { Dependency } from "../dependencies/Dependency.js"
import { MetricsList } from "../metrics/MetricsList.js"
import { AspectAnalysisResults } from "./AspectAnalysisResults.js"
import type { ConcernsAnalysisResults } from "./ConcernsAnalysisResults.js"
import { ContributorsAnalysisResults } from "./ContributorsAnalysisResults.js"
import { ControlsAnalysisResults } from "./ControlsAnalysisResults.js"
import { DuplicationAnalysisResults } from "./DuplicationAnalysisResults.js"
import { FilesAnalysisResults } from "./FilesAnalysisResults.js"
import { FilesHistoryAnalysisResults } from "./FilesHistoryAnalysisResults.js"
import type { LogicalDecompositionAnalysisResults } from "./LogicalDecompositionAnalysisResults.js"
import { UnitsAnalysisResults } from "./UnitsAnalysisResults.js"

export class CodeAnalysisResults {
  // Not serialized
  codeConfiguration: CodeConfiguration | null = null
  textSummary: string[] = []

  metadata: MetadataType = {
    name: "",
    description: "",
    tooltip: "",
    logoLink: "",
    links: [],
  }
  metricsList: MetricsList = new MetricsList()
  controlResults: ControlsAnalysisResults = new ControlsAnalysisResults()

  totalNumberOfFilesInScope: number = 0
  mainAspectAnalysisResults: AspectAnalysisResults = new AspectAnalysisResults()
  testAspectAnalysisResults: AspectAnalysisResults = new AspectAnalysisResults()
  generatedAspectAnalysisResults: AspectAnalysisResults = new AspectAnalysisResults()
  buildAndDeployAspectAnalysisResults: AspectAnalysisResults = new AspectAnalysisResults()
  otherAspectAnalysisResults: AspectAnalysisResults = new AspectAnalysisResults()

  logicalDecompositionsAnalysisResults: LogicalDecompositionAnalysisResults[] = []
  concernsAnalysisResults: ConcernsAnalysisResults[] = []

  foundTags: FoundTag[] = []

  // Not serialized
  allDependencies: Dependency[] = []

  filesAnalysisResults: FilesAnalysisResults = new FilesAnalysisResults()
  filesHistoryAnalysisResults: FilesHistoryAnalysisResults = new FilesHistoryAnalysisResults()
  unitsAnalysisResults: UnitsAnalysisResults = new UnitsAnalysisResults()
  duplicationAnalysisResults: DuplicationAnalysisResults = new DuplicationAnalysisResults()
  contributorsAnalysisResults: ContributorsAnalysisResults = new ContributorsAnalysisResults()

  numberOfExcludedFiles: number = 0
  excludedExtensions: Map<string, number> = new Map()
  analysisStartTimeMs: number = 0

  // Not serialized
  filesExcludedByExtension: SourceFile[] = []
  ignoredFilesGroups: Map<string, { filter: unknown; sourceFiles: SourceFile[] }> = new Map()

  getMaxLinesOfCode(): number {
    return Math.max(
      this.mainAspectAnalysisResults.linesOfCode,
      this.testAspectAnalysisResults.linesOfCode,
      this.generatedAspectAnalysisResults.linesOfCode,
      this.buildAndDeployAspectAnalysisResults.linesOfCode,
      this.otherAspectAnalysisResults.linesOfCode,
    )
  }

  getMaxFileCount(): number {
    return Math.max(
      this.mainAspectAnalysisResults.filesCount,
      this.testAspectAnalysisResults.filesCount,
      this.generatedAspectAnalysisResults.filesCount,
      this.buildAndDeployAspectAnalysisResults.filesCount,
      this.otherAspectAnalysisResults.filesCount,
    )
  }

  skipDuplicationAnalysis(): boolean {
    if (!this.codeConfiguration) return false
    const analysis = this.codeConfiguration.analysis
    return analysis.skipDuplication || this.mainAspectAnalysisResults.linesOfCode > analysis.locDuplicationThreshold
  }
}
