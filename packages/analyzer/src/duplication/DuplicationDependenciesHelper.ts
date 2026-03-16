import { ComponentDependency } from "../dependencies/ComponentDependency.js"
import { DependencyEvidence } from "../dependencies/DependencyEvidence.js"
import type { DuplicatedFileBlock } from "./DuplicatedFileBlock.js"
import type { DuplicationInstance } from "./DuplicationInstance.js"

export class DuplicationDependenciesHelper {
  private componentDependencies: ComponentDependency[] = []
  private componentDependenciesMap = new Map<string, ComponentDependency>()
  private componentDuplicatedLines = new Map<string, Set<string>>()
  instances: DuplicationInstance[] = []

  private group: string

  constructor(group: string) {
    this.group = group
  }

  extractDependencies(duplicationInstances: DuplicationInstance[]): ComponentDependency[] {
    for (const instance of duplicationInstances) {
      for (const file1 of instance.duplicatedFileBlocks) {
        if (!file1.sourceFile) continue
        const components1 = file1.sourceFile.logicalComponents.filter((c) => c.name === this.group || !this.group)
        if (components1.length === 0) continue
        for (const file2 of instance.duplicatedFileBlocks) {
          if (file1 === file2 || !file2.sourceFile) continue
          const components2 = file2.sourceFile.logicalComponents.filter((c) => c.name === this.group || !this.group)
          if (components2.length === 0) continue
          this.processDuplicationInstance(file1, file2, instance, components1[0]!.name, components2[0]!.name)
        }
      }
    }
    return this.componentDependencies
  }

  private processDuplicationInstance(
    file1: DuplicatedFileBlock,
    file2: DuplicatedFileBlock,
    instance: DuplicationInstance,
    name1: string,
    name2: string,
  ): void {
    if (name1.toLowerCase() === name2.toLowerCase()) return

    if (!this.instances.includes(instance)) this.instances.push(instance)

    const duplicatedLines = this.updateDuplicatedLines(file1, file2, name1, name2)
    const dependency = this.getDependency(name1, name2)
    dependency.count = duplicatedLines.size
    this.updateUniqueFilePairs(file1, file2, dependency)
  }

  private updateUniqueFilePairs(
    file1: DuplicatedFileBlock,
    file2: DuplicatedFileBlock,
    dependency: ComponentDependency,
  ): void {
    const key = `${file1.sourceFile!.relativePath}\n${file2.sourceFile!.relativePath}`
    const altKey = `${file2.sourceFile!.relativePath}\n${file1.sourceFile!.relativePath}`
    if (!dependency.hasPathFrom(key) && !dependency.hasPathFrom(altKey)) {
      dependency.evidence.push(new DependencyEvidence(key, ""))
    }
  }

  private updateDuplicatedLines(
    file1: DuplicatedFileBlock,
    file2: DuplicatedFileBlock,
    name1: string,
    name2: string,
  ): Set<string> {
    const key = `${name1}::${name2}`
    const altKey = `${name2}::${name1}`

    let duplicatedLines = this.componentDuplicatedLines.get(key) ?? this.componentDuplicatedLines.get(altKey)
    if (!duplicatedLines) {
      duplicatedLines = new Set()
      this.componentDuplicatedLines.set(key, duplicatedLines)
    }

    for (let i = file1.cleanedStartLine; i <= file1.cleanedEndLine; i++) {
      duplicatedLines.add(`${file1.sourceFile!.relativePath}::${i}`)
    }
    for (let i = file2.cleanedStartLine; i <= file2.cleanedEndLine; i++) {
      duplicatedLines.add(`${file2.sourceFile!.relativePath}::${i}`)
    }

    return duplicatedLines
  }

  private getDependency(name1: string, name2: string): ComponentDependency {
    const key = `${name1}::${name2}`
    const altKey = `${name2}::${name1}`

    let dep = this.componentDependenciesMap.get(key) ?? this.componentDependenciesMap.get(altKey)
    if (!dep) {
      dep = new ComponentDependency(name1, name2)
      dep.count = 0
      this.componentDependencies.push(dep)
      this.componentDependenciesMap.set(key, dep)
    }
    return dep
  }
}
