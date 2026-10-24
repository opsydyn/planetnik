import { Effect, Layer, Logger, type LogLevel, References } from "effect"

/**
 * Planetnik CLI logger — structured log output with phase and context annotations.
 *
 * Provides `Effect.logDebug`, `Effect.log` (INFO), `Effect.logWarning`, `Effect.logError`
 * with consistent formatting. Use `Effect.annotateLogs` to attach context (org, repo, phase).
 *
 * Log level is controlled via the `PLANETNIK_LOG_LEVEL` environment variable:
 *   DEBUG | INFO (default) | WARNING | ERROR | NONE
 */

const LOG_LEVEL_MAP: Record<string, LogLevel.LogLevel> = {
  DEBUG: "Debug",
  INFO: "Info",
  WARNING: "Warn",
  ERROR: "Error",
  NONE: "None",
}

function resolveLogLevel(): LogLevel.LogLevel {
  const env = (typeof process !== "undefined" && process.env.PLANETNIK_LOG_LEVEL) || ""
  return LOG_LEVEL_MAP[env.toUpperCase()] ?? "Info"
}

const LOG_OUTPUT: Record<string, "error" | "warn" | "debug"> = {
  Error: "error",
  Fatal: "error",
  Warn: "warn",
  Debug: "debug",
}

const planetnikLogger = Logger.make(({ logLevel, message, fiber, date }) => {
  const prefix = logLevel === "Info" ? "" : `[${logLevel.toUpperCase()}] `
  const msg = `${prefix}${message}`

  const parts: string[] = []
  for (const [key, value] of Object.entries(fiber.getRef(References.CurrentLogAnnotations))) {
    parts.push(`${key}=${value}`)
  }
  for (const [label, startTime] of fiber.getRef(References.CurrentLogSpans)) {
    parts.push(`${label}=${date.getTime() - startTime}ms`)
  }

  const suffix = parts.length > 0 ? ` (${parts.join(", ")})` : ""
  const method = LOG_OUTPUT[logLevel] ?? "log"
  console[method](`${msg}${suffix}`)
})

/** Logger layer for the Planetnik CLI. Respects PLANETNIK_LOG_LEVEL env var. */
export const PlanetnikLoggerLayer: Layer.Layer<never> = Layer.merge(
  Logger.layer([planetnikLogger, Logger.tracerLogger]),
  Layer.succeed(References.MinimumLogLevel, resolveLogLevel()),
)

/** Annotate an effect with a named phase for structured log context. */
export const withPhase = (phase: string) => Effect.annotateLogs("phase", phase)
