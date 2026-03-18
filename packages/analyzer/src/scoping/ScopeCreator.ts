import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join, resolve } from "node:path"
import { Concern } from "../aspects/Concern.js"
import { ConcernsGroup } from "../aspects/ConcernsGroup.js"
import { LogicalDecomposition } from "../aspects/LogicalDecomposition.js"
import { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import { SourceFile } from "../aspects/SourceFile.js"
import { CodeConfiguration, DEFAULT_CONFIGURATION_FOLDER } from "../core/CodeConfiguration.js"
import { Range } from "../core/Range.js"
import { SourceFileFilter } from "../core/SourceFileFilter.js"
import { LanguageAnalyzerFactory } from "../lang/LanguageAnalyzerFactory.js"
import { MetricRangeControl } from "../metrics/MetricRangeControl.js"
import { MetricsWithGoal } from "../metrics/MetricsWithGoal.js"
import { ConventionUtils } from "./ConventionUtils.js"
import { ScopingConventions } from "./ScopingConventions.js"

const KNOWN_BINARY_EXTENSIONS = new Set([
  "3ds",
  "3g2",
  "3gp",
  "7z",
  "a",
  "aac",
  "ai",
  "aif",
  "ape",
  "apk",
  "ar",
  "avi",
  "bak",
  "bin",
  "bmp",
  "bz2",
  "cab",
  "class",
  "cur",
  "dat",
  "deb",
  "dll",
  "dmg",
  "doc",
  "docx",
  "dxf",
  "eot",
  "epub",
  "exe",
  "flac",
  "gif",
  "gz",
  "gzip",
  "ico",
  "img",
  "iso",
  "jar",
  "jpeg",
  "jpg",
  "key",
  "lz",
  "lzma",
  "mkv",
  "mov",
  "mp3",
  "mp4",
  "mpeg",
  "mpg",
  "o",
  "ogg",
  "otf",
  "pages",
  "pdf",
  "png",
  "ppt",
  "pptx",
  "psd",
  "pyc",
  "pyo",
  "rar",
  "so",
  "svg",
  "swf",
  "tar",
  "tif",
  "tiff",
  "ttf",
  "war",
  "wav",
  "webm",
  "webp",
  "whl",
  "woff",
  "woff2",
  "xls",
  "xlsx",
  "xz",
  "zip",
  "zipx",
])

const IGNORABLE_EXTENSIONS = new Set(["ds_store", "iml", "ser"])

export class ScopeCreator {
  private srcRoot: string
  private confFile: string

  constructor(srcRoot: string, confFile?: string) {
    this.srcRoot = resolve(srcRoot)
    this.confFile = confFile ?? join(this.srcRoot, DEFAULT_CONFIGURATION_FOLDER, "config.json")
  }

  createScopeFromConventions(name?: string, description?: string, logoLink?: string): void {
    const extensions = this.detectExtensions()
    const config = this.createDefaultConfig(extensions)

    const dirName = basename(this.srcRoot)
    config.metadata.name = name || dirName.charAt(0).toUpperCase() + dirName.slice(1).toLowerCase()
    if (description) config.metadata.description = description
    if (logoLink) config.metadata.logoLink = logoLink

    // Scan source files for scoping conventions
    const sourceFiles = this.scanSourceFiles(extensions)
    this.applyConventions(config, sourceFiles)

    // Auto-detect components from folder structure
    this.autoDetectComponents(config, sourceFiles)

    // Add default concerns and goals
    this.addDefaultConcerns(config)
    this.addDefaultGoals(config)

    this.saveConfig(config)
  }

  private detectExtensions(): string[] {
    const extensionCounts = new Map<string, number>()
    const registeredExtensions = new Set(LanguageAnalyzerFactory.getInstance().getRegisteredExtensions())

    this.walkDirectory(this.srcRoot, (filePath) => {
      const ext = extname(filePath).slice(1).toLowerCase()
      if (!ext) return
      if (KNOWN_BINARY_EXTENSIONS.has(ext)) return
      if (IGNORABLE_EXTENSIONS.has(ext)) return
      if (!registeredExtensions.has(ext)) return
      extensionCounts.set(ext, (extensionCounts.get(ext) ?? 0) + 1)
    })

    return Array.from(extensionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([ext]) => ext)
  }

  private scanSourceFiles(extensions: string[]): SourceFile[] {
    const extSet = new Set(extensions)
    const files: SourceFile[] = []

    this.walkDirectory(this.srcRoot, (filePath) => {
      const ext = extname(filePath).slice(1).toLowerCase()
      if (!extSet.has(ext)) return
      const relativePath = filePath.slice(this.srcRoot.length + 1)
      files.push(new SourceFile(relativePath))
    })

    return files
  }

  private walkDirectory(dir: string, callback: (filePath: string) => void): void {
    if (!existsSync(dir)) return
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue
      if (entry.name === "node_modules") continue
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        this.walkDirectory(fullPath, callback)
      } else if (entry.isFile()) {
        callback(fullPath)
      }
    }
  }

  private createDefaultConfig(extensions: string[]): CodeConfiguration {
    const config = new CodeConfiguration()
    config.extensions = extensions
    config.srcRoot = ".."

    // Default logical decomposition by top-level directory
    config.logicalDecompositions = [new LogicalDecomposition("primary")]

    return config
  }

  private applyConventions(config: CodeConfiguration, sourceFiles: SourceFile[]): void {
    ConventionUtils.addConventions(ScopingConventions.testConventions(), config.test.sourceFileFilters, sourceFiles)
    ConventionUtils.addConventions(
      ScopingConventions.generatedConventions(),
      config.generated.sourceFileFilters,
      sourceFiles,
    )
    ConventionUtils.addConventions(
      ScopingConventions.buildAndDeploymentConventions(),
      config.buildAndDeployment.sourceFileFilters,
      sourceFiles,
    )
    ConventionUtils.addConventions(ScopingConventions.ignoreConventions(), config.ignore, sourceFiles)
  }

  private autoDetectComponents(config: CodeConfiguration, sourceFiles: SourceFile[]): void {
    for (const decomposition of config.logicalDecompositions) {
      if (decomposition.components.length > 0) continue // already has explicit components

      const depth = decomposition.componentsFolderDepth
      const minCount = decomposition.minComponentsCount
      const components = ScopeCreator.getComponentsFromFolderDepth(sourceFiles, depth, minCount)
      decomposition.components = components
    }
  }

  static getComponentsFromFolderDepth(
    sourceFiles: SourceFile[],
    startDepth: number,
    minCount: number,
  ): NamedSourceCodeAspect[] {
    const MAX_DEPTH = 20
    for (let depth = Math.max(1, startDepth); depth <= MAX_DEPTH; depth++) {
      const components = ScopeCreator.getComponentsAtDepth(sourceFiles, depth)
      if (components.length >= minCount || minCount === 0) {
        return components
      }
    }
    return []
  }

  static getComponentsAtDepth(sourceFiles: SourceFile[], depth: number): NamedSourceCodeAspect[] {
    // Extract unique folder paths at given depth
    const paths: string[] = []
    for (const file of sourceFiles) {
      const parts = file.relativePath.replace(/\\/g, "/").split("/")
      // Take up to `depth` folder segments (exclude filename)
      const folderParts = parts.slice(0, Math.min(depth, parts.length - 1))
      const folderPath = folderParts.join("/")
      if (folderPath && !paths.includes(folderPath)) {
        paths.push(folderPath)
      }
    }

    if (paths.length === 0) return []

    // Strip greatest common prefix so component names are meaningful
    const commonPrefix = ScopeCreator.greatestCommonPrefix(paths)

    const components: NamedSourceCodeAspect[] = []
    for (const p of paths) {
      let name = p !== commonPrefix ? p.substring(commonPrefix.length) : p
      name = name || "ROOT"

      const pathPattern = `${p}/.*`
      const filters = [SourceFileFilter.make({ pathPattern })]

      // Add exclusion filters for nested paths to avoid overlap
      for (const other of paths) {
        if (other !== p && other.startsWith(`${p}/`)) {
          filters.push(SourceFileFilter.make({ pathPattern: `${other}/.*`, exception: true }))
        }
      }

      components.push(new NamedSourceCodeAspect(name, filters))
    }

    return components
  }

  static greatestCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return ""

    const minLen = Math.min(...strings.map((s) => s.length))
    let prefixEnd = 0

    for (let i = 0; i < minLen; i++) {
      const c = strings[0][i]
      if (strings.every((s) => s[i] === c)) {
        prefixEnd = i + 1
      } else {
        break
      }
    }

    let prefix = strings[0].substring(0, prefixEnd)

    // Truncate to last full folder boundary
    if (!prefix.endsWith("/") && prefix.includes("/")) {
      prefix = prefix.substring(0, prefix.lastIndexOf("/") + 1)
    } else if (!prefix.includes("/")) {
      prefix = ""
    }

    return prefix
  }

  private addDefaultConcerns(config: CodeConfiguration): void {
    if (config.concernGroups.length > 0) return

    const todosConcern = new Concern("TODOs", [SourceFileFilter.make({ contentPattern: ".*(TODO|FIXME)( |:|\\t).*" })])

    const group = new ConcernsGroup("general")
    group.concerns.push(todosConcern)
    config.concernGroups.push(group)
  }

  private addDefaultGoals(config: CodeConfiguration): void {
    if (config.goalsAndControls.length > 0) return

    config.goalsAndControls.push(
      MetricsWithGoal.make({
        goal: "Keep the system simple and easy to change",
        description:
          "Aim at keeping the system size modest (less than 200,000 LOC is good), duplication low (less than 5% is good), files small (no files longer than 1000 LOC is good), and units simple (no units with more than 25 decision points is good).",
        controls: [
          MetricRangeControl.make({
            metric: "LINES_OF_CODE_MAIN",
            description: "Total number of lines of main code",
            desiredRange: Range.make({ min: "0", max: "200000", tolerance: "20000" }),
          }),
          MetricRangeControl.make({
            metric: "DUPLICATION_PERCENTAGE",
            description: "System duplication",
            desiredRange: Range.make({ min: "0", max: "5", tolerance: "1" }),
          }),
          MetricRangeControl.make({
            metric: "VERY_HIGH_RISK_FILE_SIZE_COUNT",
            description: "The number of very large files",
            desiredRange: Range.make({ min: "0", max: "0", tolerance: "1" }),
          }),
          MetricRangeControl.make({
            metric: "VERY_HIGH_RISK_CONDITIONAL_COMPLEXITY_COUNT",
            description: "The number of very complex units",
            desiredRange: Range.make({ min: "0", max: "0", tolerance: "1" }),
          }),
        ],
      }),
    )
  }

  private saveConfig(config: CodeConfiguration): void {
    const configDir = dirname(this.confFile)
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true })
    }
    writeFileSync(this.confFile, JSON.stringify(config, null, 2), "utf-8")
  }
}
