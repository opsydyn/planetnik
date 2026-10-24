import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import * as Arbitrary from "effect/Arbitrary"
import { DependabotAlertSchema } from "../schemas/DependabotAlertSchema.js"

const decode = Schema.decodeUnknownSync(DependabotAlertSchema)
const encode = Schema.encodeSync(DependabotAlertSchema)
const alertArbitrary = Arbitrary.schema(DependabotAlertSchema)

const VALID_STATES = ["open", "fixed", "dismissed", "auto_dismissed"] as const
const VALID_SEVERITIES = ["critical", "high", "medium", "low"] as const

describe("DependabotAlertSchema — properties", () => {
  test("any generated alert roundtrips through encode → decode", async () => {
    expect(
      (
        await Effect.runPromise(
          Arbitrary.checkEffect(
            alertArbitrary,
            (alert) => {
              const encoded = encode(alert)
              const decoded = decode(encoded)
              expect(decoded.number).toBe(alert.number)
              expect(decoded.state).toBe(alert.state)
              expect(decoded.dependency.package.name).toBe(alert.dependency.package.name)
              expect(decoded.security_advisory.ghsa_id).toBe(alert.security_advisory.ghsa_id)
              return true
            },
            { runs: 50 },
          ),
        )
      )._tag,
    ).toBe("Passed")
  })

  test("state is always one of the valid literals", async () => {
    expect(
      (
        await Effect.runPromise(
          Arbitrary.checkEffect(
            alertArbitrary,
            (alert) => {
              expect(VALID_STATES).toContain(alert.state)
              return true
            },
            { runs: 50 },
          ),
        )
      )._tag,
    ).toBe("Passed")
  })

  test("severity is always one of the valid literals", async () => {
    expect(
      (
        await Effect.runPromise(
          Arbitrary.checkEffect(
            alertArbitrary,
            (alert) => {
              expect(VALID_SEVERITIES).toContain(alert.security_advisory.severity)
              expect(VALID_SEVERITIES).toContain(alert.security_vulnerability.severity)
              return true
            },
            { runs: 50 },
          ),
        )
      )._tag,
    ).toBe("Passed")
  })

  test("number is always a finite number", async () => {
    expect(
      (
        await Effect.runPromise(
          Arbitrary.checkEffect(
            alertArbitrary,
            (alert) => {
              expect(Number.isFinite(alert.number)).toBe(true)
              return true
            },
            { runs: 50 },
          ),
        )
      )._tag,
    ).toBe("Passed")
  })

  test("dependency package always has ecosystem and name", async () => {
    expect(
      (
        await Effect.runPromise(
          Arbitrary.checkEffect(
            alertArbitrary,
            (alert) => {
              expect(typeof alert.dependency.package.ecosystem).toBe("string")
              expect(typeof alert.dependency.package.name).toBe("string")
              return true
            },
            { runs: 50 },
          ),
        )
      )._tag,
    ).toBe("Passed")
  })
})
