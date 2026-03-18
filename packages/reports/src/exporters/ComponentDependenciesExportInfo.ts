import type { ComponentDependency } from "@planetnik/analyzer"

export interface ComponentDependencyExportInfo {
  decompositionKey: string
  fromComponent: string
  toComponent: string
  count: number
  locFrom: number
  evidenceCount: number
  color: string
}

export interface ComponentDependenciesExportInfo {
  title: string
  timestamp: string
  dependencies: ComponentDependencyExportInfo[]
}

export class ComponentDependenciesExporter {
  static exportDependencies(
    decompositionDependencies: Array<{ decompositionKey: string; dependency: ComponentDependency }>,
    title: string,
    timestamp: string,
  ): ComponentDependenciesExportInfo {
    const dependencies = decompositionDependencies
      .map(({ decompositionKey, dependency }) => ({
        decompositionKey,
        fromComponent: dependency.fromComponent,
        toComponent: dependency.toComponent,
        count: dependency.count,
        locFrom: dependency.locFrom,
        evidenceCount: dependency.evidence.length,
        color: dependency.color,
      }))
      .sort((left, right) => {
        if (left.decompositionKey !== right.decompositionKey) {
          return left.decompositionKey.localeCompare(right.decompositionKey)
        }

        if (left.count !== right.count) {
          return right.count - left.count
        }

        const fromComparison = left.fromComponent.localeCompare(right.fromComponent)
        if (fromComparison !== 0) {
          return fromComparison
        }

        return left.toComponent.localeCompare(right.toComponent)
      })

    return {
      title,
      timestamp,
      dependencies,
    }
  }
}
