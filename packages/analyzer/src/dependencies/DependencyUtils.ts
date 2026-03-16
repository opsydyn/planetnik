import { ComponentDependency } from "./ComponentDependency.js"
import { Dependency } from "./Dependency.js"
import type { DependencyAnchor } from "./DependencyAnchor.js"
import { DependencyError } from "./DependencyError.js"
import { DependencyEvidence } from "./DependencyEvidence.js"
import type { SourceFileDependency } from "./SourceFileDependency.js"

export class DependencyUtils {
  static addDependency(
    dependencies: Dependency[],
    sourceFileDependency: SourceFileDependency,
    sourceAnchor: DependencyAnchor,
    targetAnchor: DependencyAnchor,
  ): void {
    if (targetAnchor.anchor.toLowerCase() === sourceAnchor.anchor.toLowerCase()) return

    const newDep = new Dependency(sourceAnchor, targetAnchor)
    const existing = dependencies.find((d) => d.equals(newDep))
    if (existing) {
      existing.fromFiles.push(sourceFileDependency)
    } else {
      newDep.fromFiles.push(sourceFileDependency)
      dependencies.push(newDep)
    }
  }

  static getDependenciesCount(componentDependencies: ComponentDependency[]): number {
    return componentDependencies.reduce((sum, d) => sum + d.count, 0)
  }

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

  static getComponentDependencies(dependencies: Dependency[], groupName: string): ComponentDependency[] {
    const componentDependencies: ComponentDependency[] = []
    const fileToComponentLinks: Set<string> = new Set()

    for (const dependency of dependencies) {
      for (const sfd of dependency.fromFiles) {
        const fromComponents = dependency.getFromComponents(groupName)
        const toComponents = dependency.getToComponents(groupName)

        // Skip if any from component matches a to component
        let skip = false
        for (const toComp of toComponents) {
          for (const fromComp of fromComponents) {
            if (fromComp.name.toLowerCase() === toComp.name.toLowerCase()) {
              skip = true
              break
            }
          }
          if (skip) break
        }
        if (skip) continue

        for (const targetComponent of toComponents) {
          const linkKey = `${sfd.sourceFile.relativePath}::${targetComponent.name}`
          if (fileToComponentLinks.has(linkKey)) continue
          fileToComponentLinks.add(linkKey)

          const sourceComponents = sfd.sourceFile.logicalComponents.filter((c) => c.filtering === groupName)
          for (const sourceComponent of sourceComponents) {
            DependencyUtils.addComponentDependency(sfd, componentDependencies, sourceComponent, targetComponent)
          }
        }
      }
    }

    return componentDependencies
  }

  private static addComponentDependency(
    sfd: SourceFileDependency,
    componentDependencies: ComponentDependency[],
    sourceComponent: { name: string },
    targetComponent: { name: string },
  ): void {
    if (sourceComponent.name.toLowerCase() === targetComponent.name.toLowerCase()) return

    const existing = componentDependencies.find(
      (d) => d.fromComponent === sourceComponent.name && d.toComponent === targetComponent.name,
    )

    if (existing) {
      existing.count++
      existing.locFrom += sfd.sourceFile.linesOfCode
      existing.evidence.push(new DependencyEvidence(sfd.sourceFile.relativePath, sfd.codeFragment))
    } else {
      const dep = new ComponentDependency(sourceComponent.name, targetComponent.name)
      dep.locFrom = sfd.sourceFile.linesOfCode
      dep.evidence.push(new DependencyEvidence(sfd.sourceFile.relativePath, sfd.codeFragment))
      componentDependencies.push(dep)
    }
  }

  static findErrors(anchors: DependencyAnchor[], errors: DependencyError[]): void {
    for (const anchor of anchors) {
      const componentsMap = new Map<string, string[]>()

      for (const sourceFile of anchor.sourceFiles) {
        for (const component of sourceFile.logicalComponents) {
          const filtering = component.filtering
          if (!componentsMap.has(filtering)) {
            componentsMap.set(filtering, [])
          }
          const components = componentsMap.get(filtering)!
          if (!components.includes(component.name)) {
            components.push(component.name)
          }
        }
      }

      for (const [key, components] of componentsMap) {
        if (components.length > 1) {
          const message = `ERROR: the anchor '${anchor.anchor}' found in ${components.length} '${key}' components. ${JSON.stringify(components)}`
          errors.push(new DependencyError(message, key))
        }
      }
    }
  }
}
