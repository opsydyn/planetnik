import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import {
  CodeAnalyzer,
  CodeAnalyzerSettings,
  CodeConfiguration,
  Concern,
  ConcernsGroup,
  DEFAULT_CONFIGURATION_FOLDER,
  LogicalDecomposition,
  NamedSourceCodeAspect,
  type SourceFileFilter,
} from "@planetnik/analyzer"
import {
  BasicSourceCodeReportGenerator,
  DataExporter,
  type FindingsAuthoringDocument,
  parseFindingsAuthoringDocument,
  ReportFileExporter,
} from "@planetnik/reports"
import { Effect } from "effect"
import { Command, Flag as Options } from "effect/cli"
import { beginSnapshotRetention, finishSnapshotRetention } from "../snapshots/snapshotRetention.js"

export interface RunAnalysisOptions {
  /** Emit legacy TXT projections and RichText HTML reports in addition to JSON. */
  readonly emitLegacyProjections?: boolean
  /** Retain up to this many canonical snapshots, including the current export. */
  readonly retainSnapshots?: number
}

/**
 * Shared analysis pipeline: load config, analyze, export data, generate reports.
 * Used by both `generateReports` and `analyzeRemote` commands.
 */
export function runAnalysis(configPath: string, reportsFolder: string, options: RunAnalysisOptions = {}) {
  return Effect.gen(function* () {
    if (!existsSync(configPath)) {
      yield* Effect.logError(`Configuration file "${configPath}" does not exist.`)
      return
    }

    yield* Effect.log(`Configuration file: ${configPath}`)

    const jsonContent = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(jsonContent)
    const emitLegacyProjections = options.emitLegacyProjections ?? parsed.emitLegacyProjections === true
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
    codeConfiguration.logicalDecompositions = (parsed.logicalDecompositions ?? []).map((d: Record<string, unknown>) => {
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
    })

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
    const retainSnapshots =
      options.retainSnapshots ?? (typeof parsed.retainSnapshots === "number" ? parsed.retainSnapshots : undefined)

    const findingsDocument = readFindingsInput(configPath, parsed)

    const settings = CodeAnalyzerSettings.selectAll()

    yield* Effect.log("Starting analysis...")
    const codeAnalyzer = new CodeAnalyzer(settings, codeConfiguration, configPath)
    const analysisResults = codeAnalyzer.analyze()

    yield* Effect.log("Exporting data...")
    const retentionSession =
      retainSnapshots === undefined ? undefined : beginSnapshotRetention(join(reportsFolder, "data"), retainSnapshots)
    if (retentionSession?.previousSnapshotId) {
      yield* Effect.log(`Archived previous canonical snapshot ${retentionSession.previousSnapshotId} before export.`)
    }
    const dataExporter = new DataExporter(analysisResults, reportsFolder, {
      emitCompatibilityProjections: emitLegacyProjections,
      findings: findingsDocument,
    })
    dataExporter.exportData()

    if (emitLegacyProjections) {
      yield* Effect.log("Generating legacy HTML reports...")
      const generator = new BasicSourceCodeReportGenerator(settings, analysisResults, findingsDocument)
      const reports = generator.report()

      for (const report of reports) {
        yield* Effect.log(`  Generating '${report.id}' report...`)
        ReportFileExporter.exportHtml(reportsFolder, "html", report)
      }

      if (settings.updateIndex) {
        ReportFileExporter.exportReportsIndex(reportsFolder, reports, codeConfiguration.metadata.name)
      }
    } else {
      yield* Effect.log("Skipping legacy TXT/HTML projections (canonical JSON is default).")
    }

    if (retentionSession) {
      const retained = finishSnapshotRetention(retentionSession)
      yield* Effect.log(
        `Retained ${retained.snapshotCount} canonical snapshot${retained.snapshotCount === 1 ? "" : "s"} (${retained.currentSnapshotId} is current).`,
      )
    }

    yield* Effect.log(`Analysis complete. Reports saved to ${reportsFolder}`)
  })
}

function readFindingsInput(configPath: string, parsed: Record<string, unknown>): FindingsAuthoringDocument | null {
  const configuredFindingsPath =
    typeof parsed.findingsPath === "string" && parsed.findingsPath.trim().length > 0 ? parsed.findingsPath.trim() : ""
  const defaultFindingsPath = join(dirname(configPath), "findings.json")
  const findingsPath = configuredFindingsPath
    ? resolve(dirname(configPath), configuredFindingsPath)
    : existsSync(defaultFindingsPath)
      ? defaultFindingsPath
      : null

  if (findingsPath) {
    if (!existsSync(findingsPath)) {
      throw new Error(`Findings JSON file not found: ${findingsPath}`)
    }

    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(findingsPath, "utf-8"))
    } catch (error) {
      throw new Error(`Failed to parse findings JSON at ${findingsPath}: ${String(error)}`)
    }

    const document = parseFindingsAuthoringDocument(raw, findingsPath)
    return document
  }

  return null
}

const confFile = Options.String("confFile").pipe(Options.optional)
const outputFolder = Options.String("outputFolder").pipe(Options.optional)
const emitLegacyProjections = Options.Boolean("emitLegacyProjections").pipe(
  Options.optional,
  Options.withDescription("Emit legacy TXT and HTML projections (default: canonical JSON only)"),
)
const retainSnapshots = Options.Int("retainSnapshots").pipe(
  Options.optional,
  Options.withDescription("Retain up to N canonical snapshots including the current export"),
)

export const generateReportsCommand = Command.make(
  "generateReports",
  { confFile, outputFolder, emitLegacyProjections, retainSnapshots },
  (args) =>
    Effect.gen(function* () {
      const configPath =
        args.confFile._tag === "Some"
          ? resolve(args.confFile.value)
          : resolve(DEFAULT_CONFIGURATION_FOLDER, "config.json")

      const reportsFolder =
        args.outputFolder._tag === "Some"
          ? resolve(args.outputFolder.value)
          : resolve(DEFAULT_CONFIGURATION_FOLDER, "reports")

      const options: RunAnalysisOptions = {
        ...(args.emitLegacyProjections._tag === "Some" && args.emitLegacyProjections.value === true
          ? { emitLegacyProjections: true }
          : {}),
        ...(args.retainSnapshots._tag === "Some" ? { retainSnapshots: args.retainSnapshots.value } : {}),
      }
      yield* runAnalysis(configPath, reportsFolder, options)
    }),
)
