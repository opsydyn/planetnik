import { describe, expect, test } from "bun:test"
import { Effect, Layer, Logger, LogLevel } from "effect"
import { PlanetnikLoggerLayer, withPhase } from "../logger.js"

interface LogEntry {
  method: string
  output: string
}

/** Capture console output by replacing console methods with mocks. */
function captureConsole() {
  const captured: LogEntry[] = []
  const origLog = console.log
  const origError = console.error
  const origWarn = console.warn
  const origDebug = console.debug

  console.log = (...args: unknown[]) => captured.push({ method: "log", output: String(args[0]) })
  console.error = (...args: unknown[]) => captured.push({ method: "error", output: String(args[0]) })
  console.warn = (...args: unknown[]) => captured.push({ method: "warn", output: String(args[0]) })
  console.debug = (...args: unknown[]) => captured.push({ method: "debug", output: String(args[0]) })

  return {
    captured,
    restore() {
      console.log = origLog
      console.error = origError
      console.warn = origWarn
      console.debug = origDebug
    },
  }
}

/** Assert a captured entry exists and return it. */
function entry(captured: LogEntry[], index: number): LogEntry {
  const e = captured[index]
  if (!e) throw new Error(`Expected log entry at index ${index}, but only ${captured.length} entries captured`)
  return e
}

/** Run an effect with PlanetnikLoggerLayer and full log visibility (Debug minimum). */
function runWithLogger<A>(effect: Effect.Effect<A, never, never>): { result: A; captured: LogEntry[] } {
  const ctx = captureConsole()
  try {
    const layer = Layer.merge(PlanetnikLoggerLayer, Logger.minimumLogLevel(LogLevel.Debug))
    const result = Effect.runSync(effect.pipe(Effect.provide(layer)))
    return { result, captured: ctx.captured }
  } finally {
    ctx.restore()
  }
}

describe("PlanetnikLoggerLayer — log level routing", () => {
  test("Info messages use console.log with no prefix", () => {
    const { captured } = runWithLogger(Effect.logInfo("hello world"))
    expect(captured).toHaveLength(1)
    expect(entry(captured, 0).method).toBe("log")
    expect(entry(captured, 0).output).toBe("hello world")
  })

  test("Error messages use console.error with [ERROR] prefix", () => {
    const { captured } = runWithLogger(Effect.logError("something broke"))
    expect(captured).toHaveLength(1)
    expect(entry(captured, 0).method).toBe("error")
    expect(entry(captured, 0).output).toStartWith("[ERROR]")
    expect(entry(captured, 0).output).toContain("something broke")
  })

  test("Warning messages use console.warn with [WARN] prefix", () => {
    const { captured } = runWithLogger(Effect.logWarning("heads up"))
    expect(captured).toHaveLength(1)
    expect(entry(captured, 0).method).toBe("warn")
    expect(entry(captured, 0).output).toStartWith("[WARN")
    expect(entry(captured, 0).output).toContain("heads up")
  })

  test("Debug messages use console.debug with [DEBUG] prefix", () => {
    const { captured } = runWithLogger(Effect.logDebug("trace detail"))
    expect(captured).toHaveLength(1)
    expect(entry(captured, 0).method).toBe("debug")
    expect(entry(captured, 0).output).toStartWith("[DEBUG]")
    expect(entry(captured, 0).output).toContain("trace detail")
  })
})

describe("PlanetnikLoggerLayer — annotations", () => {
  test("single annotation appended in parentheses", () => {
    const { captured } = runWithLogger(Effect.logInfo("processing").pipe(Effect.annotateLogs("org", "acme")))
    expect(entry(captured, 0).output).toBe("processing (org=acme)")
  })

  test("multiple annotations joined with commas", () => {
    const { captured } = runWithLogger(Effect.logInfo("step").pipe(Effect.annotateLogs({ org: "acme", repo: "core" })))
    expect(entry(captured, 0).output).toContain("org=acme")
    expect(entry(captured, 0).output).toContain("repo=core")
    expect(entry(captured, 0).output).toMatch(/\(.*,.*\)/)
  })

  test("no annotations produces no suffix", () => {
    const { captured } = runWithLogger(Effect.logInfo("plain"))
    expect(entry(captured, 0).output).toBe("plain")
  })
})

describe("withPhase helper", () => {
  test("adds phase annotation to log output", () => {
    const { captured } = runWithLogger(Effect.logInfo("discovering repos").pipe(withPhase("discovery")))
    expect(entry(captured, 0).output).toBe("discovering repos (phase=discovery)")
  })

  test("phase composes with other annotations", () => {
    const { captured } = runWithLogger(
      Effect.logInfo("cloning").pipe(Effect.annotateLogs("repo", "effect"), withPhase("analysis")),
    )
    expect(entry(captured, 0).output).toContain("phase=analysis")
    expect(entry(captured, 0).output).toContain("repo=effect")
  })
})

describe("PlanetnikLoggerLayer — log level filtering", () => {
  test("minimum level filters out lower-priority messages", () => {
    const ctx = captureConsole()
    try {
      const layer = Layer.merge(PlanetnikLoggerLayer, Logger.minimumLogLevel(LogLevel.Warning))
      Effect.runSync(
        Effect.gen(function* () {
          yield* Effect.logDebug("should be hidden")
          yield* Effect.logInfo("also hidden")
          yield* Effect.logWarning("visible warning")
          yield* Effect.logError("visible error")
        }).pipe(Effect.provide(layer)),
      )
      expect(ctx.captured).toHaveLength(2)
      expect(entry(ctx.captured, 0).output).toContain("visible warning")
      expect(entry(ctx.captured, 1).output).toContain("visible error")
    } finally {
      ctx.restore()
    }
  })
})

describe("PlanetnikLoggerLayer — spans", () => {
  test("span timing is included in output", () => {
    const { captured } = runWithLogger(Effect.logInfo("done").pipe(Effect.withLogSpan("build")))
    expect(entry(captured, 0).output).toMatch(/done \(build=\d+ms\)/)
  })
})
