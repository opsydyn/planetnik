import { describe, expect, test } from "bun:test"
import { Arbitrary, Schema } from "@effect/schema"
import { FastCheck } from "effect"
import { DependabotAlertSchema } from "../schemas/DependabotAlertSchema.js"

const decode = Schema.decodeUnknownSync(DependabotAlertSchema)
const encode = Schema.encodeSync(DependabotAlertSchema)
const alertArbitrary = Arbitrary.make(DependabotAlertSchema)

const VALID_STATES = ["open", "fixed", "dismissed", "auto_dismissed"] as const
const VALID_SEVERITIES = ["critical", "high", "medium", "low"] as const

describe("DependabotAlertSchema — properties", () => {
  test("any generated alert roundtrips through encode → decode", () => {
    FastCheck.assert(
      FastCheck.property(alertArbitrary, (alert) => {
        const encoded = encode(alert)
        const decoded = decode(encoded)
        expect(decoded.number).toBe(alert.number)
        expect(decoded.state).toBe(alert.state)
        expect(decoded.dependency.package.name).toBe(alert.dependency.package.name)
        expect(decoded.security_advisory.ghsa_id).toBe(alert.security_advisory.ghsa_id)
      }),
      { numRuns: 50 },
    )
  })

  test("state is always one of the valid literals", () => {
    FastCheck.assert(
      FastCheck.property(alertArbitrary, (alert) => {
        expect(VALID_STATES).toContain(alert.state)
      }),
      { numRuns: 50 },
    )
  })

  test("severity is always one of the valid literals", () => {
    FastCheck.assert(
      FastCheck.property(alertArbitrary, (alert) => {
        expect(VALID_SEVERITIES).toContain(alert.security_advisory.severity)
        expect(VALID_SEVERITIES).toContain(alert.security_vulnerability.severity)
      }),
      { numRuns: 50 },
    )
  })

  test("number is always a finite number", () => {
    FastCheck.assert(
      FastCheck.property(alertArbitrary, (alert) => {
        expect(Number.isFinite(alert.number)).toBe(true)
      }),
      { numRuns: 50 },
    )
  })

  test("dependency package always has ecosystem and name", () => {
    FastCheck.assert(
      FastCheck.property(alertArbitrary, (alert) => {
        expect(typeof alert.dependency.package.ecosystem).toBe("string")
        expect(typeof alert.dependency.package.name).toBe("string")
      }),
      { numRuns: 50 },
    )
  })
})
