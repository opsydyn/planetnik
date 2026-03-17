import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { Command, Options } from "@effect/cli"
import {
  CodeAnalyzer,
  CodeAnalyzerSettings,
  CodeConfiguration,
  LandscapeAnalysisInitiator,
  LandscapeAnalyzer,
  NamedSourceCodeAspect,
  ScopeCreator,
} from "@planetnik/analyzer"
import {
  BasicSourceCodeReportGenerator,
  DataExporter,
  LandscapeReportGenerator,
  REPORTS_HTML_FOOTER,
  REPORTS_HTML_HEADER,
  ReportFileExporter,
  ReportRenderer,
  RichTextReport,
} from "@planetnik/reports"
import { Effect } from "effect"
import simpleGit from "simple-git"
import { extractGitHistory } from "../git/GitHistoryExtractor.js"
import { discoverRepos, type GitHubRepo, type LandscapeConfig } from "../github/GitHubRepoFinder.js"

const configFile = Options.text("config").pipe(Options.withDescription("Path to landscape config JSON"))
const outputFolder = Options.text("outputFolder").pipe(
  Options.withDefault("./landscape-report"),
  Options.withDescription("Output folder for all reports"),
)
const landscapeName = Options.text("name").pipe(Options.optional, Options.withDescription("Landscape name override"))
const concurrency = Options.integer("concurrency").pipe(
  Options.withDefault(4),
  Options.withDescription("Number of repos to analyze in parallel"),
)
const skipExisting = Options.boolean("skipExisting").pipe(
  Options.withDefault(true),
  Options.withDescription("Skip repos that already have analysis results"),
)

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

async function analyzeRepo(
  repo: GitHubRepo,
  repoOutputDir: string,
  cloneUrl: string,
): Promise<{ name: string; success: boolean; error?: string }> {
  const tmpId = randomBytes(6).toString("hex")
  const cloneDir = join(tmpdir(), `planetnik-${tmpId}`)

  try {
    const git = simpleGit()
    await git.clone(cloneUrl, cloneDir, ["--single-branch"])

    const creator = new ScopeCreator(cloneDir)
    creator.createScopeFromConventions(repo.name, repo.description ?? undefined)

    await extractGitHistory(cloneDir)

    const confFile = join(cloneDir, "_planetnik", "config.json")
    if (!existsSync(confFile)) {
      return { name: repo.name, success: false, error: "Config not created" }
    }

    runAnalysisRaw(confFile, repoOutputDir)

    return { name: repo.name, success: true }
  } catch (e) {
    return { name: repo.name, success: false, error: String(e) }
  } finally {
    rmSync(cloneDir, { recursive: true, force: true })
  }
}

function runAnalysisRaw(confFile: string, outputDir: string): void {
  const jsonContent = readFileSync(confFile, "utf-8")
  const parsed = JSON.parse(jsonContent)
  const codeConfiguration = new CodeConfiguration()
  Object.assign(codeConfiguration, parsed)

  for (const key of ["main", "test", "generated", "buildAndDeployment", "other"] as const) {
    if (parsed[key]) {
      const aspect = new NamedSourceCodeAspect(
        parsed[key].name ?? key,
        parsed[key].sourceFileFilters ?? [],
        parsed[key].files ?? [],
      )
      aspect.sourceFiles = parsed[key].sourceFiles ?? []
      codeConfiguration[key] = aspect
    }
  }

  const settings = CodeAnalyzerSettings.selectAll()
  const codeAnalyzer = new CodeAnalyzer(settings, codeConfiguration, confFile)
  const analysisResults = codeAnalyzer.analyze()

  const dataExporter = new DataExporter(analysisResults, outputDir)
  dataExporter.exportData()

  const generator = new BasicSourceCodeReportGenerator(settings, analysisResults)
  const reports = generator.report()

  for (const report of reports) {
    ReportFileExporter.exportHtml(outputDir, "html", report)
  }

  if (settings.updateIndex) {
    ReportFileExporter.exportReportsIndex(outputDir, reports, codeConfiguration.metadata.name)
  }
}

export const analyzeLandscapeCommand = Command.make(
  "analyzeLandscape",
  { config: configFile, outputFolder, name: landscapeName, concurrency, skipExisting },
  (args) =>
    Effect.gen(function* () {
      const configPath = resolve(args.config)
      if (!existsSync(configPath)) {
        yield* Effect.logError(`Config file not found: ${configPath}`)
        return
      }

      const config: LandscapeConfig = JSON.parse(readFileSync(configPath, "utf-8"))
      const outDir = resolve(args.outputFolder)
      mkdirSync(outDir, { recursive: true })

      // 1. Discover repos
      yield* Effect.log("Discovering repositories from GitHub...")
      const orgRepos = yield* Effect.tryPromise({
        try: () => discoverRepos(config),
        catch: (error) => new Error(`GitHub API discovery failed: ${error}`),
      })

      let totalRepos = 0
      for (const [org, repos] of orgRepos) {
        yield* Effect.log(`  ${org}: ${repos.length} active repositories`)
        totalRepos += repos.length
      }
      yield* Effect.log(`Total: ${totalRepos} repositories to analyze`)

      // Save discovery results
      const discoveryDir = join(outDir, "_discovery")
      mkdirSync(discoveryDir, { recursive: true })
      for (const [org, repos] of orgRepos) {
        writeFileSync(join(discoveryDir, `${org}.json`), JSON.stringify(repos, null, 2), "utf-8")
      }

      // 2. Analyze each repo
      let analyzed = 0
      let skipped = 0
      let failed = 0
      const failures: { org: string; repo: string; error: string }[] = []

      for (const [org, repos] of orgRepos) {
        yield* Effect.log(`\nAnalyzing ${org} (${repos.length} repos)...`)

        const orgDir = join(outDir, org)
        mkdirSync(orgDir, { recursive: true })

        // Process in batches for concurrency control
        for (let i = 0; i < repos.length; i += args.concurrency) {
          const batch = repos.slice(i, i + args.concurrency)

          const promises = batch.map((repo) => {
            const repoOutputDir = join(orgDir, repo.name)

            // Skip if already analyzed
            if (args.skipExisting && existsSync(join(repoOutputDir, "data", "analysisResults.json"))) {
              skipped++
              return Promise.resolve({ name: repo.name, success: true, skipped: true as const })
            }

            mkdirSync(repoOutputDir, { recursive: true })
            const cloneUrl = `${config.githubCloneUrl}/${org}/${repo.name}.git`
            return analyzeRepo(repo, repoOutputDir, cloneUrl)
          })

          const results = yield* Effect.tryPromise({
            try: () => Promise.all(promises),
            catch: (error) => new Error(`Batch processing failed: ${error}`),
          })

          for (const result of results) {
            if ("skipped" in result) {
              yield* Effect.log(`  [skip] ${result.name} (already analyzed)`)
            } else if (result.success) {
              analyzed++
              yield* Effect.log(`  [done] ${result.name}`)
            } else {
              failed++
              failures.push({ org, repo: result.name, error: result.error ?? "unknown" })
              yield* Effect.log(`  [fail] ${result.name}: ${result.error}`)
            }
          }
        }
      }

      yield* Effect.log(`\nAnalysis complete: ${analyzed} analyzed, ${skipped} skipped, ${failed} failed`)

      if (failures.length > 0) {
        writeFileSync(join(outDir, "_failures.json"), JSON.stringify(failures, null, 2), "utf-8")
      }

      // 3. Generate landscape report
      yield* Effect.log("\nGenerating landscape report...")

      // Use initiator to discover all analysisResults.json files and build config
      const initiator = new LandscapeAnalysisInitiator()
      const landscapeConfig = initiator.initConfiguration(outDir, null, true)

      if (args.name._tag === "Some") {
        landscapeConfig.metadata = {
          ...landscapeConfig.metadata,
          name: args.name.value,
        }
      }

      const analyzer = new LandscapeAnalyzer(landscapeConfig, outDir)
      const landscapeResults = analyzer.analyze()

      const report = new RichTextReport("landscape", "index.html")
      report.displayName = landscapeResults.metadata.name || "Landscape"
      LandscapeReportGenerator.generate(report, landscapeResults)

      const reportsDir = join(outDir, "_planetnik_landscape", "reports")
      mkdirSync(reportsDir, { recursive: true })

      const parts: string[] = []
      const client = { append: (text: string) => parts.push(text) }
      new ReportRenderer().render(report, client)

      const html =
        REPORTS_HTML_HEADER.replace("{{TITLE}}", report.displayName).replace("{{CUSTOM_HEADER}}", "") +
        parts.join("") +
        REPORTS_HTML_FOOTER

      writeFileSync(join(reportsDir, "index.html"), html, "utf-8")

      const dataDir = join(reportsDir, "data")
      mkdirSync(dataDir, { recursive: true })
      writeFileSync(
        join(dataDir, "landscapeAnalysisResults.json"),
        JSON.stringify(
          landscapeResults,
          (_key, value) => (value instanceof Map ? Object.fromEntries(value) : value),
          2,
        ),
        "utf-8",
      )

      yield* Effect.log(`Landscape report: ${reportsDir}/index.html`)
      yield* Effect.log(
        `${landscapeResults.getRepositoryCount()} repositories, ${landscapeResults.getTotalLoc()} total LOC`,
      )
      yield* Effect.log(`\nData directory: ${dataDir}`)
      yield* Effect.log(`Run date: ${todayString()}`)
    }),
)
