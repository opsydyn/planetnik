import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import * as Arbitrary from "effect/Arbitrary"
import * as FastCheck from "fast-check"
import { PlanetnikConfigSchema } from "../schemas/PlanetnikConfigSchema.js"

const decode = Schema.decodeUnknownSync(PlanetnikConfigSchema)
const encode = Schema.encodeSync(PlanetnikConfigSchema)
const configArbitrary = Arbitrary.schema(PlanetnikConfigSchema)

const VALID_MODES = ["single_repository", "landscape"] as const

describe("PlanetnikConfigSchema — properties", () => {
  test("any generated config roundtrips through encode → decode", async () => {
    expect(
      (
        await Effect.runPromise(
          Arbitrary.checkEffect(
            configArbitrary,
            (config) => {
              const encoded = encode(config)
              const decoded = decode(encoded)
              expect(decoded.mode).toBe(config.mode)
              return true
            },
            { runs: 50 },
          ),
        )
      )._tag,
    ).toBe("Passed")
  })

  test("mode is always one of the valid literals", async () => {
    expect(
      (
        await Effect.runPromise(
          Arbitrary.checkEffect(
            configArbitrary,
            (config) => {
              expect(VALID_MODES).toContain(config.mode)
              return true
            },
            { runs: 50 },
          ),
        )
      )._tag,
    ).toBe("Passed")
  })

  test("any valid mode value decodes successfully", async () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.constantFrom(...VALID_MODES), (mode) => {
        const result = decode({ mode })
        expect(result.mode).toBe(mode)
      }),
      { numRuns: 20 },
    )
  })

  test("invalid mode strings always reject", async () => {
    const invalidMode = FastCheck.string({
      minLength: 1,
      maxLength: 30,
    }).filter((s) => !VALID_MODES.includes(s as (typeof VALID_MODES)[number]))

    FastCheck.assert(
      FastCheck.property(invalidMode, (mode) => {
        expect(() => decode({ mode })).toThrow()
      }),
      { numRuns: 30 },
    )
  })

  test("non-string mode values always reject", async () => {
    const nonString = FastCheck.oneof(
      FastCheck.integer(),
      FastCheck.boolean(),
      FastCheck.constant(null),
      FastCheck.array(FastCheck.string()),
    )

    FastCheck.assert(
      FastCheck.property(nonString, (mode) => {
        expect(() => decode({ mode })).toThrow()
      }),
      { numRuns: 30 },
    )
  })
})
