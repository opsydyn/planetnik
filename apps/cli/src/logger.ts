import { Effect, Layer, Logger, LogLevel } from "effect";

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
	DEBUG: LogLevel.Debug,
	INFO: LogLevel.Info,
	WARNING: LogLevel.Warning,
	ERROR: LogLevel.Error,
	NONE: LogLevel.None,
};

function resolveLogLevel(): LogLevel.LogLevel {
	const env =
		(typeof process !== "undefined" && process.env.PLANETNIK_LOG_LEVEL) || "";
	return LOG_LEVEL_MAP[env.toUpperCase()] ?? LogLevel.Info;
}

const LOG_OUTPUT: Record<string, "error" | "warn" | "debug"> = {
	Error: "error",
	Fatal: "error",
	Warning: "warn",
	Debug: "debug",
};

const planetnikLogger = Logger.make(
	({ logLevel, message, annotations, spans }) => {
		const prefix = logLevel._tag === "Info" ? "" : `[${logLevel.label}] `;
		const msg = `${prefix}${message}`;

		const parts: string[] = [];
		for (const [key, value] of annotations) {
			parts.push(`${key}=${value}`);
		}
		for (const span of spans) {
			parts.push(`${span.label}=${Date.now() - span.startTime}ms`);
		}

		const suffix = parts.length > 0 ? ` (${parts.join(", ")})` : "";
		const method = LOG_OUTPUT[logLevel._tag] ?? "log";
		console[method](`${msg}${suffix}`);
	},
);

/** Logger layer for the Planetnik CLI. Respects PLANETNIK_LOG_LEVEL env var. */
export const PlanetnikLoggerLayer: Layer.Layer<never> = Layer.merge(
	Logger.replace(Logger.defaultLogger, planetnikLogger),
	Logger.minimumLogLevel(resolveLogLevel()),
);

/** Annotate an effect with a named phase for structured log context. */
export const withPhase = (phase: string) => Effect.annotateLogs("phase", phase);
