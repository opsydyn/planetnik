import { Config, Context, Effect, Layer, Option, type Redacted } from "effect"

/**
 * Type-safe CLI configuration backed by environment variables.
 *
 * Bun automatically loads `.env` from the working directory, so values
 * defined there are available via `process.env` and Effect's `Config`.
 *
 * Environment variables:
 *   GITHUB_TOKEN           — GitHub API token for landscape discovery (optional)
 *   PLANETNIK_LOG_LEVEL    — Log verbosity: DEBUG | INFO | WARNING | ERROR | NONE (default: INFO)
 *   PLANETNIK_DATA_DIR     — Analysis data directory for server-side tools (optional)
 */

export class CliConfig extends Context.Service<
  CliConfig,
  {
    readonly githubToken: Redacted.Redacted<string> | undefined
    readonly logLevel: string
    readonly dataDir: string | undefined
  }
>()("CliConfig") {
  static readonly layer: Layer.Layer<CliConfig> = Layer.effect(
    CliConfig,
    Effect.gen(function* () {
      const githubToken = yield* Config.Redacted("GITHUB_TOKEN").pipe(
        Effect.map(Option.some),
        Effect.catchTag(["ConfigError"], () => Effect.succeed(Option.none<Redacted.Redacted<string>>())),
      )
      const logLevel = yield* Config.String("PLANETNIK_LOG_LEVEL").pipe(
        Effect.catchTag(["ConfigError"], () => Effect.succeed("INFO")),
      )
      const dataDir = yield* Config.String("PLANETNIK_DATA_DIR").pipe(
        Effect.map(Option.some),
        Effect.catchTag(["ConfigError"], () => Effect.succeed(Option.none<string>())),
      )

      return {
        githubToken: Option.getOrUndefined(githubToken),
        logLevel,
        dataDir: Option.getOrUndefined(dataDir),
      }
    }),
  )
}
