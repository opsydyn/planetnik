import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { Command, Options } from "@effect/cli"
import { Effect } from "effect"
import { LandscapeAnalyzer } from "@planetnik/analyzer"
import {
  LandscapeReportGenerator,
  ReportRenderer,
  RichTextReport,
  REPORTS_HTML_HEADER,
  REPORTS_HTML_FOOTER,
} from "@planetnik/reports"

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

      // Load or create landscape config
      const configPath = args.confFile._tag === "Some"
        ? resolve(args.confFile.value)
        : join(root, "_sokrates", "config.json")

      const analyzer = new LandscapeAnalyzer()
      const results = analyzer.analyze(root)

      // Apply metadata overrides
      if (args.name._tag === "Some") results.metadata.name = args.name.value
      if (args.description._tag === "Some") results.metadata.description = args.description.value

      // Generate report
      const report = new RichTextReport("landscape", "index.html")
      report.displayName = results.metadata.name || "Landscape"
      LandscapeReportGenerator.generate(report, results)

      // Write report
      const reportsDir = join(root, "_sokrates", "reports")
      mkdirSync(reportsDir, { recursive: true })

      const parts: string[] = []
      const client = { append: (text: string) => parts.push(text) }
      new ReportRenderer().render(report, client)

      const html = REPORTS_HTML_HEADER
        .replace("{{TITLE}}", report.displayName)
        .replace("{{CUSTOM_HEADER}}", "")
        + parts.join("")
        + REPORTS_HTML_FOOTER

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
      yield* Effect.log(
        `Found ${results.getRepositoryCount()} repositories, ${results.getTotalLoc()} total LOC`,
      )
    }),
)
