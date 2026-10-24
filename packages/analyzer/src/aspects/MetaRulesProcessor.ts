import { RegexUtils } from "@planetnik/common"
import type { MetaRule } from "../dependencies/MetaRule.js"
import { ComplexOperation } from "../operations/ComplexOperation.js"
import { Concern } from "./Concern.js"
import { NamedSourceCodeAspect } from "./NamedSourceCodeAspect.js"
import type { SourceFile } from "./SourceFile.js"

interface MetaRulesProcessorCallback {
  getInstance(name: string): NamedSourceCodeAspect
  updateSourceFile(sourceFile: SourceFile, aspect: NamedSourceCodeAspect): void
}

export class MetaRulesProcessor<T extends NamedSourceCodeAspect = NamedSourceCodeAspect> {
  private aspects: T[] = []
  private alreadyAddedFiles: SourceFile[] = []
  private map = new Map<string, T>()
  private callback: MetaRulesProcessorCallback
  uniqueClassification: boolean

  private constructor(uniqueClassification: boolean, callback: MetaRulesProcessorCallback) {
    this.uniqueClassification = uniqueClassification
    this.callback = callback
  }

  static getConcernsInstance(): MetaRulesProcessor<Concern> {
    return new MetaRulesProcessor<Concern>(false, {
      getInstance(name: string) {
        return new Concern(name)
      },
      updateSourceFile(sourceFile: SourceFile, aspect: NamedSourceCodeAspect) {
        sourceFile.concerns.push(aspect)
      },
    })
  }

  static getLogicalDecompositionInstance(): MetaRulesProcessor<NamedSourceCodeAspect> {
    return new MetaRulesProcessor<NamedSourceCodeAspect>(true, {
      getInstance(name: string) {
        return new NamedSourceCodeAspect(name)
      },
      updateSourceFile(sourceFile: SourceFile, aspect: NamedSourceCodeAspect) {
        sourceFile.logicalComponents.push(aspect)
      },
    })
  }

  extractAspects(sourceFiles: SourceFile[], metaRules: MetaRule[]): T[] {
    this.aspects = []
    this.map = new Map()
    this.alreadyAddedFiles = []

    for (const sourceFile of sourceFiles) {
      this.processSourceFile(metaRules, sourceFile)
    }

    return this.aspects
  }

  private processSourceFile(metaRules: MetaRule[], sourceFile: SourceFile): void {
    for (const metaRule of metaRules) {
      if (RegexUtils.matchesEntirely(metaRule.pathPattern || ".*", sourceFile.relativePath)) {
        this.processSourceFileContent(sourceFile, metaRule)
      }
    }
  }

  private processSourceFileContent(sourceFile: SourceFile, metaRule: MetaRule): void {
    if (this.stopProcessing(metaRule)) return

    const lines = this.getLines(sourceFile, metaRule)
    for (const line of lines) {
      if (this.matches(metaRule, line)) {
        if (this.shouldProcessFile(sourceFile)) {
          this.processMatchingString(sourceFile, metaRule, line)
        }
      }
    }
  }

  private stopProcessing(metaRule: MetaRule): boolean {
    if (metaRule.use.toLowerCase() === "path") {
      return !metaRule.pathPattern
    }
    return !metaRule.contentPattern
  }

  private matches(metaRule: MetaRule, line: string): boolean {
    if (metaRule.use.toLowerCase() === "path") {
      return RegexUtils.matchesEntirely(metaRule.pathPattern, line)
    }
    return RegexUtils.matchesEntirely(metaRule.contentPattern, line)
  }

  private getLines(sourceFile: SourceFile, metaRule: MetaRule): string[] {
    if (metaRule.use.toLowerCase() === "path") {
      return [sourceFile.relativePath]
    }
    return metaRule.ignoreComments ? sourceFile.cleanedLines : sourceFile.lines
  }

  private shouldProcessFile(sourceFile: SourceFile): boolean {
    return !this.uniqueClassification || !this.alreadyAddedFiles.includes(sourceFile)
  }

  private processMatchingString(sourceFile: SourceFile, metaRule: MetaRule, matchingString: string): void {
    this.updateAlreadyProcessedFiles(sourceFile)
    const name = new ComplexOperation(metaRule.nameOperations).exec(matchingString)
    if (!name) return

    const existing = this.map.get(name)
    if (existing) {
      if (!existing.sourceFiles.includes(sourceFile)) {
        existing.sourceFiles.push(sourceFile)
        this.callback.updateSourceFile(sourceFile, existing)
      }
    } else {
      const aspect = this.callback.getInstance(name) as T
      aspect.sourceFiles.push(sourceFile)
      this.callback.updateSourceFile(sourceFile, aspect)
      this.map.set(name, aspect)
      this.aspects.push(aspect)
    }
  }

  private updateAlreadyProcessedFiles(sourceFile: SourceFile): void {
    if (this.uniqueClassification && !this.alreadyAddedFiles.includes(sourceFile)) {
      this.alreadyAddedFiles.push(sourceFile)
    }
  }
}
