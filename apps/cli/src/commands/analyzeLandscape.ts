import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { LandscapeAnalysisInitiator, LandscapeAnalyzer, ScopeCreator } from "@planetnik/analyzer"
import {
  LandscapeDataExport,
  LandscapeReportGenerator,
  REPORTS_HTML_FOOTER,
  REPORTS_HTML_HEADER,
  ReportRenderer,
  RichTextReport,
} from "@planetnik/reports"
import { Context, Effect, Layer, Redacted, Ref, Schedule, Schema } from "effect"
import { Command, Flag as Options } from "effect/cli"
import { simpleGit } from "simple-git"
import { CliConfig } from "../config.js"
import {
  CloneError,
  ConfigNotFoundError,
  GitHistoryError,
  GitHubDiscoveryError,
  InvalidConcurrencyError,
  RepoAnalysisDone,
  RepoAnalysisFailed,
  RepoAnalysisSkipped,
  type RepoWorkerOutcome,
  UnknownWorkerError,
} from "../domain/landscape.js"
import { extractGitHistory } from "../git/GitHistoryExtractor.js"
import { buildLandscapeHealth } from "../github/DependabotAnalyzer.js"
import {
  type DependabotAlert,
  DependabotAuthError,
  DependabotScopeError,
  fetchDependabotAlerts,
} from "../github/DependabotClient.js"
import { discoverRepos, type GitHubRepo, type LandscapeConfig } from "../github/GitHubRepoFinder.js"
import { fetchVulnerabilityEnrichment } from "../github/VulnerabilityEnrichmentClient.js"
import { withPhase } from "../logger.js"
import { LandscapeConfigSchema } from "../schemas/LandscapeConfigSchema.js"
import { runAnalysis } from "./generateReports.js"
import { hydrateLandscapeConfiguration, saveLandscapeConfiguration } from "./landscapeConfigHydrator.js"
import { resolveLandscapeDataDir, resolveLandscapeReportsDir } from "./landscapePaths.js"
import { buildLandscapeTagMap } from "./landscapeTagMap.js"

const configFile = Options.String("config").pipe(Options.withDescription("Path to landscape config JSON"))
const outputFolder = Options.String("outputFolder").pipe(
  Options.withDefault("./landscape-report"),
  Options.withDescription("Output folder for all reports"),
)
const landscapeName = Options.String("name").pipe(Options.optional, Options.withDescription("Landscape name override"))
const concurrency = Options.Int("concurrency").pipe(
  Options.withDefault(4),
  Options.withDescription("Number of repos to analyze in parallel"),
)
const skipExisting = Options.Boolean("skipExisting").pipe(
  Options.withDefault(true),
  Options.withDescription("Skip repos that already have analysis results"),
)
const emitLegacyProjectionsOption = Options.Boolean("emitLegacyProjections").pipe(
  Options.optional,
  Options.withDescription("Emit legacy landscape TXT and HTML projections (default: canonical JSON only)"),
)

const DEPENDABOT_CONCURRENCY = 5

/** Maximum number of retries for an external landscape operation. */
const LANDSCAPE_EXTERNAL_RETRY_COUNT = 3

/** Bounded exponential backoff shared by GitHub discovery and repository clone. */
const LANDSCAPE_EXTERNAL_RETRY_SCHEDULE = Schedule.exponential("1 second").pipe(
  Schedule.upTo({ times: LANDSCAPE_EXTERNAL_RETRY_COUNT }),
)

const TRANSIENT_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENETUNREACH",
  "ENETDOWN",
])

const TRANSIENT_ERROR_PATTERNS = [
  /\b(?:408|425|429|500|502|503|504)\b/,
  /(?:rate limit|too many requests|secondary rate limit|timed?\s*out|timeout|temporarily unavailable|try again|connection (?:reset|refused|closed)|network is unreachable|fetch failed|failed to fetch|could not resolve host|socket hang up|tls handshake)/i,
]

const PERMANENT_ERROR_PATTERNS = [
  /\b(?:401|403|404)\b/,
  /(?:repository|resource).*(?:not found|does not exist)|\bnot found\b/i,
  /(?:authentication failed|permission denied|access denied|could not read username|invalid token)/i,
]

/**
 * Classify errors at the external discovery/clone boundary.
 *
 * Unknown errors fail closed: only recognisable transient network/service
 * failures are retried, while authentication, permission, and not-found
 * failures remain immediate and deterministic.
 */
export function isRetryableLandscapeExternalError(error: unknown): boolean {
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : undefined
  const code = typeof record?.code === "string" ? record.code.toUpperCase() : undefined
  const message = typeof record?.message === "string" ? record.message : String(error)
  const rateLimited = /(?:rate limit|too many requests|secondary rate limit)/i.test(message)
  if (rateLimited) return true

  const status = Number(record?.status ?? record?.statusCode)
  if (Number.isInteger(status)) {
    if ([401, 403, 404].includes(status)) return false
    if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true
  }

  if (PERMANENT_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return false
  if (code !== undefined && TRANSIENT_ERROR_CODES.has(code)) return true
  return TRANSIENT_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

/** Apply the bounded external retry policy; deterministic failures are never retried. */
export function retryLandscapeExternal<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  schedule: Schedule.Schedule<unknown, E, never> = LANDSCAPE_EXTERNAL_RETRY_SCHEDULE,
) {
  return Effect.retry(effect, {
    schedule,
    while: (error: E) => isRetryableLandscapeExternalError(error),
  })
}

function todayString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
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

export interface RepoAnalysisTask {
  readonly org: string
  readonly repo: GitHubRepo
  readonly repoOutputDir: string
  readonly cloneUrl: string
  readonly skip: boolean
  readonly emitLegacyProjections?: boolean
}

/** Concurrency-safe progress state for a landscape traversal. */
export interface LandscapeRunSummary {
  readonly total: number
  readonly completed: number
  readonly analyzed: number
  readonly skipped: number
  readonly failed: number
}

export function makeLandscapeRunSummary(total: number): LandscapeRunSummary {
  return { total, completed: 0, analyzed: 0, skipped: 0, failed: 0 }
}

export interface RepoFailureReportEntry {
  readonly repoKey: string
  readonly errorType: string
  readonly detail: string
}

/** Project ordered tagged outcomes into the stable `_failures.json` shape. */
export function buildRepoFailureReport(outcomes: readonly RepoWorkerOutcome[]): ReadonlyArray<RepoFailureReportEntry> {
  return outcomes
    .filter((outcome): outcome is RepoAnalysisFailed => outcome._tag === "RepoAnalysisFailed")
    .map((failure) => ({
      repoKey: failure.repoKey,
      errorType: failure.error._tag,
      detail: failure.error.detail,
    }))
}

export interface LandscapeRepoWorkerService {
  readonly run: (task: RepoAnalysisTask) => Effect.Effect<RepoWorkerOutcome, never, never>
}

/** Stable worker dependency; per-repository resources remain scoped inside the worker. */
export class LandscapeRepoWorker extends Context.Service<LandscapeRepoWorker, LandscapeRepoWorkerService>()(
  "LandscapeRepoWorker",
) {}

/** Effect-native repo worker — runs inside a scope so temp dirs are always cleaned up. */
function analyzeRepoWorker(
  repo: GitHubRepo,
  repoOutputDir: string,
  cloneUrl: string,
  org: string,
  emitLegacyProjections = false,
): Effect.Effect<RepoWorkerOutcome, never, never> {
  const repoKey = `${org}/${repo.name}`

  return Effect.scoped(
    Effect.gen(function* () {
      const cloneDir = yield* acquireTempDir("planetnik")

      yield* Effect.logDebug("Cloning...").pipe(withPhase("clone"))
      const cloneResult = yield* retryLandscapeExternal(
        Effect.tryPromise({
          try: (signal) => simpleGit({ abort: signal }).clone(cloneUrl, cloneDir, ["--single-branch"]),
          catch: (error) => error,
        }).pipe(
          // A failed clone may leave a partial checkout behind. Each retry
          // starts from a fresh directory, while the outer scope still owns
          // the final cleanup on success, failure, or interruption.
          Effect.tapError(() =>
            Effect.sync(() => {
              rmSync(cloneDir, { recursive: true, force: true })
              mkdirSync(cloneDir, { recursive: true })
            }),
          ),
        ),
      ).pipe(
        Effect.mapError(
          (error) =>
            new CloneError({
              type: "landscape/clone",
              title: "Repository clone failed",
              detail: String(error),
              repoKey,
            }),
        ),
        Effect.result,
      )

      if (cloneResult._tag === "Failure") {
        yield* Effect.logWarning(`Clone failed: ${cloneResult.failure.detail}`).pipe(withPhase("clone"))
        return new RepoAnalysisFailed({
          repoKey,
          name: repo.name,
          error: cloneResult.failure,
        })
      }

      const creator = new ScopeCreator(cloneDir)
      creator.createScopeFromConventions(repo.name, repo.description ?? undefined)

      yield* Effect.logDebug("Extracting git history...").pipe(withPhase("githistory"))
      yield* Effect.tryPromise({
        try: () => extractGitHistory(cloneDir),
        catch: (error) =>
          new GitHistoryError({
            type: "landscape/git-history",
            title: "Git history extraction failed",
            detail: String(error),
            repoKey,
          }),
      })

      const confFile = join(cloneDir, "_planetnik", "config.json")
      if (!existsSync(confFile)) {
        yield* Effect.logWarning(`Config not created at ${confFile}`).pipe(withPhase("analysis"))
        return new RepoAnalysisFailed({
          repoKey,
          name: repo.name,
          error: new ConfigNotFoundError({
            type: "landscape/config-not-found",
            title: "Analysis config file not created",
            detail: `Expected config at ${confFile}`,
            repoKey,
          }),
        })
      }

      yield* Effect.logDebug("Running analysis...").pipe(withPhase("analysis"))
      yield* runAnalysis(confFile, repoOutputDir, { emitLegacyProjections })

      return new RepoAnalysisDone({ repoKey, name: repo.name })
    }).pipe(
      Effect.catch((error) =>
        Effect.succeed(
          new RepoAnalysisFailed({
            repoKey,
            name: repo.name,
            error: new UnknownWorkerError({
              type: "landscape/unknown",
              title: "Unexpected worker error",
              detail: String(error),
              repoKey,
            }),
          }),
        ),
      ),
    ),
  ).pipe(Effect.annotateLogs({ org, repo: repo.name }))
}

export const LandscapeRepoWorkerLive: Layer.Layer<LandscapeRepoWorker> = Layer.succeed(LandscapeRepoWorker, {
  run: (task) =>
    analyzeRepoWorker(task.repo, task.repoOutputDir, task.cloneUrl, task.org, task.emitLegacyProjections === true),
})

/** Run repository jobs with a single bounded scheduler and ordered outcomes. */
export function runRepoAnalysis(
  tasks: readonly RepoAnalysisTask[],
  limit: number,
  summary: Ref.Ref<LandscapeRunSummary>,
): Effect.Effect<ReadonlyArray<RepoWorkerOutcome>, InvalidConcurrencyError, LandscapeRepoWorker> {
  return Effect.gen(function* () {
    if (!Number.isInteger(limit) || limit <= 0) {
      return yield* Effect.fail(
        new InvalidConcurrencyError({
          type: "landscape/invalid-concurrency",
          title: "Invalid landscape concurrency",
          detail: `Expected a positive integer, received ${limit}`,
          concurrency: limit,
        }),
      )
    }

    const worker = yield* LandscapeRepoWorker
    const recordOutcome = (outcome: RepoWorkerOutcome) =>
      Ref.update(summary, (current) => ({
        ...current,
        completed: current.completed + 1,
        analyzed: current.analyzed + (outcome._tag === "RepoAnalysisDone" ? 1 : 0),
        skipped: current.skipped + (outcome._tag === "RepoAnalysisSkipped" ? 1 : 0),
        failed: current.failed + (outcome._tag === "RepoAnalysisFailed" ? 1 : 0),
      }))

    return yield* Effect.forEach(
      tasks,
      (task) =>
        (task.skip
          ? Effect.succeed(
              new RepoAnalysisSkipped({
                repoKey: `${task.org}/${task.repo.name}`,
                name: task.repo.name,
              }),
            )
          : worker.run(task)
        ).pipe(Effect.tap(recordOutcome)),
      { concurrency: limit },
    )
  })
}

export const analyzeLandscapeCommand = Command.make(
  "analyzeLandscape",
  {
    config: configFile,
    outputFolder,
    name: landscapeName,
    concurrency,
    skipExisting,
    emitLegacyProjections: emitLegacyProjectionsOption,
  },
  (args) =>
    Effect.gen(function* () {
      if (!Number.isInteger(args.concurrency) || args.concurrency <= 0) {
        yield* Effect.logError(`Invalid concurrency: ${args.concurrency}. Use a positive integer.`)
        return
      }

      const configPath = resolve(args.config)
      if (!existsSync(configPath)) {
        yield* Effect.logError(`Config file not found: ${configPath}`)
        return
      }

      const rawJson = JSON.parse(readFileSync(configPath, "utf-8"))
      const decoded = Schema.decodeUnknownSync(LandscapeConfigSchema)(rawJson)
      const cliConfig = yield* CliConfig
      const rawConfig = { ...rawJson, ...decoded }
      const emitLegacyProjections =
        (args.emitLegacyProjections._tag === "Some" && args.emitLegacyProjections.value === true) ||
        rawConfig.emitLegacyProjections === true
      const config: LandscapeConfig = {
        ...decoded,
        githubToken: decoded.githubToken || (cliConfig.githubToken ? Redacted.value(cliConfig.githubToken) : undefined),
      }
      const outDir = resolve(args.outputFolder)
      mkdirSync(outDir, { recursive: true })

      // 1. Discover repos
      yield* Effect.logInfo("Discovering repositories from GitHub...").pipe(withPhase("discovery"))
      const orgRepos = yield* retryLandscapeExternal(
        Effect.tryPromise({
          try: (signal) => discoverRepos(config, signal),
          catch: (error) => error,
        }),
      ).pipe(
        Effect.mapError(
          (error) =>
            new GitHubDiscoveryError({
              type: "landscape/github-discovery",
              title: "GitHub API discovery failed",
              detail: String(error),
              org: "",
            }),
        ),
        Effect.tapError((e) =>
          Effect.logError(e.detail).pipe(withPhase("discovery"), Effect.annotateLogs("errorType", e._tag)),
        ),
      )

      let totalRepos = 0
      for (const [org, repos] of orgRepos) {
        yield* Effect.logDebug(`${org}: ${repos.length} active repositories`).pipe(
          Effect.annotateLogs({ org, repos: String(repos.length) }),
          withPhase("discovery"),
        )
        totalRepos += repos.length
      }
      yield* Effect.logInfo(`Total: ${totalRepos} repositories to analyze`).pipe(withPhase("discovery"))

      // Save discovery results
      const discoveryDir = join(outDir, "_discovery")
      mkdirSync(discoveryDir, { recursive: true })
      for (const [org, repos] of orgRepos) {
        writeFileSync(join(discoveryDir, `${org}.json`), JSON.stringify(repos, null, 2), "utf-8")
      }

      // 2. Analyze each repo with one bounded traversal across the landscape.
      const repoTasks: RepoAnalysisTask[] = []

      for (const [org, repos] of orgRepos) {
        yield* Effect.logInfo(`Analyzing ${org} (${repos.length} repos)...`).pipe(
          Effect.annotateLogs("org", org),
          withPhase("analysis"),
        )

        const orgDir = join(outDir, org)
        mkdirSync(orgDir, { recursive: true })

        for (const repo of repos) {
          const repoOutputDir = join(orgDir, repo.name)
          const skip = args.skipExisting && existsSync(join(repoOutputDir, "data", "analysisResults.json"))
          if (!skip) mkdirSync(repoOutputDir, { recursive: true })
          repoTasks.push({
            org,
            repo,
            repoOutputDir,
            cloneUrl: `${config.githubCloneUrl}/${org}/${repo.name}.git`,
            skip,
            emitLegacyProjections,
          })
        }
      }

      const runSummaryRef = yield* Ref.make(makeLandscapeRunSummary(repoTasks.length))
      const allOutcomes = yield* runRepoAnalysis(repoTasks, args.concurrency, runSummaryRef)

      // Log each outcome
      const logOutcome = (outcome: RepoWorkerOutcome) => {
        switch (outcome._tag) {
          case "RepoAnalysisSkipped":
            return Effect.logDebug(`[skip] ${outcome.name} (already analyzed)`).pipe(withPhase("analysis"))
          case "RepoAnalysisDone":
            return Effect.logDebug(`[done] ${outcome.name}`).pipe(withPhase("analysis"))
          case "RepoAnalysisFailed":
            return Effect.logError(`[fail] ${outcome.name}: ${outcome.error.detail}`).pipe(
              Effect.annotateLogs({ errorType: outcome.error._tag, repoKey: outcome.repoKey }),
              withPhase("analysis"),
            )
        }
      }
      yield* Effect.forEach(allOutcomes, logOutcome, { discard: true })

      // The Ref is the concurrency-safe progress summary; outcomes remain the detailed evidence source.
      const tally = yield* Ref.get(runSummaryRef)
      const failureReport = buildRepoFailureReport(allOutcomes)

      yield* Effect.logInfo(
        `Analysis complete: ${tally.analyzed} analyzed, ${tally.skipped} skipped, ${tally.failed} failed`,
      ).pipe(withPhase("analysis"))

      if (failureReport.length > 0) {
        writeFileSync(join(outDir, "_failures.json"), JSON.stringify(failureReport, null, 2), "utf-8")
      }

      // 2.5. Fetch Dependabot alerts (security phase)
      const alertsByRepo = new Map<string, DependabotAlert[]>()
      const securityConfig = decoded.security
      const securityFetchConfigured = securityConfig.enabled && securityConfig.fetchAlerts && !!config.githubToken
      if (securityFetchConfigured) {
        yield* Effect.logInfo("Fetching Dependabot alerts...").pipe(withPhase("security"))

        const repoTargets = Array.from(orgRepos.entries()).flatMap(([org, repos]) =>
          repos.map((repo) => ({ org, repo })),
        )

        let securityBlocked = false
        let startIndex = 0

        if (repoTargets.length > 0) {
          const firstTarget = repoTargets[0]!
          const preflight = yield* Effect.tryPromise({
            try: () =>
              fetchDependabotAlerts(firstTarget.org, firstTarget.repo.name, config.githubToken, config.githubApiUrl),
            catch: (error) => error,
          }).pipe(Effect.result)

          if (preflight._tag === "Failure") {
            const error = preflight.failure
            if (error instanceof DependabotAuthError) {
              securityBlocked = true
              yield* Effect.logWarning(
                "Skipping Dependabot alerts: GITHUB_TOKEN is invalid for the Dependabot alerts API.",
              ).pipe(withPhase("security"))
            } else if (error instanceof DependabotScopeError) {
              securityBlocked = true
              yield* Effect.logWarning(
                "Skipping Dependabot alerts: GITHUB_TOKEN cannot read Dependabot alerts. Check security_events scope, SSO authorization, and repository access.",
              ).pipe(withPhase("security"))
            } else {
              yield* Effect.logWarning(
                `Dependabot preflight failed for ${firstTarget.org}/${firstTarget.repo.name}: ${String(error)}`,
              ).pipe(withPhase("security"))
            }
          } else {
            alertsByRepo.set(firstTarget.repo.name, preflight.success)
            startIndex = 1
          }
        }

        if (!securityBlocked) {
          const results = yield* Effect.forEach(
            repoTargets.slice(startIndex),
            ({ org, repo }) =>
              Effect.tryPromise({
                try: () => fetchDependabotAlerts(org, repo.name, config.githubToken, config.githubApiUrl),
                catch: (error) => error,
              }).pipe(
                Effect.map((alerts) => ({ repo: repo.name, alerts })),
                Effect.catch((error) =>
                  Effect.gen(function* () {
                    yield* Effect.logWarning(`Dependabot fetch failed for ${org}/${repo.name}: ${String(error)}`).pipe(
                      withPhase("security"),
                    )
                    return { repo: repo.name, alerts: [] as DependabotAlert[] }
                  }),
                ),
              ),
            { concurrency: DEPENDABOT_CONCURRENCY },
          )
          for (const { repo: repoName, alerts } of results) {
            alertsByRepo.set(repoName, alerts)
          }
        }

        const totalAlertCount = Array.from(alertsByRepo.values()).reduce((sum, alerts) => sum + alerts.length, 0)
        const reposWithAlerts = Array.from(alertsByRepo.values()).filter((alerts) => alerts.length > 0).length
        if (!securityBlocked) {
          yield* Effect.logInfo(
            `Security: ${totalAlertCount} alerts across ${reposWithAlerts}/${alertsByRepo.size} repos`,
          ).pipe(withPhase("security"))
        }
      } else if (!config.githubToken) {
        yield* Effect.logDebug("Skipping Dependabot alerts: no GitHub token available").pipe(withPhase("security"))
      } else {
        yield* Effect.logDebug("Skipping Dependabot alerts: security.enabled=false or fetchAlerts=false").pipe(
          withPhase("security"),
        )
      }

      // 3. Generate landscape report
      let vulnerabilityEnrichment: Awaited<ReturnType<typeof fetchVulnerabilityEnrichment>> | undefined
      const cveIds = Array.from(alertsByRepo.values())
        .flat()
        .map((alert) => alert.security_advisory.cve_id)
        .filter((value): value is string => value !== null)
      if (securityFetchConfigured && cveIds.length > 0) {
        const enrichmentResult = yield* Effect.tryPromise({
          try: () => fetchVulnerabilityEnrichment(cveIds),
          catch: (error) => error,
        }).pipe(Effect.result)

        if (enrichmentResult._tag === "Success") {
          vulnerabilityEnrichment = enrichmentResult.success
          yield* Effect.logInfo(
            `Security enrichment: EPSS ${vulnerabilityEnrichment.epssAvailable ? "available" : "unavailable"}, KEV ${vulnerabilityEnrichment.kevAvailable ? "available" : "unavailable"}`,
          ).pipe(withPhase("security"))
        } else {
          yield* Effect.logWarning(`Security enrichment failed: ${String(enrichmentResult.failure)}`).pipe(
            withPhase("security"),
          )
        }
      }

      // 3. Generate landscape report
      yield* Effect.logInfo("Generating landscape report...").pipe(withPhase("reporting"))

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
      landscapeConfig.emitLegacyProjections = emitLegacyProjections
      saveLandscapeConfiguration(landscapeConfigPath, landscapeConfig)

      const analyzer = new LandscapeAnalyzer(landscapeConfig, outDir)
      const landscapeResults = analyzer.analyze()

      const reportsDir = resolveLandscapeReportsDir(outDir)
      mkdirSync(reportsDir, { recursive: true })

      if (emitLegacyProjections) {
        const report = new RichTextReport("landscape", "index.html")
        report.displayName = landscapeResults.metadata.name || "Landscape"
        LandscapeReportGenerator.generate(report, landscapeResults)

        const parts: string[] = []
        const client = { append: (text: string) => parts.push(text) }
        new ReportRenderer().render(report, client)

        const html =
          REPORTS_HTML_HEADER.replace("{{TITLE}}", report.displayName).replace("{{CUSTOM_HEADER}}", "") +
          parts.join("") +
          REPORTS_HTML_FOOTER

        writeFileSync(join(reportsDir, "index.html"), html, "utf-8")
      } else {
        yield* Effect.logInfo("Skipping legacy landscape TXT/HTML projections (canonical JSON is default).").pipe(
          withPhase("reporting"),
        )
      }

      const dataDir = resolveLandscapeDataDir(outDir)
      mkdirSync(dataDir, { recursive: true })
      const landscapeDataExport = new LandscapeDataExport(landscapeResults, reportsDir, {
        emitCompatibilityProjections: emitLegacyProjections,
      })
      landscapeDataExport.exportCoreContracts("analyzeLandscape")
      landscapeDataExport.exportPeopleContracts(landscapeConfig.teamsConfig)
      const tagMap = buildLandscapeTagMap(landscapeConfig, landscapeResults.repositoryAnalysisResults, outDir)
      landscapeDataExport.exportRepositories(tagMap)
      landscapeDataExport.exportTagContracts(tagMap, landscapeConfig.tagGroups)

      // Export security data if security fetching was attempted (even if no alerts found)
      if (securityFetchConfigured) {
        const landscapeHealth = buildLandscapeHealth(alertsByRepo, vulnerabilityEnrichment)
        const alertsExport = Object.fromEntries(
          Array.from(alertsByRepo.entries()).map(([repo, alerts]) => [repo, alerts]),
        )
        writeFileSync(join(dataDir, "landscape_dependency_alerts.json"), JSON.stringify(alertsExport, null, 2), "utf-8")
        writeFileSync(
          join(dataDir, "landscape_dependency_health.json"),
          JSON.stringify(landscapeHealth, null, 2),
          "utf-8",
        )
        yield* Effect.logInfo(`Security data exported: ${dataDir}/landscape_dependency_health.json`).pipe(
          withPhase("reporting"),
        )
      }

      if (emitLegacyProjections) {
        yield* Effect.logInfo(`Landscape report: ${reportsDir}/index.html`).pipe(withPhase("reporting"))
      }
      yield* Effect.logInfo(
        `${landscapeResults.getRepositoryCount()} repositories, ${landscapeResults.getTotalLoc()} total LOC`,
      ).pipe(withPhase("reporting"))
      yield* Effect.logInfo(`Data directory: ${dataDir}`).pipe(withPhase("reporting"))
      yield* Effect.logInfo(`Run date: ${todayString()}`).pipe(withPhase("reporting"))
    }),
)
