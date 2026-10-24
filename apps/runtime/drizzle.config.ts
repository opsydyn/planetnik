import type { Config } from "drizzle-kit"
import { Data, Effect, Option } from "effect"

class DrizzleConfigError extends Data.TaggedError("DrizzleConfigError")<{
  readonly message: string
}> {}

const MISSING_DATABASE_URL_MESSAGE = "DATABASE_URL or DATABASE_URL_DIRECT is required to run Drizzle commands"

const INVALID_DATABASE_URL_MESSAGE = "DATABASE_URL or DATABASE_URL_DIRECT must be a valid database URL"

const POOLED_DATABASE_URL_MESSAGE = [
  "Drizzle schema commands should use a direct Neon connection string.",
  "The current DATABASE_URL points at a Neon pooler host.",
  "Set DATABASE_URL_DIRECT to the non-pooled Neon connection string from the Neon dashboard.",
].join(" ")

function normalizeEnvValue(value: string | undefined): Option.Option<string> {
  if (!value) {
    return Option.none()
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? Option.some(trimmed) : Option.none()
}

const directDatabaseUrl = Effect.runSync(
  Effect.gen(function* () {
    const configuredUrl = yield* Option.match(
      Option.orElse(normalizeEnvValue(process.env.DATABASE_URL_DIRECT), () =>
        normalizeEnvValue(process.env.DATABASE_URL),
      ),
      {
        onNone: () =>
          Effect.fail(
            new DrizzleConfigError({
              message: MISSING_DATABASE_URL_MESSAGE,
            }),
          ),
        onSome: (value) => Effect.succeed(value),
      },
    )

    const hostname = yield* Effect.try({
      try: () => new URL(configuredUrl).hostname,
      catch: () =>
        new DrizzleConfigError({
          message: INVALID_DATABASE_URL_MESSAGE,
        }),
    })

    if (hostname.includes("-pooler") && Option.isNone(normalizeEnvValue(process.env.DATABASE_URL_DIRECT))) {
      return yield* Effect.fail(
        new DrizzleConfigError({
          message: POOLED_DATABASE_URL_MESSAGE,
        }),
      )
    }

    return configuredUrl
  }),
)

export default {
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: directDatabaseUrl,
  },
} satisfies Config
