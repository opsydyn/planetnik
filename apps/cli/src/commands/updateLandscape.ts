import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { LandscapeAnalysisInitiator, LandscapeAnalyzer } from "@planetnik/analyzer"
import {
  LandscapeDataExport,
  LandscapeReportGenerator,
  REPORTS_HTML_FOOTER,
  REPORTS_HTML_HEADER,
  ReportRenderer,
  RichTextReport,
} from "@planetnik/reports"
import { Effect } from "effect"
import { Command, Flag as Options } from "effect/cli"
import { hydrateLandscapeConfiguration, saveLandscapeConfiguration } from "./landscapeConfigHydrator.js"
import { resolveLandscapeDataDir, resolveLandscapeReportsDir } from "./landscapePaths.js"
import { buildLandscapeTagMap } from "./landscapeTagMap.js"

const analysisRoot = Options.String("analysisRoot").pipe(Options.withDefault("."))
const confFile = Options.String("confFile").pipe(Options.optional)
const name = Options.String("name").pipe(Options.optional)
const description = Options.String("description").pipe(Options.optional)
const emitLegacyProjections = Options.Boolean("emitLegacyProjections").pipe(
  Options.optional,
  Options.withDescription("Emit legacy landscape TXT and HTML projections (default: canonical JSON only)"),
)

export const updateLandscapeCommand = Command.make(
  "updateLandscape",
  { analysisRoot, confFile, name, description, emitLegacyProjections },
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
        args.confFile._tag === "Some" ? resolve(args.confFile.value) : join(root, "_planetnik_landscape", "config.json")

      const initiator = new LandscapeAnalysisInitiator()
      const landscapeConfig = initiator.initConfiguration(root, configPath, false)
      let rawConfig: Record<string, unknown> = {}
      if (existsSync(configPath)) {
        rawConfig = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>
        hydrateLandscapeConfiguration(landscapeConfig, rawConfig)
      }
      const shouldEmitLegacyProjections =
        (args.emitLegacyProjections._tag === "Some" && args.emitLegacyProjections.value === true) ||
        landscapeConfig.emitLegacyProjections
      landscapeConfig.emitLegacyProjections = shouldEmitLegacyProjections

      // Apply metadata overrides
      if (args.name._tag === "Some" || args.description._tag === "Some") {
        landscapeConfig.metadata = {
          ...landscapeConfig.metadata,
          ...(args.name._tag === "Some" ? { name: args.name.value } : {}),
          ...(args.description._tag === "Some" ? { description: args.description.value } : {}),
        }
      }
      saveLandscapeConfiguration(configPath, landscapeConfig)

      const analyzer = new LandscapeAnalyzer(landscapeConfig, root)
      const results = analyzer.analyze()

      // Write canonical data and, only when requested, the legacy report.
      const reportsDir = resolveLandscapeReportsDir(root)
      mkdirSync(reportsDir, { recursive: true })

      if (shouldEmitLegacyProjections) {
        const report = new RichTextReport("landscape", "index.html")
        report.displayName = results.metadata.name || "Landscape"
        LandscapeReportGenerator.generate(report, results)

        const parts: string[] = []
        const client = { append: (text: string) => parts.push(text) }
        new ReportRenderer().render(report, client)

        const html =
          REPORTS_HTML_HEADER.replace("{{TITLE}}", report.displayName).replace("{{CUSTOM_HEADER}}", "") +
          parts.join("") +
          REPORTS_HTML_FOOTER

        writeFileSync(join(reportsDir, "index.html"), html, "utf-8")
      } else {
        yield* Effect.log("Skipping legacy landscape TXT/HTML projections (canonical JSON is default).")
      }

      // Write analysis results JSON
      const dataDir = resolveLandscapeDataDir(root)
      mkdirSync(dataDir, { recursive: true })
      const landscapeDataExport = new LandscapeDataExport(results, reportsDir, {
        emitCompatibilityProjections: shouldEmitLegacyProjections,
      })
      landscapeDataExport.exportCoreContracts("updateLandscape")
      landscapeDataExport.exportPeopleContracts(landscapeConfig.teamsConfig)
      const tagMap = buildLandscapeTagMap(landscapeConfig, results.repositoryAnalysisResults, root)
      landscapeDataExport.exportRepositories(tagMap)
      landscapeDataExport.exportTagContracts(tagMap, landscapeConfig.tagGroups)

      if (shouldEmitLegacyProjections) {
        yield* Effect.log(`Landscape report generated at ${reportsDir}/index.html`)
      }
      yield* Effect.log(`Found ${results.getRepositoryCount()} repositories, ${results.getTotalLoc()} total LOC`)
    }),
)
