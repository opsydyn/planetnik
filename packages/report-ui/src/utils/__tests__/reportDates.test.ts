import { describe, expect, test } from "bun:test"
import { formatReportDate, normalizeReportDate } from "../reportDates.js"

describe("normalizeReportDate", () => {
  test("normalizes Date instances and date-like strings to YYYY-MM-DD", () => {
    expect(normalizeReportDate(new Date("2026-04-18T12:34:56.000Z"))).toBe("2026-04-18")
    expect(normalizeReportDate("2026-04-19T09:10:11.000Z")).toBe("2026-04-19")
    expect(normalizeReportDate("Fri Jan 10 2025 00:00:00 GMT+0000 (Greenwich Mean Time)")).toBe("2025-01-10")
  })

  test("preserves non-date strings and blanks safely", () => {
    expect(normalizeReportDate("unknown")).toBe("unknown")
    expect(normalizeReportDate("   ")).toBe("")
    expect(normalizeReportDate(null)).toBe("")
  })
})

describe("formatReportDate", () => {
  test("returns a fallback for blank values", () => {
    expect(formatReportDate(undefined)).toBe("—")
    expect(formatReportDate("", "Unknown")).toBe("Unknown")
  })
})
