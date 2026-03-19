import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { Command, Options } from "@effect/cli"
import {
  CodeAnalyzer,
  CodeAnalyzerSettings,
  CodeConfiguration,
  Concern,
  ConcernsGroup,
  DEFAULT_CONFIGURATION_FOLDER,
  LogicalDecomposition,
  NamedSourceCodeAspect,
  SourceFileFilter,
} from "@planetnik/analyzer"
import { BasicSourceCodeReportGenerator, DataExporter, ReportFileExporter } from "@planetnik/reports"
import { Effect } from "effect"

/**
 * Shared analysis pipeline: load config, analyze, export data, generate reports.
 * Used by both `generateReports` and `analyzeRemote` commands.
 */
export function runAnalysis(configPath: string, reportsFolder: string) {
  return Effect.gen(function* () {
    if (!existsSync(configPath)) {
      yield* Effect.logError(`Configuration file "${configPath}" does not exist.`)
      return
    }

    yield* Effect.log(`Configuration file: ${configPath}`)

    const jsonContent = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(jsonContent)
    const codeConfiguration = new CodeConfiguration()
    Object.assign(codeConfiguration, parsed)

    // Reconstruct NamedSourceCodeAspect instances (JSON parse loses class methods)
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

    // Reconstruct LogicalDecomposition instances with proper class methods
    codeConfiguration.logicalDecompositions = (parsed.logicalDecompositions ?? []).map(
      (d: Record<string, unknown>) => {
        const ld = new LogicalDecomposition((d.name as string) ?? "")
        Object.assign(ld, d)
        // Reconstruct component NamedSourceCodeAspect instances
        if (Array.isArray(d.components)) {
          ld.components = d.components.map(
            (c: Record<string, unknown>) =>
              new NamedSourceCodeAspect(
                (c.name as string) ?? "",
                (c.sourceFileFilters as ReturnType<typeof SourceFileFilter.make>[]) ?? [],
                (c.files as string[]) ?? [],
              ),
          )
        }
        return ld
      },
    )

    // Reconstruct concern instances in concernGroups
    if (Array.isArray(parsed.concernGroups)) {
      codeConfiguration.concernGroups = parsed.concernGroups.map((g: Record<string, unknown>) => {
        const group = new ConcernsGroup((g.name as string) ?? "")
        if (Array.isArray(g.concerns)) {
          group.concerns = g.concerns.map(
            (c: Record<string, unknown>) =>
              new Concern(
                (c.name as string) ?? "",
                (c.sourceFileFilters as ReturnType<typeof SourceFileFilter.make>[]) ?? [],
              ),
          )
        }
        return group
      })
    }

    yield* Effect.log(`Reports folder: ${reportsFolder}`)

    const findingsHtml = readFindingsHtml(configPath, parsed)

    const settings = CodeAnalyzerSettings.selectAll()

    yield* Effect.log("Starting analysis...")
    const codeAnalyzer = new CodeAnalyzer(settings, codeConfiguration, configPath)
    const analysisResults = codeAnalyzer.analyze()

    yield* Effect.log("Exporting data...")
    const dataExporter = new DataExporter(analysisResults, reportsFolder, findingsHtml)
    dataExporter.exportData()

    yield* Effect.log("Generating reports...")
    const generator = new BasicSourceCodeReportGenerator(settings, analysisResults, findingsHtml)
    const reports = generator.report()

    for (const report of reports) {
      yield* Effect.log(`  Generating '${report.id}' report...`)
      ReportFileExporter.exportHtml(reportsFolder, "html", report)
    }

    if (settings.updateIndex) {
      ReportFileExporter.exportReportsIndex(reportsFolder, reports, codeConfiguration.metadata.name)
    }

    yield* Effect.log(`Analysis complete. Reports saved to ${reportsFolder}`)
  })
}

function readFindingsHtml(configPath: string, parsed: Record<string, unknown>): string | null {
  const findingsHtmlPath =
    typeof parsed.findingsHtmlPath === "string" && parsed.findingsHtmlPath.trim().length > 0
      ? parsed.findingsHtmlPath.trim()
      : ""

  if (!findingsHtmlPath) return null

  const absolutePath = resolve(dirname(configPath), findingsHtmlPath)
  if (!existsSync(absolutePath)) {
    console.warn(`[planetnik] Findings HTML file not found: ${absolutePath}`)
    return null
  }

  return readFileSync(absolutePath, "utf-8")
}

const confFile = Options.text("confFile").pipe(Options.optional)
const outputFolder = Options.text("outputFolder").pipe(Options.optional)

export const generateReportsCommand = Command.make("generateReports", { confFile, outputFolder }, (args) =>
  Effect.gen(function* () {
    const configPath =
      args.confFile._tag === "Some"
        ? resolve(args.confFile.value)
        : resolve(DEFAULT_CONFIGURATION_FOLDER, "config.json")

    const reportsFolder =
      args.outputFolder._tag === "Some"
        ? resolve(args.outputFolder.value)
        : resolve(DEFAULT_CONFIGURATION_FOLDER, "reports")

    yield* runAnalysis(configPath, reportsFolder)
  }),
)
