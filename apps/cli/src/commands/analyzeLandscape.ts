import { randomBytes } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Command, Options } from "@effect/cli";
import { Schema } from "@effect/schema";
import {
	LandscapeAnalysisInitiator,
	LandscapeAnalyzer,
	ScopeCreator,
} from "@planetnik/analyzer";
import {
	LandscapeDataExport,
	LandscapeReportGenerator,
	REPORTS_HTML_FOOTER,
	REPORTS_HTML_HEADER,
	ReportRenderer,
	RichTextReport,
} from "@planetnik/reports";
import { Effect, Redacted } from "effect";
import simpleGit from "simple-git";
import { CliConfig } from "../config.js";
import {
	CloneError,
	ConfigNotFoundError,
	GitHistoryError,
	GitHubDiscoveryError,
	RepoAnalysisDone,
	RepoAnalysisFailed,
	RepoAnalysisSkipped,
	type RepoWorkerOutcome,
	UnknownWorkerError,
} from "../domain/landscape.js";
import { extractGitHistory } from "../git/GitHistoryExtractor.js";
import { buildLandscapeHealth } from "../github/DependabotAnalyzer.js";
import {
	type DependabotAlert,
	DependabotAuthError,
	DependabotScopeError,
	fetchDependabotAlerts,
} from "../github/DependabotClient.js";
import {
	discoverRepos,
	type GitHubRepo,
	type LandscapeConfig,
} from "../github/GitHubRepoFinder.js";
import { withPhase } from "../logger.js";
import { LandscapeConfigSchema } from "../schemas/LandscapeConfigSchema.js";
import { runAnalysis } from "./generateReports.js";
import {
	hydrateLandscapeConfiguration,
	saveLandscapeConfiguration,
} from "./landscapeConfigHydrator.js";
import {
	resolveLandscapeDataDir,
	resolveLandscapeReportsDir,
} from "./landscapePaths.js";
import { buildLandscapeTagMap } from "./landscapeTagMap.js";

const configFile = Options.text("config").pipe(
	Options.withDescription("Path to landscape config JSON"),
);
const outputFolder = Options.text("outputFolder").pipe(
	Options.withDefault("./landscape-report"),
	Options.withDescription("Output folder for all reports"),
);
const landscapeName = Options.text("name").pipe(
	Options.optional,
	Options.withDescription("Landscape name override"),
);
const concurrency = Options.integer("concurrency").pipe(
	Options.withDefault(4),
	Options.withDescription("Number of repos to analyze in parallel"),
);
const skipExisting = Options.boolean("skipExisting").pipe(
	Options.withDefault(true),
	Options.withDescription("Skip repos that already have analysis results"),
);

function todayString(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Create a temp directory as a scoped resource — guaranteed cleanup on success, failure, or interruption. */
export function acquireTempDir(prefix: string) {
	return Effect.acquireRelease(
		Effect.sync(() => {
			const tmpId = randomBytes(6).toString("hex");
			const dir = join(tmpdir(), `${prefix}-${tmpId}`);
			mkdirSync(dir, { recursive: true });
			return dir;
		}),
		(dir) =>
			Effect.sync(() => {
				rmSync(dir, { recursive: true, force: true });
			}),
	);
}

/** Effect-native repo worker — runs inside a scope so temp dirs are always cleaned up. */
export function analyzeRepoWorker(
	repo: GitHubRepo,
	repoOutputDir: string,
	cloneUrl: string,
	org: string,
): Effect.Effect<RepoWorkerOutcome, never, never> {
	const repoKey = `${org}/${repo.name}`;

	return Effect.scoped(
		Effect.gen(function* () {
			const cloneDir = yield* acquireTempDir("planetnik");

			const cloneResult = yield* Effect.tryPromise({
				try: () => simpleGit().clone(cloneUrl, cloneDir, ["--single-branch"]),
				catch: (error) =>
					new CloneError({
						type: "landscape/clone",
						title: "Repository clone failed",
						detail: String(error),
						repoKey,
					}),
			}).pipe(Effect.either);

			if (cloneResult._tag === "Left") {
				return new RepoAnalysisFailed({
					repoKey,
					name: repo.name,
					error: cloneResult.left,
				});
			}

			const creator = new ScopeCreator(cloneDir);
			creator.createScopeFromConventions(
				repo.name,
				repo.description ?? undefined,
			);

			yield* Effect.tryPromise({
				try: () => extractGitHistory(cloneDir),
				catch: (error) =>
					new GitHistoryError({
						type: "landscape/git-history",
						title: "Git history extraction failed",
						detail: String(error),
						repoKey,
					}),
			});

			const confFile = join(cloneDir, "_planetnik", "config.json");
			if (!existsSync(confFile)) {
				return new RepoAnalysisFailed({
					repoKey,
					name: repo.name,
					error: new ConfigNotFoundError({
						type: "landscape/config-not-found",
						title: "Analysis config file not created",
						detail: `Expected config at ${confFile}`,
						repoKey,
					}),
				});
			}

			yield* runAnalysis(confFile, repoOutputDir);

			return new RepoAnalysisDone({ repoKey, name: repo.name });
		}).pipe(
			Effect.catchAll((error) =>
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
	).pipe(Effect.annotateLogs({ org, repo: repo.name }));
}

export const analyzeLandscapeCommand = Command.make(
	"analyzeLandscape",
	{
		config: configFile,
		outputFolder,
		name: landscapeName,
		concurrency,
		skipExisting,
	},
	(args) =>
		Effect.gen(function* () {
			const configPath = resolve(args.config);
			if (!existsSync(configPath)) {
				yield* Effect.logError(`Config file not found: ${configPath}`);
				return;
			}

			const rawJson = JSON.parse(readFileSync(configPath, "utf-8"));
			const decoded = Schema.decodeUnknownSync(LandscapeConfigSchema)(rawJson);
			const cliConfig = yield* CliConfig;
			const rawConfig = { ...rawJson, ...decoded };
			const config: LandscapeConfig = {
				...decoded,
				githubToken:
					decoded.githubToken ||
					(cliConfig.githubToken
						? Redacted.value(cliConfig.githubToken)
						: undefined),
			};
			const outDir = resolve(args.outputFolder);
			mkdirSync(outDir, { recursive: true });

			// 1. Discover repos
			yield* Effect.logInfo("Discovering repositories from GitHub...").pipe(
				withPhase("discovery"),
			);
			const orgRepos = yield* Effect.tryPromise({
				try: () => discoverRepos(config),
				catch: (error) =>
					new GitHubDiscoveryError({
						type: "landscape/github-discovery",
						title: "GitHub API discovery failed",
						detail: String(error),
						org: "",
					}),
			});

			let totalRepos = 0;
			for (const [org, repos] of orgRepos) {
				yield* Effect.logDebug(
					`${org}: ${repos.length} active repositories`,
				).pipe(
					Effect.annotateLogs({ org, repos: String(repos.length) }),
					withPhase("discovery"),
				);
				totalRepos += repos.length;
			}
			yield* Effect.logInfo(
				`Total: ${totalRepos} repositories to analyze`,
			).pipe(withPhase("discovery"));

			// Save discovery results
			const discoveryDir = join(outDir, "_discovery");
			mkdirSync(discoveryDir, { recursive: true });
			for (const [org, repos] of orgRepos) {
				writeFileSync(
					join(discoveryDir, `${org}.json`),
					JSON.stringify(repos, null, 2),
					"utf-8",
				);
			}

			// 2. Analyze each repo
			const allOutcomes: RepoWorkerOutcome[] = [];

			for (const [org, repos] of orgRepos) {
				yield* Effect.logInfo(
					`Analyzing ${org} (${repos.length} repos)...`,
				).pipe(Effect.annotateLogs("org", org), withPhase("analysis"));

				const orgDir = join(outDir, org);
				mkdirSync(orgDir, { recursive: true });

				// Process in batches for concurrency control
				for (let i = 0; i < repos.length; i += args.concurrency) {
					const batch = repos.slice(i, i + args.concurrency);

					const batchEffects = batch.map((repo) => {
						const repoOutputDir = join(orgDir, repo.name);

						// Skip if already analyzed
						if (
							args.skipExisting &&
							existsSync(join(repoOutputDir, "data", "analysisResults.json"))
						) {
							return Effect.succeed(
								new RepoAnalysisSkipped({
									repoKey: `${org}/${repo.name}`,
									name: repo.name,
								}),
							);
						}

						mkdirSync(repoOutputDir, { recursive: true });
						const cloneUrl = `${config.githubCloneUrl}/${org}/${repo.name}.git`;
						return analyzeRepoWorker(repo, repoOutputDir, cloneUrl, org);
					});

					const results = yield* Effect.all(batchEffects, {
						concurrency: "unbounded",
					});
					allOutcomes.push(...results);
				}
			}

			// Log each outcome
			const logOutcome = (outcome: RepoWorkerOutcome) => {
				switch (outcome._tag) {
					case "RepoAnalysisSkipped":
						return Effect.logDebug(
							`[skip] ${outcome.name} (already analyzed)`,
						).pipe(withPhase("analysis"));
					case "RepoAnalysisDone":
						return Effect.logDebug(`[done] ${outcome.name}`).pipe(
							withPhase("analysis"),
						);
					case "RepoAnalysisFailed":
						return Effect.logWarning(
							`[fail] ${outcome.name}: ${outcome.error.detail}`,
						).pipe(
							Effect.annotateLogs({ errorType: outcome.error._tag }),
							withPhase("analysis"),
						);
				}
			};
			yield* Effect.forEach(allOutcomes, logOutcome, { discard: true });

			// Tally results
			const tally = allOutcomes.reduce(
				(acc, o) => ({
					analyzed: acc.analyzed + (o._tag === "RepoAnalysisDone" ? 1 : 0),
					skipped: acc.skipped + (o._tag === "RepoAnalysisSkipped" ? 1 : 0),
					failed: acc.failed + (o._tag === "RepoAnalysisFailed" ? 1 : 0),
				}),
				{ analyzed: 0, skipped: 0, failed: 0 },
			);
			const failures = allOutcomes.filter(
				(o): o is RepoAnalysisFailed => o._tag === "RepoAnalysisFailed",
			);

			yield* Effect.logInfo(
				`Analysis complete: ${tally.analyzed} analyzed, ${tally.skipped} skipped, ${tally.failed} failed`,
			).pipe(withPhase("analysis"));

			if (failures.length > 0) {
				const failureReport = failures.map((f) => ({
					repoKey: f.repoKey,
					errorType: f.error._tag,
					detail: f.error.detail,
				}));
				writeFileSync(
					join(outDir, "_failures.json"),
					JSON.stringify(failureReport, null, 2),
					"utf-8",
				);
			}

			// 2.5. Fetch Dependabot alerts (security phase)
			const alertsByRepo = new Map<string, DependabotAlert[]>();
			const securityConfig = decoded.security;
			const securityFetchConfigured =
				securityConfig.enabled &&
				securityConfig.fetchAlerts &&
				!!config.githubToken;
			if (securityFetchConfigured) {
				yield* Effect.logInfo("Fetching Dependabot alerts...").pipe(
					withPhase("security"),
				);

				const repoTargets = Array.from(orgRepos.entries()).flatMap(
					([org, repos]) => repos.map((repo) => ({ org, repo })),
				);

				let securityBlocked = false;
				let startIndex = 0;

				if (repoTargets.length > 0) {
					const firstTarget = repoTargets[0]!;
					const preflight = yield* Effect.tryPromise({
						try: () =>
							fetchDependabotAlerts(
								firstTarget.org,
								firstTarget.repo.name,
								config.githubToken,
								config.githubApiUrl,
							),
						catch: (error) => error,
					}).pipe(Effect.either);

					if (preflight._tag === "Left") {
						const error = preflight.left;
						if (error instanceof DependabotAuthError) {
							securityBlocked = true;
							yield* Effect.logWarning(
								"Skipping Dependabot alerts: GITHUB_TOKEN is invalid for the Dependabot alerts API.",
							).pipe(withPhase("security"));
						} else if (error instanceof DependabotScopeError) {
							securityBlocked = true;
							yield* Effect.logWarning(
								"Skipping Dependabot alerts: GITHUB_TOKEN cannot read Dependabot alerts. Check security_events scope, SSO authorization, and repository access.",
							).pipe(withPhase("security"));
						} else {
							yield* Effect.logWarning(
								`Dependabot preflight failed for ${firstTarget.org}/${firstTarget.repo.name}: ${String(error)}`,
							).pipe(withPhase("security"));
						}
					} else {
						alertsByRepo.set(firstTarget.repo.name, preflight.right);
						startIndex = 1;
					}
				}

				if (!securityBlocked) {
					// Process in batches of 5 to respect rate limits
					for (let i = startIndex; i < repoTargets.length; i += 5) {
						const batch = repoTargets.slice(i, i + 5);
						const batchEffects = batch.map(({ org, repo }) =>
							Effect.tryPromise({
								try: () =>
									fetchDependabotAlerts(
										org,
										repo.name,
										config.githubToken,
										config.githubApiUrl,
									),
								catch: (error) => error,
							}).pipe(
								Effect.map((alerts) => ({ repo: repo.name, alerts })),
								Effect.catchAll((error) =>
									Effect.gen(function* () {
										yield* Effect.logWarning(
											`Dependabot fetch failed for ${org}/${repo.name}: ${String(error)}`,
										).pipe(withPhase("security"));
										return { repo: repo.name, alerts: [] as DependabotAlert[] };
									}),
								),
							),
						);

						const results = yield* Effect.all(batchEffects, {
							concurrency: "unbounded",
						});
						for (const { repo: repoName, alerts } of results) {
							alertsByRepo.set(repoName, alerts);
						}
					}
				}

				const totalAlertCount = Array.from(alertsByRepo.values()).reduce(
					(sum, alerts) => sum + alerts.length,
					0,
				);
				const reposWithAlerts = Array.from(alertsByRepo.values()).filter(
					(alerts) => alerts.length > 0,
				).length;
				if (!securityBlocked) {
					yield* Effect.logInfo(
						`Security: ${totalAlertCount} alerts across ${reposWithAlerts}/${alertsByRepo.size} repos`,
					).pipe(withPhase("security"));
				}
			} else if (!config.githubToken) {
				yield* Effect.logDebug(
					"Skipping Dependabot alerts: no GitHub token available",
				).pipe(withPhase("security"));
			} else {
				yield* Effect.logDebug(
					"Skipping Dependabot alerts: security.enabled=false or fetchAlerts=false",
				).pipe(withPhase("security"));
			}

			// 3. Generate landscape report
			yield* Effect.logInfo("Generating landscape report...").pipe(
				withPhase("reporting"),
			);

			// Use initiator to discover all analysisResults.json files and build config
			const landscapeConfigPath = join(
				outDir,
				"_planetnik_landscape",
				"config.json",
			);
			const initiator = new LandscapeAnalysisInitiator();
			const landscapeConfig = initiator.initConfiguration(
				outDir,
				landscapeConfigPath,
				false,
			);
			hydrateLandscapeConfiguration(landscapeConfig, rawConfig);

			if (args.name._tag === "Some") {
				landscapeConfig.metadata = {
					...landscapeConfig.metadata,
					name: args.name.value,
				};
			}
			saveLandscapeConfiguration(landscapeConfigPath, landscapeConfig);

			const analyzer = new LandscapeAnalyzer(landscapeConfig, outDir);
			const landscapeResults = analyzer.analyze();

			const report = new RichTextReport("landscape", "index.html");
			report.displayName = landscapeResults.metadata.name || "Landscape";
			LandscapeReportGenerator.generate(report, landscapeResults);

			const reportsDir = resolveLandscapeReportsDir(outDir);
			mkdirSync(reportsDir, { recursive: true });

			const parts: string[] = [];
			const client = { append: (text: string) => parts.push(text) };
			new ReportRenderer().render(report, client);

			const html =
				REPORTS_HTML_HEADER.replace("{{TITLE}}", report.displayName).replace(
					"{{CUSTOM_HEADER}}",
					"",
				) +
				parts.join("") +
				REPORTS_HTML_FOOTER;

			writeFileSync(join(reportsDir, "index.html"), html, "utf-8");

			const dataDir = resolveLandscapeDataDir(outDir);
			mkdirSync(dataDir, { recursive: true });
			const landscapeDataExport = new LandscapeDataExport(
				landscapeResults,
				reportsDir,
			);
			landscapeDataExport.exportCoreContracts("analyzeLandscape");
			landscapeDataExport.exportPeopleContracts(landscapeConfig.teamsConfig);
			const tagMap = buildLandscapeTagMap(
				landscapeConfig,
				landscapeResults.repositoryAnalysisResults,
				outDir,
			);
			landscapeDataExport.exportRepositories(tagMap);
			landscapeDataExport.exportTagContracts(tagMap, landscapeConfig.tagGroups);

			// Export security data if security fetching was attempted (even if no alerts found)
			if (securityFetchConfigured) {
				const landscapeHealth = buildLandscapeHealth(alertsByRepo);
				const alertsExport = Object.fromEntries(
					Array.from(alertsByRepo.entries()).map(([repo, alerts]) => [
						repo,
						alerts,
					]),
				);
				writeFileSync(
					join(dataDir, "landscape_dependency_alerts.json"),
					JSON.stringify(alertsExport, null, 2),
					"utf-8",
				);
				writeFileSync(
					join(dataDir, "landscape_dependency_health.json"),
					JSON.stringify(landscapeHealth, null, 2),
					"utf-8",
				);
				yield* Effect.logInfo(
					`Security data exported: ${dataDir}/landscape_dependency_health.json`,
				).pipe(withPhase("reporting"));
			}

			yield* Effect.logInfo(`Landscape report: ${reportsDir}/index.html`).pipe(
				withPhase("reporting"),
			);
			yield* Effect.logInfo(
				`${landscapeResults.getRepositoryCount()} repositories, ${landscapeResults.getTotalLoc()} total LOC`,
			).pipe(withPhase("reporting"));
			yield* Effect.logInfo(`Data directory: ${dataDir}`).pipe(
				withPhase("reporting"),
			);
			yield* Effect.logInfo(`Run date: ${todayString()}`).pipe(
				withPhase("reporting"),
			);
		}),
);
