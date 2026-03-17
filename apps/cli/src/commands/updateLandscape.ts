import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { Command, Options } from "@effect/cli"
import { LandscapeAnalysisInitiator, LandscapeAnalyzer } from "@planetnik/analyzer"
import {
  LandscapeReportGenerator,
  REPORTS_HTML_FOOTER,
  REPORTS_HTML_HEADER,
  ReportRenderer,
  RichTextReport,
} from "@planetnik/reports"
import { Effect } from "effect"

const analysisRoot = Options.text("analysisRoot").pipe(Options.withDefault("."))
const confFile = Options.text("confFile").pipe(Options.optional)
const name = Options.text("name").pipe(Options.optional)
const description = Options.text("description").pipe(Options.optional)

export const updateLandscapeCommand = Command.make(
  "updateLandscape",
  { analysisRoot, confFile, name, description },
  (args) =>
    Effect.gen(function* () {
      const root = resolve(args.analysisRoot)
      if (!existsSync(root)) {
        yield* Effect.logError(`The analysis root "${root}" does not exist.`)
        return
      }

      yield* Effect.log(`Updating landscape at ${root}...`)

      // Discover repos and build landscape config from directory structure
      const configPath =
        args.confFile._tag === "Some" ? resolve(args.confFile.value) : null

      const initiator = new LandscapeAnalysisInitiator()
      const landscapeConfig = initiator.initConfiguration(root, configPath, true)

      // Apply metadata overrides
      if (args.name._tag === "Some" || args.description._tag === "Some") {
        landscapeConfig.metadata = {
          ...landscapeConfig.metadata,
          ...(args.name._tag === "Some" ? { name: args.name.value } : {}),
          ...(args.description._tag === "Some" ? { description: args.description.value } : {}),
        }
      }

      const analyzer = new LandscapeAnalyzer(landscapeConfig, root)
      const results = analyzer.analyze()

      // Generate report
      const report = new RichTextReport("landscape", "index.html")
      report.displayName = results.metadata.name || "Landscape"
      LandscapeReportGenerator.generate(report, results)

      // Write report
      const reportsDir = join(root, "_planetnik", "reports")
      mkdirSync(reportsDir, { recursive: true })

      const parts: string[] = []
      const client = { append: (text: string) => parts.push(text) }
      new ReportRenderer().render(report, client)

      const html =
        REPORTS_HTML_HEADER.replace("{{TITLE}}", report.displayName).replace("{{CUSTOM_HEADER}}", "") +
        parts.join("") +
        REPORTS_HTML_FOOTER

      writeFileSync(join(reportsDir, "index.html"), html, "utf-8")

      // Write analysis results JSON
      const dataDir = join(reportsDir, "data")
      mkdirSync(dataDir, { recursive: true })
      writeFileSync(
        join(dataDir, "landscapeAnalysisResults.json"),
        JSON.stringify(results, (_key, value) => (value instanceof Map ? Object.fromEntries(value) : value), 2),
        "utf-8",
      )

      yield* Effect.log(`Landscape report generated at ${reportsDir}/index.html`)
      yield* Effect.log(`Found ${results.getRepositoryCount()} repositories, ${results.getTotalLoc()} total LOC`)
    }),
)
