import * as path from "node:path"
import type { ConcernsGroup } from "../aspects/ConcernsGroup.js"
import type { LogicalDecomposition } from "../aspects/LogicalDecomposition.js"
import { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import type { MetricsWithGoalType } from "../metrics/MetricsWithGoal.js"
import type { AnalysisConfigType } from "./AnalysisConfig.js"
import { AnalysisConfig } from "./AnalysisConfig.js"
import { FileHistoryAnalysisConfig } from "./FileHistoryAnalysisConfig.js"
import type { Metadata } from "./Metadata.js"
import type { SourceFileFilter } from "./SourceFileFilter.js"
import type { TagRule } from "./TagRule.js"
import { TrendAnalysisConfig } from "./TrendAnalysisConfig.js"

export const DEFAULT_CONFIGURATION_FOLDER = "_planetnik"

export class CodeConfiguration {
  metadata: Metadata = { name: "", description: "", tooltip: "", logoLink: "", links: [] }
  srcRoot: string = ".."
  extensions: string[] = []
  ignore: SourceFileFilter[] = []
  summary: string[] = []

  main: NamedSourceCodeAspect = new NamedSourceCodeAspect("main")
  test: NamedSourceCodeAspect = new NamedSourceCodeAspect("test")
  generated: NamedSourceCodeAspect = new NamedSourceCodeAspect("generated")
  buildAndDeployment: NamedSourceCodeAspect = new NamedSourceCodeAspect("buildAndDeployment")
  other: NamedSourceCodeAspect = new NamedSourceCodeAspect("other")

  logicalDecompositions: LogicalDecomposition[] = []
  concernGroups: ConcernsGroup[] = []
  goalsAndControls: MetricsWithGoalType[] = []
  tagRules: TagRule[] = []

  analysis: AnalysisConfigType = AnalysisConfig.make()

  fileHistoryAnalysis: FileHistoryAnalysisConfig = new FileHistoryAnalysisConfig()
  trendAnalysis: TrendAnalysisConfig = new TrendAnalysisConfig()

  fileHistoryPath: string = ""
  fileHistoryAdditionalPaths: string[] = []

  static getAbsoluteSrcRoot(srcRoot: string, configFilePath: string): string {
    if (path.isAbsolute(srcRoot)) return srcRoot
    const configDir = path.dirname(configFilePath)
    return path.resolve(configDir, srcRoot)
  }
}
