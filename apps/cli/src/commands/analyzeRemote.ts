import { randomBytes } from "node:crypto"
import { existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { Command, Options } from "@effect/cli"
import { ScopeCreator } from "@planetnik/analyzer"
import { Effect } from "effect"
import simpleGit from "simple-git"
import { extractGitHistory } from "../git/GitHistoryExtractor.js"
import { runAnalysis } from "./generateReports.js"

const repo = Options.text("repo").pipe(Options.withDescription("Git repository URL or owner/repo shorthand"))
const ref = Options.text("ref").pipe(Options.withDefault("main"), Options.withDescription("Branch, tag, or commit"))
const outputFolder = Options.text("outputFolder").pipe(
  Options.withDefault("./planetnik-report"),
  Options.withDescription("Output folder for reports"),
)
const name = Options.text("name").pipe(Options.optional, Options.withDescription("Project name override"))
const keep = Options.boolean("keep").pipe(
  Options.withDefault(false),
  Options.withDescription("Keep cloned repository after analysis"),
)

function resolveRepoUrl(input: string): string {
  if (input.startsWith("http://") || input.startsWith("https://") || input.startsWith("git@")) {
    return input
  }
  // Treat as GitHub shorthand: owner/repo
  if (input.includes("/")) {
    return `https://github.com/${input}.git`
  }
  return input
}

export const analyzeRemoteCommand = Command.make("analyzeRemote", { repo, ref, outputFolder, name, keep }, (args) =>
  Effect.gen(function* () {
    const repoUrl = resolveRepoUrl(args.repo)
    const outDir = resolve(args.outputFolder)
    const tmpId = randomBytes(6).toString("hex")
    const cloneDir = join(tmpdir(), `planetnik-${tmpId}`)

    yield* Effect.log(`Cloning ${repoUrl} (ref: ${args.ref})...`)

    const git = simpleGit()
    yield* Effect.tryPromise({
      try: () => git.clone(repoUrl, cloneDir, ["--branch", args.ref, "--single-branch"]),
      catch: (error) => new Error(`Clone failed: ${error}`),
    })

    yield* Effect.log(`Cloned to ${cloneDir}`)

    try {
      // 1. Init
      yield* Effect.log("Initializing configuration...")
      const projectName = args.name._tag === "Some" ? args.name.value : undefined
      const creator = new ScopeCreator(cloneDir)
      creator.createScopeFromConventions(projectName)

      // 2. Extract git history
      yield* Effect.log("Extracting git history...")
      const historyCount = yield* Effect.tryPromise({
        try: () => extractGitHistory(cloneDir),
        catch: (error) => new Error(`Git history extraction failed: ${error}`),
      })
      yield* Effect.log(`Extracted ${historyCount} file change entries.`)

      // 3. Generate reports
      const confFile = join(cloneDir, "_planetnik", "config.json")
      if (!existsSync(confFile)) {
        yield* Effect.logError("Configuration file not found after init.")
        return
      }

      yield* Effect.log("Running analysis and generating reports...")
      yield* runAnalysis(confFile, outDir)

      yield* Effect.log(`Reports saved to ${outDir}`)
      yield* Effect.log(`Data directory: ${join(outDir, "data")}`)
      yield* Effect.log("")
      yield* Effect.log("To build the Astro site:")
      yield* Effect.log(`  PLANETNIK_DATA_DIR=${join(outDir, "data")} bun run --cwd apps/site build`)
    } finally {
      if (!args.keep) {
        yield* Effect.log("Cleaning up cloned repository...")
        rmSync(cloneDir, { recursive: true, force: true })
      } else {
        yield* Effect.log(`Cloned repository kept at ${cloneDir}`)
      }
    }
  }),
)
