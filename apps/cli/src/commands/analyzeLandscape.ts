import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { Command, Options } from "@effect/cli"
import { LandscapeAnalysisInitiator, LandscapeAnalyzer, ScopeCreator } from "@planetnik/analyzer"
import {
  LandscapeDataExport,
  LandscapeReportGenerator,
  REPORTS_HTML_FOOTER,
  REPORTS_HTML_HEADER,
  ReportRenderer,
  RichTextReport,
} from "@planetnik/reports"
import { Effect } from "effect"
import simpleGit from "simple-git"
import { extractGitHistory } from "../git/GitHistoryExtractor.js"
import { discoverRepos, type GitHubRepo, type LandscapeConfig } from "../github/GitHubRepoFinder.js"
import { runAnalysis } from "./generateReports.js"
import { hydrateLandscapeConfiguration, saveLandscapeConfiguration } from "./landscapeConfigHydrator.js"
import { resolveLandscapeDataDir, resolveLandscapeReportsDir } from "./landscapePaths.js"
import { buildLandscapeTagMap } from "./landscapeTagMap.js"

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

export interface RepoWorkerResult {
  name: string
  success: boolean
  error?: string
}

/** Create a temp directory as a scoped resource — guaranteed cleanup on success, failure, or interruption. */
export function acquireTempDir(prefix: string) {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const tmpId = randomBytes(6).toString("hex")
      const dir = join(tmpdir(), `${prefix}-${tmpId}`)
      mkdirSync(dir, { recursive: true })
      return dir
    }),
    (dir) =>
      Effect.sync(() => {
        rmSync(dir, { recursive: true, force: true })
      }),
  )
}

/** Effect-native repo worker — runs inside a scope so temp dirs are always cleaned up. */
export function analyzeRepoWorker(
  repo: GitHubRepo,
  repoOutputDir: string,
  cloneUrl: string,
): Effect.Effect<RepoWorkerResult, never, never> {
  return Effect.scoped(
    Effect.gen(function* () {
      const cloneDir = yield* acquireTempDir("planetnik")

      const cloneResult = yield* Effect.tryPromise({
        try: () => simpleGit().clone(cloneUrl, cloneDir, ["--single-branch"]),
        catch: (error) => new Error(`Clone failed: ${error}`),
      }).pipe(Effect.either)

      if (cloneResult._tag === "Left") {
        return { name: repo.name, success: false, error: cloneResult.left.message }
      }

      const creator = new ScopeCreator(cloneDir)
      creator.createScopeFromConventions(repo.name, repo.description ?? undefined)

      yield* Effect.tryPromise({
        try: () => extractGitHistory(cloneDir),
        catch: (error) => new Error(`Git history extraction failed: ${error}`),
      })

      const confFile = join(cloneDir, "_planetnik", "config.json")
      if (!existsSync(confFile)) {
        return { name: repo.name, success: false, error: "Config not created" }
      }

      yield* runAnalysis(confFile, repoOutputDir)

      return { name: repo.name, success: true }
    }).pipe(
      Effect.catchAll((error) => Effect.succeed({ name: repo.name, success: false, error: String(error) })),
    ),
  )
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

      const rawConfig = JSON.parse(readFileSync(configPath, "utf-8"))
      const config: LandscapeConfig = rawConfig
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

          const batchEffects = batch.map((repo) => {
            const repoOutputDir = join(orgDir, repo.name)

            // Skip if already analyzed
            if (args.skipExisting && existsSync(join(repoOutputDir, "data", "analysisResults.json"))) {
              skipped++
              return Effect.succeed({ name: repo.name, success: true, skipped: true as const })
            }

            mkdirSync(repoOutputDir, { recursive: true })
            const cloneUrl = `${config.githubCloneUrl}/${org}/${repo.name}.git`
            return analyzeRepoWorker(repo, repoOutputDir, cloneUrl)
          })

          const results = yield* Effect.all(batchEffects, { concurrency: "unbounded" })

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
      const landscapeConfigPath = join(outDir, "_planetnik_landscape", "config.json")
      const initiator = new LandscapeAnalysisInitiator()
      const landscapeConfig = initiator.initConfiguration(outDir, landscapeConfigPath, false)
      hydrateLandscapeConfiguration(landscapeConfig, rawConfig)

      if (args.name._tag === "Some") {
        landscapeConfig.metadata = {
          ...landscapeConfig.metadata,
          name: args.name.value,
        }
      }
      saveLandscapeConfiguration(landscapeConfigPath, landscapeConfig)

      const analyzer = new LandscapeAnalyzer(landscapeConfig, outDir)
      const landscapeResults = analyzer.analyze()

      const report = new RichTextReport("landscape", "index.html")
      report.displayName = landscapeResults.metadata.name || "Landscape"
      LandscapeReportGenerator.generate(report, landscapeResults)

      const reportsDir = resolveLandscapeReportsDir(outDir)
      mkdirSync(reportsDir, { recursive: true })

      const parts: string[] = []
      const client = { append: (text: string) => parts.push(text) }
      new ReportRenderer().render(report, client)

      const html =
        REPORTS_HTML_HEADER.replace("{{TITLE}}", report.displayName).replace("{{CUSTOM_HEADER}}", "") +
        parts.join("") +
        REPORTS_HTML_FOOTER

      writeFileSync(join(reportsDir, "index.html"), html, "utf-8")

      const dataDir = resolveLandscapeDataDir(outDir)
      mkdirSync(dataDir, { recursive: true })
      const landscapeDataExport = new LandscapeDataExport(landscapeResults, reportsDir)
      landscapeDataExport.exportCoreContracts("analyzeLandscape")
      landscapeDataExport.exportPeopleContracts(landscapeConfig.teamsConfig)
      const tagMap = buildLandscapeTagMap(landscapeConfig, landscapeResults.repositoryAnalysisResults, outDir)
      landscapeDataExport.exportRepositories(tagMap)
      landscapeDataExport.exportTagContracts(tagMap, landscapeConfig.tagGroups)

      yield* Effect.log(`Landscape report: ${reportsDir}/index.html`)
      yield* Effect.log(
        `${landscapeResults.getRepositoryCount()} repositories, ${landscapeResults.getTotalLoc()} total LOC`,
      )
      yield* Effect.log(`\nData directory: ${dataDir}`)
      yield* Effect.log(`Run date: ${todayString()}`)
    }),
)
