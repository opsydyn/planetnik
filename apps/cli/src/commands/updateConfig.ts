import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { CodeConfiguration, DEFAULT_CONFIGURATION_FOLDER } from "@planetnik/analyzer"
import { Effect } from "effect"
import { Command, Flag as Options } from "effect/cli"

const srcRoot = Options.String("srcRoot").pipe(Options.withDefault("."))
const confFile = Options.String("confFile").pipe(Options.optional)
const setName = Options.String("setName").pipe(Options.optional)
const setDescription = Options.String("setDescription").pipe(Options.optional)
const setLogoLink = Options.String("setLogoLink").pipe(Options.optional)
const skipDuplication = Options.Boolean("skipDuplication").pipe(Options.withDefault(false))
const enableDuplication = Options.Boolean("enableDuplication").pipe(Options.withDefault(false))

export const updateConfigCommand = Command.make(
  "updateConfig",
  {
    srcRoot,
    confFile,
    setName,
    setDescription,
    setLogoLink,
    skipDuplication,
    enableDuplication,
  },
  (args) =>
    Effect.gen(function* () {
      const root = resolve(args.srcRoot)
      const configPath =
        args.confFile._tag === "Some"
          ? resolve(args.confFile.value)
          : resolve(root, DEFAULT_CONFIGURATION_FOLDER, "config.json")

      if (!existsSync(configPath)) {
        yield* Effect.logError(`Configuration file "${configPath}" does not exist.`)
        return
      }

      yield* Effect.log(`Updating configuration: ${configPath}`)

      const jsonContent = readFileSync(configPath, "utf-8")
      const config: CodeConfiguration = Object.assign(new CodeConfiguration(), JSON.parse(jsonContent))

      if (args.setName._tag === "Some") config.metadata.name = args.setName.value
      if (args.setDescription._tag === "Some") config.metadata.description = args.setDescription.value
      if (args.setLogoLink._tag === "Some") config.metadata.logoLink = args.setLogoLink.value
      if (args.skipDuplication) config.analysis = { ...config.analysis, skipDuplication: true }
      if (args.enableDuplication) config.analysis = { ...config.analysis, skipDuplication: false }

      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8")
      yield* Effect.log("Configuration updated.")
    }),
)
