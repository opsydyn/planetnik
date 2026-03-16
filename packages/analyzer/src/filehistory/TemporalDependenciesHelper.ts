import type { SourceFile } from "../aspects/SourceFile.js"
import { ComponentDependency } from "../dependencies/ComponentDependency.js"
import type { FilePairChangedTogether } from "../results/FilesHistoryAnalysisResults.js"

const DEPENDENCIES_LIST_LIMIT = 1_000_000

export class TemporalDependenciesHelper {
  /**
   * Extracts component-level dependencies from file pairs changed together,
   * using the logical decomposition key to resolve file→component mappings.
   */
  extractComponentDependencies(
    logicalDecompositionKey: string,
    filePairsChangedTogether: FilePairChangedTogether[],
    allFiles: SourceFile[],
  ): ComponentDependency[] {
    const dependencies: ComponentDependency[] = []
    const dependenciesMap = new Map<string, ComponentDependency>()
    const commitsMap = new Map<string, Set<string>>()

    // Build file path → component name lookup
    const fileToComponent = new Map<string, string>()
    for (const file of allFiles) {
      const components = file.logicalComponents.get(logicalDecompositionKey)
      if (components && components.length > 0) {
        fileToComponent.set(file.relativePath.toLowerCase(), components[0]!.name)
      }
    }

    for (const pair of filePairsChangedTogether) {
      const component1 = fileToComponent.get(pair.sourceFile1Path.toLowerCase())
      const component2 = fileToComponent.get(pair.sourceFile2Path.toLowerCase())

      if (component1 && component2 && component1 !== component2) {
        const key1 = `${component1}::${component2}`
        const key2 = `${component2}::${component1}`

        let dep = dependenciesMap.get(key1) ?? dependenciesMap.get(key2)
        let commits = commitsMap.get(key1) ?? commitsMap.get(key2)

        if (!dep) {
          dep = new ComponentDependency(component1, component2)
          dependenciesMap.set(key1, dep)
          dependencies.push(dep)
          commits = new Set<string>()
          commitsMap.set(key1, commits)
        }

        for (const c of pair.commits) {
          commits!.add(c)
        }
        dep.count = commits!.size
      }
    }

    return dependencies
  }

  /**
   * Extracts file-level dependencies from file pairs changed together.
   */
  extractFileDependencies(filePairInstances: FilePairChangedTogether[]): ComponentDependency[] {
    const dependencies: ComponentDependency[] = []
    const dependenciesMap = new Map<string, ComponentDependency>()
    const datesMap = new Map<ComponentDependency, Set<string>>()

    for (const pair of filePairInstances) {
      if (dependencies.length > DEPENDENCIES_LIST_LIMIT) break

      const component1 = `[${pair.sourceFile1Path}]`
      const component2 = `[${pair.sourceFile2Path}]`

      if (component1.toLowerCase() === component2.toLowerCase()) continue

      const key1 = `${component1}::${component2}`
      const key2 = `${component2}::${component1}`

      let dep = dependenciesMap.get(key1) ?? dependenciesMap.get(key2)

      if (!dep) {
        dep = new ComponentDependency(component1, component2)
        dep.count = 0
        dependenciesMap.set(key1, dep)
        dependencies.push(dep)
        datesMap.set(dep, new Set<string>())
      }

      const commits = datesMap.get(dep)!
      for (const c of pair.commits) {
        commits.add(c)
      }
      dep.count = commits.size
    }

    return dependencies
  }

  /**
   * Extracts dependencies with commit-level granularity (commit nodes linking to files).
   */
  extractDependenciesWithCommits(filePairInstances: FilePairChangedTogether[]): ComponentDependency[] {
    const dependencies: ComponentDependency[] = []
    const dependenciesMap = new Map<string, ComponentDependency>()

    for (const pair of filePairInstances) {
      if (dependencies.length > DEPENDENCIES_LIST_LIMIT) break

      const component1 = `[${pair.sourceFile1Path}]`
      const component2 = `[${pair.sourceFile2Path}]`

      if (component1.toLowerCase() === component2.toLowerCase()) continue

      for (const commit of pair.commits) {
        const commitId = `commit_${commit}`

        const dep1 = getOrCreateDependency(commitId, component1, dependencies, dependenciesMap)
        dep1.count++

        const dep2 = getOrCreateDependency(commitId, component2, dependencies, dependenciesMap)
        dep2.count++
      }
    }

    return dependencies
  }
}

function getOrCreateDependency(
  name1: string,
  name2: string,
  list: ComponentDependency[],
  map: Map<string, ComponentDependency>,
): ComponentDependency {
  const key1 = `${name1}::${name2}`
  const key2 = `${name2}::${name1}`

  let dep = map.get(key1) ?? map.get(key2)
  if (!dep) {
    dep = new ComponentDependency(name1, name2)
    dep.count = 0
    map.set(key1, dep)
    list.push(dep)
  }
  return dep
}
