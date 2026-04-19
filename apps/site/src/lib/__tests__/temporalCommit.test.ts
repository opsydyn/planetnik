import { describe, expect, test } from "bun:test"
import { normalizeTemporalCommit } from "../temporalCommit"

describe("normalizeTemporalCommit", () => {
  test("normalizes Date instances and preserves safe fallback strings", () => {
    expect(normalizeTemporalCommit(new Date("2026-04-18T12:34:56.000Z"))).toBe("2026-04-18")
    expect(normalizeTemporalCommit("2026-04-19T09:10:11.000Z")).toBe("2026-04-19")
    expect(normalizeTemporalCommit("unknown")).toBe("unknown")
    expect(normalizeTemporalCommit(undefined)).toBe("")
  })
})
