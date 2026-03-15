import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { Command, Options } from "@effect/cli"
import {
  CodeAnalyzer,
  CodeAnalyzerSettings,
  CodeConfiguration,
  DEFAULT_CONFIGURATION_FOLDER,
} from "@planetnik/analyzer"
import { BasicSourceCodeReportGenerator, DataExporter, ReportFileExporter } from "@planetnik/reports"
import { Effect } from "effect"

const confFile = Options.text("confFile").pipe(Options.optional)
const outputFolder = Options.text("outputFolder").pipe(Options.optional)

export const generateReportsCommand = Command.make("generateReports", { confFile, outputFolder }, (args) =>
  Effect.gen(function* () {
    const configPath =
      args.confFile._tag === "Some"
        ? resolve(args.confFile.value)
        : resolve(DEFAULT_CONFIGURATION_FOLDER, "config.json")

    if (!existsSync(configPath)) {
      yield* Effect.logError(`Configuration file "${configPath}" does not exist.`)
      return
    }

    yield* Effect.log(`Configuration file: ${configPath}`)

    const jsonContent = readFileSync(configPath, "utf-8")
    const codeConfiguration: CodeConfiguration = Object.assign(new CodeConfiguration(), JSON.parse(jsonContent))

    const reportsFolder =
      args.outputFolder._tag === "Some"
        ? resolve(args.outputFolder.value)
        : resolve(DEFAULT_CONFIGURATION_FOLDER, "reports")

    yield* Effect.log(`Reports folder: ${reportsFolder}`)

    const settings = CodeAnalyzerSettings.selectAll()

    yield* Effect.log("Starting analysis...")
    const codeAnalyzer = new CodeAnalyzer(settings, codeConfiguration, configPath)
    const analysisResults = codeAnalyzer.analyze()

    yield* Effect.log("Exporting data...")
    const dataExporter = new DataExporter(analysisResults, reportsFolder)
    dataExporter.exportData()

    yield* Effect.log("Generating reports...")
    const generator = new BasicSourceCodeReportGenerator(settings, analysisResults)
    const reports = generator.report()

    for (const report of reports) {
      yield* Effect.log(`  Generating '${report.id}' report...`)
      ReportFileExporter.exportHtml(reportsFolder, "html", report)
    }

    if (settings.updateIndex) {
      ReportFileExporter.exportReportsIndex(reportsFolder, reports, codeConfiguration.metadata.name)
    }

    yield* Effect.log(`Analysis complete. Reports saved to ${reportsFolder}`)
  }),
)
