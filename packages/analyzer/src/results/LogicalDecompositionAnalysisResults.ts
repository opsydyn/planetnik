import type { LogicalDecomposition } from "../aspects/LogicalDecomposition.js"
import type { ComponentDependency } from "../dependencies/ComponentDependency.js"
import type { Dependency, DependencyError } from "../dependencies/DependenciesAnalysis.js"
import { NumericMetric } from "../metrics/NumericMetric.js"
import type { AspectAnalysisResults } from "./AspectAnalysisResults.js"

export class LogicalDecompositionAnalysisResults {
  key: string = ""
  components: AspectAnalysisResults[] = []
  componentDependencies: ComponentDependency[] = []
  componentDependenciesErrors: DependencyError[] = []
  logicalDecomposition: LogicalDecomposition | null = null

  // Not serialized
  allDependencies: Dependency[] = []

  constructor(key?: string) {
    if (key) this.key = key
  }

  getFileCountPerComponent(): NumericMetric[] {
    return this.components.map((c) => new NumericMetric(c.name, c.filesCount))
  }

  getLinesOfCodePerComponent(): NumericMetric[] {
    return this.components.map((c) => new NumericMetric(c.name, c.linesOfCode))
  }
}
