import { readdirSync, readFileSync } from "node:fs"
import { basename, extname, relative, resolve } from "node:path"
import { SourceFile } from "../src/aspects/SourceFile.js"

type BenchmarkLanguage = "python" | "rust"

interface ParsedSource {
  readonly tree: {
    readonly rootNode: {
      readonly hasError: boolean
    }
  }
  readonly dispose: () => void
}

interface BenchmarkAnalyzer {
  readonly extractUnits: (sourceFile: SourceFile) => readonly unknown[]
  readonly extractDependencies: (sourceFiles: readonly SourceFile[]) => {
    readonly dependencies: readonly unknown[]
    readonly errors: readonly unknown[]
  }
}

interface BenchmarkAdapter {
  readonly extension: string
  readonly createAnalyzer: () => BenchmarkAnalyzer
  readonly parse: (source: string) => ParsedSource
}

export interface TreeSitterBenchmarkReport {
  readonly benchmarkVersion: 1
  readonly generatedAt: string
  readonly language: BenchmarkLanguage
  readonly sourceRoot: string
  readonly runtime: {
    readonly bunVersion: string
    readonly platform: string
    readonly architecture: string
  }
  readonly corpus: {
    readonly sourceFiles: number
    readonly sourceBytes: number
    readonly sourceLines: number
  }
  readonly parse: {
    readonly syntaxErrorFiles: number
    readonly parseFailures: number
  }
  readonly analysis: {
    readonly unitCount: number
    readonly unitExtractionFailures: number
    readonly dependencyLinkCount: number
    readonly dependencyErrorCount: number
    readonly dependencyExtractionFailures: number
  }
  readonly timings: {
    readonly adapterLoadMs: number
    readonly totalMs: number
    readonly parseMs: number
    readonly unitsMs: number
    readonly dependenciesMs: number
  }
  readonly memory: {
    readonly rssBeforeBytes: number
    readonly peakRssBytes: number
    readonly rssAfterBytes: number
  }
}

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".hg",
  ".svn",
  "__pycache__",
  ".venv",
  "node_modules",
  "target",
  "dist",
  "build",
])

export async function loadBenchmarkAdapter(language: BenchmarkLanguage): Promise<BenchmarkAdapter> {
  if (language === "rust") {
    const [{ RustAnalyzer }, { parseRustSource }] = await Promise.all([
      import("../src/lang/RustAnalyzer.js"),
      import("../src/lang/rust/TreeSitterRustParser.js"),
    ])

    return {
      extension: "rs",
      createAnalyzer: () => new RustAnalyzer(),
      parse: parseRustSource,
    }
  }

  const [{ PythonAnalyzer }, { parsePythonSource }] = await Promise.all([
    import("../src/lang/PythonAnalyzer.js"),
    import("../src/lang/python/TreeSitterPythonParser.js"),
  ])

  return {
    extension: "py",
    createAnalyzer: () => new PythonAnalyzer(),
    parse: parsePythonSource,
  }
}

export async function benchmarkTreeSitter(
  language: BenchmarkLanguage,
  sourceRoot: string,
): Promise<TreeSitterBenchmarkReport> {
  const resolvedRoot = resolve(sourceRoot)
  const memoryBefore = readRss()
  let peakRss = memoryBefore
  const sampleMemory = () => {
    peakRss = Math.max(peakRss, readRss())
  }
  const totalStart = performance.now()
  const adapterStart = performance.now()
  const adapter = await loadBenchmarkAdapter(language)
  const adapterLoadMs = elapsedMs(adapterStart)
  sampleMemory()
  const sourcePaths = collectSourcePaths(resolvedRoot, adapter.extension)
  const sources = sourcePaths.map((sourcePath) => {
    const content = readFileSync(sourcePath, "utf8")
    const relativePath = relative(resolvedRoot, sourcePath).replace(/\\/g, "/")
    return new SourceFile(relativePath, content)
  })
  const sourceBytes = sources.reduce(
    (total, sourceFile) => total + new TextEncoder().encode(sourceFile.content).byteLength,
    0,
  )
  const sourceLines = sources.reduce(
    (total, sourceFile) => total + (sourceFile.content.length === 0 ? 0 : sourceFile.content.split(/\r?\n/).length),
    0,
  )
  let syntaxErrorFiles = 0
  let parseFailures = 0
  const parseStart = performance.now()
  for (const sourceFile of sources) {
    try {
      const parsed = adapter.parse(sourceFile.content)
      try {
        if (parsed.tree.rootNode.hasError) {
          syntaxErrorFiles += 1
        }
      } finally {
        parsed.dispose()
      }
    } catch {
      parseFailures += 1
    }
    sampleMemory()
  }
  const parseMs = elapsedMs(parseStart)

  const analyzer = adapter.createAnalyzer()
  let unitCount = 0
  let unitExtractionFailures = 0
  const unitsStart = performance.now()
  for (const sourceFile of sources) {
    try {
      unitCount += analyzer.extractUnits(sourceFile).length
    } catch {
      unitExtractionFailures += 1
    }
    sampleMemory()
  }
  const unitsMs = elapsedMs(unitsStart)

  let dependencyLinkCount = 0
  let dependencyErrorCount = 0
  let dependencyExtractionFailures = 0
  const dependenciesStart = performance.now()
  try {
    const dependencies = analyzer.extractDependencies(sources)
    dependencyLinkCount = dependencies.dependencies.length
    dependencyErrorCount = dependencies.errors.length
  } catch {
    dependencyExtractionFailures = 1
  }
  sampleMemory()
  const dependenciesMs = elapsedMs(dependenciesStart)

  sampleMemory()
  const memoryAfter = readRss()
  peakRss = Math.max(peakRss, memoryAfter)
  return {
    benchmarkVersion: 1,
    generatedAt: new Date().toISOString(),
    language,
    sourceRoot: basename(resolvedRoot),
    runtime: {
      bunVersion: Bun.version,
      platform: process.platform,
      architecture: process.arch,
    },
    corpus: {
      sourceFiles: sources.length,
      sourceBytes,
      sourceLines,
    },
    parse: {
      syntaxErrorFiles,
      parseFailures,
    },
    analysis: {
      unitCount,
      unitExtractionFailures,
      dependencyLinkCount,
      dependencyErrorCount,
      dependencyExtractionFailures,
    },
    timings: {
      adapterLoadMs,
      totalMs: elapsedMs(totalStart),
      parseMs,
      unitsMs,
      dependenciesMs,
    },
    memory: {
      rssBeforeBytes: memoryBefore,
      peakRssBytes: peakRss,
      rssAfterBytes: memoryAfter,
    },
  }
}

function collectSourcePaths(root: string, extension: string): string[] {
  const sourcePaths: string[] = []

  function visit(directory: string): void {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    )

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue
      }

      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          visit(path)
        }
        continue
      }

      if (entry.isFile() && extname(entry.name).toLowerCase() === `.${extension}`) {
        sourcePaths.push(path)
      }
    }
  }

  visit(root)
  return sourcePaths
}

function readRss(): number {
  return process.memoryUsage().rss
}

function elapsedMs(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100
}

function parseArguments(args: readonly string[]): { readonly language: BenchmarkLanguage; readonly root: string } {
  let language: BenchmarkLanguage | undefined
  let root: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--language") {
      const value = args[index + 1]
      if (value !== "rust" && value !== "python") {
        throw new Error("--language must be either rust or python")
      }
      language = value
      index += 1
      continue
    }

    if (argument === "--root") {
      const value = args[index + 1]
      if (!value) {
        throw new Error("--root requires a directory")
      }
      root = value
      index += 1
      continue
    }

    if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: bun run packages/analyzer/scripts/benchmark-tree-sitter.ts --language <rust|python> --root <path>",
      )
      process.exit(0)
    }

    throw new Error(`Unknown argument: ${argument}`)
  }

  if (!language || !root) {
    throw new Error("Both --language and --root are required")
  }

  return { language, root }
}

if (import.meta.main) {
  try {
    const { language, root } = parseArguments(Bun.argv.slice(2))
    console.log(JSON.stringify(await benchmarkTreeSitter(language, root), null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
