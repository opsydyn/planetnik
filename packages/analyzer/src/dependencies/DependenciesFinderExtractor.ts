import type { LogicalDecomposition } from "../aspects/LogicalDecomposition.js"
import type { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import type { SourceFile } from "../aspects/SourceFile.js"
import { LanguageAnalyzerFactory } from "../lang/LanguageAnalyzerFactory.js"
import { ComplexOperation } from "../operations/ComplexOperation.js"
import { ComponentDependency } from "./ComponentDependency.js"
import { DependencyEvidence } from "./DependencyEvidence.js"
import type { MetaDependencyRule } from "./MetaDependencyRule.js"
import type { MetaRule } from "./MetaRule.js"

export interface FileDependency {
  fromComponentName: string
  toComponentName: string
  sourceFilePath: string
  codeFragment: string
}

export class DependenciesFinderExtractor {
  private logicalDecomposition: LogicalDecomposition
  private dependencies: ComponentDependency[] = []
  private fileComponentDependencies: Set<string> = new Set()
  private dependenciesMap: Map<string, ComponentDependency> = new Map()
  allDependencies: FileDependency[] = []

  constructor(logicalDecomposition: LogicalDecomposition) {
    this.logicalDecomposition = logicalDecomposition
  }

  findComponentDependencies(aspect: NamedSourceCodeAspect): ComponentDependency[] {
    this.dependencies = []
    this.dependenciesMap = new Map()
    this.fileComponentDependencies = new Set()
    this.allDependencies = []

    for (const sourceFile of aspect.sourceFiles) {
      this.findComponentDependenciesViaSimpleRules(sourceFile as SourceFile)
    }

    const dependenciesFinder = this.logicalDecomposition.dependenciesFinder

    // Apply built-in language-specific dependency rules
    if (dependenciesFinder.useBuiltInDependencyFinders) {
      const factory = LanguageAnalyzerFactory.getInstance()
      for (const sourceFile of aspect.sourceFiles) {
        const sf = sourceFile as SourceFile
        const analyzer = factory.getLanguageAnalyzer(sf.extension)
        const builtInRules = analyzer.getMetaDependencyRules()
        if (builtInRules.length > 0) {
          this.findComponentDependenciesViaMetaRules(builtInRules, sf)
        }
      }
    }

    // Apply user-configured meta-rules
    for (const sourceFile of aspect.sourceFiles) {
      this.findComponentDependenciesViaMetaRules(dependenciesFinder.metaRules, sourceFile as SourceFile)
    }

    return this.dependencies
  }

  private findComponentDependenciesViaSimpleRules(sourceFile: SourceFile): void {
    for (const rule of this.logicalDecomposition.dependenciesFinder.rules) {
      if (!this.pathMatches(rule.pathPattern, sourceFile.relativePath)) continue

      const lines = this.getSimpleLines(sourceFile)
      for (const line of lines) {
        if (this.matchesEntirely(rule.contentPattern, line)) {
          this.addDependency(sourceFile, rule.component, line, rule.color, rule.reverseDirection)
        }
      }
    }
  }

  private findComponentDependenciesViaMetaRules(metaRules: MetaDependencyRule[], sourceFile: SourceFile): void {
    for (const metaRule of metaRules) {
      if (!this.pathMatches(metaRule.pathPattern, sourceFile.relativePath)) continue

      const lines = this.getLines(sourceFile, metaRule)
      for (const line of lines) {
        if (this.matchesEntirely(metaRule.contentPattern, line)) {
          const component = new ComplexOperation(metaRule.nameOperations).exec(line)
          this.addDependency(sourceFile, component, line, metaRule.color, metaRule.reverseDirection)
        }
      }
    }
  }

  private getLines(sourceFile: SourceFile, metaRule: MetaRule): string[] {
    if (metaRule.use.toLowerCase() === "path") {
      return [sourceFile.relativePath]
    }
    let lines = metaRule.ignoreComments ? sourceFile.cleanedLines : sourceFile.lines
    const max = this.logicalDecomposition.maxSearchDepthLines
    if (lines.length > max) {
      lines = lines.slice(0, max)
    }
    return lines
  }

  private getSimpleLines(sourceFile: SourceFile): string[] {
    let lines = sourceFile.lines
    const max = this.logicalDecomposition.maxSearchDepthLines
    if (lines.length > max) {
      lines = lines.slice(0, max)
    }
    return lines
  }

  private addDependency(
    sourceFile: SourceFile,
    toComponent: string,
    line: string,
    color: string,
    reverseDirection: boolean,
  ): void {
    if (!toComponent || !toComponent.trim()) return

    // Try exact match first, then fuzzy match (package path contains component name)
    const resolved = this.resolveComponentName(toComponent)

    if (!this.logicalDecomposition.includeExternalComponents && !resolved) {
      return
    }

    // Use resolved name if found, otherwise use the raw extracted string
    toComponent = resolved ?? toComponent

    const duplicationKey = `${color} / ${sourceFile.relativePath} -> ${toComponent}`
    if (this.fileComponentDependencies.has(duplicationKey)) return
    this.fileComponentDependencies.add(duplicationKey)

    const group = this.logicalDecomposition.name
    const logicalComponents = sourceFile.logicalComponents.filter((c) => c.filtering === group)

    if (logicalComponents.length === 0) return

    const firstAspect = logicalComponents[0]
    if (!firstAspect) return

    const fromComponent = firstAspect.name

    const dep = new ComponentDependency()
    dep.color = color
    if (reverseDirection) {
      dep.fromComponent = toComponent
      dep.toComponent = fromComponent
    } else {
      dep.fromComponent = fromComponent
      dep.toComponent = toComponent
    }

    this.allDependencies.push({
      fromComponentName: fromComponent,
      toComponentName: toComponent,
      sourceFilePath: sourceFile.relativePath,
      codeFragment: line,
    })

    if (dep.fromComponent.toLowerCase() !== dep.toComponent.toLowerCase()) {
      const key = dep.getDependencyString()
      const existing = this.dependenciesMap.get(key)
      if (existing) {
        existing.count++
        existing.locFrom += sourceFile.linesOfCode
        existing.evidence.push(new DependencyEvidence(sourceFile.relativePath, line))
      } else {
        dep.locFrom = sourceFile.linesOfCode
        dep.evidence.push(new DependencyEvidence(sourceFile.relativePath, line))
        this.dependencies.push(dep)
        this.dependenciesMap.set(key, dep)
      }
    }
  }

  /**
   * Resolve an extracted dependency string to a known component name.
   * First tries exact match, then checks if any component name appears as a
   * segment in the extracted string (e.g., "nl.obren.sokrates.common.utils" matches component "common").
   */
  private resolveComponentName(extracted: string): string | null {
    // Exact match
    const exact = this.logicalDecomposition.getComponentByName(extracted)
    if (exact) return exact.name

    // Segment match: split the extracted string by dots and slashes,
    // check if any component name matches a segment
    const segments = extracted.replace(/\./g, "/").split("/")
    for (const component of this.logicalDecomposition.components) {
      const compSegments = component.name.replace(/\./g, "/").split("/")
      // Check if component name segments appear contiguously in the extracted segments
      for (let i = 0; i <= segments.length - compSegments.length; i++) {
        let match = true
        for (let j = 0; j < compSegments.length; j++) {
          const segment = segments[i + j]
          const componentSegment = compSegments[j]
          if (!segment || !componentSegment || segment.toLowerCase() !== componentSegment.toLowerCase()) {
            match = false
            break
          }
        }
        if (match) return component.name
      }
    }

    return null
  }

  private pathMatches(pattern: string, path: string): boolean {
    if (!pattern) return true
    try {
      return new RegExp(pattern).test(path)
    } catch {
      return false
    }
  }

  private matchesEntirely(pattern: string, content: string): boolean {
    if (!pattern) return false
    try {
      return new RegExp(`^(?:${pattern})$`).test(content)
    } catch {
      return false
    }
  }
}
