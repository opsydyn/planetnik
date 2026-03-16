import type { ComponentDependency } from "./ComponentDependency.js"

export class DependencyUtils {
  static getCyclicDependencyPlacesCount(componentDependencies: ComponentDependency[]): number {
    let count = 0
    for (const d1 of componentDependencies) {
      for (const d2 of componentDependencies) {
        if (d1 !== d2 && DependencyUtils.isCyclic(d1, d2)) {
          count++
        }
      }
    }
    return count / 2
  }

  static getCyclicDependencyCount(componentDependencies: ComponentDependency[]): number {
    let count = 0
    for (const d1 of componentDependencies) {
      for (const d2 of componentDependencies) {
        if (d1 !== d2 && DependencyUtils.isCyclic(d1, d2)) {
          count += d1.count
        }
      }
    }
    return count
  }

  private static isCyclic(d1: ComponentDependency, d2: ComponentDependency): boolean {
    return d1.fromComponent === d2.toComponent && d1.toComponent === d2.fromComponent
  }
}
