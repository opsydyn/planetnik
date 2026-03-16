import type { LogicalDecomposition } from "../aspects/LogicalDecomposition.js"
import type { SourceFile } from "../aspects/SourceFile.js"
import type { Thresholds } from "../core/Thresholds.js"
import { RiskDistributionStats } from "../metrics/RiskDistributionStats.js"

export class SourceFileChangeDistribution extends RiskDistributionStats {
  private thresholds: Thresholds

  constructor(thresholds: Thresholds) {
    super(thresholds.low, thresholds.medium, thresholds.high, thresholds.veryHigh)
    this.thresholds = thresholds
  }

  private getNumberOfChanges(sourceFile: SourceFile): number {
    return sourceFile.fileModificationHistory?.dates.length ?? 0
  }

  getDistributionPerExtension(files: SourceFile[]): RiskDistributionStats[] {
    const map = new Map<string, SourceFileChangeDistribution>()
    const result: RiskDistributionStats[] = []

    for (const file of files) {
      let dist = map.get(file.extension)
      if (!dist) {
        dist = new SourceFileChangeDistribution(this.thresholds)
        dist.key = file.extension
        map.set(file.extension, dist)
        result.push(dist)
      }
      if (file.fileModificationHistory) {
        dist.update(this.getNumberOfChanges(file), file.linesOfCode)
      }
    }

    return result
  }

  getRiskDistributionPerComponent(logicalDecomposition: LogicalDecomposition): RiskDistributionStats[] {
    const result: RiskDistributionStats[] = []

    for (const component of logicalDecomposition.components) {
      const dist = new SourceFileChangeDistribution(this.thresholds)
      dist.key = component.name
      for (const file of component.sourceFiles) {
        if (file.fileModificationHistory) {
          dist.update(this.getNumberOfChanges(file), file.linesOfCode)
        }
      }
      result.push(dist)
    }

    return result
  }

  getOverallDistribution(files: SourceFile[]): SourceFileChangeDistribution {
    this.reset()
    for (const file of files) {
      if (file.fileModificationHistory) {
        this.update(this.getNumberOfChanges(file), file.linesOfCode)
      }
    }
    return this
  }

  getOverallContributorsCountDistribution(files: SourceFile[]): SourceFileChangeDistribution {
    this.reset()
    for (const file of files) {
      if (file.fileModificationHistory) {
        this.update(file.fileModificationHistory.countContributors(), file.linesOfCode)
      }
    }
    return this
  }
}
