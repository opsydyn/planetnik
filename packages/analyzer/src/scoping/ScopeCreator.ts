import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { basename, dirname, extname, join, resolve } from "node:path"
import { LogicalDecomposition } from "../aspects/LogicalDecomposition.js"
import { SourceFile } from "../aspects/SourceFile.js"
import { CodeConfiguration, DEFAULT_CONFIGURATION_FOLDER } from "../core/CodeConfiguration.js"
import { LanguageAnalyzerFactory } from "../lang/LanguageAnalyzerFactory.js"
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

  private saveConfig(config: CodeConfiguration): void {
    const configDir = dirname(this.confFile)
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true })
    }
    writeFileSync(this.confFile, JSON.stringify(config, null, 2), "utf-8")
  }
}
