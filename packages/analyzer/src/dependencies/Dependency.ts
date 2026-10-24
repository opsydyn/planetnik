import type { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import type { DependencyAnchor } from "./DependencyAnchor.js"
import type { SourceFileDependency } from "./SourceFileDependency.js"

export class Dependency {
  fromFiles: SourceFileDependency[] = []
  from: DependencyAnchor
  to: DependencyAnchor
  fromComponentName: string | null = null
  toComponentName: string | null = null

  constructor(from: DependencyAnchor, to: DependencyAnchor) {
    this.from = from
    this.to = to
  }

  getFromComponents(group: string): NamedSourceCodeAspect[] {
    const components: NamedSourceCodeAspect[] = []
    for (const sfd of this.fromFiles) {
      for (const aspect of sfd.sourceFile.logicalComponents) {
        if (aspect.filtering === group && !components.some((c) => c.name === aspect.name)) {
          components.push(aspect)
        }
      }
    }
    return components
  }

  getToComponents(group: string): NamedSourceCodeAspect[] {
    const components: NamedSourceCodeAspect[] = []
    for (const sourceFile of this.to.sourceFiles) {
      for (const aspect of sourceFile.logicalComponents) {
        if (aspect.filtering === group && !components.some((c) => c.name === aspect.name)) {
          components.push(aspect)
        }
      }
    }
    return components
  }

  getDependencyString(): string {
    return `${this.from.anchor} -> ${this.to.anchor}`
  }

  getComponentDependency(group: string): string {
    const fromComponents = this.getFromComponents(group)
    const toComponents = this.getToComponents(group)
    const fromName = fromComponents[0]?.name ?? this.from.anchor
    const toName = toComponents[0]?.name ?? this.to.anchor
    return `${fromName} -> ${toName}`
  }

  equals(other: Dependency): boolean {
    return this.getDependencyString() === other.getDependencyString()
  }
}
