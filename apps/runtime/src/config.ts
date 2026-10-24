import { Config, ConfigProvider, Effect, Option, Redacted, Schema } from "effect"

type NodeEnvironment = "development" | "test" | "production"
type CookieSameSite = "lax" | "none" | "strict"

export type AppConfig = {
  readonly nodeEnv: NodeEnvironment
  readonly port: number
  readonly corsOrigins: string[]
  readonly databaseUrl: string
  readonly datasetsRoot?: string
  readonly cookieDomain?: string
  readonly authCookies: {
    readonly secure: boolean
    readonly sameSite: CookieSameSite
  }
  readonly betterAuth: {
    readonly baseURL: string
    readonly secret: string
  }
}

const DatabaseUrl = Config.NonEmptyString("DATABASE_URL").pipe(Config.map(Redacted.make))
const BetterAuthSecret = Config.NonEmptyString("BETTER_AUTH_SECRET").pipe(Config.map(Redacted.make))
const BetterAuthUrl = Config.NonEmptyString("BETTER_AUTH_URL")

const Port = Config.Port("PORT").pipe(Config.withDefault(1337))
const CorsOrigin = Config.String("CORS_ORIGIN").pipe(Config.withDefault(""))
const DatasetsRoot = Config.option(Config.NonEmptyString("PLANETNIK_DATASETS_ROOT"))
const CookieDomain = Config.option(Config.NonEmptyString("COOKIE_DOMAIN"))
const AuthCookieSecure = Config.option(Config.Boolean("AUTH_COOKIE_SECURE"))
const AuthCookieSameSite = Config.option(
  Config.String("AUTH_COOKIE_SAME_SITE")
    .pipe(Config.map((value) => value.trim().toLowerCase()))
    .pipe(
      Config.mapEffect((value) =>
        Schema.decodeUnknownEffect(Schema.Literals(["lax", "none", "strict"]))(value).pipe(
          Effect.mapError((error) => new Config.ConfigError(error)),
        ),
      ),
    ),
)
const NodeEnv = Config.String("NODE_ENV")
  .pipe(Config.withDefault("development"))
  .pipe(Config.map((value) => value.trim().toLowerCase()))
  .pipe(
    Config.mapEffect((value) =>
      Schema.decodeUnknownEffect(Schema.Literals(["development", "test", "production"]))(value).pipe(
        Effect.mapError((error) => new Config.ConfigError(error)),
      ),
    ),
  )

const DEFAULT_DEV_CORS_ORIGINS = ["http://localhost:4321", "http://127.0.0.1:4321"] as const

function normalizeOptionalString(value: Option.Option<string>): Option.Option<string> {
  return Option.filter(
    Option.map(value, (raw) => raw.trim()),
    (trimmed) => trimmed.length > 0,
  )
}

function resolveCorsOrigins(nodeEnv: NodeEnvironment, corsOrigin: string) {
  const configuredOrigins = corsOrigin
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  if (nodeEnv !== "development") {
    return configuredOrigins
  }

  return [...new Set([...configuredOrigins, ...DEFAULT_DEV_CORS_ORIGINS])]
}

const makeConfig = Effect.gen(function* () {
  const databaseUrlRedacted = yield* DatabaseUrl
  const betterAuthSecretRedacted = yield* BetterAuthSecret
  const betterAuthUrl = yield* BetterAuthUrl
  const port = yield* Port
  const corsOrigin = yield* CorsOrigin
  const datasetsRoot = yield* DatasetsRoot
  const cookieDomain = yield* CookieDomain
  const authCookieSecureOverride = yield* AuthCookieSecure
  const authCookieSameSiteOverride = yield* AuthCookieSameSite
  const nodeEnv = yield* NodeEnv

  const authCookieSecure = Option.match(authCookieSecureOverride, {
    onNone: () => nodeEnv === "production",
    onSome: (value) => value,
  })
  const authCookieSameSite = Option.match(authCookieSameSiteOverride, {
    onNone: () => "lax" as const,
    onSome: (value) => value,
  })

  const normalizedAuthCookieSameSite: CookieSameSite =
    authCookieSameSite === "none" && !authCookieSecure ? "lax" : authCookieSameSite
  const normalizedDatasetsRoot = Option.getOrUndefined(normalizeOptionalString(datasetsRoot))
  const normalizedCookieDomain = Option.getOrUndefined(normalizeOptionalString(cookieDomain))

  const appConfig: AppConfig = {
    nodeEnv,
    port,
    corsOrigins: resolveCorsOrigins(nodeEnv, corsOrigin),
    databaseUrl: Redacted.value(databaseUrlRedacted),
    ...(normalizedDatasetsRoot ? { datasetsRoot: normalizedDatasetsRoot } : {}),
    authCookies: {
      secure: authCookieSecure,
      sameSite: normalizedAuthCookieSameSite,
    },
    betterAuth: {
      baseURL: betterAuthUrl,
      secret: Redacted.value(betterAuthSecretRedacted),
    },
    ...(normalizedCookieDomain ? { cookieDomain: normalizedCookieDomain } : {}),
  }

  return appConfig
})

export const appConfig: AppConfig = Effect.runSync(
  Effect.provideService(makeConfig, ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
)
