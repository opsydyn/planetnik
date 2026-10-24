import type { SourceFile } from "../aspects/SourceFile.js"
import { CodeConfiguration } from "../core/CodeConfiguration.js"
import type { FoundTag } from "../core/FoundTag.js"
import type { TagRuleType } from "../core/TagRule.js"
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"
import { AnalysisUtils } from "./AnalysisUtils.js"
import { SourceCodeFiles } from "./SourceCodeFiles.js"

export class BasicsAnalyzer {
  private results: CodeAnalysisResults
  private codeConfiguration: CodeConfiguration
  private configFilePath: string

  constructor(results: CodeAnalysisResults, configFilePath: string) {
    this.results = results
    this.codeConfiguration = results.codeConfiguration!
    this.configFilePath = configFilePath
  }

  analyze(): void {
    const sourceCodeFiles = new SourceCodeFiles()
    const srcRoot = CodeConfiguration.getAbsoluteSrcRoot(this.codeConfiguration.srcRoot, this.configFilePath)
    sourceCodeFiles.load(srcRoot)

    this.results.foundTags = this.findTags(sourceCodeFiles)
    this.results.filesExcludedByExtension = sourceCodeFiles.filesExcludedByExtension
    this.results.ignoredFilesGroups = sourceCodeFiles.ignoredFilesGroups
    this.results.totalNumberOfFilesInScope = sourceCodeFiles.allFiles.length

    this.results.metricsList
      .addMetric()
      .setId(AnalysisUtils.getMetricId("TOTAL_NUMBER_OF_FILES"))
      .setDescription("Total number of files in the source folder")
      .setValue(sourceCodeFiles.allFiles.length)

    // Create broad scope and load config scopes
    sourceCodeFiles.createBroadScope(
      this.codeConfiguration.extensions,
      this.codeConfiguration.ignore,
      this.codeConfiguration.analysis,
    )

    // Populate scope source files
    this.loadScopes(sourceCodeFiles)
    this.analyzeScopes()

    const excludedFiles = sourceCodeFiles.getExcludedFiles()
    this.results.numberOfExcludedFiles = excludedFiles.length
    this.results.excludedExtensions = this.getExcludedExtensions(excludedFiles)
  }

  private loadScopes(sourceCodeFiles: SourceCodeFiles): void {
    // First populate secondary scopes (test, generated, build, other)
    if (this.codeConfiguration.test) {
      sourceCodeFiles.getSourceFiles(this.codeConfiguration.test)
    }
    if (this.codeConfiguration.generated) {
      sourceCodeFiles.getSourceFiles(this.codeConfiguration.generated)
    }
    if (this.codeConfiguration.buildAndDeployment) {
      sourceCodeFiles.getSourceFiles(this.codeConfiguration.buildAndDeployment)
    }
    if (this.codeConfiguration.other) {
      sourceCodeFiles.getSourceFiles(this.codeConfiguration.other)
    }

    // Main scope: if main has explicit filters, use them; otherwise take all
    // files in broad scope that weren't claimed by other scopes
    if (this.codeConfiguration.main.sourceFileFilters.length > 0 || this.codeConfiguration.main.files.length > 0) {
      sourceCodeFiles.getSourceFiles(this.codeConfiguration.main)
    } else {
      const claimed = new Set<string>()
      for (const aspect of [
        this.codeConfiguration.test,
        this.codeConfiguration.generated,
        this.codeConfiguration.buildAndDeployment,
        this.codeConfiguration.other,
      ]) {
        if (aspect) {
          for (const sf of aspect.sourceFiles) {
            claimed.add(sf.relativePath)
          }
        }
      }
      this.codeConfiguration.main.sourceFiles = sourceCodeFiles.filesInBroadScope.filter(
        (f) => !claimed.has(f.relativePath),
      )
    }
  }

  private analyzeScopes(): void {
    const start = this.results.analysisStartTimeMs

    AnalysisUtils.analyze(
      "",
      this.codeConfiguration.main,
      null,
      null,
      this.results.mainAspectAnalysisResults,
      this.results.metricsList,
      this.results.textSummary,
      start,
    )
    AnalysisUtils.analyze(
      "",
      this.codeConfiguration.test,
      null,
      null,
      this.results.testAspectAnalysisResults,
      this.results.metricsList,
      this.results.textSummary,
      start,
    )

    const mainLoc = this.results.mainAspectAnalysisResults.linesOfCode
    const testLoc = this.results.testAspectAnalysisResults.linesOfCode
    if (mainLoc > 0) {
      this.results.metricsList
        .addMetric()
        .setId(AnalysisUtils.getMetricId("TEST_VS_MAIN_LINES_OF_CODE_PERCENTAGE"))
        .setDescription("Test / main code ratio")
        .setValue(Math.round((10000.0 * testLoc) / mainLoc) / 100.0)
    }

    AnalysisUtils.analyze(
      "",
      this.codeConfiguration.generated,
      null,
      null,
      this.results.generatedAspectAnalysisResults,
      this.results.metricsList,
      this.results.textSummary,
      start,
    )
    AnalysisUtils.analyze(
      "",
      this.codeConfiguration.buildAndDeployment,
      null,
      null,
      this.results.buildAndDeployAspectAnalysisResults,
      this.results.metricsList,
      this.results.textSummary,
      start,
    )
    AnalysisUtils.analyze(
      "",
      this.codeConfiguration.other,
      null,
      null,
      this.results.otherAspectAnalysisResults,
      this.results.metricsList,
      this.results.textSummary,
      start,
    )
  }

  private findTags(sourceCodeFiles: SourceCodeFiles): FoundTag[] {
    const { FoundTag: FoundTagClass } = require("../core/FoundTag.js")
    const foundTags: FoundTag[] = []
    const allPaths = sourceCodeFiles.allFiles.map((f) => f.relativePath)

    for (const tagRule of this.codeConfiguration.tagRules) {
      for (const pattern of tagRule.pathPatterns) {
        try {
          const re = new RegExp(pattern)
          const matchedPath = allPaths.find((p) => re.test(p))
          if (matchedPath) {
            const excluded = tagRule.excludePathPatterns.some((ep: TagRuleType["excludePathPatterns"][number]) => {
              try {
                return new RegExp(ep).test(matchedPath)
              } catch {
                return false
              }
            })
            if (!excluded) {
              foundTags.push(new FoundTagClass(tagRule, matchedPath))
              break
            }
          }
        } catch {
          // invalid regex, skip
        }
      }
    }

    return foundTags
  }

  private getExcludedExtensions(excludedFiles: SourceFile[]): Map<string, number> {
    const map = new Map<string, number>()
    for (const file of excludedFiles) {
      const ext = file.extension
      map.set(ext, (map.get(ext) ?? 0) + 1)
    }
    return map
  }
}
