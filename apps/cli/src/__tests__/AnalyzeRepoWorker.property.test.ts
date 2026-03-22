import { describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { Effect, FastCheck } from "effect"
import { acquireTempDir } from "../commands/analyzeLandscape.js"

describe("acquireTempDir — properties", () => {
  test("always creates a directory under os.tmpdir() for any prefix", () => {
    FastCheck.assert(
      FastCheck.property(
        FastCheck.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
        (prefix) => {
          let capturedDir = ""
          Effect.runSync(
            Effect.scoped(
              Effect.gen(function* () {
                const dir = yield* acquireTempDir(prefix)
                capturedDir = dir
                expect(dir.startsWith(tmpdir())).toBe(true)
                expect(existsSync(dir)).toBe(true)
              }),
            ),
          )
          // Finalizer must have removed it
          expect(existsSync(capturedDir)).toBe(false)
        },
      ),
      { numRuns: 20 },
    )
  })

  test("directory name always contains the prefix", () => {
    FastCheck.assert(
      FastCheck.property(
        FastCheck.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
        (prefix) => {
          Effect.runSync(
            Effect.scoped(
              Effect.gen(function* () {
                const dir = yield* acquireTempDir(prefix)
                expect(dir).toContain(prefix)
              }),
            ),
          )
        },
      ),
      { numRuns: 20 },
    )
  })

  test("N concurrent scopes always produce N unique directories", () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.integer({ min: 2, max: 10 }), (n) => {
        const dirs: string[] = []
        Effect.runSync(
          Effect.all(
            Array.from({ length: n }, () =>
              Effect.scoped(
                Effect.gen(function* () {
                  const dir = yield* acquireTempDir("prop-concurrent")
                  dirs.push(dir)
                }),
              ),
            ),
            { concurrency: n },
          ),
        )
        const unique = new Set(dirs)
        expect(unique.size).toBe(n)
        // All cleaned up
        for (const dir of dirs) {
          expect(existsSync(dir)).toBe(false)
        }
      }),
      { numRuns: 10 },
    )
  })

  test("cleanup always happens even when the effect fails", () => {
    FastCheck.assert(
      FastCheck.property(
        FastCheck.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s)),
        (prefix) => {
          let capturedDir = ""
          const result = Effect.runSync(
            Effect.scoped(
              Effect.gen(function* () {
                const dir = yield* acquireTempDir(prefix)
                capturedDir = dir
                yield* Effect.fail("simulated")
              }),
            ).pipe(Effect.either),
          )
          expect(result._tag).toBe("Left")
          expect(capturedDir).not.toBe("")
          expect(existsSync(capturedDir)).toBe(false)
        },
      ),
      { numRuns: 20 },
    )
  })
})
