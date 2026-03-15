import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { Command, Options } from "@effect/cli"
import { ScopeCreator } from "@planetnik/analyzer"
import { Effect } from "effect"

const srcRoot = Options.text("srcRoot").pipe(Options.withDefault("."))
const name = Options.text("name").pipe(Options.optional)
const description = Options.text("description").pipe(Options.optional)
const logoLink = Options.text("logoLink").pipe(Options.optional)
const confFile = Options.text("confFile").pipe(Options.optional)

export const initCommand = Command.make("init", { srcRoot, name, description, logoLink, confFile }, (args) =>
  Effect.gen(function* () {
    const root = resolve(args.srcRoot)
    if (!existsSync(root)) {
      yield* Effect.logError(`The source root "${root}" does not exist.`)
      return
    }

    yield* Effect.log(`Initializing configuration for ${root}...`)

    const creator = new ScopeCreator(root, args.confFile._tag === "Some" ? args.confFile.value : undefined)
    creator.createScopeFromConventions(
      args.name._tag === "Some" ? args.name.value : undefined,
      args.description._tag === "Some" ? args.description.value : undefined,
      args.logoLink._tag === "Some" ? args.logoLink.value : undefined,
    )

    yield* Effect.log("Configuration saved.")
  }),
)
