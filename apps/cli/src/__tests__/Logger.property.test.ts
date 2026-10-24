import { describe, expect, test } from "bun:test"
import { Effect, Layer, References } from "effect"
import * as FastCheck from "fast-check"
import { PlanetnikLoggerLayer, withPhase } from "../logger.js"

interface LogEntry {
  method: string
  output: string
}

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

function entry(captured: LogEntry[], index: number): LogEntry {
  const e = captured[index]
  if (!e) throw new Error(`Expected log entry at index ${index}, but only ${captured.length} entries captured`)
  return e
}

const debugLayer = Layer.merge(PlanetnikLoggerLayer, Layer.succeed(References.MinimumLogLevel, "Debug"))

const logFns = [Effect.logInfo, Effect.logWarning, Effect.logError, Effect.logDebug] as const

const logEntries = [
  { name: "logInfo" as const, fn: Effect.logInfo },
  { name: "logWarning" as const, fn: Effect.logWarning },
  { name: "logError" as const, fn: Effect.logError },
  { name: "logDebug" as const, fn: Effect.logDebug },
]

const expectedRouting = {
  logInfo: "log",
  logWarning: "warn",
  logError: "error",
  logDebug: "debug",
} as const

describe("Logger — properties", () => {
  test("any message string is always present in the output regardless of log level", () => {
    FastCheck.assert(
      FastCheck.property(
        FastCheck.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        FastCheck.integer({ min: 0, max: 3 }),
        (message, levelIndex) => {
          const ctx = captureConsole()
          try {
            const logFn = logFns[levelIndex]
            if (!logFn) throw new Error(`Invalid level index: ${levelIndex}`)
            Effect.runSync(logFn(message).pipe(Effect.provide(debugLayer)))
            expect(ctx.captured).toHaveLength(1)
            expect(entry(ctx.captured, 0).output).toContain(message)
          } finally {
            ctx.restore()
          }
        },
      ),
      { numRuns: 50 },
    )
  })

  test("annotation keys and values always appear in output", () => {
    const safeString = FastCheck.string({ minLength: 1, maxLength: 30 }).filter((s) =>
      /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s),
    )

    FastCheck.assert(
      FastCheck.property(safeString, safeString, (key, value) => {
        const ctx = captureConsole()
        try {
          Effect.runSync(Effect.logInfo("msg").pipe(Effect.annotateLogs(key, value), Effect.provide(debugLayer)))
          expect(entry(ctx.captured, 0).output).toContain(`${key}=${value}`)
        } finally {
          ctx.restore()
        }
      }),
      { numRuns: 30 },
    )
  })

  test("withPhase always produces phase=<value> in output for any phase name", () => {
    const phaseName = FastCheck.string({ minLength: 1, maxLength: 30 }).filter((s) =>
      /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s),
    )

    FastCheck.assert(
      FastCheck.property(phaseName, (phase) => {
        const ctx = captureConsole()
        try {
          Effect.runSync(Effect.logInfo("work").pipe(withPhase(phase), Effect.provide(debugLayer)))
          expect(entry(ctx.captured, 0).output).toContain(`phase=${phase}`)
        } finally {
          ctx.restore()
        }
      }),
      { numRuns: 30 },
    )
  })

  test("log level routing is deterministic: same level always routes to same console method", () => {
    FastCheck.assert(
      FastCheck.property(
        FastCheck.integer({ min: 0, max: 3 }),
        FastCheck.nat({ max: 100 }),
        (levelIndex, _iteration) => {
          const logEntry = logEntries[levelIndex]
          if (!logEntry) throw new Error(`Invalid level index: ${levelIndex}`)
          const ctx = captureConsole()
          try {
            Effect.runSync(logEntry.fn("test").pipe(Effect.provide(debugLayer)))
            expect(entry(ctx.captured, 0).method).toBe(expectedRouting[logEntry.name])
          } finally {
            ctx.restore()
          }
        },
      ),
      { numRuns: 40 },
    )
  })

  test("multiple annotations never lose any key-value pair", () => {
    const safeKey = FastCheck.string({ minLength: 1, maxLength: 15 }).filter((s) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s))
    const safeVal = FastCheck.string({ minLength: 1, maxLength: 15 }).filter((s) => /^[a-zA-Z0-9]+$/.test(s))

    FastCheck.assert(
      FastCheck.property(
        FastCheck.array(FastCheck.tuple(safeKey, safeVal), {
          minLength: 1,
          maxLength: 5,
        }),
        (pairs) => {
          const ctx = captureConsole()
          try {
            const annotations: Record<string, string> = {}
            for (const [k, v] of pairs) {
              annotations[k] = v
            }
            Effect.runSync(Effect.logInfo("multi").pipe(Effect.annotateLogs(annotations), Effect.provide(debugLayer)))
            for (const [k, v] of Object.entries(annotations)) {
              expect(entry(ctx.captured, 0).output).toContain(`${k}=${v}`)
            }
          } finally {
            ctx.restore()
          }
        },
      ),
      { numRuns: 30 },
    )
  })
})
